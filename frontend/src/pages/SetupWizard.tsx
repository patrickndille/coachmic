import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { createSession, parseResumeStream, reparseStoredResumeStream, listResumeVersions, getResumeVersionDownloadUrl, updateSession, getRecommendedJobs, searchJobs, saveJob, unsaveJob, generateImprovedResumeStream, saveImprovedResume, getImprovedResume, getPreferences, getSavedCompanyIntel, getFullSession } from '../services/api';
import { triggerArtifactGeneration, triggerSessionArtifactGeneration } from '../services/artifacts';
import { InterviewType, JobMatch, CareerAdvice, WizardStep, UserPreferences, DatePostedFilter, JSearchEmploymentType, FeedbackData, ResumeVersion } from '../types';
import { COUNTRIES, getRegionsForCountry, getCitiesForRegion, buildLocationString } from '../data/locations';
import { CompanyIntelPanel } from '../components/company';
import type { CompanyIntel } from '../types';
import { HelpTooltip } from '../components/common';
import { helpContent } from '../utils/helpContent';
import { BookmarkIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, ExclamationTriangleIcon, DocumentArrowDownIcon, ClipboardDocumentIcon, PencilSquareIcon, ArrowTopRightOnSquareIcon, MagnifyingGlassIcon, ArrowPathIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid, CheckCircleIcon, SparklesIcon, DocumentTextIcon, CalendarDaysIcon, ArrowTrendingUpIcon, BuildingOffice2Icon, TrophyIcon } from '@heroicons/react/24/solid';
import { ATSFeedbackPanel } from '../components/resume/ATSFeedbackPanel';
import { StarStoryCard } from '../components/common/StarStoryCard';

const STEPS: WizardStep[] = ['resume', 'role', 'company', 'type'];

