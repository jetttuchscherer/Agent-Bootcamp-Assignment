import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type {
  CareerOpportunityReport,
  GenerateReportRequest,
} from '../src/types/report.ts';
import {
  FIXED_CANDIDATE_PROFILE,
  auditAndNormalizeReport,
  detectEthicsViolationInPrompt,
  getCalgaryDateRange,
} from './ethicsAndAuditor.ts';
import { parseUploadedDocuments } from './fileParser.ts';
import {
  collectLivePublicMarketData,
  compileReportFromLiveEvidence,
  formatEvidencePacketForPrompt,
} from './livePublicCollector.ts';
import type { LiveMarketEvidence } from './livePublicCollector.ts';
import {
  extractUrlsFromText,
  verifyAndResolveSources,
} from './urlVerifier.ts';

// Valid free-tier-compatible Gemini models (from gemini-api SKILL.md),
// ordered from highest free-tier request headroom to richest reasoning.
const MODEL_CASCADE = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
] as const;

type SupportedModel = (typeof MODEL_CASCADE)[number];

// Separate circuit-breaker cooldowns for Search-Grounded calls vs plain JSON synthesis calls
const searchModelCooldownUntil = new Map<SupportedModel, number>();
const textModelCooldownUntil = new Map<SupportedModel, number>();
let searchGroundingGlobalCooldownUntil = 0;

// Global single-flight queue: strictly 1 report pipeline executes Gemini calls at a time
let activeQueueTail: Promise<unknown> = Promise.resolve();
let lastGeminiCallCompletedAt = 0;
const MIN_CALL_SPACING_MS = 2000;

// In-flight deduplication + verified report cache
const FULL_CACHE_TTL_MS = 10 * 60 * 1000;
const QUOTA_FALLBACK_CACHE_TTL_MS = 2 * 60 * 1000;

const recentReportCache = new Map<
  string,
  { expiresAt: number; report: CareerOpportunityReport }
>();
const inFlightByKey = new Map<string, Promise<CareerOpportunityReport>>();

function enqueueSingleFlight<T>(task: () => Promise<T>): Promise<T> {
  const run = activeQueueTail.then(async () => {
    const elapsed = Date.now() - lastGeminiCallCompletedAt;
    if (lastGeminiCallCompletedAt > 0 && elapsed < MIN_CALL_SPACING_MS) {
      await new Promise((r) => setTimeout(r, MIN_CALL_SPACING_MS - elapsed));
    }
    try {
      return await task();
    } finally {
      lastGeminiCallCompletedAt = Date.now();
    }
  });
  activeQueueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function buildRequestCacheKey(
  reqBody: GenerateReportRequest,
  reportDate: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(
    JSON.stringify({
      policyVersion: 'v6-chain-of-command',
      reportDate,
      prompt: (reqBody.prompt || '').trim(),
      focusTracks: reqBody.focusTracks || [],
      cityPreference: reqBody.cityPreference || 'calgary_priority',
      files: (reqBody.uploadedFiles || []).map((f) => ({
        n: f.fileName,
        s: f.sizeBytes,
        c: f.category,
      })),
    })
  );
  return hash.digest('hex');
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaOrTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('fetch failed')
  );
}

function isDailyQuotaExhausted(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('PerDay') ||
    msg.includes('per_day') ||
    msg.includes('check your plan and billing details')
  );
}

function isFatalAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('"code":403')
  );
}

