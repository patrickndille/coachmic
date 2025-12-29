// Session and State Types

export type AppStatus = 'idle' | 'setup' | 'interviewing' | 'processing' | 'complete';

export type InterviewType = 'behavioral' | 'technical' | 'mixed';

export type WizardStep = 'resume' | 'role' | 'company' | 'type';

export interface SetupConfig {
  targetRole: string;
  targetCompany?: string;
  interviewType: InterviewType;
  resumeFile?: File;
  resumeParsedData?: ResumeData;
  improvedResumeMarkdown?: string;

  // Saved job reference (single source of truth)
  savedJobId?: string;              // Firestore saved_job document ID
  selectedJobData?: JobPosting;     // Full job data for interview context

  // Artifacts (loaded from saved_job OR generated for session)
  coverLetter?: string;
  companyIntel?: CompanyIntel;
}

// ============================================================================
// ENHANCED RESUME TYPES
// ============================================================================

export type SkillLevel = 'beginner' | 'intermediate' | 'expert';

export interface SkillItem {
  name: string;
  level: SkillLevel;
  years?: number;
  evidence?: string;
}

export interface SkillGraph {
  technical: SkillItem[];
  soft: SkillItem[];
  certifications: string[];
}

export interface CareerSignals {
  seniorityLevel?: string;
  industryFocus: string[];
  careerTrajectory?: string;
  yearsExperience?: number;
}

export interface StarStory {
  theme: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics: string[];
  keywords: string[];
}

export interface TalkingPoints {
  elevatorPitch?: string;
  keyStrengths: string[];
  uniqueValue?: string;
}

export interface SkillGap {
  skill: string;
  importance: 'low' | 'medium' | 'high';
  currentLevel?: string;
  requiredLevel?: string;
  recommendation?: string;
  resources: Array<{ type: string; title: string; url?: string }>;
}

export interface GapAnalysis {
  targetRole?: string;
  readinessScore?: number;
  strengthsForRole: string[];
  gaps: SkillGap[];
  actionPlan: {
    immediate?: string[];
    '30_days'?: string[];
    '90_days'?: string[];
  };
}

export interface KeywordGap {
  keyword: string;
  category: 'technical' | 'soft' | 'industry' | 'certification';
  importance: 'low' | 'medium' | 'high';
  whereToAdd?: string;
}

export interface ATSIssue {
  issue: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ATSAnalysis {
  atsScore: number;
  scoreBreakdown: {
    structureClarity: number;
    keywordDensity: number;
    quantifiableAchievements: number;
    contactInformation: number;
    formattingSimplicity: number;
  };
  atsIssues: ATSIssue[];
  keywordGaps: KeywordGap[];
  formattingTips: string[];
  industryKeywords: {
    mustHave: string[];
    niceToHave: string[];
    trending: string[];
  };
}

/** Extracted location from resume for job search targeting */
export interface CandidateLocation {
  rawAddress?: string;  // Original text from resume
  city?: string;
  stateProvince?: string;  // e.g., "ON", "CA", "NY"
  country?: string;  // e.g., "Canada", "United States"
  countryCode?: string;  // e.g., "ca", "us"
}

export interface ResumeData {
  fileName: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: CandidateLocation;  // Extracted location for job search
  summary?: string;
  skills: string[];
  experiences: Experience[];
  education: Education[];
  keyAchievements: string[];
  suggestedQuestions: string[];
  suggestedRoles: string[];