/**
 * Normalize resume data from backend (handles both snake_case and camelCase).
 * Some older sessions may have data stored with snake_case keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeResumeData(data: any): any {
  if (!data) return undefined;

  // Create normalized version with camelCase keys
  const normalized = { ...data };

  // Handle skill_graph -> skillGraph
  if (data.skill_graph && !data.skillGraph) {
    normalized.skillGraph = data.skill_graph;
    delete normalized.skill_graph;
  }

  // Handle career_signals -> careerSignals
  if (data.career_signals && !data.careerSignals) {
    const cs = data.career_signals;
    normalized.careerSignals = {
      seniorityLevel: cs.seniority_level || cs.seniorityLevel || '',
      industryFocus: cs.industry_focus || cs.industryFocus || [],
      careerTrajectory: cs.career_trajectory || cs.careerTrajectory || '',
      yearsExperience: cs.years_experience ?? cs.yearsExperience,
    };
    delete normalized.career_signals;
  }

  // Handle star_stories -> starStories
  if (data.star_stories && !data.starStories) {
    normalized.starStories = data.star_stories;
    delete normalized.star_stories;
  }

  // Handle talking_points -> talkingPoints
  if (data.talking_points && !data.talkingPoints) {
    const tp = data.talking_points;
    normalized.talkingPoints = {
      elevatorPitch: tp.elevator_pitch || tp.elevatorPitch || '',
      keyStrengths: tp.key_strengths || tp.keyStrengths || [],
      uniqueValue: tp.unique_value || tp.uniqueValue || '',
    };
    delete normalized.talking_points;
  }

  // Handle ats_analysis -> atsAnalysis
  if (data.ats_analysis && !data.atsAnalysis) {
    const ats = data.ats_analysis;
    normalized.atsAnalysis = {
      atsScore: ats.ats_score ?? ats.atsScore ?? 0,
      scoreBreakdown: ats.score_breakdown || ats.scoreBreakdown || {},
      atsIssues: ats.ats_issues || ats.atsIssues || [],
      keywordGaps: ats.keyword_gaps || ats.keywordGaps || [],
      formattingTips: ats.formatting_tips || ats.formattingTips || [],
      industryKeywords: ats.industry_keywords || ats.industryKeywords || {},
    };
    delete normalized.ats_analysis;
  }

  // Handle gap_analysis -> gapAnalysis
  if (data.gap_analysis && !data.gapAnalysis) {
    normalized.gapAnalysis = data.gap_analysis;
    delete normalized.gap_analysis;
  }

  // Handle key_achievements -> keyAchievements
  if (data.key_achievements && !data.keyAchievements) {
    normalized.keyAchievements = data.key_achievements;
    delete normalized.key_achievements;
  }

  // Handle suggested_roles -> suggestedRoles
  if (data.suggested_roles && !data.suggestedRoles) {
    normalized.suggestedRoles = data.suggested_roles;
    delete normalized.suggested_roles;
  }

  // Handle suggested_questions -> suggestedQuestions
  if (data.suggested_questions && !data.suggestedQuestions) {
    normalized.suggestedQuestions = data.suggested_questions;
    delete normalized.suggested_questions;
  }

  // Handle file_name -> fileName
  if (data.file_name && !data.fileName) {
    normalized.fileName = data.file_name;
    delete normalized.file_name;
  }

  // Handle raw_text -> rawText
  if (data.raw_text && !data.rawText) {
    normalized.rawText = data.raw_text;
    delete normalized.raw_text;
  }

  // Handle location object with snake_case nested fields
  if (data.location) {
    const loc = data.location;
    normalized.location = {
      city: loc.city,
      country: loc.country,
      // Convert snake_case to camelCase for nested location fields
      countryCode: loc.country_code || loc.countryCode,
      stateProvince: loc.state_province || loc.stateProvince,
      rawAddress: loc.raw_address || loc.rawAddress,
    };
  }

  return normalized;
}

const POPULAR_ROLES = [
  'Software Engineer',
  'Product Manager',
  'Data Analyst',
  'UX Designer',
  'Marketing Manager',
  'Sales Representative',
];

const INTERVIEW_TYPES: { value: InterviewType; label: string; description: string }[] = [
  {
    value: 'behavioral',
    label: 'Behavioral',
    description: 'STAR method questions about past experiences',
  },
  {
    value: 'technical',
    label: 'Technical',
    description: 'Role-specific technical knowledge questions',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    description: 'Combination of behavioral and technical',
  },
];

export default function SetupWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, dispatch } = useApp();
  const { userProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>(state.currentSetupStep || 'resume');
  const [isLoading, setIsLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Existing resume versions state (for "Use This Resume" feature)
  const [existingVersions, setExistingVersions] = useState<ResumeVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);

  // Selected stored resume info for preview (when selecting existing version from storage)
  const [storedResumeInfo, setStoredResumeInfo] = useState<{
    downloadUrl: string;
    fileType: 'pdf' | 'docx';
    fileName: string;
  } | null>(null);

  // Session restoration state (for "Continue Session" and "Practice Again" features)
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const sessionRestorationRef = useRef(false); // Ref to prevent duplicate restoration in strict mode
  const continueSessionId = searchParams.get('continue'); // Load existing session (no cloning)
  const cloneSessionId = searchParams.get('clone'); // Clone into new session (Practice Again)
  const restoreSessionId = searchParams.get('restore'); // Legacy - treated as clone
  const stepParam = searchParams.get('step') as WizardStep | null;

  // Job search mode - declare first as other state depends on it
  const [searchMode, setSearchMode] = useState<'ai' | 'manual'>('ai');

  // Job discovery state - separate state for AI discovery vs manual search
  const cachedJobsArray = Object.values(state.cachedJobs) as JobMatch[];
  const [showJobDiscovery, setShowJobDiscovery] = useState(cachedJobsArray.length > 0);
  const [jobsLoading, setJobsLoading] = useState(false);

  // AI Discovery state (persisted to Firestore)
  const [aiDiscoveryJobs, setAiDiscoveryJobs] = useState<JobMatch[]>(cachedJobsArray);
  const [aiDiscoveryAdvice, setAiDiscoveryAdvice] = useState<CareerAdvice | null>(null);
  const [hasRunAiDiscovery, setHasRunAiDiscovery] = useState(cachedJobsArray.length > 0);

  // Search Jobs state (persisted to Firestore)
  const [searchJobsResults, setSearchJobsResults] = useState<JobMatch[]>([]);
  const [searchJobsAdvice, setSearchJobsAdvice] = useState<CareerAdvice | null>(null);

  // Legacy alias for compatibility - returns current tab's jobs
  const recommendedJobs = searchMode === 'ai' ? aiDiscoveryJobs : searchJobsResults;
  const careerAdvice = searchMode === 'ai' ? aiDiscoveryAdvice : searchJobsAdvice;

  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobMatch | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(null);

  // Job search filters
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [jobFilters, setJobFilters] = useState({
    remoteOnly: false,
    country: 'us' as 'us' | 'ca',
    stateProvince: '',
    city: '',
    datePosted: 'all' as DatePostedFilter,
    employmentType: '' as '' | JSearchEmploymentType,
    experienceLevel: '',
    salaryMin: null as number | null,
  });

  // Get regions and cities based on current country/state selection
  const regions = getRegionsForCountry(jobFilters.country);
  const cities = jobFilters.stateProvince ? getCitiesForRegion(jobFilters.country, jobFilters.stateProvince) : [];

  // Handle filter changes with cascading resets
  const handleCountryChange = (newCountry: 'us' | 'ca') => {
    setJobFilters(prev => ({
      ...prev,
      country: newCountry,
      stateProvince: '', // Reset state when country changes
      city: '', // Reset city when country changes
    }));
  };

  const handleStateChange = (newState: string) => {
    setJobFilters(prev => ({
      ...prev,
      stateProvince: newState,
      city: '', // Reset city when state changes
    }));
  };

  const clearAllFilters = () => {
    setJobFilters({
      remoteOnly: false,
      country: 'us',
      stateProvince: '',
      city: '',
      datePosted: 'all',
      employmentType: '',
      experienceLevel: '',
      salaryMin: null,
    });
    setJobSearchQuery('');
  };

  // Initialize job filters from resume location when resume data becomes available
  useEffect(() => {
    const location = state.setup.resumeParsedData?.location;
    if (location?.countryCode) {
      const countryCode = location.countryCode.toLowerCase();
      // Only set if it's a supported country (us or ca)
      if (countryCode === 'us' || countryCode === 'ca') {
        console.log('[SetupWizard] Initializing job filters from resume location:', location);
        setJobFilters(prev => ({
          ...prev,
          country: countryCode as 'us' | 'ca',
          stateProvince: location.stateProvince || '',
          city: location.city || '',
        }));
      }
    }
  }, [state.setup.resumeParsedData?.location]);

  // Resume view tab state
  const [resumeViewTab, setResumeViewTab] = useState<'analysis' | 'preview' | 'ats' | 'improve'>('analysis');

  // Improve resume state
  const [isImprovingResume, setIsImprovingResume] = useState(false);
  const [improvedResumeMarkdown, setImprovedResumeMarkdown] = useState<string | null>(
    state.setup.improvedResumeMarkdown || null
  );
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [editedResumeMarkdown, setEditedResumeMarkdown] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Interview mode selection (voice chat vs text chat)
  const [interviewMode, setInterviewMode] = useState<'voice' | 'text'>('voice');
  const [isSavingResume, setIsSavingResume] = useState(false);

  // Progressive loading states for streaming resume parsing
  const [streamingProgress, setStreamingProgress] = useState({
    basic: false,   // Basic info (name, skills, experience) loaded
    career: false,  // Career analysis (skill_graph, star_stories) loaded
    ats: false,     // ATS analysis loaded
    improve: false, // Improved resume loaded
  });
  const [isLoadingImprovedResume, setIsLoadingImprovedResume] = useState(false);
  const improvedResumeRef = useRef<HTMLDivElement>(null);

  // Typewriter effect state for streaming resume
  const typewriterQueueRef = useRef<string>('');
  const typewriterActiveRef = useRef<boolean>(false);
  const displayedTextRef = useRef<string>('');

  // Typewriter effect - drip out characters one by one
  const processTypewriterQueue = useCallback(() => {
    if (typewriterActiveRef.current) return; // Already processing
    typewriterActiveRef.current = true;

    const drip = () => {
      if (typewriterQueueRef.current.length > 0) {
        // Take 3-5 characters at a time for smoother effect
        const charsToTake = Math.min(3, typewriterQueueRef.current.length);
        const chars = typewriterQueueRef.current.slice(0, charsToTake);
        typewriterQueueRef.current = typewriterQueueRef.current.slice(charsToTake);
        displayedTextRef.current += chars;
        setImprovedResumeMarkdown(displayedTextRef.current);
        
        // Schedule next character (adjust speed: lower = faster)
        setTimeout(drip, 8);
      } else {
        typewriterActiveRef.current = false;
      }
    };

    drip();
  }, []);

  // User preferences for interview configuration
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState({
    stage: 'idle' as 'idle' | 'uploading' | 'parsing' | 'analyzing' | 'complete',
    percentage: 0,
    message: '',
  });

  // Memoize blob URL for resume preview to avoid creating new URLs on every render
  const resumePreviewUrl = useMemo(() => {
    if (resumeFile) {
      return URL.createObjectURL(resumeFile);
    }
    return null;
  }, [resumeFile]);

  // Cleanup blob URL when file changes or component unmounts
  useEffect(() => {
    return () => {
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }
    };
  }, [resumePreviewUrl]);

  const currentStepIndex = STEPS.indexOf(currentStep);

  // Sync currentStep to AppContext for persistence
  useEffect(() => {
    dispatch({ type: 'SET_SETUP_STEP', payload: currentStep });
  }, [currentStep, dispatch]);

  // Handle step URL param for direct navigation (e.g., from "Practice Interview" button)
  useEffect(() => {
    if (stepParam && STEPS.includes(stepParam)) {
      setCurrentStep(stepParam);
    }
  }, [stepParam]);

  // Load user preferences for interview configuration
  useEffect(() => {
    const loadPreferencesData = async () => {
      try {
        const prefs = await getPreferences();
        setUserPreferences(prefs);
      } catch (error) {
        console.error('[SetupWizard] Failed to load preferences:', error);
        // Use defaults if preferences fail to load
      }
    };
    loadPreferencesData();
  }, []);

  // Load existing resume versions for "Use This Resume" feature
  useEffect(() => {
    const loadExistingVersions = async () => {
      try {
        setIsLoadingVersions(true);
        const response = await listResumeVersions();
        if (response.success) {
          setExistingVersions(response.versions);
          setCurrentVersionId(response.currentVersionId || null);
        }
      } catch (error) {
        console.error('[SetupWizard] Failed to load resume versions:', error);
        // Non-fatal - user can still upload new resume
      } finally {
        setIsLoadingVersions(false);
      }
    };
    loadExistingVersions();
  }, []);

  // Session continuation for "Continue Session" feature - loads SAME session (no cloning)
  useEffect(() => {
    const loadExistingSession = async () => {
      // Skip if no continue param or already restoring (use ref for immediate check)
      if (!continueSessionId || isRestoringSession || sessionRestorationRef.current) return;
      sessionRestorationRef.current = true; // Set ref immediately to prevent duplicate calls

      setIsRestoringSession(true);
      console.log('[SetupWizard] Loading existing session (Continue):', continueSessionId);

      try {
        // Fetch session data
        const fullSession = await getFullSession(continueSessionId);
        console.log('[SetupWizard] Full session data:', fullSession);

        // Set the SAME session ID (no new session created!)
        dispatch({ type: 'SET_SESSION_ID', payload: continueSessionId });

        // Restore all setup data (normalize resume data to handle legacy snake_case)
        const setupPayload = {
          targetRole: fullSession.targetRole,
          targetCompany: fullSession.targetCompany || '',
          interviewType: fullSession.interviewType,
          resumeParsedData: normalizeResumeData(fullSession.resumeData),
          improvedResumeMarkdown: fullSession.improvedResumeMarkdown || undefined,
        };
        console.log('[SetupWizard] Dispatching UPDATE_SETUP with:', setupPayload);
        dispatch({
          type: 'UPDATE_SETUP',
          payload: setupPayload,
        });

        // Restore improved resume locally
        if (fullSession.improvedResumeMarkdown) {
          setImprovedResumeMarkdown(fullSession.improvedResumeMarkdown);
        }

        // Restore company intel locally
        if (fullSession.companyIntel) {
          setCompanyIntel(fullSession.companyIntel as CompanyIntel);
        }

        // Restore job discovery data
        if (fullSession.aiDiscovery) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aiData = fullSession.aiDiscovery as any;
          const jobs = (aiData.jobs || []) as JobMatch[];
          const advice = (aiData.careerAdvice || aiData.career_advice || null) as CareerAdvice | null;
          setAiDiscoveryJobs(jobs);
          setAiDiscoveryAdvice(advice);
          setHasRunAiDiscovery(true);
          if (jobs.length > 0) {
            dispatch({ type: 'CACHE_JOBS', payload: jobs });
          }
        }
        if (fullSession.searchJobs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const searchData = fullSession.searchJobs as any;
          const jobs = (searchData.jobs || []) as JobMatch[];
          const advice = (searchData.careerAdvice || searchData.career_advice || null) as CareerAdvice | null;
          const lastQuery = (searchData.lastQuery || searchData.last_query || '') as string;
          const filters = (searchData.filters || {}) as Record<string, unknown>;
          setSearchJobsResults(jobs);
          setSearchJobsAdvice(advice);
          setJobSearchQuery(lastQuery);
          if (Object.keys(filters).length > 0) {
            setJobFilters({
              remoteOnly: (filters.remoteOnly ?? filters.remote_only ?? false) as boolean,
              country: ((filters.country || 'us') as string) as 'us' | 'ca',
              stateProvince: (filters.stateProvince || filters.state_province || '') as string,
              city: (filters.city || '') as string,
              datePosted: ((filters.datePosted || filters.date_posted || 'all') as string) as DatePostedFilter,
              employmentType: ((filters.employmentType || filters.employment_type || '') as string) as '' | JSearchEmploymentType,
              experienceLevel: (filters.experienceLevel || filters.experience_level || '') as string,
              salaryMin: (filters.salaryMin ?? filters.salary_min ?? null) as number | null,
            });
          }
          if (jobs.length > 0) {
            dispatch({ type: 'CACHE_JOBS', payload: jobs });
          }
        }

        // Show job discovery panel if we have job data
        if (fullSession.hasAiDiscovery || fullSession.hasSearchJobs) {
          setShowJobDiscovery(true);
        }

        // Set step based on session data
        setCurrentStep(fullSession.hasResumeData ? 'role' : 'resume');

        toast.success('Session loaded! Pick up where you left off.');

        // Clear URL params
        navigate('/setup', { replace: true });
      } catch (error) {
        console.error('[SetupWizard] Failed to load session:', error);
        toast.error('Could not load session. Starting fresh.');
        navigate('/setup', { replace: true });
      } finally {
        setIsRestoringSession(false);
        sessionRestorationRef.current = false; // Reset ref after completion
      }
    };

    loadExistingSession();
  }, [continueSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session cloning for "Practice Again" feature - creates NEW session with cloned data
  useEffect(() => {
    const cloneSessionIntoNew = async () => {
      // Use clone param or legacy restore param
      const sourceSessionId = cloneSessionId || restoreSessionId;
      // Skip if no clone param or already restoring (use ref for immediate check)
      if (!sourceSessionId || isRestoringSession || sessionRestorationRef.current) return;
      sessionRestorationRef.current = true; // Set ref immediately to prevent duplicate calls

      setIsRestoringSession(true);
      console.log('[SetupWizard] Cloning session for Practice Again:', sourceSessionId);

      try {
        // Fetch old session data to clone
        const fullSession = await getFullSession(sourceSessionId);
        console.log('[SetupWizard] Full session data:', fullSession);

        // Create a NEW session with cloned basic data
        const newSession = await createSession({
          targetRole: fullSession.targetRole || 'General',
          targetCompany: fullSession.targetCompany || undefined,
          interviewType: fullSession.interviewType || 'behavioral',
        });
        console.log('[SetupWizard] Created new session:', newSession.sessionId);

        // Clear old feedback since this is a new practice session
        dispatch({ type: 'CLEAR_FEEDBACK' });

        // Set the NEW session ID
        dispatch({ type: 'SET_SESSION_ID', payload: newSession.sessionId });

        // Restore all setup data including target role and company (normalize resume data to handle legacy snake_case)
        const setupPayload = {
          targetRole: fullSession.targetRole,
          targetCompany: fullSession.targetCompany || '',
          interviewType: fullSession.interviewType,
          resumeParsedData: normalizeResumeData(fullSession.resumeData),
          improvedResumeMarkdown: fullSession.improvedResumeMarkdown || undefined,
        };
        console.log('[SetupWizard] Dispatching UPDATE_SETUP with:', setupPayload);
        dispatch({
          type: 'UPDATE_SETUP',
          payload: setupPayload,
        });

        // Note: Resume data is restored to local state above (resumeParsedData).
        // The backend session update API doesn't support copying resume fields,
        // so the user may need to re-upload their resume for the new session
        // if they want it persisted server-side. Local state will have the data.

        // Restore improved resume locally
        if (fullSession.improvedResumeMarkdown) {
          setImprovedResumeMarkdown(fullSession.improvedResumeMarkdown);
        }

        // Restore company intel locally
        if (fullSession.companyIntel) {
          setCompanyIntel(fullSession.companyIntel as CompanyIntel);
        }

        // Restore job discovery data (handle both camelCase and legacy snake_case formats)
        if (fullSession.aiDiscovery) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aiData = fullSession.aiDiscovery as any;
          const jobs = (aiData.jobs || []) as JobMatch[];
          const advice = (aiData.careerAdvice || aiData.career_advice || null) as CareerAdvice | null;
          setAiDiscoveryJobs(jobs);
          setAiDiscoveryAdvice(advice);
          setHasRunAiDiscovery(true);
          if (jobs.length > 0) {
            dispatch({ type: 'CACHE_JOBS', payload: jobs });
          }
          console.log('[SetupWizard] Restored AI discovery:', jobs.length, 'jobs');
        }
        if (fullSession.searchJobs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const searchData = fullSession.searchJobs as any;
          const jobs = (searchData.jobs || []) as JobMatch[];
          const advice = (searchData.careerAdvice || searchData.career_advice || null) as CareerAdvice | null;
          const lastQuery = (searchData.lastQuery || searchData.last_query || '') as string;
          const filters = (searchData.filters || {}) as Record<string, unknown>;
          setSearchJobsResults(jobs);
          setSearchJobsAdvice(advice);
          setJobSearchQuery(lastQuery);
          if (Object.keys(filters).length > 0) {
            setJobFilters({
              remoteOnly: (filters.remoteOnly ?? filters.remote_only ?? false) as boolean,
              country: ((filters.country || 'us') as string) as 'us' | 'ca',
              stateProvince: (filters.stateProvince || filters.state_province || '') as string,
              city: (filters.city || '') as string,
              datePosted: ((filters.datePosted || filters.date_posted || 'all') as string) as DatePostedFilter,
              employmentType: ((filters.employmentType || filters.employment_type || '') as string) as '' | JSearchEmploymentType,
              experienceLevel: (filters.experienceLevel || filters.experience_level || '') as string,
              salaryMin: (filters.salaryMin ?? filters.salary_min ?? null) as number | null,
            });
          }
          if (jobs.length > 0) {
            dispatch({ type: 'CACHE_JOBS', payload: jobs });
          }
          console.log('[SetupWizard] Restored search jobs:', jobs.length, 'jobs');
        }

        // Show job discovery panel if we have job data
        if (fullSession.hasAiDiscovery || fullSession.hasSearchJobs) {
          setShowJobDiscovery(true);
        }

        // Set step based on restored data - go to role step if resume is available
        setCurrentStep(fullSession.hasResumeData ? 'role' : 'resume');

        toast.success('Session cloned! Practice again with the same settings.');

        // Clear URL params
        navigate('/setup', { replace: true });
      } catch (error) {
        console.error('[SetupWizard] Failed to clone session:', error);
        toast.error('Could not clone session. Starting fresh.');
        navigate('/setup', { replace: true });
      } finally {
        setIsRestoringSession(false);
        sessionRestorationRef.current = false; // Reset ref after completion
      }
    };

    cloneSessionIntoNew();
  }, [cloneSessionId, restoreSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect user change and reset session
  useEffect(() => {
    // Don't reset during active operations
    if (isLoading) {
      return;
    }
    
    const lastUid = localStorage.getItem('coachmic_last_uid');

    if (userProfile && lastUid && lastUid !== userProfile.uid) {
      // Different user detected - reset setup state
      console.log('[SetupWizard] Different user detected, resetting session');
      dispatch({ type: 'RESET_SESSION' });
      setCurrentStep('resume');
      setResumeFile(null);
      // Reset AI discovery state
      setAiDiscoveryJobs([]);
      setAiDiscoveryAdvice(null);
      setHasRunAiDiscovery(false);
      // Reset search jobs state
      setSearchJobsResults([]);
      setSearchJobsAdvice(null);
      setShowJobDiscovery(false);
    }

    if (userProfile) {
      localStorage.setItem('coachmic_last_uid', userProfile.uid);
    }
  }, [userProfile, dispatch, isLoading]);

  // Track if we've already attempted to load the improved resume
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // Load improved resume from API when session exists but not in local state
  useEffect(() => {
    const loadImprovedResume = async () => {
      // Skip if we already have it, no session, already loading, or already attempted
      if (improvedResumeMarkdown || !state.sessionId || isLoadingImprovedResume || hasAttemptedLoad) {
        return;
      }

      // Check global state first
      if (state.setup.improvedResumeMarkdown) {
        setImprovedResumeMarkdown(state.setup.improvedResumeMarkdown);
        setHasAttemptedLoad(true);
        return;
      }

      // Fetch from API
      setIsLoadingImprovedResume(true);
      setHasAttemptedLoad(true); // Mark as attempted before fetch
      try {
        const response = await getImprovedResume(state.sessionId);
        if (response.success && response.improvedResumeMarkdown) {
          setImprovedResumeMarkdown(response.improvedResumeMarkdown);
          dispatch({ type: 'UPDATE_SETUP', payload: { improvedResumeMarkdown: response.improvedResumeMarkdown } });
        }
      } catch (error) {
        // Silent fail - no improved resume exists yet
        console.debug('[SetupWizard] No improved resume found for session');
      } finally {
        setIsLoadingImprovedResume(false);
      }
    };

    loadImprovedResume();
  }, [state.sessionId, state.setup.improvedResumeMarkdown, improvedResumeMarkdown, hasAttemptedLoad, dispatch]);

  // Load saved company intel from Firestore only when on company step (step 3)
  // This avoids unnecessary API calls when on other steps
  const [hasAttemptedCompanyIntelLoad, setHasAttemptedCompanyIntelLoad] = useState(false);

  useEffect(() => {
    const loadSavedCompanyIntel = async () => {
      // Only load when on company step AND we don't already have intel
      if (currentStep !== 'company' || companyIntel || !state.sessionId || hasAttemptedCompanyIntelLoad) {
        return;
      }

      setHasAttemptedCompanyIntelLoad(true);
      try {
        const response = await getSavedCompanyIntel();
        if (response.success && response.intel) {
          console.log('[SetupWizard] Loaded saved company intel from session');
          setCompanyIntel(response.intel);
        }
      } catch (error) {
        // Silent fail - no saved company intel exists yet
        console.debug('[SetupWizard] No saved company intel found for session');
      }
    };

    loadSavedCompanyIntel();
  }, [currentStep, state.sessionId, companyIntel, hasAttemptedCompanyIntelLoad]);

  // NOTE: We no longer sync from cachedJobs to aiDiscoveryJobs because:
  // 1. The cache mixes AI discovery and search jobs together
  // 2. Firestore is now the source of truth for job discovery data
  // 3. The loadJobDiscoveryFromSession effect below properly separates AI vs Search jobs
  // The cache is still used for fast navigation within the same session (not on page refresh)

  // Load full session data from Firestore on page refresh when session exists
  // This loads job discovery data, company intel, etc. from Firestore as the source of truth
  const [hasAttemptedSessionDataLoad, setHasAttemptedSessionDataLoad] = useState(false);

  useEffect(() => {
    const loadSessionDataFromFirestore = async () => {
      // Skip if:
      // - No session ID
      // - Already attempted to load
      // - Already have data loaded (jobs or company intel)
      // - Restoring session via Practice Again (handled separately)
      if (
        !state.sessionId ||
        hasAttemptedSessionDataLoad ||
        aiDiscoveryJobs.length > 0 ||
        searchJobsResults.length > 0 ||
        restoreSessionId // Don't double-load during Practice Again
      ) {
        return;
      }

      setHasAttemptedSessionDataLoad(true);
      console.log('[SetupWizard] Loading session data from Firestore for session:', state.sessionId);

      try {
        const fullSession = await getFullSession(state.sessionId);

        // Restore AI discovery jobs
        if (fullSession.aiDiscovery) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aiData = fullSession.aiDiscovery as any;
          const jobs = (aiData.jobs || []) as JobMatch[];
          const advice = (aiData.careerAdvice || aiData.career_advice || null) as CareerAdvice | null;

          if (jobs.length > 0) {
            setAiDiscoveryJobs(jobs);
            setAiDiscoveryAdvice(advice);
            setHasRunAiDiscovery(true);
            dispatch({ type: 'CACHE_JOBS', payload: jobs });
            console.log('[SetupWizard] Loaded AI discovery from Firestore:', jobs.length, 'jobs');
          }
        }

        // Restore search jobs
        if (fullSession.searchJobs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const searchData = fullSession.searchJobs as any;
          const jobs = (searchData.jobs || []) as JobMatch[];
          const advice = (searchData.careerAdvice || searchData.career_advice || null) as CareerAdvice | null;
          const lastQuery = (searchData.lastQuery || searchData.last_query || '') as string;
          const filters = (searchData.filters || {}) as Record<string, unknown>;

          if (jobs.length > 0) {
            setSearchJobsResults(jobs);
            setSearchJobsAdvice(advice);
            setJobSearchQuery(lastQuery);
            // Restore filters
            if (Object.keys(filters).length > 0) {
              setJobFilters({
                remoteOnly: (filters.remoteOnly ?? filters.remote_only ?? false) as boolean,
                country: ((filters.country || 'us') as string) as 'us' | 'ca',
                stateProvince: (filters.stateProvince || filters.state_province || '') as string,
                city: (filters.city || '') as string,
                datePosted: ((filters.datePosted || filters.date_posted || 'all') as string) as DatePostedFilter,
                employmentType: ((filters.employmentType || filters.employment_type || '') as string) as '' | JSearchEmploymentType,
                experienceLevel: (filters.experienceLevel || filters.experience_level || '') as string,
                salaryMin: (filters.salaryMin ?? filters.salary_min ?? null) as number | null,
              });
            }
            dispatch({ type: 'CACHE_JOBS', payload: jobs });
            console.log('[SetupWizard] Loaded search jobs from Firestore:', jobs.length, 'jobs');
          }
        }

        // Show job discovery panel if we loaded any data
        if (fullSession.hasAiDiscovery || fullSession.hasSearchJobs) {
          setShowJobDiscovery(true);
        }

        // Also restore company intel from the same session data
        if (fullSession.companyIntel && !companyIntel) {
          setCompanyIntel(fullSession.companyIntel as CompanyIntel);
          console.log('[SetupWizard] Loaded company intel from Firestore');
        }
      } catch (error) {
        console.debug('[SetupWizard] Could not load session data from Firestore:', error);
      }
    };

    loadSessionDataFromFirestore();
  }, [state.sessionId, hasAttemptedSessionDataLoad, aiDiscoveryJobs.length, searchJobsResults.length, restoreSessionId, dispatch, companyIntel]);

  // Clear local state when session is reset (no resumeParsedData means fresh session)
  // But preserve jobs if they exist in cache
  useEffect(() => {
    if (!state.setup.resumeParsedData && !state.sessionId) {
      setResumeFile(null);
      setCurrentStep('resume');
      // Only clear jobs if there are no cached jobs
      if (Object.keys(state.cachedJobs).length === 0) {
        setAiDiscoveryJobs([]);
        setAiDiscoveryAdvice(null);
        setHasRunAiDiscovery(false);
        setSearchJobsResults([]);
        setSearchJobsAdvice(null);
        setShowJobDiscovery(false);
      }
      setImprovedResumeMarkdown(null);
      setHasAttemptedLoad(false); // Reset so we can try loading again for new session
      setCompanyIntel(null); // Clear company intel on session reset
      setHasAttemptedCompanyIntelLoad(false); // Reset so we can try loading again for new session
    }
  }, [state.setup.resumeParsedData, state.sessionId, state.cachedJobs]);

  // Load AI-recommended jobs (saved to Firestore ai_discovery)
  const loadRecommendedJobs = useCallback(async () => {
    if (!state.setup.resumeParsedData || !state.sessionId) return;

    setJobsLoading(true);
    try {
      // Pass the country from filters (which is initialized from resume location)
      const response = await getRecommendedJobs(5, jobFilters.country);
      // Update AI discovery state (backend saves to Firestore)
      setAiDiscoveryJobs(response.jobs);
      setAiDiscoveryAdvice(response.careerAdvice || null);
      setHasRunAiDiscovery(true);
      // Cache all discovered jobs for navigation persistence
      if (response.jobs.length > 0) {
        dispatch({ type: 'CACHE_JOBS', payload: response.jobs });
      }
    } catch (error) {
      console.error('Failed to load recommended jobs:', error);
      toast.error('Unable to load job recommendations');
    } finally {
      setJobsLoading(false);
    }
  }, [state.setup.resumeParsedData, state.sessionId, dispatch, jobFilters.country]);

  // Search for jobs with filters (saved to Firestore search_jobs)
  const handleJobSearch = useCallback(async () => {
    if (!state.sessionId) return;

    setJobsLoading(true);
    try {
      // Build location string from filters
      const locationString = buildLocationString(
        jobFilters.country,
        jobFilters.stateProvince,
        jobFilters.city
      );

      const response = await searchJobs({
        query: jobSearchQuery,
        skills: state.setup.resumeParsedData?.skills || [],
        remoteOnly: jobFilters.remoteOnly,
        limit: 10,
        country: jobFilters.country,
        location: locationString || undefined,
        datePosted: jobFilters.datePosted !== 'all' ? jobFilters.datePosted : undefined,
        employmentType: jobFilters.employmentType || undefined,
        experienceLevel: jobFilters.experienceLevel || undefined,
        salaryMin: jobFilters.salaryMin || undefined,
      });
      // Update search jobs state (backend saves to Firestore with filters)
      setSearchJobsResults(response.jobs);
      setSearchJobsAdvice(response.careerAdvice || null);
      // Cache all searched jobs for navigation persistence
      if (response.jobs.length > 0) {
        dispatch({ type: 'CACHE_JOBS', payload: response.jobs });
      }
    } catch (error) {
      console.error('Failed to search jobs:', error);
      toast.error('Job search failed');
    } finally {
      setJobsLoading(false);
    }
  }, [jobSearchQuery, state.sessionId, state.setup.resumeParsedData?.skills, dispatch, jobFilters]);

  // Select a job and use its role for interview
  const handleSelectJob = (job: JobMatch) => {
    setSelectedJob(job);

    // Check if this is a saved job (single source of truth)
    const isSavedJob = job.saved || savedJobIds.has(job.job.jobId);

    // Update setup with job data and artifacts (if available from saved job)
    dispatch({
      type: 'UPDATE_SETUP',
      payload: {
        targetRole: job.job.title,
        targetCompany: job.job.company,
        // Saved job reference
        savedJobId: isSavedJob ? job.job.jobId : undefined,
        selectedJobData: job.job,
        // Load artifacts from saved job if available
        coverLetter: job.coverLetter || undefined,
        companyIntel: job.companyIntel || undefined,
      },
    });

    // If saved job is missing artifacts, trigger background generation
    if (isSavedJob) {
      const needsCoverLetter = !job.coverLetter;
      const needsIntel = !job.companyIntel;
      if (needsCoverLetter || needsIntel) {
        triggerArtifactGeneration(job.job.jobId, {
          coverLetter: needsCoverLetter,
          companyIntel: needsIntel,
          resumeMarkdown: state.setup.improvedResumeMarkdown || undefined,
          targetRole: job.job.title,
          targetCompany: job.job.company,
          jobData: job.job,
        });
      }
    }

    toast.success(`Selected: ${job.job.title} at ${job.job.company}`);
  };

  // Toggle save/unsave job
  const handleToggleSaveJob = async (event: React.MouseEvent, jobId: string, jobTitle: string) => {
    event.stopPropagation(); // Prevent triggering job selection

    const isSaved = savedJobIds.has(jobId);

    try {
      if (isSaved) {
        await unsaveJob(jobId);
        setSavedJobIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
        toast.success(`Removed "${jobTitle}" from saved jobs`);
      } else {
        // Find the job to get its data and fitAnalysis (avoids lookups and AI calls)
        const jobMatch = recommendedJobs.find(j => j.job.jobId === jobId);
        await saveJob(jobId, jobMatch?.fitAnalysis, jobMatch?.job);
        setSavedJobIds(prev => new Set(prev).add(jobId));
        toast.success(`Saved "${jobTitle}" to your job list`);

        // Trigger background artifact generation (cover letter + company intel)
        if (jobMatch?.job) {
          triggerArtifactGeneration(jobId, {
            coverLetter: true,
            companyIntel: true,
            resumeMarkdown: state.setup.improvedResumeMarkdown || undefined,
            targetRole: jobMatch.job.title,
            targetCompany: jobMatch.job.company,
            jobData: jobMatch.job,
          });
        }
      }
    } catch (error) {
      console.error('[SaveJob] Error:', error);
      toast.error(isSaved ? 'Failed to unsave job' : 'Failed to save job');
    }
  };

  // File upload handler with streaming for progressive updates
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a PDF or DOCX file.');
      return;
    }

    setResumeFile(file);
    setStoredResumeInfo(null); // Clear stored resume info when uploading a new file
    setIsLoading(true);

    // Reset streaming progress
    setStreamingProgress({ basic: false, career: false, ats: false, improve: false });

    // Track accumulated data for merging (typed as partial ResumeData)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let accumulatedData: any = { fileName: file.name };

    try {
      // Stage 1: Uploading
      setUploadProgress({ stage: 'uploading', percentage: 20, message: 'Uploading file...' });

      // Stage 2: Starting parallel AI analysis
      setUploadProgress({ stage: 'analyzing', percentage: 30, message: 'AI analyzing in parallel...' });

      await parseResumeStream(file, {
        onBasicData: (data) => {
          console.log('[SetupWizard] Basic data received');
          accumulatedData = { ...accumulatedData, ...data };
          setStreamingProgress(prev => ({ ...prev, basic: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 50, message: 'Basic info extracted...' });

          // Update state with partial data
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              resumeFile: file,
              resumeParsedData: accumulatedData,
            },
          });
        },

        onCareerData: (data) => {
          console.log('[SetupWizard] Career data received');
          accumulatedData = { ...accumulatedData, ...data };
          setStreamingProgress(prev => ({ ...prev, career: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 90, message: 'Career analysis complete...' });

          // Merge career data into state
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              resumeParsedData: accumulatedData,
            },
          });
        },

        onAtsData: (data) => {
          console.log('[SetupWizard] ATS data received');
          // Convert snake_case to camelCase for frontend
          const atsAnalysis = {
            atsScore: (data as Record<string, unknown>).ats_score,
            scoreBreakdown: (data as Record<string, unknown>).score_breakdown,
            atsIssues: (data as Record<string, unknown>).ats_issues,
            keywordGaps: (data as Record<string, unknown>).keyword_gaps,
            formattingTips: (data as Record<string, unknown>).formatting_tips,
            industryKeywords: (data as Record<string, unknown>).industry_keywords,
          };
          accumulatedData = { ...accumulatedData, atsAnalysis };
          setStreamingProgress(prev => ({ ...prev, ats: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 60, message: 'ATS analysis complete, improving resume...' });

          // Merge ATS data into state
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              resumeParsedData: accumulatedData,
            },
          });
        },

        onImproveData: (markdown) => {
          console.log('[SetupWizard] Improve data received');
          setImprovedResumeMarkdown(markdown);
          setStreamingProgress(prev => ({ ...prev, improve: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 80, message: 'Resume improved...' });

          // Save improved markdown to state
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              improvedResumeMarkdown: markdown,
            },
          });
        },

        onComplete: (sessionId) => {
          console.log('[SetupWizard] All tasks complete, sessionId:', sessionId);

          // Store session ID
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

          // Stage complete
          setUploadProgress({ stage: 'complete', percentage: 100, message: 'All analysis complete!' });

          // Reset progress after brief delay
          setTimeout(() => {
            setUploadProgress({ stage: 'idle', percentage: 0, message: '' });
          }, 1500);

          toast.success('Resume analysis complete!');
          setIsLoading(false);
        },

        onError: (error, task) => {
          console.error('[SetupWizard] Stream error:', error, 'task:', task);
          if (task) {
            // Non-fatal error - one task failed but others may succeed
            toast.error(`${task} analysis failed: ${error}`);
          } else {
            // Fatal error
            toast.error(`Resume parsing failed: ${error}`);
            setUploadProgress({ stage: 'idle', percentage: 0, message: '' });
            setIsLoading(false);
          }
        },
      });
    } catch (error) {
      console.error('Resume upload error:', error);
      toast.error('Failed to parse resume. You can skip this step.');
      setUploadProgress({ stage: 'idle', percentage: 0, message: '' });
      setIsLoading(false);
    }
  }, [dispatch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  // Handler for selecting an existing resume version
  const handleSelectExistingVersion = useCallback(async (version: ResumeVersion) => {
    console.log('[SetupWizard] Selecting existing version:', version.versionId);
    setIsLoading(true);

    // Clear local file since we're using a stored version
    setResumeFile(null);

    // Reset streaming progress
    setStreamingProgress({ basic: false, career: false, ats: false, improve: false });

    // Track accumulated data for merging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let accumulatedData: any = { fileName: version.fileName };

    try {
      // Stage 1: Get download URL for preview
      setUploadProgress({ stage: 'uploading', percentage: 10, message: 'Getting resume file...' });

      // Fetch download URL for preview
      const downloadResponse = await getResumeVersionDownloadUrl(version.versionId);
      if (downloadResponse.success && downloadResponse.downloadUrl) {
        setStoredResumeInfo({
          downloadUrl: downloadResponse.downloadUrl,
          fileType: version.fileType,
          fileName: version.fileName,
        });
      }

      // Stage 2: Loading
      setUploadProgress({ stage: 'uploading', percentage: 20, message: 'Loading stored resume...' });

      // Stage 2: Starting parallel AI analysis
      setUploadProgress({ stage: 'analyzing', percentage: 30, message: 'AI analyzing in parallel...' });

      await reparseStoredResumeStream(version.versionId, state.sessionId, {
        onBasicData: (data) => {
          console.log('[SetupWizard] Basic data received (reparse)');
          accumulatedData = { ...accumulatedData, ...data };
          setStreamingProgress(prev => ({ ...prev, basic: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 50, message: 'Basic info extracted...' });

          // Update state with partial data
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              resumeParsedData: accumulatedData,
            },
          });
        },

        onCareerData: (data) => {
          console.log('[SetupWizard] Career data received (reparse)');
          accumulatedData = { ...accumulatedData, ...data };
          setStreamingProgress(prev => ({ ...prev, career: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 90, message: 'Career analysis complete...' });

          // Merge career data into state
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              resumeParsedData: accumulatedData,
            },
          });
        },

        onAtsData: (data) => {
          console.log('[SetupWizard] ATS data received (reparse)');
          // Convert snake_case to camelCase for frontend
          const atsAnalysis = {
            atsScore: (data as Record<string, unknown>).ats_score,
            scoreBreakdown: (data as Record<string, unknown>).score_breakdown,
            atsIssues: (data as Record<string, unknown>).ats_issues,
            keywordGaps: (data as Record<string, unknown>).keyword_gaps,
            formattingTips: (data as Record<string, unknown>).formatting_tips,
            industryKeywords: (data as Record<string, unknown>).industry_keywords,
          };
          accumulatedData = { ...accumulatedData, atsAnalysis };
          setStreamingProgress(prev => ({ ...prev, ats: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 60, message: 'ATS analysis complete, improving resume...' });

          // Merge ATS data into state
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              resumeParsedData: accumulatedData,
            },
          });
        },

        onImproveData: (markdown) => {
          console.log('[SetupWizard] Improve data received (reparse)');
          setImprovedResumeMarkdown(markdown);
          setStreamingProgress(prev => ({ ...prev, improve: true }));
          setUploadProgress({ stage: 'analyzing', percentage: 80, message: 'Resume improved...' });

          // Save improved markdown to state
          dispatch({
            type: 'UPDATE_SETUP',
            payload: {
              improvedResumeMarkdown: markdown,
            },
          });
        },

        onComplete: (sessionId) => {
          console.log('[SetupWizard] All tasks complete (reparse), sessionId:', sessionId);

          // Store session ID
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

          // Stage complete
          setUploadProgress({ stage: 'complete', percentage: 100, message: 'All analysis complete!' });

          // Reset progress after brief delay
          setTimeout(() => {
            setUploadProgress({ stage: 'idle', percentage: 0, message: '' });
          }, 1500);

          toast.success('Resume analysis complete!');
          setIsLoading(false);
        },

        onError: (error, task) => {
          console.error('[SetupWizard] Reparse error:', error, task);
          if (task) {
            // Non-fatal task error - continue
            toast.error(`${task} analysis failed: ${error}`);
          } else {
            // Fatal error
            toast.error(`Failed to analyze resume: ${error}`);
            setUploadProgress({ stage: 'idle', percentage: 0, message: '' });
            setIsLoading(false);
          }
        },
      });
    } catch (error) {
      console.error('Resume reparse error:', error);
      toast.error('Failed to analyze stored resume. Try uploading a new file.');
      setUploadProgress({ stage: 'idle', percentage: 0, message: '' });
      setIsLoading(false);
    }
  }, [dispatch, state.sessionId]);

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      // When moving from company step to type step, trigger artifact generation for non-saved jobs
      if (currentStep === 'company' && STEPS[nextIndex] === 'type') {
        const hasSelectedJob = selectedJob?.job;
        const isSavedJob = !!state.setup.savedJobId;
        const hasArtifacts = !!state.setup.coverLetter && !!state.setup.companyIntel;

        // Only generate if: non-saved job with selected job data, and missing artifacts
        if (hasSelectedJob && !isSavedJob && !hasArtifacts) {
          console.log('[SetupWizard] Triggering session artifact generation for non-saved job');
          triggerSessionArtifactGeneration(
            {
              coverLetter: true,
              companyIntel: true,
              resumeMarkdown: state.setup.improvedResumeMarkdown || undefined,
              targetRole: selectedJob.job.title,
              targetCompany: selectedJob.job.company,
              jobData: selectedJob.job,
            },
            // On cover letter generated - update AppContext
            (coverLetter) => {
              dispatch({
                type: 'UPDATE_SETUP',
                payload: { coverLetter },
              });
            },
            // On company intel generated - update AppContext
            (intel) => {
              dispatch({
                type: 'UPDATE_SETUP',
                payload: { companyIntel: intel },
              });
              setCompanyIntel(intel); // Also update local state
            }
          );
        }
      }

      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleStartInterview = async () => {
    // Validate required fields
    if (!state.setup.targetRole) {
      toast.error('Please select a target role');
      goToStep('role');
      return;
    }

    setIsLoading(true);

    // Clear any old transcript/feedback data before starting a new interview
    // This ensures fresh state regardless of session update vs create path
    dispatch({ type: 'SET_TRANSCRIPT', payload: [] });
    dispatch({ type: 'SET_FEEDBACK', payload: null as unknown as FeedbackData });

    try {
      let sessionId = state.sessionId;

      // Try to update existing session, or create new one
      if (sessionId) {
        try {
          // Session already exists (from resume upload), update it with final values
          await updateSession(sessionId, {
            targetRole: state.setup.targetRole,
            targetCompany: state.setup.targetCompany,
            interviewType: state.setup.interviewType,
            interviewLength: userPreferences?.default_interview_length || 'medium',
            difficultyLevel: userPreferences?.difficulty_level || 'medium',
          });
        } catch (updateError) {
          // Session not found on backend (server restarted), create new one
          console.log('Session not found, creating new one...');
          const session = await createSession({
            targetRole: state.setup.targetRole,
            targetCompany: state.setup.targetCompany,
            interviewType: state.setup.interviewType,
            interviewLength: userPreferences?.default_interview_length || 'medium',
            difficultyLevel: userPreferences?.difficulty_level || 'medium',
          });
          sessionId = session.sessionId;
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
        }
      } else {
        // No session exists, create new one
        const session = await createSession({
          targetRole: state.setup.targetRole,
          targetCompany: state.setup.targetCompany,
          interviewType: state.setup.interviewType,
          interviewLength: userPreferences?.default_interview_length || 'medium',
          difficultyLevel: userPreferences?.difficulty_level || 'medium',
        });
        sessionId = session.sessionId;
        dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
      }

      dispatch({ type: 'SET_STATUS', payload: 'interviewing' });
      // Navigate based on selected interview mode
      navigate(interviewMode === 'text' ? '/text-interview' : '/interview');
    } catch (error) {
      console.error('Start interview error:', error);
      toast.error('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCoaching = async () => {
    // Validate required fields
    if (!state.setup.targetRole) {
      toast.error('Please select a target role');
      goToStep('role');
      return;
    }

    setIsLoading(true);

    try {
      let sessionId = state.sessionId;

      // Try to update existing session, or create new one
      if (sessionId) {
        try {
          await updateSession(sessionId, {
            targetRole: state.setup.targetRole,
            targetCompany: state.setup.targetCompany,
            interviewType: state.setup.interviewType,
            interviewLength: userPreferences?.default_interview_length || 'medium',
            difficultyLevel: userPreferences?.difficulty_level || 'medium',
          });
        } catch (updateError) {
          console.log('Session not found, creating new one...');
          const session = await createSession({
            targetRole: state.setup.targetRole,
            targetCompany: state.setup.targetCompany,
            interviewType: state.setup.interviewType,
            interviewLength: userPreferences?.default_interview_length || 'medium',
            difficultyLevel: userPreferences?.difficulty_level || 'medium',
          });
          sessionId = session.sessionId;
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
        }
      } else {
        const session = await createSession({
          targetRole: state.setup.targetRole,
          targetCompany: state.setup.targetCompany,
          interviewType: state.setup.interviewType,
          interviewLength: userPreferences?.default_interview_length || 'medium',
          difficultyLevel: userPreferences?.difficulty_level || 'medium',
        });
        sessionId = session.sessionId;
        dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
      }

      // Navigate to coach with pre-interview type
      navigate('/coach?type=pre_interview');
    } catch (error) {
      console.error('Start coaching error:', error);
      toast.error('Failed to start coaching. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state during session restoration
  if (isRestoringSession) {
    return (
      <div className="min-h-[calc(100vh-8rem)] py-8 px-4">
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Restoring Your Session</h2>
          <p className="text-gray-600">Loading your previous interview setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => goToStep(step)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors ${
                    index <= currentStepIndex
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-1 mx-1 ${
                      index < currentStepIndex ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            Step {currentStepIndex + 1} of {STEPS.length}:{' '}
            {currentStep === 'resume' && 'Upload Resume'}
            {currentStep === 'role' && 'Select Role'}
            {currentStep === 'company' && 'Target Company'}
            {currentStep === 'type' && 'Interview Type'}
          </p>
        </div>

        {/* Step Content */}
        <div className="card">
          {/* Resume Upload Step */}
          {currentStep === 'resume' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-semibold">Upload Your Resume</h2>
                <HelpTooltip {...helpContent.resumeUpload} />
              </div>
              <p className="text-gray-600 mb-6">
                Upload your resume to get personalized interview questions based on your experience.
              </p>

              {/* Existing Resume Versions Selector */}
              {!isLoadingVersions && existingVersions.length > 0 && !state.setup.resumeParsedData && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Your Saved Resumes</h3>
                  <div className="space-y-2">
                    {existingVersions.map((version) => {
                      const isCurrent = version.versionId === currentVersionId;
                      const uploadDate = new Date(version.uploadedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      const fileSize = version.fileSize < 1024 * 1024
                        ? `${(version.fileSize / 1024).toFixed(0)} KB`
                        : `${(version.fileSize / (1024 * 1024)).toFixed(1)} MB`;

                      return (
                        <div
                          key={version.versionId}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isCurrent ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white'
                          } ${isLoading ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            {version.isAiImproved ? (
                              <SparklesIcon className="w-5 h-5 text-purple-500" />
                            ) : (
                              <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900 truncate max-w-[200px]">
                                  {version.fileName}
                                </span>
                                {isCurrent && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    Current
                                  </span>
                                )}
                                {version.isAiImproved && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                    AI Improved
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {uploadDate} • {fileSize}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelectExistingVersion(version)}
                            disabled={isLoading}
                            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Use This
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-white text-gray-500">Or upload a new resume</span>
                    </div>
                  </div>
                </div>
              )}

              <div
                {...getRootProps()}
                data-tour="resume-upload"
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-primary-400'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input {...getInputProps()} />
                {isLoading ? (
                  <div className="py-4">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-600">Parsing resume...</p>
                  </div>
                ) : resumeFile ? (
                  <div className="py-4">
                    <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">{resumeFile.name}</p>
                    <p className="text-sm text-gray-500 mt-1">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="py-4">
                    <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="font-medium">Drop your resume here</p>
                    <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                    <p className="text-xs text-gray-400 mt-2">PDF or DOCX, max 5MB</p>
                  </div>
                )}
              </div>

              {/* Upload Progress Indicator */}
              {uploadProgress.stage !== 'idle' && (
                <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">
                      {uploadProgress.message}
                    </span>
                    <span className="text-sm text-blue-700 font-semibold">
                      {uploadProgress.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {uploadProgress.stage === 'uploading' && (
                      <span className="text-xs text-blue-600">Uploading...</span>
                    )}
                    {uploadProgress.stage === 'parsing' && (
                      <span className="text-xs text-blue-600">Extracting...</span>
                    )}
                    {uploadProgress.stage === 'analyzing' && (
                      <span className="text-xs text-blue-600">AI Analyzing...</span>
                    )}
                    {uploadProgress.stage === 'complete' && (
                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircleIcon className="w-4 h-4" /> Complete!</span>
                    )}
                  </div>
                </div>
              )}

              {/* Enhanced Resume Preview - shown after successful upload */}
              {state.setup.resumeParsedData && (
                <div className="mt-6 space-y-4">
                  {/* Header Card */}
                  <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">Resume Analysis Complete</h3>
                        <p className="text-sm text-gray-600">AI-powered career insights ready</p>
                      </div>
                      <CheckCircleIcon className="w-8 h-8 text-green-500" />
                    </div>

                    {/* Name & Current Role */}
                    {state.setup.resumeParsedData.name && (
                      <p className="text-xl font-bold text-gray-800 mb-1">
                        {state.setup.resumeParsedData.name}
                      </p>
                    )}
                    {state.setup.resumeParsedData.experiences?.[0] && (
                      <p className="text-sm text-gray-600">
                        {state.setup.resumeParsedData.experiences[0].title}
                        {state.setup.resumeParsedData.experiences[0].company &&
                          ` at ${state.setup.resumeParsedData.experiences[0].company}`}
                      </p>
                    )}
                  </div>

                  {/* Tab Buttons */}
                  <div className="flex border-b border-gray-200">
                    <button
                      type="button"
                      onClick={() => setResumeViewTab('analysis')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                        resumeViewTab === 'analysis'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Analysis
                      <HelpTooltip {...helpContent.resumeAnalysis} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeViewTab('preview')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        resumeViewTab === 'preview'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeViewTab('ats')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        resumeViewTab === 'ats'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      ATS Score
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeViewTab('improve')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                        resumeViewTab === 'improve'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <SparklesIcon className="w-4 h-4" />
                      Improve
                    </button>
                  </div>

                  {/* Analysis Tab Content */}
                  {resumeViewTab === 'analysis' && (
                    <>
                      {/* Career Signals Card */}
                      {state.setup.resumeParsedData.careerSignals && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-3">Career Signals</p>
                      <div className="flex flex-wrap gap-3">
                        {state.setup.resumeParsedData.careerSignals.seniorityLevel && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <SparklesIcon className="w-4 h-4 text-primary-500" />
                            <span className="font-medium capitalize">
                              {state.setup.resumeParsedData.careerSignals.seniorityLevel} Level
                            </span>
                          </div>
                        )}
                        {state.setup.resumeParsedData.careerSignals.yearsExperience && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <CalendarDaysIcon className="w-4 h-4 text-primary-500" />
                            <span>{state.setup.resumeParsedData.careerSignals.yearsExperience} YOE</span>
                          </div>
                        )}
                        {state.setup.resumeParsedData.careerSignals.careerTrajectory && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <ArrowTrendingUpIcon className="w-4 h-4 text-primary-500" />
                            <span>{state.setup.resumeParsedData.careerSignals.careerTrajectory}</span>
                          </div>
                        )}
                      </div>
                      {state.setup.resumeParsedData.careerSignals.industryFocus?.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-sm">
                          <BuildingOffice2Icon className="w-4 h-4 text-primary-500" />
                          <span className="text-gray-600">
                            Industries: {state.setup.resumeParsedData.careerSignals.industryFocus.slice(0, 3).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Skill Graph Card */}
                  {state.setup.resumeParsedData.skillGraph && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-3">Skill Assessment</p>

                      {/* Technical Skills */}
                      {state.setup.resumeParsedData.skillGraph.technical?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 mb-2">Technical Skills</p>
                          <div className="space-y-2">
                            {state.setup.resumeParsedData.skillGraph.technical.slice(0, 4).map((skill, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span className="text-sm font-medium w-36 flex-shrink-0 truncate" title={skill.name}>{skill.name}</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      skill.level === 'expert' ? 'bg-green-500 w-full' :
                                      skill.level === 'intermediate' ? 'bg-blue-500 w-2/3' :
                                      'bg-gray-400 w-1/3'
                                    }`}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 capitalize w-24 flex-shrink-0 text-right">{skill.level}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Certifications */}
                      {state.setup.resumeParsedData.skillGraph.certifications?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {state.setup.resumeParsedData.skillGraph.certifications.map((cert, index) => (
                            <span key={index} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center gap-1">
                              <TrophyIcon className="w-3 h-3" /> {cert}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Elevator Pitch Card - Moved before STAR Stories */}
                  {state.setup.resumeParsedData.talkingPoints?.elevatorPitch && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-2">Elevator Pitch</p>
                      <p className="text-sm text-gray-700 italic leading-relaxed">
                        "{state.setup.resumeParsedData.talkingPoints.elevatorPitch}"
                      </p>
                      {state.setup.resumeParsedData.talkingPoints.keyStrengths?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          {state.setup.resumeParsedData.talkingPoints.keyStrengths.map((strength, index) => (
                            <div 
                              key={index} 
                              className="text-sm text-green-700 bg-green-50 p-2 rounded-lg border border-green-100 leading-relaxed"
                            >
                              {strength}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STAR Stories Card */}
                  {state.setup.resumeParsedData.starStories && state.setup.resumeParsedData.starStories.length > 0 && (
                    <div className="p-4 bg-white rounded-xl border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-3">
                        Prepared STAR Stories ({state.setup.resumeParsedData.starStories.length})
                      </p>
                      <div className="space-y-2">
                        {state.setup.resumeParsedData.starStories.slice(0, 3).map((story, index) => (
                          <StarStoryCard key={index} story={story} />
                        ))}
                      </div>
                    </div>
                  )}

                      {/* Fallback: Basic Skills with assessment loading indicator */}
                      {!state.setup.resumeParsedData.skillGraph && state.setup.resumeParsedData.skills?.length > 0 && (
                        <div className="p-4 bg-white rounded-xl border border-gray-200 relative overflow-hidden">
                          {/* Shimmer animation overlay */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />

                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase">Key Skills</p>
                              <p className="text-xs text-primary-500 flex items-center gap-1 mt-0.5">
                                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Assessing skill levels...
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />
                              <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                              <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {state.setup.resumeParsedData.skills.slice(0, 8).map((skill, index) => (
                              <span
                                key={index}
                                className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs rounded-full border border-primary-100 flex items-center gap-1.5"
                              >
                                {skill}
                                {/* Mini progress indicator per skill */}
                                <span className="w-8 h-1 bg-primary-200 rounded-full overflow-hidden">
                                  <span
                                    className="block h-full bg-primary-400 rounded-full animate-pulse"
                                    style={{
                                      width: `${30 + (index * 10) % 70}%`,
                                      animationDelay: `${index * 0.1}s`
                                    }}
                                  />
                                </span>
                              </span>
                            ))}
                          </div>

                          <p className="text-xs text-gray-400 mt-3 text-center">
                            Analyzing proficiency levels and certifications...
                          </p>
                        </div>
                      )}

                    </>
                  )}

                  {/* ATS Score Tab Content */}
                  {resumeViewTab === 'ats' && (
                    <div className="mt-4">
                      {isLoading && !streamingProgress.ats ? (
                        <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-200">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3"></div>
                          <p className="text-gray-500">Analyzing ATS compatibility...</p>
                        </div>
                      ) : state.setup.resumeParsedData.atsAnalysis ? (
                        <ATSFeedbackPanel atsAnalysis={state.setup.resumeParsedData.atsAnalysis} />
                      ) : (
                        <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-gray-500">ATS analysis not available for this resume</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preview Tab Content */}
                  {resumeViewTab === 'preview' && (
                    <div className="mt-4">
                      {/* Local file preview (from drag & drop or file input) */}
                      {resumeFile && resumePreviewUrl ? (
                        resumeFile.type === 'application/pdf' ? (
                          <object
                            data={resumePreviewUrl}
                            type="application/pdf"
                            className="w-full h-96 rounded-lg border border-gray-200"
                          >
                            <div className="p-8 text-center bg-gray-50 rounded-lg">
                              <p className="text-gray-600 mb-4">Unable to display PDF preview</p>
                              <a
                                href={resumePreviewUrl}
                                download={resumeFile.name}
                                className="text-primary-600 hover:underline"
                              >
                                Download PDF to view
                              </a>
                            </div>
                          </object>
                        ) : (
                          <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
                            <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="font-medium text-gray-700 mb-2">{resumeFile.name}</p>
                            <p className="text-gray-500 text-sm mb-4">DOCX preview not supported in browser</p>
                            <a
                              href={resumePreviewUrl}
                              download={resumeFile.name}
                              className="inline-block px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                            >
                              Download to View
                            </a>
                          </div>
                        )
                      ) : storedResumeInfo ? (
                        /* Stored resume preview (from Firebase Storage) */
                        storedResumeInfo.fileType === 'pdf' ? (
                          <object
                            data={storedResumeInfo.downloadUrl}
                            type="application/pdf"
                            className="w-full h-96 rounded-lg border border-gray-200"
                          >
                            <div className="p-8 text-center bg-gray-50 rounded-lg">
                              <p className="text-gray-600 mb-4">Unable to display PDF preview</p>
                              <a
                                href={storedResumeInfo.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:underline"
                              >
                                Open PDF in new tab
                              </a>
                            </div>
                          </object>
                        ) : (
                          <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
                            <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="font-medium text-gray-700 mb-2">{storedResumeInfo.fileName}</p>
                            <p className="text-gray-500 text-sm mb-4">DOCX preview not supported in browser</p>
                            <a
                              href={storedResumeInfo.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                            >
                              Download to View
                            </a>
                          </div>
                        )
                      ) : (
                        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
                          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="font-medium text-gray-700 mb-2">File preview unavailable</p>
                          <p className="text-gray-500 text-sm mb-4">
                            The file preview was lost after page refresh. Your analysis is still available in the Analysis tab.
                          </p>
                          <p className="text-gray-400 text-xs">
                            Re-upload your resume above to restore preview
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Improve Resume Tab Content */}
                  {resumeViewTab === 'improve' && (
                    <div className="mt-4">
                      {isLoadingImprovedResume ? (
                        <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-md">
                              <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              Loading Improved Resume...
                            </h3>
                            <p className="text-gray-600">
                              Checking for your saved improved resume
                            </p>
                          </div>
                        </div>
                      ) : !improvedResumeMarkdown ? (
                        <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                          <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-md">
                              <SparklesIcon className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              AI-Powered Resume Improvement
                            </h3>
                            <p className="text-gray-600 max-w-md mx-auto">
                              Based on the ATS analysis, we found{' '}
                              <span className="font-medium text-indigo-600">
                                {state.setup.resumeParsedData?.atsAnalysis?.atsIssues?.length || 0} issues
                              </span>{' '}
                              and{' '}
                              <span className="font-medium text-indigo-600">
                                {state.setup.resumeParsedData?.atsAnalysis?.keywordGaps?.length || 0} missing keywords
                              </span>{' '}
                              in your resume.
                            </p>
                          </div>

                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!state.sessionId) {
                                  toast.error('No active session found');
                                  return;
                                }
                                setIsImprovingResume(true);
                                setImprovedResumeMarkdown('');
                                
                                // Reset typewriter state
                                typewriterQueueRef.current = '';
                                typewriterActiveRef.current = false;
                                displayedTextRef.current = '';
                                
                                let fullText = '';
                                try {
                                  await generateImprovedResumeStream(
                                    state.sessionId,
                                    (chunk) => {
                                      // Queue chunk for typewriter effect
                                      fullText += chunk;
                                      typewriterQueueRef.current += chunk;
                                      processTypewriterQueue();
                                    },
                                    (completeText) => {
                                      // Wait for typewriter to finish, then complete
                                      const waitForTypewriter = () => {
                                        if (typewriterQueueRef.current.length === 0 && !typewriterActiveRef.current) {
                                          setImprovedResumeMarkdown(completeText);
                                          dispatch({ type: 'UPDATE_SETUP', payload: { improvedResumeMarkdown: completeText } });
                                          toast.success('Resume improved and saved!');
                                          setIsImprovingResume(false);
                                        } else {
                                          setTimeout(waitForTypewriter, 50);
                                        }
                                      };
                                      waitForTypewriter();
                                    },
                                    (errorMsg) => {
                                      console.error('Streaming error:', errorMsg);
                                      toast.error(errorMsg || 'Failed to generate improved resume');
                                      setIsImprovingResume(false);
                                    }
                                  );
                                } catch (error: any) {
                                  console.error('Failed to improve resume:', error);
                                  toast.error(error.message || 'Failed to generate improved resume');
                                  setIsImprovingResume(false);
                                }
                              }}
                              disabled={isImprovingResume}
                              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isImprovingResume ? (
                                <>
                                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Generating Improved Resume...
                                </>
                              ) : (
                                <>
                                  <SparklesIcon className="w-5 h-5" />
                                  Generate Improved Resume
                                </>
                              )}
                            </button>
                          </div>

                          {isImprovingResume && (
                            <div className="mt-4">
                              <p className="text-center text-sm text-gray-500 mb-4">
                                ✨ AI is rewriting your resume...
                              </p>
                              {/* Show streaming content as it arrives */}
                              {improvedResumeMarkdown && (
                                <div className="p-6 bg-white rounded-xl border border-gray-200 prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-lg prose-h2:font-semibold prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-p:text-gray-700 prose-p:my-3 prose-strong:text-gray-900 prose-ul:my-3 prose-li:my-1.5">
                                  <ReactMarkdown>{improvedResumeMarkdown}</ReactMarkdown>
                                  <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-0.5" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Unsaved Changes Banner */}
                          {hasUnsavedChanges && (
                            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                              <div className="flex items-center gap-2 text-amber-700">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                                <span className="text-sm font-medium">You have unsaved changes</span>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!state.sessionId) return;
                                  setIsSavingResume(true);
                                  try {
                                    await saveImprovedResume(state.sessionId, editedResumeMarkdown);
                                    setImprovedResumeMarkdown(editedResumeMarkdown);
                                    dispatch({ type: 'UPDATE_SETUP', payload: { improvedResumeMarkdown: editedResumeMarkdown } });
                                    setHasUnsavedChanges(false);
                                    toast.success('Resume saved successfully!');
                                  } catch (error) {
                                    console.error('Failed to save resume:', error);
                                    toast.error('Failed to save resume');
                                  } finally {
                                    setIsSavingResume(false);
                                  }
                                }}
                                disabled={isSavingResume}
                                className="px-3 py-1 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
                              >
                                {isSavingResume ? 'Saving...' : 'Save Now'}
                              </button>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex justify-between">
                            <div className="flex gap-2">
                              {/* Edit/View Toggle */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditingResume) {
                                    // Switching to view mode
                                    setIsEditingResume(false);
                                  } else {
                                    // Switching to edit mode
                                    setEditedResumeMarkdown(improvedResumeMarkdown || '');
                                    setIsEditingResume(true);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 border font-medium rounded-lg transition-colors ${
                                  isEditingResume
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <PencilSquareIcon className="w-5 h-5" />
                                {isEditingResume ? 'Preview' : 'Edit Resume'}
                              </button>
                            </div>

                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const content = isEditingResume ? editedResumeMarkdown : improvedResumeMarkdown;
                                  if (content) {
                                    navigator.clipboard.writeText(content);
                                    toast.success('Copied to clipboard!');
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <ClipboardDocumentIcon className="w-5 h-5" />
                                Copy to Clipboard
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (improvedResumeRef.current) {
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                      printWindow.document.write(`
                                        <!DOCTYPE html>
                                        <html>
                                          <head>
                                            <title>Improved Resume</title>
                                            <style>
                                              body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
                                              h1 { font-size: 24px; margin-bottom: 8px; }
                                              h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                                              h3 { font-size: 14px; margin-top: 16px; margin-bottom: 8px; }
                                              p { margin: 8px 0; }
                                              ul { margin: 8px 0; padding-left: 24px; }
                                              li { margin: 4px 0; }
                                              strong { font-weight: 600; }
                                              @media print {
                                                body { padding: 0; }
                                              }
                                            </style>
                                          </head>
                                          <body>
                                            ${improvedResumeRef.current.innerHTML}
                                          </body>
                                        </html>
                                      `);
                                      printWindow.document.close();
                                      printWindow.print();
                                    }
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                <DocumentArrowDownIcon className="w-5 h-5" />
                                Export as PDF
                              </button>
                            </div>
                          </div>

                          {/* Improved Resume Content - Edit or View Mode */}
                          {isEditingResume ? (
                            <div data-color-mode="light">
                              <MDEditor
                                value={editedResumeMarkdown}
                                onChange={(value) => {
                                  setEditedResumeMarkdown(value || '');
                                  setHasUnsavedChanges(value !== improvedResumeMarkdown);
                                }}
                                height={500}
                                preview="edit"
                              />
                              <div className="mt-4 flex justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditedResumeMarkdown(improvedResumeMarkdown || '');
                                    setHasUnsavedChanges(false);
                                  }}
                                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Discard Changes
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!state.sessionId) return;
                                    setIsSavingResume(true);
                                    try {
                                      await saveImprovedResume(state.sessionId, editedResumeMarkdown);
                                      setImprovedResumeMarkdown(editedResumeMarkdown);
                                      dispatch({ type: 'UPDATE_SETUP', payload: { improvedResumeMarkdown: editedResumeMarkdown } });
                                      setHasUnsavedChanges(false);
                                      setIsEditingResume(false);
                                      toast.success('Resume saved successfully!');
                                    } catch (error) {
                                      console.error('Failed to save resume:', error);
                                      toast.error('Failed to save resume');
                                    } finally {
                                      setIsSavingResume(false);
                                    }
                                  }}
                                  disabled={isSavingResume || !hasUnsavedChanges}
                                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isSavingResume ? 'Saving...' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              ref={improvedResumeRef}
                              className="p-6 bg-white rounded-xl border border-gray-200 prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-lg prose-h2:font-semibold prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-p:text-gray-700 prose-p:my-3 prose-strong:text-gray-900 prose-ul:my-3 prose-li:my-1.5"
                            >
                              <ReactMarkdown>{improvedResumeMarkdown}</ReactMarkdown>
                            </div>
                          )}

                          {/* Regenerate Button */}
                          <div className="text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (hasUnsavedChanges) {
                                  if (!confirm('You have unsaved changes. Are you sure you want to generate a new version?')) {
                                    return;
                                  }
                                }
                                if (!state.sessionId) {
                                  toast.error('No active session found');
                                  return;
                                }
                                // Directly regenerate without resetting the view
                                setIsImprovingResume(true);
                                setIsEditingResume(false);
                                setHasUnsavedChanges(false);
                                setImprovedResumeMarkdown('');
                                
                                // Reset typewriter state
                                typewriterQueueRef.current = '';
                                typewriterActiveRef.current = false;
                                displayedTextRef.current = '';
                                
                                let fullText = '';
                                try {
                                  await generateImprovedResumeStream(
                                    state.sessionId,
                                    (chunk) => {
                                      // Queue chunk for typewriter effect
                                      fullText += chunk;
                                      typewriterQueueRef.current += chunk;
                                      processTypewriterQueue();
                                    },
                                    (completeText) => {
                                      // Wait for typewriter to finish, then complete
                                      const waitForTypewriter = () => {
                                        if (typewriterQueueRef.current.length === 0 && !typewriterActiveRef.current) {
                                          setImprovedResumeMarkdown(completeText);
                                          dispatch({ type: 'UPDATE_SETUP', payload: { improvedResumeMarkdown: completeText } });
                                          toast.success('New version generated and saved!');
                                          setIsImprovingResume(false);
                                        } else {
                                          setTimeout(waitForTypewriter, 50);
                                        }
                                      };
                                      waitForTypewriter();
                                    },
                                    (errorMsg) => {
                                      console.error('Streaming error:', errorMsg);
                                      toast.error(errorMsg || 'Failed to generate new version');
                                      setIsImprovingResume(false);
                                    }
                                  );
                                } catch (error: any) {
                                  console.error('Failed to regenerate resume:', error);
                                  toast.error(error.message || 'Failed to generate new version');
                                  setIsImprovingResume(false);
                                }
                              }}
                              disabled={isImprovingResume}
                              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                            >
                              {isImprovingResume ? 'Generating new version...' : '🔄 Generate a new version'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Skip hint when no resume uploaded */}
              {!state.setup.resumeParsedData && (
                <p className="text-sm text-gray-500 mt-6 text-center">
                  Click "Next" to skip and use generic interview questions
                </p>
              )}
            </div>
          )}

          {/* Role Selection Step */}
          {currentStep === 'role' && (
            <div data-tour="interview-config">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">What role are you interviewing for?</h2>
                <Link
                  to="/saved-jobs"
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <BookmarkIcon className="w-4 h-4" />
                  Saved Jobs
                </Link>
              </div>

              <div className="mb-6">
                <input
                  type="text"
                  className="input"
                  placeholder="Enter job title..."
                  value={state.setup.targetRole}
                  onChange={(e) =>
                    dispatch({ type: 'UPDATE_SETUP', payload: { targetRole: e.target.value } })
                  }
                />
              </div>

              {/* Job Discovery Toggle - only show if resume is uploaded */}
              {state.setup.resumeParsedData && (
                <div className="mb-6" data-tour="job-discovery">
                  <button
                    onClick={() => {
                      // If collapsing (toggle open -> closed) and AI discovery hasn't run yet
                      if (showJobDiscovery && !hasRunAiDiscovery && state.setup.resumeParsedData) {
                        loadRecommendedJobs();
                      }
                      setShowJobDiscovery(!showJobDiscovery);
                    }}
                    className="w-full p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-200 text-left hover:border-primary-400 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <SparklesIcon className="w-5 h-5 text-primary-600" /> Discover Jobs For You
                          <HelpTooltip {...helpContent.jobDiscovery} />
                        </div>
                        <p className="text-sm text-gray-600">AI-matched positions based on your resume</p>
                      </div>
                      {showJobDiscovery ? (
                        <ChevronDownIcon className="w-6 h-6 text-gray-600" />
                      ) : (
                        <ChevronRightIcon className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                  </button>
                </div>
              )}

              {/* Job Discovery Panel */}
              {showJobDiscovery && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  {/* Mode Toggle */}
                  <div className="flex gap-1 p-1 bg-gray-200 rounded-lg mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMode('ai');
                        // Load AI discovery if it hasn't been run yet
                        if (!hasRunAiDiscovery) {
                          loadRecommendedJobs();
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        searchMode === 'ai'
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <SparklesIcon className="w-4 h-4" />
                      AI Discovery
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchMode('manual')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        searchMode === 'manual'
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <MagnifyingGlassIcon className="w-4 h-4" />
                      Search Jobs
                    </button>
                  </div>

                  {/* AI Mode Header */}
                  {searchMode === 'ai' && (
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-gray-600">Jobs matched to your resume</p>
                      <button
                        type="button"
                        onClick={loadRecommendedJobs}
                        disabled={jobsLoading}
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 font-medium disabled:opacity-50"
                      >
                        <ArrowPathIcon className={`w-4 h-4 ${jobsLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                  )}

                  {/* Manual Search Mode - Search Bar and Filters */}
                  {searchMode === 'manual' && (
                    <div className="space-y-4 mb-4">
                      {/* Search Bar */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input flex-1"
                          placeholder="Search by title, skills, or company..."
                          value={jobSearchQuery}
                          onChange={(e) => setJobSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleJobSearch()}
                        />
                        <button
                          type="button"
                          onClick={handleJobSearch}
                          disabled={jobsLoading}
                          className="btn-primary px-4"
                        >
                          {jobsLoading ? '...' : 'Search'}
                        </button>
                      </div>

                      {/* Basic Filters - Always Visible */}
                      <div className="space-y-3">
                        {/* Remote Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={jobFilters.remoteOnly}
                            onChange={(e) => setJobFilters(prev => ({ ...prev, remoteOnly: e.target.checked }))}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">Remote Only</span>
                        </label>

                        {/* Location Filters Row */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Country */}
                          <select
                            value={jobFilters.country}
                            onChange={(e) => handleCountryChange(e.target.value as 'us' | 'ca')}
                            className="input text-sm"
                          >
                            {COUNTRIES.map(c => (
                              <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                          </select>

                          {/* State/Province */}
                          <select
                            value={jobFilters.stateProvince}
                            onChange={(e) => handleStateChange(e.target.value)}
                            className="input text-sm"
                          >
                            <option value="">All {jobFilters.country === 'us' ? 'States' : 'Provinces'}</option>
                            {regions.map(r => (
                              <option key={r.code} value={r.code}>{r.name}</option>
                            ))}
                          </select>

                          {/* City - Only show if state/province is selected */}
                          <select
                            value={jobFilters.city}
                            onChange={(e) => setJobFilters(prev => ({ ...prev, city: e.target.value }))}
                            className="input text-sm"
                            disabled={!jobFilters.stateProvince || cities.length === 0}
                          >
                            <option value="">All Cities</option>
                            {cities.map(city => (
                              <option key={city} value={city}>{city}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* More Filters Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowMoreFilters(!showMoreFilters)}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <FunnelIcon className="w-4 h-4" />
                        {showMoreFilters ? 'Hide' : 'More'} Filters
                        {showMoreFilters ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        )}
                      </button>

                      {/* More Filters - Collapsible */}
                      {showMoreFilters && (
                        <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          {/* Date Posted */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date Posted</label>
                            <select
                              value={jobFilters.datePosted}
                              onChange={(e) => setJobFilters(prev => ({ ...prev, datePosted: e.target.value as DatePostedFilter }))}
                              className="input text-sm w-full"
                            >
                              <option value="all">Any Time</option>
                              <option value="today">Today</option>
                              <option value="3days">Last 3 Days</option>
                              <option value="week">Past Week</option>
                              <option value="month">Past Month</option>
                            </select>
                          </div>

                          {/* Employment Type */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Job Type</label>
                            <select
                              value={jobFilters.employmentType}
                              onChange={(e) => setJobFilters(prev => ({ ...prev, employmentType: e.target.value as '' | JSearchEmploymentType }))}
                              className="input text-sm w-full"
                            >
                              <option value="">Any Type</option>
                              <option value="FULLTIME">Full-time</option>
                              <option value="PARTTIME">Part-time</option>
                              <option value="CONTRACT">Contract</option>
                              <option value="INTERN">Internship</option>
                            </select>
                          </div>

                          {/* Experience Level */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Experience Level</label>
                            <select
                              value={jobFilters.experienceLevel}
                              onChange={(e) => setJobFilters(prev => ({ ...prev, experienceLevel: e.target.value }))}
                              className="input text-sm w-full"
                            >
                              <option value="">Any Level</option>
                              <option value="entry">Entry Level</option>
                              <option value="mid">Mid Level</option>
                              <option value="senior">Senior Level</option>
                            </select>
                          </div>

                          {/* Minimum Salary */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Min Salary</label>
                            <select
                              value={jobFilters.salaryMin?.toString() || ''}
                              onChange={(e) => setJobFilters(prev => ({ ...prev, salaryMin: e.target.value ? parseInt(e.target.value) : null }))}
                              className="input text-sm w-full"
                            >
                              <option value="">Any Salary</option>
                              <option value="50000">$50k+</option>
                              <option value="75000">$75k+</option>
                              <option value="100000">$100k+</option>
                              <option value="125000">$125k+</option>
                              <option value="150000">$150k+</option>
                              <option value="200000">$200k+</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Clear Filters Button */}
                      {(jobFilters.remoteOnly || jobFilters.stateProvince || jobFilters.city ||
                        jobFilters.datePosted !== 'all' || jobFilters.employmentType ||
                        jobFilters.experienceLevel || jobFilters.salaryMin || jobSearchQuery) && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          Clear all filters
                        </button>
                      )}
                    </div>
                  )}

                  {/* Loading State */}
                  {jobsLoading && (
                    <div className="py-8 text-center">
                      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-gray-600">Finding matching jobs...</p>
                    </div>
                  )}

                  {/* Career Advice */}
                  {careerAdvice && !jobsLoading && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-medium text-blue-700 uppercase mb-1">Career Insight</p>
                      <p className="text-sm text-gray-700">{careerAdvice.recommendedTrajectory}</p>
                      {careerAdvice.skillInvestments.length > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Skills to develop:</span>{' '}
                          {careerAdvice.skillInvestments.slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Job Cards */}
                  {!jobsLoading && recommendedJobs.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-gray-500 uppercase">
                        {searchMode === 'ai' ? 'AI-Recommended Jobs' : 'Search Results'} ({recommendedJobs.length})
                      </p>
                      {recommendedJobs.map((match) => (
                        <div
                          key={match.job.jobId}
                          className={`relative p-3 bg-white rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                            selectedJob?.job.jobId === match.job.jobId
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-primary-300'
                          }`}
                          onClick={() => handleSelectJob(match)}
                        >
                          {/* Save/Unsave Bookmark Button */}
                          <button
                            onClick={(e) => handleToggleSaveJob(e, match.job.jobId, match.job.title)}
                            className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full transition-colors z-10"
                            title={savedJobIds.has(match.job.jobId) ? 'Remove from saved jobs' : 'Save job'}
                          >
                            {savedJobIds.has(match.job.jobId) ? (
                              <BookmarkIconSolid className="h-5 w-5 text-primary-600" />
                            ) : (
                              <BookmarkIcon className="h-5 w-5 text-gray-400 hover:text-primary-600" />
                            )}
                          </button>

                          <div className="flex items-start justify-between gap-2 pr-6">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">{match.job.title}</p>
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                  match.fitAnalysis.overallMatch >= 80
                                    ? 'bg-green-100 text-green-700'
                                    : match.fitAnalysis.overallMatch >= 60
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {match.fitAnalysis.overallMatch}% Match
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">
                                {match.job.company} • {match.job.location}
                                {match.job.remoteType === 'remote' && ' • Remote'}
                              </p>
                              {match.job.salaryRange && (
                                <p className="text-sm text-green-600 font-medium">
                                  ${(match.job.salaryRange.minSalary || 0) / 1000}k - ${(match.job.salaryRange.maxSalary || 0) / 1000}k
                                </p>
                              )}
                            </div>
                            {selectedJob?.job.jobId === match.job.jobId && (
                              <CheckCircleIcon className="w-6 h-6 text-green-500" />
                            )}
                          </div>

                          {/* Fit Analysis Highlights */}
                          <div className="mt-2 text-xs">
                            {match.fitAnalysis.strengthsForRole.length > 0 && (
                              <div className="flex items-start gap-1 text-green-600 mb-1">
                                <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{match.fitAnalysis.strengthsForRole[0]}</span>
                              </div>
                            )}
                            {match.fitAnalysis.potentialConcerns.length > 0 && (
                              <div className="flex items-start gap-1 text-amber-600">
                                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{match.fitAnalysis.potentialConcerns[0]}</span>
                              </div>
                            )}
                          </div>

                          {/* Career Trajectory */}
                          {match.careerTrajectory && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Career Path:</span>{' '}
                                {match.careerTrajectory.growthPath || match.careerTrajectory.currentFit}
                              </p>
                            </div>
                          )}

                          {/* Apply Link */}
                          {match.job.url && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Cache job before navigating
                                  dispatch({ type: 'CACHE_JOBS', payload: [match] });
                                  navigate(`/job/${encodeURIComponent(match.job.jobId)}`);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
                              >
                                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                View & Apply
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No Results */}
                  {!jobsLoading && recommendedJobs.length === 0 && (
                    <div className="py-6 text-center text-gray-500">
                      <p>No job recommendations yet.</p>
                      <p className="text-sm">Try searching or upload a resume for better matches.</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI-Suggested Roles from Resume */}
              {state.setup.resumeParsedData?.suggestedRoles && state.setup.resumeParsedData.suggestedRoles.length > 0 && !showJobDiscovery && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                    <span className="text-primary-500">✨</span>
                    Suggested based on your resume:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {state.setup.resumeParsedData.suggestedRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => dispatch({ type: 'UPDATE_SETUP', payload: { targetRole: role } })}
                        className={`px-4 py-2 rounded-full text-sm transition-colors border-2 ${
                          state.setup.targetRole === role
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-primary-50 text-primary-700 border-primary-200 hover:border-primary-400'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-500 mb-3">Popular roles:</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => dispatch({ type: 'UPDATE_SETUP', payload: { targetRole: role } })}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
                      state.setup.targetRole === role
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Company Selection Step */}
          {currentStep === 'company' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Target Company</h2>

              {/* Scenario A: User selected job from discovery - company is pre-filled */}
              {selectedJob ? (
                <div className="space-y-6">
                  <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-200">
                    <div className="flex items-center gap-3">
                      <BuildingOffice2Icon className="w-8 h-8 text-primary-600" />
                      <div>
                        <p className="text-sm text-gray-500">Target Company</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {selectedJob.job.company}
                        </p>
                        <p className="text-sm text-gray-600">
                          {selectedJob.job.title} • {selectedJob.job.location}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJob(null);
                        setCompanyIntel(null);
                        dispatch({ type: 'UPDATE_SETUP', payload: { targetCompany: '' } });
                      }}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-800"
                    >
                      Change company
                    </button>
                  </div>

                  {/* Company Intel Panel */}
                  <CompanyIntelPanel
                    companyName={selectedJob.job.company}
                    targetRole={state.setup.targetRole}
                    intel={companyIntel}
                    onIntelGenerated={setCompanyIntel}
                  />
                </div>
              ) : (
                /* Scenario B: Manual company entry */
                <div className="space-y-6">
                  <p className="text-gray-600">
                    Enter the company name to get interview questions tailored to their style
                    and research the company.
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="e.g., Google, Amazon, Microsoft..."
                      value={state.setup.targetCompany || ''}
                      onChange={(e) =>
                        dispatch({ type: 'UPDATE_SETUP', payload: { targetCompany: e.target.value } })
                      }
                    />
                  </div>

                  <p className="text-sm text-gray-500">
                    Leave blank for general interview practice.
                  </p>

                  {/* Company Intel Panel - only show if company name entered */}
                  {state.setup.targetCompany && state.setup.targetCompany.length >= 2 && (
                    <CompanyIntelPanel
                      companyName={state.setup.targetCompany}
                      targetRole={state.setup.targetRole}
                      intel={companyIntel}
                      onIntelGenerated={setCompanyIntel}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Interview Type Step */}
          {currentStep === 'type' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Select Interview Type</h2>

              <div className="space-y-3">
                {INTERVIEW_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() =>
                      dispatch({ type: 'UPDATE_SETUP', payload: { interviewType: type.value } })
                    }
                    className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                      state.setup.interviewType === type.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{type.label}</p>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                      <HelpTooltip {...helpContent.interviewTypes[type.value]} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Interview Mode Selection */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Communication Mode</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInterviewMode('voice')}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      interviewMode === 'voice'
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      interviewMode === 'voice' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">Voice Chat</div>
                      <div className="text-xs text-gray-500">Speak naturally with AI</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterviewMode('text')}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      interviewMode === 'text'
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      interviewMode === 'text' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">Text Chat</div>
                      <div className="text-xs text-gray-500">Type your responses</div>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Both modes use the same AI interviewer and feedback system
                </p>
              </div>

              {/* Pre-Interview Coaching Option */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-3">Not feeling ready yet?</p>
                <button
                  onClick={handleStartCoaching}
                  disabled={isLoading || !state.setup.targetRole}
                  className="w-full p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 text-left hover:border-blue-400 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <SparklesIcon className="w-8 h-8 text-primary-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">Get Coaching First</div>
                        <HelpTooltip {...helpContent.preCoaching} />
                      </div>
                      <p className="text-sm text-gray-600">
                        Practice your STAR stories, refine your pitch, and build confidence before the interview
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={goBack}
              disabled={currentStepIndex === 0}
              className="btn-secondary disabled:opacity-0"
            >
              ← Back
            </button>

            {currentStep === 'type' ? (
              <button
                onClick={handleStartInterview}
                disabled={isLoading || !state.setup.targetRole}
                className="btn-primary"
                data-tour="start-interview"
              >
                {isLoading ? 'Joining...' : 'Join Interview →'}
              </button>
            ) : (
              <button onClick={goNext} className="btn-primary">
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