async function tryGeminiSearchGroundedPass(
  ai: GoogleGenAI,
  buildParams: (model: SupportedModel) => GenerateContentParameters,
  onQuotaNote?: (detail: string) => void
): Promise<GenerateContentResponse | null> {
  const now = Date.now();
  if (searchGroundingGlobalCooldownUntil > now) {
    return null;
  }

  const readyModels = MODEL_CASCADE.filter(
    (m) =>
      (searchModelCooldownUntil.get(m) || 0) <= now &&
      (textModelCooldownUntil.get(m) || 0) <= now
  );

  // Try at most 2 ready models with Google Search grounding before falling back to Tier 2
  const candidates = readyModels.slice(0, 2);
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    try {
      return await ai.models.generateContent(buildParams(model));
    } catch (err) {
      if (isFatalAuthError(err)) {
        throw err;
      }
      if (!isQuotaOrTransientError(err)) {
        return null;
      }

      const daily = isDailyQuotaExhausted(err);
      const cooldownMs = daily ? 12 * 60 * 1000 : 65 * 1000;
      searchModelCooldownUntil.set(model, Date.now() + cooldownMs);

      if (daily) {
        // Project-level free-tier SearchGrounding or daily bucket hit; move directly to Tier 2
        searchGroundingGlobalCooldownUntil = Date.now() + 10 * 60 * 1000;
        onQuotaNote?.(
          'Search grounding quota reached; switching to direct Canadian portal evidence synthesis...'
        );
        return null;
      }

      if (i < candidates.length - 1) {
        onQuotaNote?.(
          `Switching search pass to ${candidates[i + 1]}...`
        );
        await new Promise((r) => setTimeout(r, 900));
      }
    }
  }

  return null;
}

async function tryGeminiSynthesisWithoutSearchTool(
  ai: GoogleGenAI,
  buildParams: (model: SupportedModel) => GenerateContentParameters,
  onQuotaNote?: (detail: string) => void
): Promise<GenerateContentResponse | null> {
  const now = Date.now();
  const readyModels = MODEL_CASCADE.filter(
    (m) => (textModelCooldownUntil.get(m) || 0) <= now
  );

  for (let i = 0; i < readyModels.length; i++) {
    const model = readyModels[i];
    try {
      return await ai.models.generateContent(buildParams(model));
    } catch (err) {
      if (isFatalAuthError(err)) {
        throw err;
      }
      if (!isQuotaOrTransientError(err)) {
        return null;
      }

      const daily = isDailyQuotaExhausted(err);
      const cooldownMs = daily ? 10 * 60 * 1000 : 65 * 1000;
      textModelCooldownUntil.set(model, Date.now() + cooldownMs);

      if (i < readyModels.length - 1) {
        onQuotaNote?.(
          `Switching synthesis model to ${readyModels[i + 1]}...`
        );
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  return null;
}

function collectGroundingCandidates(
  res: GenerateContentResponse | null,
  parsedReport?: Partial<CareerOpportunityReport>,
  liveEvidence?: LiveMarketEvidence
): { url: string; title?: string }[] {
  const collected: { url: string; title?: string }[] = [];

  const chunks = res?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        collected.push({
          url: chunk.web.uri,
          title: chunk.web.title || undefined,
        });
      }
    }
  }

  if (res?.text) {
    for (const inlineUrl of extractUrlsFromText(res.text)) {
      collected.push({ url: inlineUrl });
    }
  }

  if (parsedReport) {
    for (const j of parsedReport.rankedJobs || []) {
      if (j.directUrl) collected.push({ url: j.directUrl, title: j.sourceName });
    }
    for (const j of parsedReport.adjacentRoles || []) {
      if (j.directUrl) collected.push({ url: j.directUrl, title: j.sourceName });
    }
    for (const c of parsedReport.networkingContacts || []) {
      if (c.publicProfileUrl) {
        collected.push({ url: c.publicProfileUrl, title: c.publicSourceName });
      }
    }
    for (const b of parsedReport.compensationInsights?.benchmarks || []) {
      if (b.sourceUrl) collected.push({ url: b.sourceUrl, title: b.sourceName });
    }
  }

  if (liveEvidence) {
    for (const s of liveEvidence.verifiedSources) {
      collected.push({ url: s.url, title: s.title });
    }
  }

  return collected;
}

function extractBalancedJsonObject(raw: string): string | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const start = stripped.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return stripped.slice(start, i + 1);
        }
      }
    }
  }
  return null;
}

