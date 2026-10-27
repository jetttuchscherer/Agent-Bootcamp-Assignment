import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { UploadedDocInput } from '../src/types/report.ts';

export interface ParsedUploadsResult {
  extractedTextBlocks: {
    fileName: string;
    category: UploadedDocInput['category'];
    content: string;
  }[];
  inlinePdfParts: {
    inlineData: {
      mimeType: string;
      data: string;
    };
  }[];
  hasPriorReport: boolean;
  hasTracker: boolean;
  hasResume: boolean;
}

export async function parseUploadedDocuments(
  files: UploadedDocInput[] = []
): Promise<ParsedUploadsResult> {
  const extractedTextBlocks: ParsedUploadsResult['extractedTextBlocks'] = [];
  const inlinePdfParts: ParsedUploadsResult['inlinePdfParts'] = [];

  let hasPriorReport = false;
  let hasTracker = false;
  let hasResume = false;

  for (const file of files) {
    const lowerName = file.fileName.toLowerCase();
    const inferredCategory = inferDocumentCategory(lowerName, file.category);

    if (inferredCategory === 'prior_report') hasPriorReport = true;
    if (inferredCategory === 'tracker') hasTracker = true;
    if (inferredCategory === 'resume') hasResume = true;

    try {
      const buffer = Buffer.from(file.base64Data, 'base64');

      if (
        lowerName.endsWith('.docx') ||
        file.mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        const cleaned = result.value.trim().slice(0, 35000);
        if (cleaned) {
          extractedTextBlocks.push({
            fileName: file.fileName,
            category: inferredCategory,
            content: cleaned,
          });
        }
      } else if (
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.csv') ||
        file.mimeType.includes('spreadsheet') ||
        file.mimeType === 'text/csv'
      ) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetTexts: string[] = [];
        for (const sheetName of workbook.SheetNames.slice(0, 5)) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
          if (csv.trim()) {
            sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
          }
        }
        const combined = sheetTexts.join('\n\n').slice(0, 35000);
        if (combined) {
          extractedTextBlocks.push({
            fileName: file.fileName,
            category: inferredCategory,
            content: combined,
          });
        }
      } else if (lowerName.endsWith('.pdf') || file.mimeType === 'application/pdf') {
        inlinePdfParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: file.base64Data,
          },
        });
        extractedTextBlocks.push({
          fileName: file.fileName,
          category: inferredCategory,
          content: `[Attached PDF document "${file.fileName}" (${inferredCategory}) supplied as multimodal PDF input.]`,
        });
      } else {
        const rawText = buffer.toString('utf-8').trim().slice(0, 35000);
        if (rawText) {
          extractedTextBlocks.push({
            fileName: file.fileName,
            category: inferredCategory,
            content: rawText,
          });
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to parse file';
      extractedTextBlocks.push({
        fileName: file.fileName,
        category: inferredCategory,
        content: `[Note: File "${file.fileName}" could not be fully parsed: ${errMsg}]`,
      });
    }
  }

  return {
    extractedTextBlocks,
    inlinePdfParts,
    hasPriorReport,
    hasTracker,
    hasResume,
  };
}

function inferDocumentCategory(
  lowerName: string,
  explicitCategory: UploadedDocInput['category']
): UploadedDocInput['category'] {
  if (explicitCategory && explicitCategory !== 'other') {
    return explicitCategory;
  }
  if (
    lowerName.includes('career_opportunity_report') ||
    lowerName.includes('report') ||
    lowerName.includes('prior') ||
    lowerName.includes('week')
  ) {
    return 'prior_report';
  }
  if (
    lowerName.includes('tracker') ||
    lowerName.includes('.xlsx') ||
    lowerName.includes('.csv')
  ) {
    return 'tracker';
  }
  if (
    lowerName.includes('resume') ||
    lowerName.includes('résumé') ||
    lowerName.includes('cv')
  ) {
    return 'resume';
  }
  return explicitCategory || 'other';
}
