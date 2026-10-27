import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBlinkOverlay } from './components/ErrorAlertBox';
import { MandateInputPanel } from './components/MandateInputPanel';
import {
  ReportWorkspace,
  type WorkspaceSectionTab,
} from './components/ReportWorkspace';
import { downloadReportDocx, streamGenerateReport } from './services/reportApi';
import type {
  CareerOpportunityReport,
  UploadedDocInput,
} from './types/report';

export type ThemeMode = 'light' | 'dark';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('pfcb-theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [prompt, setPrompt] = useState<string>('');
  const [focusTracks, setFocusTracks] = useState<string[]>([
    'Corporate Banking',
    'Corporate Finance',
    'M&A & Transaction Advisory',
  ]);
  const [cityPreference, setCityPreference] = useState<
    'calgary_priority' | 'calgary_only' | 'both_equal'
  >('calgary_priority');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocInput[]>([]);

  const [report, setReport] = useState<CareerOpportunityReport | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceSectionTab>('overview');

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressDetail, setProgressDetail] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorTimestamp, setErrorTimestamp] = useState<string>('');
  const [isBlinkingError, setIsBlinkingError] = useState(false);
  const [errorBlinkKey, setErrorBlinkKey] = useState(0);
  const blinkTimeoutRef = useRef<number | null>(null);

  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const generationLockRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    try {
      localStorage.setItem('pfcb-theme', theme);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      if (blinkTimeoutRef.current !== null) {
        window.clearTimeout(blinkTimeoutRef.current);
      }
    };
  }, []);

  const triggerError = useCallback((message: string) => {
    const nowLabel = new Date().toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setErrorMessage(message);
    setErrorTimestamp(nowLabel);
    setErrorBlinkKey((prev) => prev + 1);
    setIsBlinkingError(true);

    if (blinkTimeoutRef.current !== null) {
      window.clearTimeout(blinkTimeoutRef.current);
    }
    // 3 blinks * 0.56s = 1.68s; fallback timer guarantees clean teardown
    blinkTimeoutRef.current = window.setTimeout(() => {
      setIsBlinkingError(false);
    }, 1850);
  }, []);

  const handleDismissError = useCallback(() => {
    setErrorMessage(null);
    setIsBlinkingError(false);
  }, []);

  const handleToggleTrack = (track: string) => {
    setFocusTracks((prev) => {
      if (prev.includes(track)) {
        return prev.length === 1 ? prev : prev.filter((t) => t !== track);
      }
      return [...prev, track];
    });
  };

  const handleAddFiles = (files: UploadedDocInput[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleUpdateFileCategory = (
    index: number,
    category: UploadedDocInput['category']
  ) => {
    setUploadedFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, category } : item))
    );
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateReport = async () => {
    if (isGenerating || generationLockRef.current) return;
    generationLockRef.current = true;
    setIsGenerating(true);
    setErrorMessage(null);
    setIsBlinkingError(false);
    setProgressStage('Initializing weekly audit');
    setProgressDetail(
      'Validating candidate mandate, ethics rules, and 30-day active window'
    );
    setProgressPercent(6);

    try {
      const generated = await streamGenerateReport(
        {
          prompt,
          focusTracks,
          cityPreference,
          uploadedFiles,
        },
        (stage, detail, percent) => {
          setProgressStage(stage);
          setProgressDetail(detail);
          setProgressPercent(percent);
        }
      );
      setReport(generated);
      setActiveTab('overview');
    } catch (err) {
      triggerError(
        err instanceof Error
          ? err.message
          : 'Unable to complete the weekly opportunity report.'
      );
    } finally {
      generationLockRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!report || isDownloadingDocx) return;
    setIsDownloadingDocx(true);
    setErrorMessage(null);
    try {
      await downloadReportDocx(report);
    } catch (err) {
      triggerError(
        err instanceof Error
          ? err.message
          : 'Failed to export Word (.docx) report.'
      );
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  const handleUpdateTrackerStatus = (rowIndex: number, newStatus: string) => {
    setReport((prev) => {
      if (!prev) return prev;
      const updatedTracker = prev.tracker.map((row, idx) =>
        idx === rowIndex ? { ...row, currentStatus: newStatus } : row
      );
      return {
        ...prev,
        tracker: updatedTracker,
      };
    });
  };

  const handleNavSelect = (tab: WorkspaceSectionTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* 3x Full-Screen ERROR Blink Overlay */}
      <ErrorBlinkOverlay
        active={isBlinkingError}
        blinkKey={errorBlinkKey}
        onComplete={() => setIsBlinkingError(false)}
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors duration-150">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Prairie Finance Career Brief
          </a>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav
            aria-label="Workspace Sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
          >
            <button
              type="button"
              onClick={() => handleNavSelect('overview')}
              className={`hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'overview'
                  ? 'text-slate-900 dark:text-white underline'
                  : ''
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleNavSelect('jobs')}
              className={`hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'jobs'
                  ? 'text-slate-900 dark:text-white underline'
                  : ''
              }`}
            >
              Opportunities
            </button>
            <button
              type="button"
              onClick={() => handleNavSelect('networking')}
              className={`hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'networking'
                  ? 'text-slate-900 dark:text-white underline'
                  : ''
              }`}
            >
              Networking
            </button>
            <button
              type="button"
              onClick={() => handleNavSelect('compensation')}
              className={`hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'compensation'
                  ? 'text-slate-900 dark:text-white underline'
                  : ''
              }`}
            >
              Compensation
            </button>
            <button
              type="button"
              onClick={() => handleNavSelect('execution')}
              className={`hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'execution'
                  ? 'text-slate-900 dark:text-white underline'
                  : ''
              }`}
            >
              Action Plan
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {report ? (
              <button
                type="button"
                disabled={isDownloadingDocx}
                onClick={handleDownloadDocx}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] dark:bg-sky-600 rounded-lg hover:bg-slate-900 dark:hover:bg-sky-500 disabled:bg-slate-400 dark:disabled:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isDownloadingDocx ? 'Exporting .docx...' : 'Download .docx'}
              </button>
            ) : (
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateReport}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] dark:bg-sky-600 rounded-lg hover:bg-slate-900 dark:hover:bg-sky-500 disabled:bg-slate-400 dark:disabled:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isGenerating ? 'Researching...' : 'Generate Report'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main One-Screen Split Workspace */}
      <main
        id="top"
        className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row items-stretch gap-6"
      >
        <MandateInputPanel
          theme={theme}
          onThemeChange={setTheme}
          prompt={prompt}
          onPromptChange={setPrompt}
          focusTracks={focusTracks}
          onToggleTrack={handleToggleTrack}
          cityPreference={cityPreference}
          onCityPreferenceChange={setCityPreference}
          uploadedFiles={uploadedFiles}
          onAddFiles={handleAddFiles}
          onUpdateFileCategory={handleUpdateFileCategory}
          onRemoveFile={handleRemoveFile}
          isGenerating={isGenerating}
          onGenerate={handleGenerateReport}
          onError={triggerError}
        />

        <ReportWorkspace
          report={report}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isGenerating={isGenerating}
          progressStage={progressStage}
          progressDetail={progressDetail}
          progressPercent={progressPercent}
          errorMessage={errorMessage}
          errorTimestamp={errorTimestamp}
          onDismissError={handleDismissError}
          isDownloadingDocx={isDownloadingDocx}
          onDownloadDocx={handleDownloadDocx}
          onTriggerGenerate={handleGenerateReport}
          onUpdateTrackerStatus={handleUpdateTrackerStatus}
        />
      </main>
    </div>
  );
}
