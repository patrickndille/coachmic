import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, AppStatus, SetupConfig, TranscriptEntry, FeedbackData, AppError, WizardStep, JobMatch } from '../types';

// Storage Keys (defined early so they're available in reducer)
const STORAGE_KEY = 'coachmic_session';
const JOBS_CACHE_KEY = 'coachmic_jobs_cache';
const STORAGE_VERSION = 1;

// Initial State
const initialState: AppState = {
  status: 'idle',
  sessionId: null,
  setup: {
    targetRole: '',
    targetCompany: '',
    interviewType: 'behavioral',
    // Saved job reference and artifacts
    savedJobId: undefined,
    selectedJobData: undefined,
    coverLetter: undefined,
    companyIntel: undefined,
  },
  currentSetupStep: null,
  transcript: [],
  feedback: null,
  error: null,
  isLoading: false,
  cachedJobs: {},
};

// Action Types
type AppAction =
  | { type: 'SET_STATUS'; payload: AppStatus }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'UPDATE_SETUP'; payload: Partial<SetupConfig> }
  | { type: 'SET_SETUP_STEP'; payload: WizardStep | null }
  | { type: 'ADD_TRANSCRIPT_ENTRY'; payload: TranscriptEntry }
  | { type: 'SET_TRANSCRIPT'; payload: TranscriptEntry[] }
  | { type: 'SET_FEEDBACK'; payload: FeedbackData }
  | { type: 'CLEAR_FEEDBACK' }
  | { type: 'SET_ERROR'; payload: AppError | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET_SESSION' }
  | { type: 'RESTORE_SESSION'; payload: Partial<AppState> }
  | { type: 'CACHE_JOBS'; payload: JobMatch[] }
  | { type: 'UPDATE_CACHED_JOB'; payload: { jobId: string; updates: Partial<JobMatch> } }
  | { type: 'CLEAR_JOB_CACHE' };

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'UPDATE_SETUP':
      return { ...state, setup: { ...state.setup, ...action.payload } };
    case 'SET_SETUP_STEP':
      return { ...state, currentSetupStep: action.payload };
    case 'ADD_TRANSCRIPT_ENTRY':
      return { ...state, transcript: [...state.transcript, action.payload] };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload };
    case 'SET_FEEDBACK':
      return { ...state, feedback: action.payload, status: 'complete' };
    case 'CLEAR_FEEDBACK':
      return { ...state, feedback: null, transcript: [] };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'RESET_SESSION':
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(JOBS_CACHE_KEY);
      localStorage.removeItem('coachmic_last_uid');
      return { ...initialState };
    case 'RESTORE_SESSION':
      return { ...state, ...action.payload };
    case 'CACHE_JOBS': {
      const newCache = { ...state.cachedJobs };
      action.payload.forEach(job => {
        newCache[job.job.jobId] = job;
      });
      return { ...state, cachedJobs: newCache };
    }
    case 'UPDATE_CACHED_JOB': {
      const { jobId, updates } = action.payload;
      if (!state.cachedJobs[jobId]) return state;
      return {
        ...state,
        cachedJobs: {
          ...state.cachedJobs,
          [jobId]: { ...state.cachedJobs[jobId], ...updates },
        },
      };
    }
    case 'CLEAR_JOB_CACHE':
      return { ...state, cachedJobs: {} };
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);

        // Check version and expiry
        if (parsed.version === STORAGE_VERSION && Date.now() < parsed.expiresAt) {
          dispatch({
            type: 'RESTORE_SESSION',
            payload: {
              sessionId: parsed.sessionId,
              setup: parsed.setup,
              currentSetupStep: parsed.currentSetupStep || null,
              transcript: parsed.transcript,
              feedback: parsed.feedback,
              status: parsed.feedback ? 'complete' : 'idle',
              // Don't load cachedJobs here - handled by separate effect below
            },
          });
        } else {
          // Expired or wrong version - clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Load jobs cache separately (independent of session state)
  useEffect(() => {
    const storedJobs = localStorage.getItem(JOBS_CACHE_KEY);
    if (storedJobs) {
      try {
        const parsed = JSON.parse(storedJobs);
        // Check expiry (24 hours)
        if (parsed.expiresAt && Date.now() < parsed.expiresAt && parsed.jobs) {
          console.log('[AppContext] Restoring cached jobs:', Object.keys(parsed.jobs).length);
          dispatch({ type: 'CACHE_JOBS', payload: Object.values(parsed.jobs) });
        } else {
          console.log('[AppContext] Jobs cache expired, removing');
          localStorage.removeItem(JOBS_CACHE_KEY);
        }
      } catch (e) {
        console.error('[AppContext] Failed to restore jobs cache:', e);
        localStorage.removeItem(JOBS_CACHE_KEY);
      }
    }
  }, []);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (state.sessionId) {
      const toStore = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        sessionId: state.sessionId,
        setup: state.setup,
        currentSetupStep: state.currentSetupStep,
        transcript: state.transcript,
        feedback: state.feedback,
        // Don't save cachedJobs here - handled by separate effect below
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    }
  }, [state.sessionId, state.setup, state.currentSetupStep, state.transcript, state.feedback]);

  // Save jobs cache separately (independent of session state)
  // This ensures jobs persist even if session lookup fails after refresh
  useEffect(() => {
    const jobCount = Object.keys(state.cachedJobs).length;
    if (jobCount > 0) {
      const toStore = {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        jobs: state.cachedJobs,
      };
      console.log('[AppContext] Saving jobs cache:', jobCount, 'jobs');
      localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(toStore));
    }
  }, [state.cachedJobs]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Convenience hooks
export function useAppStatus() {
  const { state } = useApp();
  return state.status;
}

export function useSetup() {
  const { state, dispatch } = useApp();
  const updateSetup = (config: Partial<SetupConfig>) => {
    dispatch({ type: 'UPDATE_SETUP', payload: config });
  };
  return { setup: state.setup, updateSetup };
}

export function useTranscript() {
  const { state, dispatch } = useApp();
  const addEntry = (entry: TranscriptEntry) => {
    dispatch({ type: 'ADD_TRANSCRIPT_ENTRY', payload: entry });
  };
  return { transcript: state.transcript, addEntry };
}

export function useFeedback() {
  const { state } = useApp();
  return state.feedback;
}
