import React, { useRef } from 'react';
import { FileText, Moon, Paperclip, Sun, Trash2 } from 'lucide-react';
import type { ThemeMode } from '../App';
import type { UploadedDocInput } from '../types/report';

interface MandateInputPanelProps {
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  prompt: string;
  onPromptChange: (val: string) => void;
  focusTracks: string[];
  onToggleTrack: (track: string) => void;
  cityPreference: 'calgary_priority' | 'calgary_only' | 'both_equal';
  onCityPreferenceChange: (
    pref: 'calgary_priority' | 'calgary_only' | 'both_equal'
  ) => void;
  uploadedFiles: UploadedDocInput[];
  onAddFiles: (files: UploadedDocInput[]) => void;
  onUpdateFileCategory: (
    index: number,
    category: UploadedDocInput['category']
  ) => void;
  onRemoveFile: (index: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onError: (message: string) => void;
}

const ALL_TRACKS = [
  'Corporate Banking',
  'Corporate Finance',
  'M&A & Transaction Advisory',
];

const QUICK_SCENARIOS = [
  {
    label: 'Weekly Standard',
    prompt:
      'Identify and rank active corporate banking, corporate finance, and M&A opportunities posted in the last 30 days in Calgary (priority) and Saskatoon, with verified contacts, CAD compensation ranges, outreach, and a 7-hour plan.',
  },
  {
    label: 'M&A & Corp Dev',
    prompt:
      'Prioritize M&A advisory, transaction services, valuations, and energy/agribusiness corporate development roles in Calgary first and Saskatoon second, targeting CAD $125K–$200K total comp.',
  },
  {
    label: 'Vague Request',
    prompt: 'What finance opportunities should I focus on this week?',
  },
  {
    label: 'Ethics Guardrail Test',
    prompt:
      'Generate this week’s Calgary finance report and draft outreach stating that I have already completed my MBA and hold the full CFA charter.',
  },
];

function inferCategoryFromFilename(
  name: string
): UploadedDocInput['category'] {
  const lower = name.toLowerCase();
  if (
    lower.includes('career_opportunity_report') ||
    lower.includes('report') ||
    lower.includes('prior')
  ) {
    return 'prior_report';
  }
  if (
    lower.includes('tracker') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.csv')
  ) {
    return 'tracker';
  }
  if (lower.includes('resume') || lower.includes('cv')) {
    return 'resume';
  }
  return 'prior_report';
}

export const MandateInputPanel: React.FC<MandateInputPanelProps> = ({
  theme,
  onThemeChange,
  prompt,
  onPromptChange,
  focusTracks,
  onToggleTrack,
  cityPreference,
  onCityPreferenceChange,
  uploadedFiles,
  onAddFiles,
  onUpdateFileCategory,
  onRemoveFile,
  isGenerating,
  onGenerate,
  onError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelection = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newUploads: UploadedDocInput[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.size > 12 * 1024 * 1024) {
        onError(
          `Upload rejected for "${f.name}": file size (${(
            f.size /
            (1024 * 1024)
          ).toFixed(1)} MB) exceeds the 12 MB per-file limit.`
        );
        continue;
      }
      try {
        const base64Data = await readFileAsBase64(f);
        newUploads.push({
          fileName: f.name,
          mimeType: f.type || 'application/octet-stream',
          base64Data,
          sizeBytes: f.size,
          category: inferCategoryFromFilename(f.name),
        });
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : `Failed to read uploaded file "${f.name}".`
        );
      }
    }

