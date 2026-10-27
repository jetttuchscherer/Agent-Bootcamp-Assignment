export interface UploadedDocInput {
  fileName: string;
  mimeType: string;
  base64Data: string;
  sizeBytes: number;
  category: 'prior_report' | 'tracker' | 'resume' | 'other';
}

export interface GenerateReportRequest {
  prompt: string;
  focusTracks?: string[];
  cityPreference?: 'calgary_priority' | 'calgary_only' | 'both_equal';
  uploadedFiles?: UploadedDocInput[];
}

export interface CandidateProfile {
  education: string;
  experience: string;
  mbaStatus: string;
  cfaStatus: string;
  compensationTargetCad: string;
  geographicPriority: string;
  targetTracks: string[];
  resumeHighlights?: string[];
}

export interface EthicsAudit {
  triggered: boolean;
  statusLabel: string;
  explanation: string;
  enforcedCredentialsStatement: string;
}

export interface TopPriorityItem {
  priorityRank: number;
  headline: string;
  organization: string;
  location: string;
  category: string;
  compositeScore: number;
  compensationSummary: string;
  whyTopPriority: string;
  immediateNextStep: string;
  directUrl: string;
}

export interface ScoredOpportunity {
  rank: number;
  isTopPriority: boolean;
  title: string;
  organization: string;
  location: string;
  category: string;
  postedDate: string;
  daysSincePosted: number;
  verificationDate: string;
  sourceName: string;
  directUrl: string;
  urlVerifiedLive: boolean;
  qualificationsFitScore: number;
  qualificationsFitRationale: string;
  careerGrowthScore: number;
  careerGrowthRationale: string;
  totalCompScore: number;
  totalCompRationale: string;
  compositeScore: number;
  compensationBaseCad: string;
  compensationBonusCad: string;
  compensationTotalCad: string;
  compensationLabel: string;
  roleSummary: string;
  strategicFitNotes: string;
}

export interface NetworkingContact {
  index: number;
  fullName: string;
  currentTitle: string;
  organization: string;
  location: string;
  practiceArea: string;
  publicSourceName: string;
  publicProfileUrl: string;
  verificationDate: string;
  urlVerifiedLive: boolean;
  networkingRationale: string;
  suggestedTopic: string;
}

export interface CompensationBenchmark {
  roleTrack: string;
  seniorityLevel: string;
  market: string;
  baseRangeCad: string;
  bonusRangeCad: string;
  totalCompRangeCad: string;
  compensationLabel: string;
  sourceName: string;
  sourceUrl: string;
  verificationDate: string;
  positioningNote: string;
}

export interface ActionPlanStep {
  stepNumber: number;
  priorityLevel: string;
  activityTitle: string;
  hoursAllocated: number;
  recommendedWindow: string;
  deliverable: string;
  targetReference: string;
}

export interface OutreachDraft {
  id: string;
  recipientLabel: string;
  channel: string;
  subjectLine: string;
  sourcedHook: string;
  messageBody: string;
}

export interface WeeklyChangesSection {
  mode: 'baseline' | 'comparison';
  modeLabel: string;
  summary: string;
  newOpportunities: string[];
  closedOrRemovedOpportunities: string[];
  scoreOrPriorityChanges: string[];
  trackerUpdates: string[];
}

export interface TrackerRow {
  entryType: 'Target Role' | 'Adjacent Role' | 'Networking Contact';
  priorityFlag: string;
  organization: string;
  roleOrContactName: string;
  location: string;
  postedOrVerifiedDate: string;
  scoreDisplay: string;
  compensationLabel: string;
  currentStatus: string;
  nextAction: string;
  followUpDate: string;
  directUrl: string;
}

export interface CareerOpportunityReport {
  reportId: string;
  reportDate: string;
  windowStartDate: string;
  fileName: string;
  userRequestInterpreted: string;
  candidateProfile: CandidateProfile;
  ethicsAudit: EthicsAudit;
  executiveSummary: string[];
  verificationMethodologyNote: string;
  topThreePriorities: TopPriorityItem[];
  rankedJobs: ScoredOpportunity[];
  adjacentRoles: ScoredOpportunity[];
  networkingContacts: NetworkingContact[];
  compensationInsights: {
    overview: string;
    benchmarks: CompensationBenchmark[];
  };
  weeklyActionPlan: {
    totalHours: number;
    targetHoursBand: string;
    steps: ActionPlanStep[];
  };
  outreachMessages: OutreachDraft[];
  weeklyChanges: WeeklyChangesSection;
  tracker: TrackerRow[];
  groundingSources: {
    title: string;
    url: string;
  }[];
}

export interface GenerationProgressEvent {
  type: 'progress' | 'complete' | 'error';
  stage?: string;
  detail?: string;
  percent?: number;
  report?: CareerOpportunityReport;
  message?: string;
}