  // NEW: Enhanced parsing fields
  skillGraph?: SkillGraph;
  careerSignals?: CareerSignals;
  starStories?: StarStory[];
  talkingPoints?: TalkingPoints;
  gapAnalysis?: GapAnalysis;
  atsAnalysis?: ATSAnalysis;
}

// ============================================================================
// RESUME VERSION TYPES (Firebase Storage persistence)
// ============================================================================

/** Represents a stored resume file version in Firebase Storage */
export interface ResumeVersion {
  versionId: string;
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  uploadedAt: string;
  isAiImproved: boolean;
  sourceVersionId?: string;  // If AI-improved, links to original version
}

export interface ResumeVersionListResponse {
  success: boolean;
  versions: ResumeVersion[];
  currentVersionId?: string;
  message?: string;
}

export interface ResumeVersionDownloadResponse {
  success: boolean;
  downloadUrl: string;
  versionId: string;
  fileName: string;
}

export interface DeleteResumeVersionResponse {
  success: boolean;
  message: string;
  versionId: string;
}

export interface SetCurrentVersionResponse {
  success: boolean;
  message?: string;
}

export interface GenerateImprovedPDFRequest {
  sessionId: string;
  setAsCurrent: boolean;
}

export interface GenerateImprovedPDFResponse {
  success: boolean;
  version?: ResumeVersion;
  message?: string;
}

export interface Experience {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string;
  description: string;
  highlights: string[];
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  graduationDate?: string;
}

// ============================================================================
// JOB BOARD TYPES
// ============================================================================

export type RemoteType = 'remote' | 'hybrid' | 'onsite';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type Urgency = 'low' | 'medium' | 'high';

export interface SalaryRange {
  minSalary?: number;
  maxSalary?: number;
  currency: string;
  period: 'hourly' | 'yearly';
}

export interface JobPosting {
  jobId: string;
  source: string;
  title: string;
  company: string;
  location: string;
  remoteType: RemoteType;
  salaryRange?: SalaryRange;
  postedDate: string;
  description: string;
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  url?: string;
  companyLogo?: string;
  experienceLevel?: string;
  employmentType: EmploymentType;
}

export interface SkillMatch {
  skill: string;
  required: boolean;
  candidateLevel?: string;
  requiredLevel?: string;
  matchScore: number;
}

export interface PreparationItem {
  topic: string;
  urgency: Urgency;
  reason?: string;
  resources: string[];
}

export interface FitAnalysis {
  overallMatch: number;
  skillMatch: number;
  experienceMatch: number;
  cultureSignals?: string;
  strengthsForRole: string[];
  potentialConcerns: string[];
  interviewFocusAreas: string[];
  preparationPriority: PreparationItem[];
  skillMatches: SkillMatch[];
}

export interface CareerTrajectory {
  currentFit: string;
  growthPath?: string;
  adjacentRoles: string[];
  longTermOutlook?: string;
  timeToNextLevel?: string;
}

export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'ghosted';

export interface JobMatch {
  job: JobPosting;
  fitAnalysis: FitAnalysis;
  careerTrajectory?: CareerTrajectory;
  saved: boolean;
  applied: boolean;
  // Auto-save tracking
  autoSaved?: boolean;           // true if saved via cover letter/apply action
  // Cover letter
  coverLetter?: string;
  coverLetterGeneratedAt?: string;
  // Application tracking
  applicationStatus?: ApplicationStatus;
  appliedAt?: string;
  statusUpdatedAt?: string;
  notes?: string;
  followUpDate?: string;
  // Company intelligence (job-specific)
  companyIntel?: CompanyIntel;
  companyIntelGeneratedAt?: string;
}

export interface CareerAdvice {
  recommendedTrajectory: string;
  immediateOpportunities: string[];
  skillInvestments: string[];
  marketInsights?: string;
}

// JSearch API filter values
export type DatePostedFilter = 'all' | 'today' | '3days' | 'week' | 'month';
export type JSearchEmploymentType = 'FULLTIME' | 'PARTTIME' | 'CONTRACT' | 'INTERN';

export interface JobSearchRequest {
  query?: string;
  skills: string[];
  location?: string;
  remoteOnly: boolean;
  experienceLevel?: string;
  salaryMin?: number;
  country?: string;  // Country code for JSearch (us, ca, etc.)
  limit: number;
  // New JSearch API filters
  datePosted?: DatePostedFilter;
  employmentType?: JSearchEmploymentType;
}

export interface JobSearchResponse {
  jobs: JobMatch[];
  totalCount: number;
  careerAdvice?: CareerAdvice;
}

export interface InterviewPrepPlan {
  jobId: string;
  company: string;
  role: string;
  keyTopics: string[];
  likelyQuestions: Array<{
    question: string;
    type: string;
    howToPrepare: string;
  }>;
  starStoriesToUse: string[];
  skillsToHighlight: string[];
  gapsToAddress: string[];
  companyResearchPoints: string[];
  questionsToAsk: string[];
}

// ============================================================================
// COACH TYPES
// ============================================================================

export type CoachType = 'pre_interview' | 'post_interview';

export interface CoachMessage {
  id: string;
  role: 'coach' | 'user';
  content: string;
  timestamp: string;
  suggestions: string[];
}

export interface StartCoachingRequest {
  coachType?: CoachType;  // Optional - backend auto-detects if not provided
  targetRole?: string;
  targetCompany?: string;
}

export interface StartCoachingResponse {
  sessionId: string;
  coachType: string;
  initialMessage: string;
  suggestions: string[];
}

export interface SendMessageRequest {
  message: string;
}

export interface CoachMessageResponse {
  message: string;
  suggestions: string[];
  sessionNotes: string[];
  actionItems: string[];
}

export interface CoachSessionHistory {
  sessionId: string;
  coachType: string;
  messages: CoachMessage[];
  createdAt: string;
}

export interface CoachStatus {
  hasActiveSession: boolean;
  coachType?: CoachType;
  messageCount: number;
}

// ============================================================================
// TEXT INTERVIEW TYPES
// ============================================================================

export type TextInterviewRole = 'interviewer' | 'user';
export type TextInterviewStatus = 'active' | 'paused' | 'completed';

export interface TextInterviewMessage {
  id: string;
  role: TextInterviewRole;
  content: string;
  timestamp: number;  // Unix ms
}

export interface TextInterviewConfig {
  minQuestions: number;
  maxQuestions: number;
  duration: string;
  difficulty: string;
  interviewType: string;
}

export interface TextInterviewMetrics {
  fillerWordCount: number;
  totalWordsSpoken: number;
  totalSpeakingTime: number;
  fillerWordsDetected: string[];
}

export interface StartTextInterviewResponse {
  sessionId: string;
  firstMessage: string;
  interviewConfig: TextInterviewConfig;
  candidateName?: string;
}

export interface TextInterviewMessageResponse {
  message: string;
  questionCount: number;
  maxQuestions: number;
  isClosingStatement: boolean;
  metrics: TextInterviewMetrics;
}

export interface PauseTextInterviewRequest {
  elapsedTime: number;
  metrics?: TextInterviewMetrics;
}

export interface TextInterviewStateResponse {
  hasState: boolean;
  sessionId?: string;
  status?: TextInterviewStatus;
  messages: TextInterviewMessage[];
  questionCount: number;
  elapsedTime: number;
  metrics?: TextInterviewMetrics;
  interviewConfig?: TextInterviewConfig;
}

export interface ResumeTextInterviewResponse {
  sessionId: string;
  resumeMessage: string;
  messages: TextInterviewMessage[];
  questionCount: number;
  elapsedTime: number;
  metrics: TextInterviewMetrics;
  interviewConfig: TextInterviewConfig;
}

export interface EndTextInterviewResponse {
  success: boolean;
  message: string;
  transcript: TranscriptEntry[];
  metrics: TextInterviewMetrics;
}

export interface TextInterviewTranscriptResponse {
  sessionId: string;
  transcript: TranscriptEntry[];
  questionCount: number;
  elapsedTime: number;
  metrics: TextInterviewMetrics;
}

// Transcript Types

export type Speaker = 'agent' | 'user';

export interface TranscriptEntry {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: number;
}

// Interview State Types (for persistence and pause/resume)

export interface InterviewMetrics {
  fillerWordCount: number;
  totalWordsSpoken: number;
  totalSpeakingTime: number;
}

export interface InterviewStateResponse {
  hasState: boolean;
  sessionId?: string;
  transcript: TranscriptEntry[];
  elapsedTime: number;
  questionCount: number;
  metrics?: InterviewMetrics;
  pausedAt?: string;
  status?: string;
}

export interface SaveTranscriptRequest {
  entries: TranscriptEntry[];
  elapsedTime?: number;
  questionCount?: number;
  metrics?: InterviewMetrics;
}

export interface PauseInterviewRequest {
  elapsedTime: number;
  questionCount: number;
  metrics?: InterviewMetrics;
}

// Feedback Types

export interface CategoryScores {
  content: number;
  delivery: number;
  structure: number;
  relevance: number;
}

export interface SpeakingMetrics {
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: string[];
  averageResponseTime: number;
  totalSpeakingTime: number;
}

export interface StarAnalysis {
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
}

export interface QuestionFeedback {
  questionId: string;
  question: string;
  userResponse: string;
  score: number;
  feedback: string;
  starAnalysis?: StarAnalysis;
  suggestedImprovement?: string;
}

export interface FeedbackData {
  sessionId: string;
  overallScore: number;
  categoryScores: CategoryScores;
  speakingMetrics: SpeakingMetrics;
  strengths: string[];
  areasForImprovement: string[];
  questionFeedback: QuestionFeedback[];
  generatedAt: string;
  // Session context (for displaying feedback without needing current session)
  targetRole?: string;
  targetCompany?: string;
}

// App State

export interface AppState {
  status: AppStatus;
  sessionId: string | null;
  setup: SetupConfig;
  currentSetupStep: WizardStep | null;
  transcript: TranscriptEntry[];
  feedback: FeedbackData | null;
  error: AppError | null;
  isLoading: boolean;
  // Job caching for navigation between pages
  cachedJobs: Record<string, JobMatch>;
}

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
}