function tryParseReportJson(rawText: string): CareerOpportunityReport | null {
  const candidate = extractBalancedJsonObject(rawText);
  if (!candidate) return null;

  try {
    return JSON.parse(candidate) as CareerOpportunityReport;
  } catch {
    const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned) as CareerOpportunityReport;
    } catch {
      return null;
    }
  }
}

export async function generateCareerOpportunityReport(
  reqBody: GenerateReportRequest,
  onProgress?: (stage: string, detail: string, percent: number) => void
): Promise<CareerOpportunityReport> {
  const { reportDate, windowStartDate } = getCalgaryDateRange(new Date());
  const cacheKey = buildRequestCacheKey(reqBody, reportDate);

  // 1. Serve immediately from verified cache (0 API calls)
  const cached = recentReportCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    onProgress?.(
      'Report verified & ready',
      `Loaded verified report ${cached.report.fileName}`,
      100
    );
    return cached.report;
  }

  // 2. Coalesce identical concurrent requests onto the existing in-flight run
  const existingInFlight = inFlightByKey.get(cacheKey);
  if (existingInFlight) {
    onProgress?.(
      'Joining active verification run',
      'Waiting for the current report generation already in progress...',
      45
    );
    return existingInFlight;
  }

  const runPromise = enqueueSingleFlight(() =>
    executeResilientReportPipeline(
      reqBody,
      reportDate,
      windowStartDate,
      cacheKey,
      onProgress
    )
  );

  inFlightByKey.set(cacheKey, runPromise);
  try {
    return await runPromise;
  } finally {
    inFlightByKey.delete(cacheKey);
  }
}

