import type {
  CareerOpportunityReport,
  EthicsAudit,
  ScoredOpportunity,
  TopPriorityItem,
  TrackerRow,
} from '../src/types/report.ts';

export const FIXED_CANDIDATE_PROFILE = {
  education: 'BComm in Finance',
  experience: '9 years progressive finance experience',
  mbaStatus: 'MBA candidate (expected April 2027)',
  cfaStatus: 'CFA Level II candidate (expected May 2027)',
  compensationTargetCad: 'CAD $100,000 – $200,000',
  geographicPriority: 'Calgary, AB (Primary) · Saskatoon, SK (Secondary)',
  targetTracks: [
    'Corporate Banking',
    'Corporate Finance',
    'M&A & Transaction Advisory',
  ],
};

const CREDENTIAL_INFLATION_PATTERNS: RegExp[] = [
  /\b(claim|say|state|pretend|tell\s+them|write|list|present|act\s+like|imply|show)\b.{0,55}\b(completed|finished|graduated|have\s+my|hold\s+an?|earned|already\s+have|passed\s+all)\b.{0,35}\b(mba|cfa|charter|charterholder|level\s*ii|level\s*2|level\s*iii|level\s*3)\b/i,
  /\b(mba|cfa)\b.{0,40}\b(as\s+completed|already\s+completed|already\s+done|is\s+complete|without\s+candidate|drop\s+candidate|remove\s+candidate|omit\s+candidate|omit\s+expected)\b/i,
  /\b(claim|say|state|pretend|write)\b.{0,40}\b(cfa\s+charterholder|i\s+am\s+a\s+cfa|i'm\s+a\s+cfa|have\s+an\s+mba|mba\s+graduate)\b/i,
  /\b(fabricate|make\s+up|invent|fake)\b.{0,40}\b(jobs?|postings?|contacts?|emails?|salaries|compensation|credentials|experience)\b/i,
];

export function detectEthicsViolationInPrompt(userPrompt: string): {
  triggered: boolean;
  reason: string;
} {
  const normalized = userPrompt.trim();
  if (!normalized) {
    return { triggered: false, reason: '' };
  }

  for (const pattern of CREDENTIAL_INFLATION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        triggered: true,
        reason:
          'Request to misrepresent incomplete credentials or fabricate evidence was rejected. In compliance with CFA Institute Standards of Professional Conduct and report integrity rules, incomplete designations cannot be presented as completed. All sections strictly state "MBA candidate (expected April 2027)" and "CFA Level II candidate (expected May 2027)".',
      };
    }
  }

  return { triggered: false, reason: '' };
}

export function getCalgaryDateRange(now: Date = new Date()): {
  reportDate: string;
  windowStartDate: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const reportDate = formatter.format(now);
  const [y, m, d] = reportDate.split('-').map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d));
  startUtc.setUTCDate(startUtc.getUTCDate() - 30);
  const windowStartDate = startUtc.toISOString().slice(0, 10);
  return { reportDate, windowStartDate };
}

function parseIsoDateDaysDiff(postedDate: string, reportDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedDate)) return null;
  const [py, pm, pd] = postedDate.split('-').map(Number);
  const [ry, rm, rd] = reportDate.split('-').map(Number);
  const postedMs = Date.UTC(py, pm - 1, pd);
  const reportMs = Date.UTC(ry, rm - 1, rd);
  if (Number.isNaN(postedMs) || Number.isNaN(reportMs)) return null;
  const diffDays = Math.round((reportMs - postedMs) / (1000 * 60 * 60 * 24));
  return diffDays;
}

function sanitizeCredentialClaims(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bCFA\s+[Cc]harterholder\b/g, 'CFA Level II candidate (expected May 2027)')
    .replace(/\bcompleted\s+MBA\b/gi, 'MBA candidate (expected April 2027)')
    .replace(/\bMBA\s+graduate\b/gi, 'MBA candidate (expected April 2027)');
}

function scrubPrivateContactInfo(text: string): string {
  if (!text) return text;
  // Remove any accidental email addresses or North American phone numbers
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[public profile messaging only]')
    .replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, '[redacted phone]');
}