// API Types

export type InterviewLength = 'short' | 'medium' | 'long';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface CreateSessionRequest {
  targetRole: string;
  targetCompany?: string;
  interviewType: InterviewType;
  interviewLength?: InterviewLength;
  difficultyLevel?: DifficultyLevel;
}

export interface CreateSessionResponse {
  sessionId: string;
  status: string;
  interviewMode?: 'voice' | 'text' | null;  // Track which interview mode is being used
  createdAt: string;
}

export interface ParseResumeResponse {
  success: boolean;
  parsedData: ResumeData;
  sessionId: string;
  message?: string;
  aiInsights?: {
    keyAchievements: string[];
    suggestedTalkingPoints: string[];
  };
}

export interface ConversationOverrides {
  systemPrompt: string;
  firstMessage: string;
}

export interface StartInterviewResponse {
  signedUrl: string;
  agentId: string;
  expiresAt: string;
  overrides: ConversationOverrides;
}

export interface Question {
  id: string;
  text: string;
  type: string;
  category: string;
}

export interface GenerateFeedbackRequest {
  transcript: TranscriptEntry[];
}

export interface FeedbackStatusResponse {
  sessionId: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

// Session History

export interface SessionSummary {
  sessionId: string;
  targetRole: string;
  targetCompany?: string;
  interviewType: string;
  status: string;
  createdAt: string;
  overallScore?: number;
  hasResumeData?: boolean;
  hasImprovedResume?: boolean;
}

export interface SessionHistoryResponse {
  sessions: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// JOB DISCOVERY PERSISTENCE TYPES
// ============================================================================

/** Pipeline audit trail for job discovery operations */
export interface TaskMeta {
  resumeSkillsExtracted?: string[];
  suggestedRolesFromResume?: string[];
  queryGenerated?: string;
  jsearchParams?: Record<string, unknown>;
  jsearchResultsCount?: number;
  aiMatchingScores?: Array<{ jobId: string; score: number }>;
  pipelineSteps?: Array<{ step: string; timestamp: string; result: string }>;
}

/** Search filters used for job search (persisted with search results) */
export interface JobSearchFilters {
  remoteOnly: boolean;
  country: string;
  stateProvince: string;
  city: string;
  datePosted: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: number | null;
}

/** AI-recommended jobs data stored in session */
export interface AIDiscoveryData {
  jobs: JobMatch[];
  careerAdvice?: CareerAdvice;
  generatedAt: string;
  taskMeta?: TaskMeta;
}

/** Manual search jobs data stored in session */
export interface SearchJobsData {
  jobs: JobMatch[];
  careerAdvice?: CareerAdvice;
  lastQuery: string;
  filters?: JobSearchFilters;
  generatedAt: string;
  taskMeta?: TaskMeta;
}

export interface FullSessionResponse {
  sessionId: string;
  targetRole: string;
  targetCompany?: string;
  interviewType: InterviewType;
  interviewLength: string;
  difficultyLevel: string;
  status: string;
  createdAt: string;
  resumeData?: ResumeData;
  improvedResumeMarkdown?: string;
  companyIntel?: CompanyIntel;
  // Job discovery data
  aiDiscovery?: AIDiscoveryData;
  searchJobs?: SearchJobsData;
  // Flags
  hasResumeData: boolean;
  hasImprovedResume: boolean;
  hasCompanyIntel: boolean;
  hasAiDiscovery: boolean;
  hasSearchJobs: boolean;
}

// localStorage Schema

export interface StoredSession {
  version: number;
  timestamp: number;
  expiresAt: number;
  sessionId: string;
  setup: SetupConfig;
  transcript: TranscriptEntry[];
  feedback: FeedbackData | null;
}

// User Preferences

export interface UserPreferences {
  // Target job preferences
  default_role?: string; // User's target role
  default_company?: string; // User's target company

