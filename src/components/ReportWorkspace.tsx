import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ErrorDescriptionBox } from './ErrorAlertBox';
import type {
  CareerOpportunityReport,
  ScoredOpportunity,
  TrackerRow,
} from '../types/report';

export type WorkspaceSectionTab =
  | 'overview'
  | 'jobs'
  | 'adjacent'
  | 'networking'
  | 'compensation'
  | 'execution'
  | 'tracker';

interface ReportWorkspaceProps {
  report: CareerOpportunityReport | null;
  activeTab: WorkspaceSectionTab;
  onTabChange: (tab: WorkspaceSectionTab) => void;
  isGenerating: boolean;
  progressStage: string;
  progressDetail: string;
  progressPercent: number;
  errorMessage: string | null;
  errorTimestamp: string;
  onDismissError: () => void;
  isDownloadingDocx: boolean;
  onDownloadDocx: () => void;
  onTriggerGenerate: () => void;
  onUpdateTrackerStatus: (rowIndex: number, newStatus: string) => void;
}

const TABS: { id: WorkspaceSectionTab; label: string }[] = [
  { id: 'overview', label: 'Overview & Top 3' },
  { id: 'jobs', label: 'Ranked Jobs' },
  { id: 'adjacent', label: 'Adjacent Roles' },
  { id: 'networking', label: 'Networking' },
  { id: 'compensation', label: 'Compensation' },
  { id: 'execution', label: 'Plan & Outreach' },
  { id: 'tracker', label: 'Changes & Tracker' },
];

const TRACKER_STATUS_OPTIONS = [
  'Verified Open — To Apply',
  'Public Profile Verified — Ready to Connect',
  'Verified Open — Evaluate Bridge Fit',
  'Application Submitted',
  'Outreach Sent',
  'Coffee Chat Scheduled',
  'Interviewing',
  'Closed / Archived',
];