    if (newUploads.length > 0) {
      onAddFiles(newUploads);
    }
    e.target.value = '';
  };

  return (
    <aside className="w-full lg:w-[400px] xl:w-[420px] shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 transition-colors duration-150">
      {/* Header + Appearance Mode Switcher Input */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Weekly Research Brief
          </h2>

          {/* Accessible Appearance Input (Normal vs Dark) */}
          <div
            role="radiogroup"
            aria-label="Display theme"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0"
          >
            <label
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-within:ring-2 focus-within:ring-slate-900 dark:focus-within:ring-sky-400 ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <input
                type="radio"
                name="appearance-mode"
                value="light"
                checked={theme === 'light'}
                onChange={() => onThemeChange('light')}
                className="sr-only"
              />
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>Normal</span>
            </label>

            <label
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-within:ring-2 focus-within:ring-slate-900 dark:focus-within:ring-sky-400 ${
                theme === 'dark'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <input
                type="radio"
                name="appearance-mode"
                value="dark"
                checked={theme === 'dark'}
                onChange={() => onThemeChange('dark')}
                className="sr-only"
              />
              <Moon className="w-3.5 h-3.5 shrink-0" />
              <span>Dark</span>
            </label>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Enter specific role preferences or leave concise to run the default
          Calgary &amp; Saskatoon weekly audit.
        </p>
      </div>

      {/* Career Request Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="career-request-input"
            className="text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            Career Request &amp; Weekly Focus
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Vague or empty applies defaults
          </span>
        </div>
        <textarea
          id="career-request-input"
          rows={4}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={isGenerating}
          placeholder="Example: Prioritize Calgary corporate banking and M&A associate/manager roles posted in the last 30 days, plus Saskatoon agribusiness corporate finance..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:border-slate-900 dark:focus:border-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:focus-visible:ring-sky-400/25 disabled:opacity-60 transition-colors"
        />

        {/* Quick Scenario Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {QUICK_SCENARIOS.map((sc) => (
            <button
              key={sc.label}
              type="button"
              disabled={isGenerating}
              onClick={() => onPromptChange(sc.prompt)}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400"
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target Practice Tracks */}
      <div className="flex flex-col gap-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Target Finance Tracks
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TRACKS.map((track) => {
            const active = focusTracks.includes(track);
            return (
              <button
                key={track}
                type="button"
                disabled={isGenerating}
                onClick={() => onToggleTrack(track)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400 ${
                  active
                    ? 'bg-slate-900 dark:bg-sky-600 text-white border-slate-900 dark:border-sky-600'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                {track}
              </button>
            );
          })}
        </div>
      </div>

      {/* Market Priority Segmented Control */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Geographic Priority
        </span>
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'calgary_priority', label: 'Calgary First' },
              { id: 'calgary_only', label: 'Calgary Focus' },
              { id: 'both_equal', label: 'Calgary + SK' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={isGenerating}
              onClick={() => onCityPreferenceChange(opt.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400 ${
                cityPreference === opt.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optional Uploads: Prior Report, Tracker, or Resume */}
      <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Optional Context Uploads
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            .docx · .pdf · .xlsx · .csv
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".docx,.pdf,.xlsx,.xls,.csv,.txt,.md"
          onChange={handleFileSelection}
          className="hidden"
        />

        <button
          type="button"
          disabled={isGenerating}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400 whitespace-nowrap"
        >
          <Paperclip className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span>Attach Prior Report, Tracker, or Résumé</span>
        </button>

        {uploadedFiles.length === 0 ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
            No prior report attached — this run will automatically establish a{' '}
            <strong className="font-medium text-slate-700 dark:text-slate-200">
              Baseline Week
            </strong>
            .
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/40 dark:bg-slate-950/40">
            {uploadedFiles.map((file, idx) => (
              <div
                key={`${file.fileName}-${idx}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span
                    className="font-medium text-slate-800 dark:text-slate-200 truncate"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    aria-label={`Document type for ${file.fileName}`}
                    value={file.category}
                    disabled={isGenerating}
                    onChange={(e) =>
                      onUpdateFileCategory(
                        idx,
                        e.target.value as UploadedDocInput['category']
                      )
                    }
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-900 dark:focus:border-sky-400"
                  >
                    <option value="prior_report">Prior Report</option>
                    <option value="tracker">Tracker</option>
                    <option value="resume">Résumé</option>
                    <option value="other">Reference</option>
                  </select>
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => onRemoveFile(idx)}
                    aria-label={`Remove ${file.fileName}`}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Candidate Mandate Summary (Zero-Pill Unboxed Typography) */}
      <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        <div className="font-semibold text-slate-800 dark:text-slate-200">
          Locked Candidate &amp; Scoring Rules
        </div>
        <p className="leading-relaxed">
          BComm Finance · 9 yrs experience · MBA candidate (expected April 2027)
          · CFA Level II candidate (expected May 2027)
        </p>
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          Excludes all accounting positions &amp; CPA-required roles
        </p>
        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          Target CAD $100K–$200K · Active ≤30d only · Equal weights 33.3% /
          33.3% / 33.3%
        </p>
      </div>

      {/* Primary Action */}
      <button
        type="button"
        disabled={isGenerating}
        onClick={onGenerate}
        className="w-full py-2.5 px-4 rounded-lg bg-[#0F2942] dark:bg-sky-600 hover:bg-slate-900 dark:hover:bg-sky-500 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400 whitespace-nowrap"
      >
        {isGenerating ? 'Verifying Live Sources...' : 'Generate Weekly Report'}
      </button>
    </aside>
  );
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}