  // Interview preferences
  default_interview_type: 'behavioral' | 'technical' | 'mixed';
  default_interview_length: 'short' | 'medium' | 'long';
  difficulty_level: 'easy' | 'medium' | 'hard';

  // Voice preferences
  voice_speed: number; // 0.8 - 1.2
  voice_accent: string;

  // Notification preferences
  email_notifications: boolean;
  practice_reminders: boolean;
  weekly_summary: boolean;

  // Privacy
  share_anonymous_data: boolean;

  // Display
  show_real_time_metrics: boolean;
  auto_save_transcripts: boolean;
}

// Resume Improvement

export interface ImproveResumeResponse {
  success: boolean;
  improvedResumeMarkdown: string;
  message?: string;
}

export interface GetImprovedResumeResponse {
  success: boolean;
  improvedResumeMarkdown?: string;
  message?: string;
}

export interface SaveImprovedResumeResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// COMPANY INTELLIGENCE TYPES
// ============================================================================

export interface NewsItem {
  title: string;
  summary: string;
  date?: string;
  source?: string;
  relevanceToInterview?: string;
}

export interface LeadershipChange {
  name: string;
  role: string;
  changeType: 'new_hire' | 'departure' | 'promotion' | 'restructure' | 'no_change' | 'other';
  date?: string;
  implications?: string;
}

export interface StrategicInitiative {
  title: string;
  description: string;
  relevance?: string;
  interviewAngle?: string;
}

export interface CultureSignal {
  signal: string;
  evidence: string;
  interviewTip?: string;
}

export interface FinancialHealth {
  isPublic: boolean;
  stockTrend?: string;
  recentEarnings?: string;
  growthIndicators: string[];
  concerns: string[];
}

export interface InterviewAngle {
  topic: string;
  whyRelevant: string;
  howToUse: string;
  samplePhrases: string[];
}

export interface PredictedQuestion {
  question: string;
  type: 'behavioral' | 'technical' | 'situational' | 'company-specific';
  reasoning: string;
  preparationTip: string;
  relatedNews?: string;
}

export interface StoryToCompanyMapping {
  storyTheme: string;
  storySummary: string;
  companyInitiative: string;
  connectionExplanation: string;
  framingTip: string;
  emphasisScore: number;
}

export interface CompanyIntel {
  companyName: string;
  industry?: string;
  headquarters?: string;
  companySize?: string;
  founded?: string;
  website?: string;
  generatedAt: string;
  dataFreshness: 'real-time' | 'cached';
  executiveSummary: string;
  keyTalkingPoints: string[];
  recentNews: NewsItem[];
  leadershipChanges: LeadershipChange[];
  strategicInitiatives: StrategicInitiative[];
  cultureSignals: CultureSignal[];
  financialHealth?: FinancialHealth;
  interviewAngles: InterviewAngle[];
  predictedQuestions: PredictedQuestion[];
  storyMappings: StoryToCompanyMapping[];
  sources: string[];
}

export interface GenerateCompanyIntelRequest {
  companyName: string;
  targetRole?: string;
  jobId?: string;
  includeQuestions?: boolean;
  includeStoryMapping?: boolean;
}

export interface CompanyIntelResponse {
  success: boolean;
  intel?: CompanyIntel;
  cached: boolean;
  cacheExpiresAt?: string;
  error?: string;
}

// ============================================================================
// GEMINI TTS TYPES (Reader Mode)
// ============================================================================

export interface GeminiTTSVoice {
  name: string;
  description: string;
}

export interface GeminiTTSVoicesResponse {
  voices: GeminiTTSVoice[];
  default: string;
}

export interface GeminiTTSRequest {
  text: string;
  voiceName?: string;
  stylePrompt?: string;
}
