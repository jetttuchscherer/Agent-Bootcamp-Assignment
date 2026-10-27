import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, RotateCcw, X } from 'lucide-react';

interface ErrorBlinkOverlayProps {
  active: boolean;
  blinkKey: number;
  onComplete: () => void;
}

export const ErrorBlinkOverlay: React.FC<ErrorBlinkOverlayProps> = ({
  active,
  blinkKey,
  onComplete,
}) => {
  if (!active) return null;

  return (
    <div
      key={blinkKey}
      aria-hidden="true"
      onAnimationEnd={onComplete}
      className="error-blink-overlay fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-red-600/25 dark:bg-red-600/35 border-8 border-red-600 dark:border-red-500"
    >
      <div className="px-10 py-5 rounded-xl bg-red-700 text-white shadow-lg border border-red-400 flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 shrink-0" />
        <span className="text-3xl sm:text-4xl font-bold tracking-wider font-mono">
          ERROR
        </span>
      </div>
    </div>
  );
};

interface ErrorDescriptionBoxProps {
  errorMessage: string;
  errorTimestamp: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export const ErrorDescriptionBox: React.FC<ErrorDescriptionBoxProps> = ({
  errorMessage,
  errorTimestamp,
  onRetry,
  onDismiss,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedText = `Error Timestamp: ${errorTimestamp}\nDescription: ${errorMessage}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50/90 dark:bg-red-950/45 p-5 flex flex-col gap-3 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <label
            htmlFor="error-description-textbox"
            className="text-sm font-semibold"
          >
            Error Description
          </label>
          <span className="text-xs font-mono text-red-700/80 dark:text-red-400/80 tabular-nums">
            · {errorTimestamp}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-slate-800 text-xs font-medium text-red-800 dark:text-red-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Error</span>
              </>
            )}
          </button>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>

      <textarea
        id="error-description-textbox"
        readOnly
        rows={3}
        value={formattedText}
        className="w-full rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-xs sm:text-sm text-red-950 dark:text-red-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-y"
      />
    </div>
  );
};