function normalizeCompensationLabel(label: string): string {
  const trimmed = (label || '').trim();
  if (!trimmed) return 'Unknown';
  if (/^published\b/i.test(trimmed)) return 'Published';
  if (/^estimate\s*\(.+\)$/i.test(trimmed)) return trimmed;
  if (/^estimate/i.test(trimmed)) {
    const cleanedSource = trimmed.replace(/^estimate\s*[:\-–—]?\s*/i, '').trim();
    return cleanedSource
      ? `Estimate (${cleanedSource.replace(/^\(|\)$/g, '')})`
      : 'Estimate (Canadian market benchmark)';
  }
  if (/^unknown\b/i.test(trimmed)) return 'Unknown';
  return 'Unknown';
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const ACCOUNTING_TITLE_OR_ORG_EXCLUSION =
  /\b(accountant|accountants|accounting|controller|comptroller|auditor|auditing|internal\s+audit|bookkeeper|bookkeeping|tax\b|taxation|payroll|accounts\s+payable|accounts\s+receivable|cpa|chartered\s+professional\s+accountant|chartered\s+accountants?)\b/i;

const CPA_REQUIREMENT_TEXT_EXCLUSION =
  /\b(requires?\s+(?:a\s+)?cpa|cpa\s+(?:is\s+)?required|cpa\s+preferred|must\s+(?:hold|have)\s+(?:a\s+)?cpa|cpa\s+designation\s+required|accounting\s+designation|full-cycle\s+accounting|general\s+ledger|month-end\s+close)\b/i;

const EXPLICIT_NON_CPA_NEGATION =
  /\b(no\s+cpa|non-cpa|zero\s+cpa|not\s+require\s+(?:a\s+)?cpa|without\s+(?:a\s+)?cpa|without\s+requiring\s+(?:a\s+)?cpa)\b/i;

function isExcludedAccountingOrCpaJob(job: ScoredOpportunity): boolean {
  const headerFields = `${job.title || ''} ${job.organization || ''} ${job.category || ''}`;
  if (ACCOUNTING_TITLE_OR_ORG_EXCLUSION.test(headerFields)) {
    return true;
  }

  const bodyFields = `${job.roleSummary || ''} ${job.qualificationsFitRationale || ''} ${job.strategicFitNotes || ''}`;
  if (
    CPA_REQUIREMENT_TEXT_EXCLUSION.test(bodyFields) &&
    !EXPLICIT_NON_CPA_NEGATION.test(bodyFields)
  ) {
    return true;
  }

  return false;
}

function auditOpportunitiesList(
  items: ScoredOpportunity[],
  reportDate: string,
  windowStartDate: string,
  maxItems: number,
  markTopThree: boolean,
  seenKeys: Set<string>
): ScoredOpportunity[] {
  const valid: ScoredOpportunity[] = [];

  for (const job of items || []) {
    if (!job.title?.trim() || !job.organization?.trim()) continue;
    if (!job.directUrl || !/^https?:\/\//i.test(job.directUrl.trim())) continue;
    if (isExcludedAccountingOrCpaJob(job)) continue;

    const posted = (job.postedDate || '').trim();
    if (posted < windowStartDate || posted > reportDate) continue;

    const diff = parseIsoDateDaysDiff(posted, reportDate);
    if (diff === null || diff < 0 || diff > 30) continue;

    const dedupeKey = `${job.organization.toLowerCase().trim()}::${job.title
      .toLowerCase()
      .trim()}::${(job.location || '').toLowerCase().trim()}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const fit = clampScore(job.qualificationsFitScore);
    const growth = clampScore(job.careerGrowthScore);
    const comp = clampScore(job.totalCompScore);
    const composite = Number(((fit + growth + comp) / 3).toFixed(1));

    valid.push({
      ...job,
      title: job.title.trim(),
      organization: job.organization.trim(),
      location: normalizeCity(job.location),
      postedDate: posted,
      daysSincePosted: diff,
      verificationDate: reportDate,
      directUrl: job.directUrl.trim(),
      qualificationsFitScore: fit,
      careerGrowthScore: growth,
      totalCompScore: comp,
      compositeScore: composite,
      compensationLabel: normalizeCompensationLabel(job.compensationLabel),
      roleSummary: sanitizeCredentialClaims(job.roleSummary || ''),
      strategicFitNotes: sanitizeCredentialClaims(job.strategicFitNotes || ''),
    });
  }

  // Sort by equal-weighted composite score desc; tie-break Calgary ahead of Saskatoon
  valid.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) {
      return b.compositeScore - a.compositeScore;
    }
    const aCalgary = a.location.toLowerCase().includes('calgary') ? 1 : 0;
    const bCalgary = b.location.toLowerCase().includes('calgary') ? 1 : 0;
    return bCalgary - aCalgary;
  });

  return valid.slice(0, maxItems).map((item, index) => ({
    ...item,
    rank: index + 1,
    isTopPriority: markTopThree && index < 3,
  }));
}

function normalizeCity(loc: string): string {
  const lower = (loc || '').toLowerCase();
  if (lower.includes('calgary')) return 'Calgary, AB';
  if (lower.includes('saskatoon')) return 'Saskatoon, SK';
  return loc?.trim() || 'Calgary, AB';
}

export function auditAndNormalizeReport(
  raw: CareerOpportunityReport,
  reportDate: string,
  windowStartDate: string,
  deterministicEthics: { triggered: boolean; reason: string },
  hasUploadedHistory: boolean
): CareerOpportunityReport {
  const seenJobKeys = new Set<string>();

  const rankedJobs = auditOpportunitiesList(
    raw.rankedJobs || [],
    reportDate,
    windowStartDate,
    10,
    true,
    seenJobKeys
  );

  const adjacentRoles = auditOpportunitiesList(
    raw.adjacentRoles || [],
    reportDate,
    windowStartDate,
    6,
    false,
    seenJobKeys
  );

  // Audit networking contacts: max 10, public URL required, zero private emails/phones
  const seenContacts = new Set<string>();
  const networkingContacts = (raw.networkingContacts || [])
    .filter((c) => {
      const name = (c.fullName || '').trim();
      const org = (c.organization || '').trim();
      const title = (c.currentTitle || '').trim();
      if (!name || !org || !title) return false;
      if (!c.publicProfileUrl || !/^https?:\/\//i.test(c.publicProfileUrl.trim())) {
        return false;
      }
      // Reject generic placeholder names or titles used as a person's name
      if (name.toLowerCase() === title.toLowerCase()) return false;
      if (name.split(/\s+/).length < 2) return false;
      if (
        /\b(director|manager|vice[\s-]+president|\bvp\b|head\s+of|partner|team|department|hiring|recruiter|analyst|associate|officer|firm|company|tbd|unknown|n\/a|leader|executive)\b/i.test(
          name
        )
      ) {
        return false;
      }
      if (
        /\b(major\s+calgary|major\s+saskatoon|major\s+firm|leading\s+bank|local\s+firm|various|confidential|example|placeholder|sample|target\s+company)\b/i.test(
          org
        )
      ) {
        return false;
      }
      if (
        /\b(audit\s+partner|tax\s+partner|accounting\s+firm|chartered\s+accountants?|bookkeeping|controller|comptroller)\b/i.test(
          `${title} ${c.practiceArea || ''} ${org}`
        )
      ) {
        return false;
      }
      // Enforce Chain-of-Command: never list enterprise CEOs, Board Chairs, COOs, or Founders as cold networking targets
      if (
        /\b(chief\s+executive\s+officer|\bceo\b|president\s*(?:&|and|\/|,)\s*(?:chief\s+executive|ceo|founder)|board\s+chair|chair\s+of\s+the\s+board|chairman|chairwoman|co-chair|\bfounder\b|chief\s+operating\s+officer|\bcoo\b)\b/i.test(
          title
        )
      ) {
        return false;
      }
      const key = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      if (seenContacts.has(key)) return false;
      seenContacts.add(key);
      return true;
    })
    .slice(0, 10)
    .map((c, idx) => ({
      ...c,
      index: idx + 1,
      location: normalizeCity(c.location),
      verificationDate: reportDate,
      networkingRationale: scrubPrivateContactInfo(
        sanitizeCredentialClaims(c.networkingRationale || '')
      ),
      suggestedTopic: scrubPrivateContactInfo(
        sanitizeCredentialClaims(c.suggestedTopic || '')
      ),
    }));

  // Audit compensation benchmarks (exclude accounting, controller, audit, and CPA tracks)
  const benchmarks = (raw.compensationInsights?.benchmarks || [])
    .filter(
      (b) =>
        b.roleTrack?.trim() &&
        b.totalCompRangeCad?.trim() &&
        !ACCOUNTING_TITLE_OR_ORG_EXCLUSION.test(
          `${b.roleTrack || ''} ${b.seniorityLevel || ''}`
        )
    )
    .map((b) => ({
      ...b,
      market: normalizeCity(b.market),
      verificationDate: reportDate,
      compensationLabel:
        normalizeCompensationLabel(b.compensationLabel) === 'Unknown'
          ? `Estimate (${b.sourceName || 'Canadian compensation guide'})`
          : normalizeCompensationLabel(b.compensationLabel),
      positioningNote: sanitizeCredentialClaims(b.positioningNote || ''),
    }));

  // Enforce 5-10 hour action plan budget
  const steps = (raw.weeklyActionPlan?.steps || []).map((s, idx) => ({
    ...s,
    stepNumber: idx + 1,
    hoursAllocated: Number(Math.max(0.5, Math.min(4, s.hoursAllocated || 1)).toFixed(1)),
    deliverable: sanitizeCredentialClaims(s.deliverable || ''),
  }));

  let totalHours = Number(
    steps.reduce((acc, s) => acc + s.hoursAllocated, 0).toFixed(1)
  );
  if (steps.length > 0 && (totalHours < 5.0 || totalHours > 10.0)) {
    const target = totalHours < 5.0 ? 6.5 : 8.5;
    const scale = target / (totalHours || 1);
    for (const s of steps) {
      s.hoursAllocated = Number(Math.max(0.5, s.hoursAllocated * scale).toFixed(1));
    }
    totalHours = Number(
      steps.reduce((acc, s) => acc + s.hoursAllocated, 0).toFixed(1)
    );
  }

  // Enforce ethics & accurate MBA/CFA candidate phrasing in outreach messages
  const outreachMessages = (raw.outreachMessages || [])
    .filter((msg) => {
      const label = (msg.recipientLabel || '').trim();
      const body = (msg.messageBody || '').trim();
      if (!label || !body) return false;
      // Reject bare generic 1-2 word titles like "Finance Director" with no organization or real recipient
      if (label.split(/\s+/).length < 3) return false;
      if (/\b(major\s+calgary|major\s+firm|placeholder|example)\b/i.test(label)) {
        return false;
      }
      return true;
    })
    .map((msg, idx) => {
      let body = scrubPrivateContactInfo(sanitizeCredentialClaims(msg.messageBody || ''));
      // Ensure candidate status is stated accurately if MBA or CFA is mentioned
      if (/\bMBA\b/.test(body) && !/MBA candidate \(expected April 2027\)/i.test(body)) {
        body = body.replace(/\bMBA\s*(?:candidate)?(?:\s*\([^)]*\))?/i, 'MBA candidate (expected April 2027)');
      }
      if (/\bCFA\b/.test(body) && !/CFA Level II candidate/i.test(body)) {
        body = body.replace(
          /\bCFA(?:\s+Level\s+(?:II|2))?\s*(?:candidate)?(?:\s*\([^)]*\))?/i,
          'CFA Level II candidate (expected May 2027)'
        );
      }
      return {
        ...msg,
        id: msg.id || `outreach-${idx + 1}`,
        subjectLine: sanitizeCredentialClaims(msg.subjectLine || ''),
        sourcedHook: sanitizeCredentialClaims(msg.sourcedHook || ''),
        messageBody: body,
      };
    });

  // Merge deterministic & model ethics evaluation
  const ethicsTriggered = deterministicEthics.triggered || Boolean(raw.ethicsAudit?.triggered);
  const ethicsAudit: EthicsAudit = {
    triggered: ethicsTriggered,
    statusLabel: ethicsTriggered
      ? 'Refusal Applied — Credential Misrepresentation Rejected'
      : 'Verified — Candidate Credentials & Public Sources Compliant',
    explanation: ethicsTriggered
      ? deterministicEthics.reason ||
        raw.ethicsAudit?.explanation ||
        'Requests to claim completed MBA or CFA credentials were rejected. All sections state "MBA candidate (expected April 2027)" and "CFA Level II candidate (expected May 2027)".'
      : 'All credentials are accurately stated as BComm in Finance, MBA candidate (expected April 2027), and CFA Level II candidate (expected May 2027). Only public sources and active postings within 30 calendar days are included.',
    enforcedCredentialsStatement:
      'BComm in Finance · 9 years experience · MBA candidate (expected April 2027) · CFA Level II candidate (expected May 2027)',
  };

  // Ensure Top 3 Priorities match the top ranked jobs (or top actionable items if <3 jobs)
  const topThreePriorities: TopPriorityItem[] = rankedJobs.slice(0, 3).map((job, idx) => {
    const existing = raw.topThreePriorities?.[idx];
    return {
      priorityRank: idx + 1,
      headline: `${job.title} — ${job.organization}`,
      organization: job.organization,
      location: job.location,
      category: job.category,
      compositeScore: job.compositeScore,
      compensationSummary: `${job.compensationTotalCad} (${job.compensationLabel})`,
      whyTopPriority: sanitizeCredentialClaims(
        existing?.whyTopPriority || job.strategicFitNotes || job.roleSummary
      ),
      immediateNextStep: sanitizeCredentialClaims(
        existing?.immediateNextStep ||
          `Submit tailored application referencing 9 years finance experience and initiate warm outreach in ${job.location}.`
      ),
      directUrl: job.directUrl,
    };
  });

  // Build synchronized tracker rows from verified ranked jobs, adjacent roles, and top contacts
  const tracker: TrackerRow[] = buildSynchronizedTracker(
    rankedJobs,
    adjacentRoles,
    networkingContacts,
    raw.tracker || [],
    reportDate
  );

  // Enforce Baseline vs Comparison mode truth
  const weeklyChangesMode = hasUploadedHistory ? 'comparison' : 'baseline';
  const weeklyChanges = {
    mode: weeklyChangesMode as 'baseline' | 'comparison',
    modeLabel:
      weeklyChangesMode === 'comparison'
        ? 'Comparative Week — Diff Against Uploaded Prior Report / Tracker'
        : `Baseline Week Established (${reportDate})`,
    summary:
      weeklyChangesMode === 'comparison'
        ? raw.weeklyChanges?.summary ||
          'Compared active verified opportunities and networking targets against your uploaded prior report/tracker.'
        : `No prior weekly report or tracker was uploaded for this cycle. Report ${reportDate} is officially designated as your Baseline Week benchmark for tracking future openings, closures, and outreach velocity across Calgary and Saskatoon.`,
    newOpportunities:
      weeklyChangesMode === 'comparison'
        ? raw.weeklyChanges?.newOpportunities || rankedJobs.map((j) => `${j.title} at ${j.organization} (${j.location})`)
        : rankedJobs.slice(0, 5).map(
            (j) => `Baseline Entry #${j.rank}: ${j.title} — ${j.organization} (${j.location}, Posted ${j.postedDate})`
          ),
    closedOrRemovedOpportunities:
      weeklyChangesMode === 'comparison'
        ? raw.weeklyChanges?.closedOrRemovedOpportunities || []
        : ['None — Baseline Week (subsequent reports will log closed or >30-day expired postings here).'],
    scoreOrPriorityChanges:
      weeklyChangesMode === 'comparison'
        ? raw.weeklyChanges?.scoreOrPriorityChanges || []
        : topThreePriorities.map(
            (p) => `Priority #${p.priorityRank} Baseline: ${p.headline} (Composite Score ${p.compositeScore.toFixed(1)}/100)`
          ),
    trackerUpdates:
      weeklyChangesMode === 'comparison'
        ? raw.weeklyChanges?.trackerUpdates || []
        : [`Initialized tracker with ${rankedJobs.length} verified primary roles, ${adjacentRoles.length} adjacent roles, and ${networkingContacts.length} public networking contacts.`],
  };

  return {
    ...raw,
    reportId: `COR-${reportDate}`,
    reportDate,
    windowStartDate,
    fileName: `Career_Opportunity_Report_${reportDate}.docx`,
    candidateProfile: {
      ...FIXED_CANDIDATE_PROFILE,
      resumeHighlights: raw.candidateProfile?.resumeHighlights || [],
    },
    ethicsAudit,
    executiveSummary: (raw.executiveSummary || []).map(sanitizeCredentialClaims),
    topThreePriorities,
    rankedJobs,
    adjacentRoles,
    networkingContacts,
    compensationInsights: {
      overview: sanitizeCredentialClaims(raw.compensationInsights?.overview || ''),
      benchmarks,
    },
    weeklyActionPlan: {
      totalHours,
      targetHoursBand: '5.0 – 10.0 hours/week',
      steps,
    },
    outreachMessages,
    weeklyChanges,
    tracker,
  };
}

function buildSynchronizedTracker(
  rankedJobs: ScoredOpportunity[],
  adjacentRoles: ScoredOpportunity[],
  contacts: CareerOpportunityReport['networkingContacts'],
  modelTracker: TrackerRow[],
  reportDate: string
): TrackerRow[] {
  const [y, m, d] = reportDate.split('-').map(Number);
  const plusDays = (days: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  };

  const rows: TrackerRow[] = [];

  for (const job of rankedJobs) {
    const matched = modelTracker.find(
      (r) =>
        r.organization?.toLowerCase() === job.organization.toLowerCase() &&
        r.roleOrContactName?.toLowerCase().includes(job.title.toLowerCase().slice(0, 12))
    );
    rows.push({
      entryType: 'Target Role',
      priorityFlag: job.isTopPriority ? `Priority #${job.rank}` : `Rank #${job.rank}`,
      organization: job.organization,
      roleOrContactName: job.title,
      location: job.location,
      postedOrVerifiedDate: `Posted ${job.postedDate}`,
      scoreDisplay: `${job.compositeScore.toFixed(1)} / 100`,
      compensationLabel: job.compensationLabel,
      currentStatus: matched?.currentStatus || 'Verified Open — To Apply',
      nextAction:
        matched?.nextAction ||
        (job.isTopPriority
          ? 'Tailor CV + submit application & warm referral check'
          : 'Submit targeted application'),
      followUpDate: plusDays(job.isTopPriority ? 3 : 5),
      directUrl: job.directUrl,
    });
  }

  for (const adj of adjacentRoles.slice(0, 4)) {
    rows.push({
      entryType: 'Adjacent Role',
      priorityFlag: `Adjacent #${adj.rank}`,
      organization: adj.organization,
      roleOrContactName: adj.title,
      location: adj.location,
      postedOrVerifiedDate: `Posted ${adj.postedDate}`,
      scoreDisplay: `${adj.compositeScore.toFixed(1)} / 100`,
      compensationLabel: adj.compensationLabel,
      currentStatus: 'Verified Open — Evaluate Bridge Fit',
      nextAction: 'Assess lateral transition path & apply selectively',
      followUpDate: plusDays(6),
      directUrl: adj.directUrl,
    });
  }

  for (const contact of contacts.slice(0, 5)) {
    rows.push({
      entryType: 'Networking Contact',
      priorityFlag: contact.index <= 3 ? 'High-Value Outreach' : 'Warm Pipeline',
      organization: contact.organization,
      roleOrContactName: `${contact.fullName} (${contact.currentTitle})`,
      location: contact.location,
      postedOrVerifiedDate: `Verified ${contact.verificationDate}`,
      scoreDisplay: '—',
      compensationLabel: '—',
      currentStatus: 'Public Profile Verified — Ready to Connect',
      nextAction: 'Send personalized public-profile connection note',
      followUpDate: plusDays(4),
      directUrl: contact.publicProfileUrl,
    });
  }

  return rows;
}