function buildReportSchemaPrompt(
  reportDate: string,
  windowStartDate: string,
  effectiveUserIntent: string,
  focusTracks: string,
  cityDirective: string,
  deterministicEthics: { triggered: boolean; reason: string },
  uploadedDocsContext: string,
  hasUploadedHistory: boolean,
  liveEvidenceText: string,
  allowAdditionalSearch: boolean
): string {
  const groundingRule = allowAdditionalSearch
    ? `You have both SERVER-VERIFIED LIVE EVIDENCE below AND Google Search access. Prioritize verified active roles (posted ${windowStartDate} to ${reportDate}), public contacts, and CAD benchmarks from both Google Search and the server-verified evidence below.`
    : `CRITICAL: Use ONLY the verified live job postings, direct URLs, posting dates, networking contacts, and ESDC CAD compensation benchmarks provided in the SERVER-VERIFIED LIVE EVIDENCE packet below (plus any uploaded user files). NEVER fabricate, guess, or invent any job, employer, URL, posting date, contact, email, or salary.`;

  return `Today is ${reportDate}. The strict 30-calendar-day active posting window is ${windowStartDate} through ${reportDate}.

USER REQUEST: "${effectiveUserIntent}"
FOCUS TRACKS: ${focusTracks}
GEOGRAPHIC PRIORITY: ${cityDirective}
ETHICS PRE-CHECK: Triggered=${deterministicEthics.triggered}. ${
    deterministicEthics.triggered
      ? deterministicEthics.reason
      : 'Never present incomplete MBA or CFA credentials as completed.'
  }

FIXED CANDIDATE PROFILE & STRICT ROLE EXCLUSIONS:
- Education: BComm in Finance
- Experience: 9 years progressive finance experience
- Graduate Study: MBA candidate (expected April 2027)
- Designation: CFA Level II candidate (expected May 2027)
- Target Total Compensation: CAD $100,000 – $200,000
- Markets: Calgary, AB (Primary) > Saskatoon, SK (Secondary)
- STRICT EXCLUSION (MANDATORY): Remove and exclude ALL accounting positions (Accountant, Senior Accountant, Accounting Manager, Director of Accounting, Controller, Comptroller, Bookkeeper, Auditor, Tax, Payroll) AND any roles requiring or preferring a CPA (Chartered Professional Accountant) designation from rankedJobs, adjacentRoles, topThreePriorities, compensationInsights, executiveSummary, weeklyActionPlan, and outreachMessages. The candidate is NOT qualified for accounting or CPA roles.

UPLOADED DOCUMENTS:
${uploadedDocsContext}

${liveEvidenceText}

INSTRUCTIONS:
${groundingRule}
Return ONLY a single valid JSON object (no markdown commentary outside JSON) matching the exact schema below:
1. "rankedJobs": Up to 10 currently ACTIVE non-accounting, non-CPA jobs in Calgary, AB (priority) and Saskatoon, SK in Corporate Banking, Corporate Finance, or M&A / Transaction Advisory originally posted between ${windowStartDate} and ${reportDate}. Exclude closed, duplicate, undated, >30-day, accounting, or CPA-required postings.
2. "adjacentRoles": 2 to 6 separated active non-accounting, non-CPA adjacent finance/commercial/credit bridge roles posted between ${windowStartDate} and ${reportDate}.
3. Equal 33.3% scoring on every role (0–100 integers): "qualificationsFitScore", "careerGrowthScore", "totalCompScore", and "compositeScore" = (fit+growth+comp)/3.
4. "compensationLabel" on every job and benchmark MUST be strictly "Published", "Estimate (<Exact Source Name>)", or "Unknown".
5. "networkingContacts": 8 to 10 REAL named professionals (first and last name — NEVER generic placeholders like "Director of Finance" or "Major Calgary Firm") in Calgary (majority) and Saskatoon verified via public directories, STRICTLY RESPECTING THE CHAIN OF COMMAND:
   - Prioritize the verified real professionals in SERVER-VERIFIED LIVE PUBLIC NETWORKING CONTACTS above (e.g., functional Directors, Senior Directors, Vice Presidents, Investment Managers, and Desk Heads at ATB Financial, KV Capital, Sequeira Partners, ARC Financial, Westcap Mgt., and Nutrien).
   - NEVER list a company CEO, President & CEO, Board Chair, COO, or Founder.
   - Target the direct functional hiring/managing layer 1–2 steps above the target role within that specific practice group (e.g., for an Associate Director or Manager of Corporate Banking at ATB Financial, list a Director, Senior Director, or Head of Corporate Banking who manages that team — NOT the CEO of the company).
   - State the chain-of-command reporting rationale explicitly in "networkingRationale". NEVER invent names, emails, or private phone numbers.
6. "compensationInsights": Sourced non-CPA CAD base, bonus, and total comp ranges for Calgary & Saskatoon.
7. "weeklyActionPlan": Steps summing to 5.5–9.5 total hours.
8. "outreachMessages": 3 personalized, sourced outreach drafts addressed to real named contacts/organizations from your verified networking contacts and top ranked jobs, stating strictly "MBA candidate (expected April 2027)" and "CFA Level II candidate (expected May 2027)".
9. "weeklyChanges": Compare against uploaded documents if provided (${hasUploadedHistory}), otherwise set mode="baseline".

REQUIRED JSON STRUCTURE:
{
  "userRequestInterpreted": "string",
  "candidateProfile": { "resumeHighlights": ["string"] },
  "ethicsAudit": {
    "triggered": ${deterministicEthics.triggered},
    "statusLabel": "string",
    "explanation": "string",
    "enforcedCredentialsStatement": "MBA candidate (expected April 2027) · CFA Level II candidate (expected May 2027)"
  },
  "executiveSummary": ["paragraph 1", "paragraph 2"],
  "verificationMethodologyNote": "string",
  "topThreePriorities": [
    {
      "priorityRank": 1,
      "headline": "Role — Org",
      "organization": "string",
      "location": "Calgary, AB",
      "category": "string",
      "compositeScore": 88.0,
      "compensationSummary": "string",
      "whyTopPriority": "string",
      "immediateNextStep": "string",
      "directUrl": "https://..."
    }
  ],
  "rankedJobs": [
    {
      "rank": 1,
      "isTopPriority": true,
      "title": "string",
      "organization": "string",
      "location": "Calgary, AB",
      "category": "Corporate Banking | Corporate Finance | M&A & Transaction Advisory",
      "postedDate": "YYYY-MM-DD",
      "daysSincePosted": 5,
      "verificationDate": "${reportDate}",
      "sourceName": "string",
      "directUrl": "https://...",
      "urlVerifiedLive": true,
      "qualificationsFitScore": 88,
      "qualificationsFitRationale": "string",
      "careerGrowthScore": 90,
      "careerGrowthRationale": "string",
      "totalCompScore": 86,
      "totalCompRationale": "string",
      "compositeScore": 88.0,
      "compensationBaseCad": "string",
      "compensationBonusCad": "string",
      "compensationTotalCad": "string",
      "compensationLabel": "Published | Estimate (Source) | Unknown",
      "roleSummary": "string",
      "strategicFitNotes": "string"
    }
  ],
  "adjacentRoles": [],
  "networkingContacts": [
    {
      "index": 1,
      "fullName": "string",
      "currentTitle": "string",
      "organization": "string",
      "location": "Calgary, AB",
      "practiceArea": "string",
      "publicSourceName": "string",
      "publicProfileUrl": "https://...",
      "verificationDate": "${reportDate}",
      "urlVerifiedLive": true,
      "networkingRationale": "string",
      "suggestedTopic": "string"
    }
  ],
  "compensationInsights": {
    "overview": "string",
    "benchmarks": [
      {
        "roleTrack": "string",
        "seniorityLevel": "string",
        "market": "Calgary, AB",
        "baseRangeCad": "string",
        "bonusRangeCad": "string",
        "totalCompRangeCad": "string",
        "compensationLabel": "Published | Estimate (Source)",
        "sourceName": "string",
        "sourceUrl": "https://...",
        "verificationDate": "${reportDate}",
        "positioningNote": "string"
      }
    ]
  },
  "weeklyActionPlan": {
    "totalHours": 7.5,
    "targetHoursBand": "5.0 – 10.0 hours/week",
    "steps": [
      {
        "stepNumber": 1,
        "priorityLevel": "Priority 1",
        "activityTitle": "string",
        "hoursAllocated": 2.0,
        "recommendedWindow": "Mon–Tue",
        "deliverable": "string",
        "targetReference": "string"
      }
    ]
  },
  "outreachMessages": [
    {
      "id": "outreach-1",
      "recipientLabel": "string",
      "channel": "string",
      "subjectLine": "string",
      "sourcedHook": "string",
      "messageBody": "string"
    }
  ],
  "weeklyChanges": {
    "mode": "${hasUploadedHistory ? 'comparison' : 'baseline'}",
    "modeLabel": "string",
    "summary": "string",
    "newOpportunities": ["string"],
    "closedOrRemovedOpportunities": ["string"],
    "scoreOrPriorityChanges": ["string"],
    "trackerUpdates": ["string"]
  },
  "tracker": []
}`;
}

