export interface VerifiedSourceRecord {
  id: string;
  originalUrl: string;
  resolvedUrl: string;
  title: string;
  httpStatus: number;
  verifiedLive: boolean;
  isClosedOrDead: boolean;
  pageTitleSnippet: string;
  verificationDate: string;
}

const CLOSED_INDICATORS = [
  'job is no longer available',
  'this job has expired',
  'no longer accepting applications',
  'position has been filled',
  'this job posting is closed',
  'requisition is no longer active',
  'sorry, the job you are looking for is no longer open',
  '404 not found',
  'page not found',
];

export function extractUrlsFromText(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s)\]>"'`]+/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map((u) => u.replace(/[.,;:!?]+$/, ''));
}

export async function verifyAndResolveSources(
  candidates: { url: string; title?: string }[],
  verificationDate: string
): Promise<{
  verified: VerifiedSourceRecord[];
  deadUrls: Set<string>;
  redirectMap: Map<string, string>;
}> {
  const seen = new Set<string>();
  const uniqueCandidates: { url: string; title: string }[] = [];

  for (const item of candidates) {
    if (!item.url || !item.url.startsWith('http')) continue;
    const clean = item.url.trim();
    if (seen.has(clean)) continue;
    seen.add(clean);
    uniqueCandidates.push({
      url: clean,
      title: item.title?.trim() || extractHostnameLabel(clean),
    });
    if (uniqueCandidates.length >= 24) break;
  }

  // Bounded concurrency (max 5 simultaneous outbound HTTP checks)
  const CONCURRENCY = 5;
  const results: VerifiedSourceRecord[] = new Array(uniqueCandidates.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= uniqueCandidates.length) break;
      const item = uniqueCandidates[idx];
      results[idx] = await inspectSingleUrl(
        `SRC-${idx + 1}`,
        item.url,
        item.title,
        verificationDate
      );
    }
  }

  const workerCount = Math.min(CONCURRENCY, uniqueCandidates.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const byResolved = new Map<string, VerifiedSourceRecord>();
  const deadUrls = new Set<string>();
  const redirectMap = new Map<string, string>();

  for (const rec of results) {
    if (!rec) continue;
    redirectMap.set(rec.originalUrl, rec.resolvedUrl);
    if (rec.isClosedOrDead) {
      deadUrls.add(rec.originalUrl);
      deadUrls.add(rec.resolvedUrl);
      continue;
    }
    if (
      rec.resolvedUrl.includes('vertexaisearch.cloud.google.com') &&
      rec.httpStatus === 0
    ) {
      deadUrls.add(rec.originalUrl);
      continue;
    }
    if (!byResolved.has(rec.resolvedUrl)) {
      byResolved.set(rec.resolvedUrl, rec);
    }
  }

  return {
    verified: Array.from(byResolved.values()),
    deadUrls,
    redirectMap,
  };
}

async function inspectSingleUrl(
  id: string,
  url: string,
  fallbackTitle: string,
  verificationDate: string
): Promise<VerifiedSourceRecord> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(4800),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en-US;q=0.9,en;q=0.8',
      },
    });

    const finalUrl = response.url || url;
    const status = response.status;

    if (status === 404 || status === 410) {
      return {
        id,
        originalUrl: url,
        resolvedUrl: finalUrl,
        title: fallbackTitle,
        httpStatus: status,
        verifiedLive: false,
        isClosedOrDead: true,
        pageTitleSnippet: 'HTTP 404/410 Not Found',
        verificationDate,
      };
    }

    let bodySample = '';
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let bytesRead = 0;
      while (bytesRead < 32768) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.byteLength;
        bodySample += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => undefined);
    }

    const lowerBody = bodySample.toLowerCase();
    const hasClosedMarker = CLOSED_INDICATORS.some((phrase) =>
      lowerBody.includes(phrase)
    );

    const extractedTitleMatch = bodySample.match(/<title[^>]*>([^<]{2,180})<\/title>/i);
    const extractedTitle = extractedTitleMatch
      ? decodeHtmlEntities(extractedTitleMatch[1].replace(/\s+/g, ' ').trim())
      : fallbackTitle;

    // Status 200-399 or bot-gated public profiles (e.g., LinkedIn 999 / Workday 403) that resolved cleanly
    const isReachablePublic =
      (status >= 200 && status < 400) || status === 999 || status === 403 || status === 429;

    return {
      id,
      originalUrl: url,
      resolvedUrl: finalUrl,
      title: extractedTitle || fallbackTitle,
      httpStatus: status,
      verifiedLive: isReachablePublic && !hasClosedMarker,
      isClosedOrDead: hasClosedMarker || status >= 500,
      pageTitleSnippet: extractedTitle,
      verificationDate,
    };
  } catch {
    const isRedirectWrapper = url.includes('vertexaisearch.cloud.google.com');
    return {
      id,
      originalUrl: url,
      resolvedUrl: url,
      title: fallbackTitle,
      httpStatus: 0,
      verifiedLive: false,
      isClosedOrDead: isRedirectWrapper,
      pageTitleSnippet: fallbackTitle,
      verificationDate,
    };
  }
}

function extractHostnameLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Public Web Source';
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
