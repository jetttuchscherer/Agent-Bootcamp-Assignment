import type {
  CareerOpportunityReport,
  GenerateReportRequest,
  GenerationProgressEvent,
} from '../types/report';

export async function streamGenerateReport(
  payload: GenerateReportRequest,
  onProgress: (stage: string, detail: string, percent: number) => void
): Promise<CareerOpportunityReport> {
  const response = await fetch('/api/reports/generate-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || `Server returned HTTP ${response.status}`);
  }

  if (!response.body) {
    const fallbackRes = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const fallbackData = await fallbackRes.json();
    if (!fallbackRes.ok) {
      throw new Error(fallbackData.error || 'Failed to generate report.');
    }
    return fallbackData.report as CareerOpportunityReport;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completedReport: CareerOpportunityReport | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const event = JSON.parse(line) as GenerationProgressEvent;
      if (event.type === 'progress') {
        onProgress(
          event.stage || 'Researching',
          event.detail || '',
          event.percent ?? 50
        );
      } else if (event.type === 'complete' && event.report) {
        completedReport = event.report;
      } else if (event.type === 'error') {
        throw new Error(event.message || 'Failed to generate career report.');
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer.trim()) as GenerationProgressEvent;
    if (event.type === 'complete' && event.report) {
      completedReport = event.report;
    } else if (event.type === 'error') {
      throw new Error(event.message || 'Failed to generate career report.');
    }
  }

  if (!completedReport) {
    throw new Error('Report stream ended before completion.');
  }

  return completedReport;
}

export async function downloadReportDocx(
  report: CareerOpportunityReport
): Promise<void> {
  const response = await fetch('/api/reports/docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to build Word (.docx) document.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    report.fileName || `Career_Opportunity_Report_${report.reportDate}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