async function executeResilientReportPipeline(
  reqBody: GenerateReportRequest,
  reportDate: string,
  windowStartDate: string,
  cacheKey: string,
  onProgress?: (stage: string, detail: string, percent: number) => void
): Promise<CareerOpportunityReport> {
  const ai = createGeminiClient();

  const rawPrompt = (reqBody.prompt || '').trim();
  const effectiveUserIntent =
    rawPrompt ||
    'Produce this week’s comprehensive finance opportunity report prioritizing Calgary over Saskatoon across corporate banking, corporate finance, and M&A / transaction advisory.';

  onProgress?.(
    'Auditing mandate & live Canadian portals',
    `Opening verified public listings (${windowStartDate} to ${reportDate}), ESDC CAD wage tables, and uploaded files`,
    18
  );

  const deterministicEthics = detectEthicsViolationInPrompt(rawPrompt);
  const [parsedUploads, liveEvidence] = await Promise.all([
    parseUploadedDocuments(reqBody.uploadedFiles || []),
    collectLivePublicMarketData(reportDate, windowStartDate),
  ]);

  const hasUploadedHistory =
    parsedUploads.hasPriorReport || parsedUploads.hasTracker;

  const focusTracks =
    reqBody.focusTracks && reqBody.focusTracks.length > 0
      ? reqBody.focusTracks.join(', ')
      : FIXED_CANDIDATE_PROFILE.targetTracks.join(', ');

  const cityDirective =
    reqBody.cityPreference === 'calgary_only'
      ? 'Focus primarily on Calgary, AB (include Saskatoon, SK only if an exceptional match appears).'
      : reqBody.cityPreference === 'both_equal'
        ? 'Evaluate Calgary, AB and Saskatoon, SK with balanced attention while breaking ties in favor of Calgary.'
        : 'Prioritize Calgary, AB over Saskatoon, SK (aim for ~75% Calgary and ~25% Saskatoon where active verified roles exist).';

  const uploadedDocsContext =
    parsedUploads.extractedTextBlocks.length > 0
      ? parsedUploads.extractedTextBlocks
          .map(
            (doc) =>
              `=== UPLOADED FILE: ${doc.fileName} (Category: ${doc.category}) ===\n${doc.content.slice(
                0,
                14000
              )}`
          )
          .join('\n\n')
      : 'None uploaded (designate this report as Baseline Week).';

  const liveEvidenceText = formatEvidencePacketForPrompt(liveEvidence);
  const deterministicBaseline = compileReportFromLiveEvidence(
    liveEvidence,
    reqBody,
    parsedUploads,
    deterministicEthics
  );

  let parsedReport: CareerOpportunityReport | null = null;
  let geminiResponse: GenerateContentResponse | null = null;
  let usedQuotaContinuityFallback = false;

  if (ai) {
    // TIER 1: Single-pass Gemini + Google Search Grounding + Live Portal Evidence
    onProgress?.(
      'Synthesizing grounded intelligence',
      'Scoring Calgary & Saskatoon roles (33.3% Fit / Growth / Comp) and verifying sources',
      45
    );

    const searchPrompt = buildReportSchemaPrompt(
      reportDate,
      windowStartDate,
      effectiveUserIntent,
      focusTracks,
      cityDirective,
      deterministicEthics,
      uploadedDocsContext,
      hasUploadedHistory,
      liveEvidenceText,
      true
    );

    geminiResponse = await tryGeminiSearchGroundedPass(
      ai,
      (model) => ({
        model,
        contents: {
          parts: [...parsedUploads.inlinePdfParts, { text: searchPrompt }],
        },
        config: {
          tools: [{ googleSearch: {} }],
          ...(model === 'gemini-3.8-flash'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      }),
      (note) => onProgress?.('Optimizing API quota path', note, 52)
    );

    if (geminiResponse?.text) {
      parsedReport = tryParseReportJson(geminiResponse.text);
    }

    // TIER 2: Single-pass Gemini JSON synthesis WITHOUT googleSearch tool (uses 0 SearchGrounding quota)
    if (!parsedReport) {
      onProgress?.(
        'Synthesizing from verified public portals',
        'Structuring live Job Bank postings, ESDC CAD benchmarks, and corporate directories',
        62
      );

      const evidenceOnlyPrompt = buildReportSchemaPrompt(
        reportDate,
        windowStartDate,
        effectiveUserIntent,
        focusTracks,
        cityDirective,
        deterministicEthics,
        uploadedDocsContext,
        hasUploadedHistory,
        liveEvidenceText,
        false
      );

      const synthesisResponse = await tryGeminiSynthesisWithoutSearchTool(
        ai,
        (model) => ({
          model,
          contents: {
            parts: [
              ...parsedUploads.inlinePdfParts,
              { text: evidenceOnlyPrompt },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            ...(model === 'gemini-3.8-flash'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        (note) => onProgress?.('Optimizing API model selection', note, 68)
      );

      if (synthesisResponse?.text) {
        geminiResponse = synthesisResponse;
        parsedReport = tryParseReportJson(synthesisResponse.text);
      }
    }
  }

  // TIER 3: Zero-crash live-evidence deterministic compiler if free-tier Gemini daily quota is completely exhausted
  if (!parsedReport) {
    if (
      deterministicBaseline.rankedJobs.length === 0 &&
      deterministicBaseline.adjacentRoles.length === 0
    ) {
      throw new Error(
        'Gemini API quota reached (429) and live Canadian public job portals returned no reachable listings.'
      );
    }

    usedQuotaContinuityFallback = true;
    onProgress?.(
      'Compiling verified live Canadian portal evidence',
      'Free-tier Gemini quota is temporarily capped; scoring live-opened Job Bank & ESDC records directly',
      74
    );
    parsedReport = {
      ...deterministicBaseline,
      verificationMethodologyNote: `${deterministicBaseline.verificationMethodologyNote} (Note: Free-tier Gemini quota was at capacity during this run, so rankings, equal 33.3% scores, and outreach drafts were compiled directly from live HTTP-verified Canadian public portals without fabricated entries.)`,
    };
  } else {
    // Verify URLs on Gemini-generated reports and backfill with live HTTP-verified records if dead links were pruned
    onProgress?.(
      'Verifying public links & HTTP status',
      'Checking HTTP status codes (max 5 concurrent) and pruning any closed or 404 postings',
      80
    );

    const preVerifiedUrls = new Set(
      liveEvidence.verifiedSources.map((s) => s.url.trim())
    );
    const rawUrlCandidates = collectGroundingCandidates(
      geminiResponse,
      parsedReport
    ).filter((c) => !preVerifiedUrls.has(c.url.trim()));

    const {
      verified: newlyVerifiedSources,
      deadUrls,
      redirectMap,
    } = await verifyAndResolveSources(rawUrlCandidates, reportDate);

    const verifiedSources = [
      ...liveEvidence.verifiedSources.map((s) => ({
        title: s.title,
        resolvedUrl: s.url,
        verifiedLive: true,
      })),
      ...newlyVerifiedSources,
    ];

    const resolveUrl = (u: string) => redirectMap.get(u) || u;

    parsedReport.rankedJobs = (parsedReport.rankedJobs || [])
      .filter(
        (j) =>
          !deadUrls.has(j.directUrl) && !deadUrls.has(resolveUrl(j.directUrl))
      )
      .map((j) => {
        const resolved = resolveUrl(j.directUrl);
        return {
          ...j,
          directUrl: resolved,
          urlVerifiedLive: verifiedSources.some(
            (s) => s.resolvedUrl === resolved && s.verifiedLive
          ),
        };
      });

    parsedReport.adjacentRoles = (parsedReport.adjacentRoles || [])
      .filter(
        (j) =>
          !deadUrls.has(j.directUrl) && !deadUrls.has(resolveUrl(j.directUrl))
      )
      .map((j) => {
        const resolved = resolveUrl(j.directUrl);
        return {
          ...j,
          directUrl: resolved,
          urlVerifiedLive: verifiedSources.some(
            (s) => s.resolvedUrl === resolved && s.verifiedLive
          ),
        };
      });

    parsedReport.networkingContacts = (parsedReport.networkingContacts || [])
      .filter(
        (c) =>
          !deadUrls.has(c.publicProfileUrl) &&
          !deadUrls.has(resolveUrl(c.publicProfileUrl))
      )
      .map((c) => {
        const resolved = resolveUrl(c.publicProfileUrl);
        return {
          ...c,
          publicProfileUrl: resolved,
          urlVerifiedLive: verifiedSources.some(
            (s) => s.resolvedUrl === resolved && s.verifiedLive
          ),
        };
      });

    // Supplement with live-verified Job Bank / ESDC / Corporate records if URL pruning thinned any section
    if (parsedReport.rankedJobs.length < 4) {
      parsedReport.rankedJobs = [
        ...parsedReport.rankedJobs,
        ...deterministicBaseline.rankedJobs,
      ];
    }
    if (parsedReport.adjacentRoles.length < 2) {
      parsedReport.adjacentRoles = [
        ...parsedReport.adjacentRoles,
        ...deterministicBaseline.adjacentRoles,
      ];
    }
    if (parsedReport.networkingContacts.length < 8) {
      parsedReport.networkingContacts = [
        ...parsedReport.networkingContacts,
        ...deterministicBaseline.networkingContacts,
      ];
    }
    if (
      !parsedReport.compensationInsights?.benchmarks ||
      parsedReport.compensationInsights.benchmarks.length < 3
    ) {
      parsedReport.compensationInsights = {
        overview:
          parsedReport.compensationInsights?.overview ||
          deterministicBaseline.compensationInsights.overview,
        benchmarks: [
          ...(parsedReport.compensationInsights?.benchmarks || []),
          ...deterministicBaseline.compensationInsights.benchmarks,
        ],
      };
    } else {
      for (const b of parsedReport.compensationInsights.benchmarks) {
        b.sourceUrl = resolveUrl(b.sourceUrl);
      }
    }

    parsedReport.groundingSources = verifiedSources.slice(0, 22).map((s) => ({
      title: s.title,
      url: s.resolvedUrl,
    }));
  }

  onProgress?.(
    'Auditing scores & ethics rules',
    'Verifying 33.3% equal weights, 30-day posting window, and credential compliance',
    92
  );

  let auditedReport = auditAndNormalizeReport(
    parsedReport,
    reportDate,
    windowStartDate,
    deterministicEthics,
    hasUploadedHistory
  );

  // If auditing pruned placeholder/invalid entries below target thresholds, backfill with live-verified portal records and re-normalize
  if (
    auditedReport.rankedJobs.length < 4 ||
    auditedReport.adjacentRoles.length < 2 ||
    auditedReport.networkingContacts.length < 8 ||
    auditedReport.outreachMessages.length < 3 ||
    auditedReport.compensationInsights.benchmarks.length < 3
  ) {
    auditedReport = auditAndNormalizeReport(
      {
        ...auditedReport,
        rankedJobs: [
          ...auditedReport.rankedJobs,
          ...deterministicBaseline.rankedJobs,
        ],
        adjacentRoles: [
          ...auditedReport.adjacentRoles,
          ...deterministicBaseline.adjacentRoles,
        ],
        networkingContacts: [
          ...auditedReport.networkingContacts,
          ...deterministicBaseline.networkingContacts,
        ],
        outreachMessages:
          auditedReport.outreachMessages.length >= 3
            ? auditedReport.outreachMessages
            : [
                ...auditedReport.outreachMessages,
                ...deterministicBaseline.outreachMessages,
              ].slice(0, 3),
        compensationInsights: {
          overview:
            auditedReport.compensationInsights.overview ||
            deterministicBaseline.compensationInsights.overview,
          benchmarks: [
            ...auditedReport.compensationInsights.benchmarks,
            ...deterministicBaseline.compensationInsights.benchmarks,
          ],
        },
      },
      reportDate,
      windowStartDate,
      deterministicEthics,
      hasUploadedHistory
    );
  }

  recentReportCache.set(cacheKey, {
    expiresAt:
      Date.now() +
      (usedQuotaContinuityFallback
        ? QUOTA_FALLBACK_CACHE_TTL_MS
        : FULL_CACHE_TTL_MS),
    report: auditedReport,
  });

  onProgress?.(
    'Report verified & ready',
    `Compiled ${auditedReport.fileName}`,
    100
  );

  return auditedReport;
}