export const ReportWorkspace: React.FC<ReportWorkspaceProps> = ({
  report,
  activeTab,
  onTabChange,
  isGenerating,
  progressStage,
  progressDetail,
  progressPercent,
  errorMessage,
  errorTimestamp,
  onDismissError,
  isDownloadingDocx,
  onDownloadDocx,
  onTriggerGenerate,
  onUpdateTrackerStatus,
}) => {
  const [marketFilter, setMarketFilter] = useState<
    'all' | 'calgary' | 'saskatoon'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedJobKey, setExpandedJobKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredRankedJobs = useMemo(() => {
    if (!report) return [];
    return filterByMarketAndSearch(report.rankedJobs, marketFilter, searchQuery);
  }, [report, marketFilter, searchQuery]);

  const filteredAdjacentRoles = useMemo(() => {
    if (!report) return [];
    return filterByMarketAndSearch(
      report.adjacentRoles,
      marketFilter,
      searchQuery
    );
  }, [report, marketFilter, searchQuery]);

  const filteredContacts = useMemo(() => {
    if (!report) return [];
    return report.networkingContacts.filter((c) => {
      if (
        marketFilter === 'calgary' &&
        !c.location.toLowerCase().includes('calgary')
      ) {
        return false;
      }
      if (
        marketFilter === 'saskatoon' &&
        !c.location.toLowerCase().includes('saskatoon')
      ) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.organization.toLowerCase().includes(q) ||
        c.currentTitle.toLowerCase().includes(q) ||
        c.practiceArea.toLowerCase().includes(q)
      );
    });
  }, [report, marketFilter, searchQuery]);

  const handleCopyOutreach = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  // 1. Loading / Live Grounded Research Progress State
  if (isGenerating) {
    return (
      <section className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col justify-between gap-8 transition-colors duration-150">
        <div className="max-w-2xl">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            Live Evidence Pipeline · {progressPercent}% Complete
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {progressStage || 'Researching Calgary & Saskatoon Markets'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {progressDetail ||
              'Opening public job portals, corporate directories, and Canadian salary guides to verify dates and URLs.'}
          </p>

          <div className="mt-6 w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0F2942] dark:bg-sky-500 transition-transform duration-200 origin-left"
              style={{
                transform: `scaleX(${Math.max(0.06, progressPercent / 100)})`,
              }}
            />
          </div>
        </div>

        {/* Aligned table row skeletons matching populated geometry */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-11 px-4 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="h-3 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 flex-1 max-w-xs bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/70 rounded" />
              <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/70 rounded" />
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 2. Empty State (with Error Description Text Box shown at top if an error occurred)
  if (!report) {
    return (
      <section className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 lg:p-10 flex flex-col justify-between gap-8 transition-colors duration-150">
        {errorMessage && (
          <ErrorDescriptionBox
            errorMessage={errorMessage}
            errorTimestamp={errorTimestamp}
            onRetry={onTriggerGenerate}
            onDismiss={onDismissError}
          />
        )}

        <div className="max-w-2xl">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Calgary, AB (Primary) · Saskatoon, SK (Secondary) · CAD $100K–$200K
            Mandate
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Weekly Evidence-Based Finance Opportunity Report
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Searches live public career portals, deal advisory directories, and
            Canadian compensation benchmarks to verify active opportunities
            posted within the preceding 30 calendar days and export a formatted
            Word report (
            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
              Career_Opportunity_Report_YYYY-MM-DD.docx
            </span>
            ).
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onTriggerGenerate}
              className="px-5 py-2.5 rounded-lg bg-[#0F2942] dark:bg-sky-600 hover:bg-slate-900 dark:hover:bg-sky-500 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400"
            >
              Run Baseline Weekly Report
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Applies fixed BComm · 9 yrs · MBA (Apr 2027) · CFA L2 (May 2027)
              profile automatically
            </span>
          </div>
        </div>

        {/* Clean Specification Matrix (No nested cards, subtle hairline dividers) */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              01. 30-Day Active Verification
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Includes only open roles originally posted within 30 calendar days
              with verified dates and live HTTP source checks. Separates
              adjacent roles from core targets.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              02. Equal 33.3% Scoring &amp; CAD Comp
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Weights Qualifications Fit (33.3%), Career Growth (33.3%), and
              Total Compensation (33.3%) equally. Labels every figure Published,
              Estimate (source), or Unknown.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              03. Ethical Public Sourcing &amp; .docx
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Verifies up to 10 Calgary &amp; Saskatoon contacts via public
              profiles without private emails, builds a 5–10h plan, and exports
              a complete Word document.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // 3. Populated Report Workspace
  return (
    <section className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 lg:p-8 flex flex-col gap-6 transition-colors duration-150">
      {/* Error Description Text Box if an error occurred while viewing a report */}
      {errorMessage && (
        <ErrorDescriptionBox
          errorMessage={errorMessage}
          errorTimestamp={errorTimestamp}
          onRetry={onTriggerGenerate}
          onDismiss={onDismissError}
        />
      )}

      {/* Report Header & Download .docx Action */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Report {report.reportDate}</span>
            <span aria-hidden="true">·</span>
            <span>
              30-Day Window {report.windowStartDate} to {report.reportDate}
            </span>
            <span aria-hidden="true">·</span>
            <span>{report.weeklyChanges.modeLabel}</span>
          </div>
          <h1 className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Calgary &amp; Saskatoon Finance Opportunity Report
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {report.candidateProfile.education} ·{' '}
            {report.candidateProfile.experience} ·{' '}
            {report.candidateProfile.mbaStatus} ·{' '}
            {report.candidateProfile.cfaStatus}
          </p>
        </div>

        <button
          type="button"
          disabled={isDownloadingDocx}
          onClick={onDownloadDocx}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F2942] dark:bg-sky-600 hover:bg-slate-900 dark:hover:bg-sky-500 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>
            {isDownloadingDocx
              ? 'Building .docx...'
              : `Download ${report.fileName}`}
          </span>
        </button>
      </div>

      {/* Ethics & Credential Compliance Audit Notice */}
      <div
        className={`rounded-lg border p-4 flex items-start gap-3 ${
          report.ethicsAudit.triggered
            ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-red-950 dark:text-red-100'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200'
        }`}
      >
        {report.ethicsAudit.triggered ? (
          <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        )}
        <div className="text-xs leading-relaxed">
          <span className="font-semibold">{report.ethicsAudit.statusLabel}: </span>
          <span>{report.ethicsAudit.explanation}</span>
        </div>
      </div>

      {/* Interactive Section Tabs + Filter Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Report Sections"
          className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto"
        >
          {TABS.map((t) => {
            const countSuffix =
              t.id === 'jobs'
                ? ` (${report.rankedJobs.length})`
                : t.id === 'adjacent'
                ? ` (${report.adjacentRoles.length})`
                : t.id === 'networking'
                ? ` (${report.networkingContacts.length})`
                : '';
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-sky-400 ${
                  activeTab === t.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {t.label}
                <span className="font-mono tabular-nums">{countSuffix}</span>
              </button>
            );
          })}
        </div>

        {(activeTab === 'jobs' ||
          activeTab === 'adjacent' ||
          activeTab === 'networking') && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'calgary', label: 'Calgary' },
                  { id: 'saskatoon', label: 'Saskatoon' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMarketFilter(m.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    marketFilter === m.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter organization or role..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-sky-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: OVERVIEW & TOP THREE PRIORITIES */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8">
          {/* Top 3 Highlighted Priorities */}
          <div>
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Top Three Weekly Priorities
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Equal Weighting: 33.3% Fit · 33.3% Growth · 33.3% Comp
              </span>
            </div>

            {report.topThreePriorities.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No active postings passed the 30-day date verification filter in
                this cycle. Review the Networking and Action Plan tabs for
                direct outreach steps.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {report.topThreePriorities.map((item) => (
                  <div
                    key={item.priorityRank}
                    className="border border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 rounded-lg p-4 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        <span className="font-semibold text-[#0F2942] dark:text-sky-400">
                          Priority 0{item.priorityRank}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Score {item.compositeScore.toFixed(1)}/100
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                        {item.headline}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {item.location} · {item.category} ·{' '}
                        {item.compensationSummary}
                      </p>
                      <p className="mt-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {item.whyTopPriority}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-2">
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        <strong className="font-semibold text-slate-800 dark:text-slate-200">
                          Next Action:{' '}
                        </strong>
                        {item.immediateNextStep}
                      </p>
                      <a
                        href={item.directUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-sky-400 hover:text-blue-900 dark:hover:text-sky-300 hover:underline w-fit whitespace-nowrap"
                      >
                        <span>Open Verified Source</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Executive Summary */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Executive Summary
              </h2>
              {report.executiveSummary.map((para, i) => (
                <p
                  key={i}
                  className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-[72ch]"
                >
                  {para}
                </p>
              ))}
              {report.verificationMethodologyNote && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">
                    Verification Audit:{' '}
                  </strong>
                  {report.verificationMethodologyNote}
                </p>
              )}
            </div>

            {/* Right Column: Audit Metrics + Bottom-Right Concise Top 3 Findings Summary */}
            <div className="flex flex-col justify-between gap-5">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  Weekly Audit Summary
                </h3>
                <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="py-2 flex items-center justify-between gap-2">
                    <dt className="text-slate-600 dark:text-slate-400">
                      Ranked Active Jobs (≤30d)
                    </dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.rankedJobs.length} / 10 max
                    </dd>
                  </div>
                  <div className="py-2 flex items-center justify-between gap-2">
                    <dt className="text-slate-600 dark:text-slate-400">
                      Separated Adjacent Roles
                    </dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.adjacentRoles.length}
                    </dd>
                  </div>
                  <div className="py-2 flex items-center justify-between gap-2">
                    <dt className="text-slate-600 dark:text-slate-400">
                      Verified Public Contacts
                    </dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.networkingContacts.length} / 10 max
                    </dd>
                  </div>
                  <div className="py-2 flex items-center justify-between gap-2">
                    <dt className="text-slate-600 dark:text-slate-400">
                      Weekly Action Budget
                    </dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.weeklyActionPlan.totalHours.toFixed(1)} hrs
                    </dd>
                  </div>
                  <div className="py-2 flex items-center justify-between gap-2">
                    <dt className="text-slate-600 dark:text-slate-400">
                      Reporting Mode
                    </dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {report.weeklyChanges.mode === 'comparison'
                        ? 'Prior Report Diff'
                        : 'Baseline Week'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Bottom-Right Concise Summary of Top 3 Report Findings */}
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/35 rounded-lg p-4">
                <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                    Top 3 Report Findings
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    Key Takeaways
                  </span>
                </div>

                <ol className="divide-y divide-slate-200/80 dark:divide-slate-800 text-xs">
                  {buildTopThreeFindings(report).map((finding, idx) => (
                    <li key={finding.id} className="py-2.5 first:pt-3 last:pb-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          0{idx + 1}. {finding.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => onTabChange(finding.targetTab)}
                          className="text-[11px] font-medium text-blue-700 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {finding.linkLabel}
                        </button>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed tabular-nums">
                        {finding.summary}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RANKED TARGET JOBS */}
      {activeTab === 'jobs' && (
        <OpportunitiesTableSection
          title="Ranked Target Finance Opportunities (Active ≤ 30 Calendar Days)"
          subtitle="Scored equally on Qualifications Fit (33.3%), Career Growth (33.3%), and Total Compensation (33.3%). Click any row to inspect scoring evidence."
          jobs={filteredRankedJobs}
          expandedKey={expandedJobKey}
          onToggleExpand={(k) =>
            setExpandedJobKey((prev) => (prev === k ? null : k))
          }
          isPrimary
        />
      )}

      {/* TAB 3: ADJACENT ROLES (SEPARATED) */}
      {activeTab === 'adjacent' && (
        <OpportunitiesTableSection
          title="Adjacent Finance Opportunities (Separated from Core Targets)"
          subtitle="Verified bridge roles in commercial banking, credit structuring, treasury, and strategic FP&A posted within the last 30 calendar days."
          jobs={filteredAdjacentRoles}
          expandedKey={expandedJobKey}
          onToggleExpand={(k) =>
            setExpandedJobKey((prev) => (prev === k ? null : k))
          }
          isPrimary={false}
        />
      )}

      {/* TAB 4: VERIFIED NETWORKING CONTACTS */}
      {activeTab === 'networking' && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Verified Public Networking Contacts ({filteredContacts.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Respects institutional chain of command: targets functional
              Directors, VPs, and Desk Heads (1–2 levels above target mandates —
              never enterprise CEOs) from verified public team directories with
              zero private emails.
            </p>
          </div>

          {filteredContacts.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 py-6">
              No networking contacts match the current filter.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <th className="py-2.5 px-3 font-semibold w-10">#</th>
                    <th className="py-2.5 px-3 font-semibold">
                      Name &amp; Current Role
                    </th>
                    <th className="py-2.5 px-3 font-semibold">
                      Organization &amp; Market
                    </th>
                    <th className="py-2.5 px-3 font-semibold">
                      Networking Rationale &amp; Discussion Angle
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      Verified Source
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredContacts.map((c) => (
                    <tr
                      key={`${c.index}-${c.fullName}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors align-top"
                    >
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {c.index}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {c.fullName}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {c.currentTitle}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {c.organization}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {c.location} · {c.practiceArea}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-md leading-relaxed text-slate-700 dark:text-slate-300">
                        <p>{c.networkingRationale}</p>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          <strong className="font-medium text-slate-700 dark:text-slate-200">
                            Angle:{' '}
                          </strong>
                          {c.suggestedTopic}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <a
                          href={c.publicProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-sky-400 hover:text-blue-900 dark:hover:text-sky-300 hover:underline"
                        >
                          <span>{c.publicSourceName}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          Verified {c.verificationDate}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COMPENSATION INSIGHTS */}
      {activeTab === 'compensation' && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Sourced CAD Compensation Benchmarks (Calgary &amp; Saskatoon)
            </h2>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
              {report.compensationInsights.overview}
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="py-2.5 px-3 font-semibold">Track &amp; Level</th>
                  <th className="py-2.5 px-3 font-semibold">Market</th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    CAD Base Range
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    Target Bonus
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    CAD Total Comp
                  </th>
                  <th className="py-2.5 px-3 font-semibold">
                    Label &amp; Verified Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {report.compensationInsights.benchmarks.map((b, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors align-top"
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {b.roleTrack}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        {b.seniorityLevel}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {b.market}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                      {b.baseRangeCad}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {b.bonusRangeCad}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {b.totalCompRangeCad}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {b.compensationLabel}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {b.sourceUrl && b.sourceUrl.startsWith('http') ? (
                          <a
                            href={b.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 dark:text-sky-400 hover:underline"
                          >
                            <span>{b.sourceName}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span>{b.sourceName}</span>
                        )}
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {b.verificationDate}
                        </span>
                      </div>
                      {b.positioningNote && (
                        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                          {b.positioningNote}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: 5-10 HOUR ACTION PLAN & SOURCED OUTREACH */}
      {activeTab === 'execution' && (
        <div className="flex flex-col gap-8">
          {/* 5-10 Hour Weekly Action Plan */}
          <div>
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  5–10-Hour Weekly Execution Plan
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Calibrated for a full-time professional balancing MBA &amp;
                  CFA Level II study commitments.
                </p>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                Total Scheduled: {report.weeklyActionPlan.totalHours.toFixed(1)}{' '}
                hrs
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <th className="py-2.5 px-3 font-semibold w-12">Step</th>
                    <th className="py-2.5 px-3 font-semibold">Priority</th>
                    <th className="py-2.5 px-3 font-semibold">
                      Activity &amp; Linked Target
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Window</th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      Hours
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Deliverable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {report.weeklyActionPlan.steps.map((s) => (
                    <tr
                      key={s.stepNumber}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 align-top"
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        0{s.stepNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {s.priorityLevel}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {s.activityTitle}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {s.targetReference}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {s.recommendedWindow}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                        {s.hoursAllocated.toFixed(1)}h
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs">
                        {s.deliverable}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Personalized Sourced Outreach Messages */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Personalized, Sourced Outreach Drafts
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Every draft states credentials truthfully as MBA candidate
                (expected April 2027) and CFA Level II candidate (expected May
                2027).
              </p>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {report.outreachMessages.map((msg) => (
                <div key={msg.id} className="p-4 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {msg.recipientLabel}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{msg.channel}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyOutreach(msg.id, msg.messageBody)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Copy Message</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="font-medium text-slate-700 dark:text-slate-300">
                      Subject / Hook:{' '}
                    </strong>
                    {msg.subjectLine} ·{' '}
                    <strong className="font-medium text-slate-700 dark:text-slate-300">
                      Sourced Fact:{' '}
                    </strong>
                    {msg.sourcedHook}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed bg-slate-50/70 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                    {msg.messageBody}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: WEEKLY CHANGES & INTERACTIVE TRACKER */}
      {activeTab === 'tracker' && (
        <div className="flex flex-col gap-8">
          {/* Weekly Changes */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Weekly Continuity — {report.weeklyChanges.modeLabel}
            </h2>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
              {report.weeklyChanges.summary}
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  New &amp; Active Benchmark Entries
                </h3>
                <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 list-disc pl-4">
                  {report.weeklyChanges.newOpportunities.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Priority Shifts &amp; Closed Postings
                </h3>
                <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 list-disc pl-4">
                  {report.weeklyChanges.scoreOrPriorityChanges.map((item, i) => (
                    <li key={`s-${i}`}>{item}</li>
                  ))}
                  {report.weeklyChanges.closedOrRemovedOpportunities.map(
                    (item, i) => (
                      <li
                        key={`c-${i}`}
                        className="text-slate-500 dark:text-slate-400"
                      >
                        {item}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Interactive Opportunity & Networking Tracker */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Opportunity &amp; Networking Tracker ({report.tracker.length})
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Status updates made below are saved directly into your
                  downloaded Word (.docx) report.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <th className="py-2.5 px-3 font-semibold">Priority</th>
                    <th className="py-2.5 px-3 font-semibold">
                      Organization &amp; Target
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Market &amp; Date</th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      Score / Comp
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">
                      Follow-Up &amp; Link
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {report.tracker.map((row: TrackerRow, idx: number) => (
                    <tr
                      key={`${row.organization}-${row.roleOrContactName}-${idx}`}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 align-top ${
                        row.priorityFlag.includes('Priority')
                          ? 'bg-blue-50/25 dark:bg-sky-950/25'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.priorityFlag}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {row.entryType}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.organization}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {row.roleOrContactName}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {row.location}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          {row.postedOrVerifiedDate}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.scoreDisplay}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {row.compensationLabel}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          aria-label={`Status for ${row.roleOrContactName}`}
                          value={row.currentStatus}
                          onChange={(e) =>
                            onUpdateTrackerStatus(idx, e.target.value)
                          }
                          className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-900 dark:focus:border-sky-400"
                        >
                          {!TRACKER_STATUS_OPTIONS.includes(
                            row.currentStatus
                          ) && (
                            <option value={row.currentStatus}>
                              {row.currentStatus}
                            </option>
                          )}
                          {TRACKER_STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[220px]">
                          {row.nextAction}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 tabular-nums">
                          Target: {row.followUpDate}
                        </div>
                        <a
                          href={row.directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-blue-700 dark:text-sky-400 hover:underline font-medium"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

interface OpportunitiesTableSectionProps {
  title: string;
  subtitle: string;
  jobs: ScoredOpportunity[];
  expandedKey: string | null;
  onToggleExpand: (key: string) => void;
  isPrimary: boolean;
}

const OpportunitiesTableSection: React.FC<OpportunitiesTableSectionProps> = ({
  title,
  subtitle,
  jobs,
  expandedKey,
  onToggleExpand,
  isPrimary,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 py-6">
          No verified active roles within the preceding 30 calendar days matched
          the current filter criteria.
        </p>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <th className="py-2.5 px-3 font-semibold w-14">
                  {isPrimary ? 'Rank' : '#'}
                </th>
                <th className="py-2.5 px-3 font-semibold">
                  Role &amp; Organization
                </th>
                <th className="py-2.5 px-3 font-semibold">Market</th>
                <th className="py-2.5 px-3 font-semibold">Posted / Verified</th>
                <th className="py-2.5 px-3 font-semibold text-right">
                  Fit / Grw / Cmp
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">
                  Composite
                </th>
                <th className="py-2.5 px-3 font-semibold">
                  CAD Compensation &amp; Label
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {jobs.map((job) => {
                const rowKey = `${isPrimary ? 'p' : 'a'}-${job.rank}-${job.organization}`;
                const expanded = expandedKey === rowKey;
                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      onClick={() => onToggleExpand(rowKey)}
                      className={`cursor-pointer transition-colors align-top ${
                        job.isTopPriority
                          ? 'bg-blue-50/35 dark:bg-sky-950/30 hover:bg-blue-50/60 dark:hover:bg-sky-950/50'
                          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                        #{job.rank}
                        {job.isTopPriority && (
                          <div className="text-[10px] font-sans font-semibold text-[#0F2942] dark:text-sky-400">
                            Top 3
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {job.title}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {job.organization} · {job.category}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {job.location}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        <div>Posted {job.postedDate}</div>
                        <div className="text-slate-400 dark:text-slate-500">
                          Verified {job.verificationDate}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {job.qualificationsFitScore} / {job.careerGrowthScore} /{' '}
                        {job.totalCompScore}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#0F2942] dark:text-sky-400 tabular-nums whitespace-nowrap">
                        {job.compositeScore.toFixed(1)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                          {job.compensationTotalCad}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {job.compensationLabel}
                        </div>
                      </td>
                      <td
                        className="py-3 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={job.directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-sky-400 hover:text-blue-900 dark:hover:text-sky-300 hover:underline"
                        >
                          <span>{job.sourceName}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="bg-slate-50/70 dark:bg-slate-800/50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                Qualifications Fit ({job.qualificationsFitScore}
                                /100 · 33.3%):{' '}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {job.qualificationsFitRationale}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                Career Growth ({job.careerGrowthScore}/100 ·
                                33.3%):{' '}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {job.careerGrowthRationale}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                Total Compensation ({job.totalCompScore}/100 ·
                                33.3%):{' '}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {job.totalCompRationale} (Base:{' '}
                                {job.compensationBaseCad} · Bonus:{' '}
                                {job.compensationBonusCad})
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            <strong className="font-semibold text-slate-900 dark:text-white">
                              Role Evidence &amp; Positioning:{' '}
                            </strong>
                            {job.roleSummary} {job.strategicFitNotes}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function filterByMarketAndSearch(
  items: ScoredOpportunity[],
  market: 'all' | 'calgary' | 'saskatoon',
  query: string
): ScoredOpportunity[] {
  return items.filter((item) => {
    if (
      market === 'calgary' &&
      !item.location.toLowerCase().includes('calgary')
    ) {
      return false;
    }
    if (
      market === 'saskatoon' &&
      !item.location.toLowerCase().includes('saskatoon')
    ) {
      return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.organization.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });
}

function buildTopThreeFindings(report: CareerOpportunityReport): {
  id: string;
  title: string;
  summary: string;
  targetTab: WorkspaceSectionTab;
  linkLabel: string;
}[] {
  const calgaryJobs = report.rankedJobs.filter((j) =>
    j.location.toLowerCase().includes('calgary')
  ).length;
  const saskatoonJobs = report.rankedJobs.length - calgaryJobs;
  const topJob = report.rankedJobs[0];

  const finding1Summary = topJob
    ? `${report.rankedJobs.length} active ≤30d target roles verified (${calgaryJobs} Calgary, ${saskatoonJobs} Saskatoon), led by ${topJob.title} at ${topJob.organization} (${topJob.compositeScore.toFixed(1)}/100), plus ${report.adjacentRoles.length} separated adjacent ${report.adjacentRoles.length === 1 ? 'role' : 'roles'}.`
    : `0 active target postings met the strict 30-day verified window; ${report.adjacentRoles.length} adjacent ${report.adjacentRoles.length === 1 ? 'role' : 'roles'} separated for review.`;

  const topBenchmark = report.compensationInsights.benchmarks[0];
  const publishedCount = report.rankedJobs.filter((j) =>
    j.compensationLabel.toLowerCase().startsWith('published')
  ).length;

  const finding2Summary = topBenchmark
    ? `Sourced ${topBenchmark.market} ${topBenchmark.roleTrack} total comp centers around ${topBenchmark.totalCompRangeCad} (${topBenchmark.compensationLabel}); ${publishedCount} of ${report.rankedJobs.length} active postings disclose published CAD pay against your CAD $100K–$200K target.`
    : topJob
    ? `Lead target compensation is ${topJob.compensationTotalCad} (${topJob.compensationLabel}) relative to the CAD $100K–$200K mandate.`
    : 'CAD base, bonus, and total compensation ranges are benchmarked to verified Canadian salary guides.';

  const calgaryContacts = report.networkingContacts.filter((c) =>
    c.location.toLowerCase().includes('calgary')
  ).length;
  const leadContact = report.networkingContacts[0];

  const finding3Summary = leadContact
    ? `${report.networkingContacts.length} public networking profiles verified (${calgaryContacts} in Calgary, starting with ${leadContact.fullName} at ${leadContact.organization}), paired with a ${report.weeklyActionPlan.totalHours.toFixed(1)}-hour weekly execution plan.`
    : `Scheduled a focused ${report.weeklyActionPlan.totalHours.toFixed(1)}-hour weekly action plan across ${report.weeklyActionPlan.steps.length} prioritized steps.`;

  return [
    {
      id: 'finding-opportunities',
      title: 'Active Opportunity Lead',
      summary: finding1Summary,
      targetTab: 'jobs',
      linkLabel: 'View Jobs',
    },
    {
      id: 'finding-compensation',
      title: 'CAD Compensation Fit',
      summary: finding2Summary,
      targetTab: 'compensation',
      linkLabel: 'View Comp',
    },
    {
      id: 'finding-execution',
      title: 'Networking & Action Pace',
      summary: finding3Summary,
      targetTab: 'execution',
      linkLabel: 'View Plan',
    },
  ];
}

