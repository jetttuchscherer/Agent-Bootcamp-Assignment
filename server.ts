import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  CareerOpportunityReport,
  GenerateReportRequest,
  GenerationProgressEvent,
} from './src/types/report.ts';
import { buildCareerReportDocxBuffer } from './server/docxGenerator.ts';
import { generateCareerOpportunityReport } from './server/reportService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatGeminiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return 'Gemini API authentication failed. Please check or select a valid API key in the Settings > Secrets panel.';
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return 'Gemini API quota reached (429). Upgrading to a billing-enabled API key in Settings > Secrets increases your request quota.';
  }
  return raw || 'An unexpected error occurred while generating the weekly report.';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  // Streaming NDJSON endpoint for real-time stage updates during grounded research
  app.post('/api/reports/generate-stream', async (req, res) => {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const writeEvent = (event: GenerationProgressEvent) => {
      if (!res.writableEnded) {
        res.write(`${JSON.stringify(event)}\n`);
      }
    };

    try {
      const body = (req.body || {}) as GenerateReportRequest;
      const report = await generateCareerOpportunityReport(
        body,
        (stage, detail, percent) => {
          writeEvent({ type: 'progress', stage, detail, percent });
        }
      );
      writeEvent({ type: 'complete', report, percent: 100 });
      res.end();
    } catch (err) {
      const formatted = formatGeminiErrorMessage(err);
      console.log('[report-api] Handled stream error:', formatted);
      writeEvent({
        type: 'error',
        message: formatted,
      });
      res.end();
    }
  });

  // Standard JSON endpoint
  app.post('/api/reports/generate', async (req, res) => {
    try {
      const body = (req.body || {}) as GenerateReportRequest;
      const report = await generateCareerOpportunityReport(body);
      res.json({ report });
    } catch (err) {
      const formatted = formatGeminiErrorMessage(err);
      console.log('[report-api] Handled request error:', formatted);
      res.status(500).json({ error: formatted });
    }
  });

  // Word (.docx) binary download endpoint
  app.post('/api/reports/docx', async (req, res) => {
    try {
      const { report } = (req.body || {}) as { report?: CareerOpportunityReport };
      if (!report || !report.reportDate) {
        res.status(400).json({ error: 'Valid report payload is required.' });
        return;
      }

      const docxBuffer = await buildCareerReportDocxBuffer(report);
      const safeDate = report.reportDate.replace(/[^0-9-]/g, '');
      const filename = `Career_Opportunity_Report_${safeDate}.docx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(docxBuffer.length));
      res.send(docxBuffer);
    } catch (err) {
      console.error('DOCX generation error:', err);
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to build Word (.docx) report.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Prairie Finance Career Brief server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
