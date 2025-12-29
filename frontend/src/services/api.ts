import axios, { AxiosError } from 'axios';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  ParseResumeResponse,
  StartInterviewResponse,
  GenerateFeedbackRequest,
  FeedbackData,
  FeedbackStatusResponse,
  JobSearchRequest,
  JobSearchResponse,
  JobMatch,
  JobPosting,
  FitAnalysis,
  InterviewPrepPlan,
  StartCoachingRequest,
  StartCoachingResponse,
  CoachMessageResponse,
  CoachSessionHistory,
  CoachStatus,
  SessionHistoryResponse,
  FullSessionResponse,
  UserPreferences,
  ImproveResumeResponse,
  GetImprovedResumeResponse,
  SaveImprovedResumeResponse,
  TranscriptEntry,
  InterviewStateResponse,
  // Text Interview types
  TextInterviewMetrics,
  StartTextInterviewResponse,
  TextInterviewMessageResponse,
  TextInterviewStateResponse,
  ResumeTextInterviewResponse,
  // Resume version types
  ResumeVersionListResponse,
  ResumeVersionDownloadResponse,
  DeleteResumeVersionResponse,
  SetCurrentVersionResponse,
  GenerateImprovedPDFResponse,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Get the WebSocket URL for the STT (Speech-to-Text) service.
 *
 * Converts the HTTP API URL to WebSocket protocol (http → ws, https → wss).
 *
 * @returns WebSocket URL for the STT endpoint
 */
export function getSTTWebSocketUrl(): string {
  const wsUrl = API_URL.replace(/^http/, 'ws');
  return `${wsUrl}/ws/stt`;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add Firebase auth token
api.interceptors.request.use(async (config) => {
  // Add Firebase auth token
  try {
    const { getCurrentUserToken } = await import('./firebase');
    const token = await getCurrentUserToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    // Firebase not initialized or user not authenticated
    console.debug('[API] No Firebase token available');
  }

  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { message?: string };

      switch (status) {
        case 400:
          throw new Error(data.message || 'Invalid request');
        case 401:
        case 403:
          throw new Error('Session invalid or expired');
        case 404:
          throw new Error('Resource not found');
        case 429:
          throw new Error('Too many requests. Please wait a moment.');
        case 500:
        case 502:
        case 503:
          throw new Error('Server temporarily unavailable. Please try again.');
        default:
          throw new Error(data.message || 'Request failed');
      }
    } else if (error.request) {
      throw new Error('No response from server. Check your connection.');
    } else {
      throw new Error(error.message);
    }
  }
);

// API Functions

export async function createSession(data: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await api.post<CreateSessionResponse>('/api/v1/session', data);
  return response.data;
}

export async function getSession(sessionId: string): Promise<CreateSessionResponse> {
  const response = await api.get<CreateSessionResponse>(`/api/v1/session/${sessionId}`);
  return response.data;
}

export async function updateSession(
  sessionId: string,
  data: Partial<CreateSessionRequest>
): Promise<CreateSessionResponse> {
  const response = await api.put<CreateSessionResponse>(`/api/v1/session/${sessionId}`, data);
  return response.data;
}

export async function getActiveSession(): Promise<CreateSessionResponse | null> {
  try {
    const response = await api.get<CreateSessionResponse>('/api/v1/session/active');
    return response.data;
  } catch (error) {
    // 404 means no active session - this is not an error, just return null
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function parseResume(file: File): Promise<ParseResumeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<ParseResumeResponse>('/api/v1/resume/parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // Resume parsing may take longer with Gemini 2.5 Pro
  });
  return response.data;
}

/**
 * Stream data types for progressive resume parsing
 */
export interface ResumeStreamCallbacks {
  onBasicData: (data: Record<string, unknown>) => void;
  onCareerData: (data: Record<string, unknown>) => void;
  onAtsData: (data: Record<string, unknown>) => void;
  onImproveData: (markdown: string) => void;
  onStorage?: (data: Record<string, unknown>) => void; // Version stored event (for new uploads)
  onComplete: (sessionId: string) => void;
  onError: (error: string, task?: string) => void;
}

/**
 * Parse resume with streaming output for progressive UI updates.
 * Uses Server-Sent Events (SSE) to stream results as each analysis completes.
 *
 * Order of events (based on completion time):
 * 1. ATS analysis (~8s) - triggers auto-improve
 * 2. Basic parsing (~10s) - name, skills, experience
 * 3. Improve (~12s) - auto-triggered after ATS
 * 4. Career analysis (~20s) - skill_graph, star_stories
 * 5. Complete - all done, session saved
 *
 * @param file - The resume file to parse
 * @param callbacks - Callback functions for each event type
 */
export async function parseResumeStream(
  file: File,
  callbacks: ResumeStreamCallbacks,
): Promise<void> {
  // Get Firebase token for auth
  let token: string | null = null;
  try {
    const { getCurrentUserToken } = await import('./firebase');
    token = await getCurrentUserToken();
  } catch (error) {
    console.debug('[API] No Firebase token available for streaming');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/v1/resume/parse/stream`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    callbacks.onError(`HTTP error: ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove 'data: ' prefix
          if (jsonStr.trim()) {
            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case 'basic':
                  console.log('[API Stream] Received basic data');
                  callbacks.onBasicData(event.data);
                  break;

                case 'career':
                  console.log('[API Stream] Received career data');
                  callbacks.onCareerData(event.data);
                  break;

                case 'ats':
                  console.log('[API Stream] Received ATS data');
                  callbacks.onAtsData(event.data);
                  break;

                case 'improve':
                  console.log('[API Stream] Received improve data');
                  callbacks.onImproveData(event.data);
                  break;

                case 'storage':
                  console.log('[API Stream] Received storage data (version stored)');
                  callbacks.onStorage?.(event.data);
                  break;

                case 'warning':
                  console.warn('[API Stream] Warning:', event.message);
                  // Warnings are non-fatal, continue processing
                  break;

                case 'complete':
                  console.log('[API Stream] Complete, sessionId:', event.sessionId);
                  callbacks.onComplete(event.sessionId);
                  return;

                case 'error':
                  console.error('[API Stream] Error:', event.message);
                  callbacks.onError(event.message, event.task);
                  if (!event.task) {
                    // Fatal error, stop processing
                    return;
                  }
                  break;

                default:
                  console.warn('[API Stream] Unknown event type:', event.type);
              }
            } catch (parseError) {
              console.warn('[API Stream] Failed to parse SSE event:', jsonStr);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Re-parse a stored resume version with streaming output.
 * Downloads the file from storage and runs full AI analysis.
 *
 * Same events as parseResumeStream but does NOT create a new storage version.
 *
 * @param versionId - The version_id of the stored resume to re-parse
 * @param sessionId - Optional existing session ID to update
 * @param callbacks - Callback functions for each event type
 */
export async function reparseStoredResumeStream(
  versionId: string,
  sessionId: string | null,
  callbacks: ResumeStreamCallbacks,
): Promise<void> {
  // Get Firebase token for auth
  let token: string | null = null;
  try {
    const { getCurrentUserToken } = await import('./firebase');
    token = await getCurrentUserToken();
  } catch (error) {
    console.debug('[API] No Firebase token available for streaming');
  }

  if (!token) {
    callbacks.onError('Authentication required');
    return;
  }

  const response = await fetch(`${API_URL}/api/v1/resume/reparse-stream/${versionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    callbacks.onError(`HTTP error: ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove 'data: ' prefix
          if (jsonStr.trim()) {
            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case 'basic':
                  console.log('[Reparse Stream] Received basic data');
                  callbacks.onBasicData(event.data);
                  break;

                case 'career':
                  console.log('[Reparse Stream] Received career data');
                  callbacks.onCareerData(event.data);
                  break;

                case 'ats':
                  console.log('[Reparse Stream] Received ATS data');
                  callbacks.onAtsData(event.data);
                  break;

                case 'improve':
                  console.log('[Reparse Stream] Received improve data');
                  callbacks.onImproveData(event.data);
                  break;

                case 'complete':
                  console.log('[Reparse Stream] Complete, sessionId:', event.sessionId);
                  callbacks.onComplete(event.sessionId);
                  return;

                case 'error':
                  console.error('[Reparse Stream] Error:', event.message);
                  callbacks.onError(event.message, event.task);
                  if (!event.task) {
                    // Fatal error, stop processing
                    return;
                  }
                  break;

                default:
                  console.warn('[Reparse Stream] Unknown event type:', event.type);
              }
            } catch (parseError) {
              console.warn('[Reparse Stream] Failed to parse SSE event:', jsonStr);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function generateImprovedResume(sessionId: string): Promise<ImproveResumeResponse> {
  const response = await api.post<ImproveResumeResponse>('/api/v1/resume/improve', {
    sessionId,
  }, {
    timeout: 90000, // Resume improvement may take longer due to LLM generation
  });
  return response.data;
}

/**
 * Generate improved resume with streaming output.
 * Uses Server-Sent Events (SSE) to stream text as it's generated.
 * 
 * @param sessionId - The session ID
 * @param onChunk - Callback function called with each text chunk
 * @param onComplete - Callback function called when streaming is complete with full text
 * @param onError - Callback function called on error
 */
export async function generateImprovedResumeStream(
  sessionId: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  // Get Firebase token for auth
  let token: string | null = null;
  try {
    const { getCurrentUserToken } = await import('./firebase');
    token = await getCurrentUserToken();
  } catch (error) {
    console.debug('[API] No Firebase token available for streaming');
  }

  const response = await fetch(`${API_URL}/api/v1/resume/improve/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    onError(`HTTP error: ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove 'data: ' prefix
          if (jsonStr.trim()) {
            try {
              const data = JSON.parse(jsonStr);
              
              if (data.error) {
                onError(data.error);
                return;
              }
              
              if (data.chunk) {
                onChunk(data.chunk);
              }
              
              if (data.done && data.fullText) {
                onComplete(data.fullText);
                return;
              }
            } catch (parseError) {
              console.warn('[API] Failed to parse SSE event:', jsonStr);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getImprovedResume(sessionId: string): Promise<GetImprovedResumeResponse> {
  const response = await api.get<GetImprovedResumeResponse>(`/api/v1/resume/improved/${sessionId}`);
  return response.data;
}

export async function saveImprovedResume(sessionId: string, improvedResumeMarkdown: string): Promise<SaveImprovedResumeResponse> {
  const response = await api.put<SaveImprovedResumeResponse>('/api/v1/resume/improved', {
    sessionId,
    improvedResumeMarkdown,
  });
  return response.data;
}

// ============================================================================
// RESUME VERSION MANAGEMENT API FUNCTIONS
// ============================================================================

/**
 * List all resume versions for the current user.
 * Returns versions sorted by upload date (newest first).
 */
export async function listResumeVersions(): Promise<ResumeVersionListResponse> {
  const response = await api.get<ResumeVersionListResponse>('/api/v1/resume/versions');
  return response.data;
}

/**
 * Get a fresh download URL for a specific resume version.
 * URLs expire after 7 days, so this generates a new signed URL.
 *
 * @param versionId - The version ID to get download URL for
 */
export async function getResumeVersionDownloadUrl(versionId: string): Promise<ResumeVersionDownloadResponse> {
  const response = await api.get<ResumeVersionDownloadResponse>(`/api/v1/resume/versions/${versionId}/download`);
  return response.data;
}

/**
 * Delete a specific resume version.
 * Cannot delete the current version - must set a different version as current first.
 *
 * @param versionId - The version ID to delete
 */
export async function deleteResumeVersion(versionId: string): Promise<DeleteResumeVersionResponse> {
  const response = await api.delete<DeleteResumeVersionResponse>(`/api/v1/resume/versions/${versionId}`);
  return response.data;
}

/**
 * Set a specific resume version as the current active version.
 *
 * @param versionId - The version ID to set as current
 */
export async function setCurrentResumeVersion(versionId: string): Promise<SetCurrentVersionResponse> {
  const response = await api.post<SetCurrentVersionResponse>(`/api/v1/resume/set-current/${versionId}`);
  return response.data;
}

/**
 * Generate a PDF from the improved resume markdown.
 * Uploads to Firebase Storage as a new version.
 *
 * @param sessionId - The session ID containing the improved resume markdown
 * @param setAsCurrent - Whether to set this as the current version
 */
export async function generateImprovedPDF(
  sessionId: string,
  setAsCurrent: boolean = false,
): Promise<GenerateImprovedPDFResponse> {
  const response = await api.post<GenerateImprovedPDFResponse>('/api/v1/resume/improve/pdf', {
    sessionId,
    setAsCurrent,
  }, {
    timeout: 60000, // PDF generation may take a bit longer
  });
  return response.data;
}

export async function startInterview(options?: { clearExisting?: boolean }): Promise<StartInterviewResponse> {
  const params = options?.clearExisting ? '?clear_existing=true' : '';
  const response = await api.post<StartInterviewResponse>(`/api/v1/interview/start${params}`, {});
  return response.data;
}

export async function resumeInterview(): Promise<StartInterviewResponse> {
  const response = await api.post<StartInterviewResponse>('/api/v1/interview/resume', {});
  return response.data;
}

export async function endInterview(): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>('/api/v1/interview/end', {});
  return response.data;
}

export async function markInterviewInterrupted(): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>('/api/v1/interview/mark-interrupted', {});
  return response.data;
}

// Interview state persistence functions

export async function saveTranscriptEntries(
  entries: TranscriptEntry[],
  elapsedTime?: number,
  questionCount?: number,
  metrics?: { fillerWordCount: number; totalWordsSpoken: number; totalSpeakingTime: number }
): Promise<{ status: string; count: number }> {
  const response = await api.post<{ status: string; count: number }>(
    '/api/v1/interview/transcript',
    { entries, elapsedTime, questionCount, metrics }
  );
  return response.data;
}

export async function pauseInterview(
  elapsedTime: number,
  questionCount: number,
  metrics?: { fillerWordCount: number; totalWordsSpoken: number; totalSpeakingTime: number }
): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>(
    '/api/v1/interview/pause',
    { elapsedTime, questionCount, metrics }
  );
  return response.data;
}

export async function getInterviewState(): Promise<InterviewStateResponse> {
  const response = await api.get<InterviewStateResponse>('/api/v1/interview/state');
  return response.data;
}

// ============================================================================
// TEXT INTERVIEW API FUNCTIONS
// ============================================================================

/**
 * Start a new text-based interview session.
 * Uses the same interview prompts as voice interviews but through text chat.
 *
 * @param clearExisting - Whether to clear any existing interview state
 * @returns Interview start response with first message and configuration
 */
export async function startTextInterview(clearExisting: boolean = false): Promise<StartTextInterviewResponse> {
  const response = await api.post<{
    session_id: string;
    first_message: string;
    interview_config: {
      min_questions: number;
      max_questions: number;
      duration: string;
      difficulty: string;
      interview_type: string;
    };
    candidate_name?: string;
  }>(
    `/api/v1/text-interview/start${clearExisting ? '?clear_existing=true' : ''}`,
    {},
    { timeout: 30000 }
  );

  // Transform snake_case response to camelCase
  return {
    sessionId: response.data.session_id,
    firstMessage: response.data.first_message,
    interviewConfig: {
      minQuestions: response.data.interview_config.min_questions,
      maxQuestions: response.data.interview_config.max_questions,
      duration: response.data.interview_config.duration,
      difficulty: response.data.interview_config.difficulty,
      interviewType: response.data.interview_config.interview_type,
    },
    candidateName: response.data.candidate_name,
  };
}

/**
 * Send a message in the text interview and get the interviewer's response.
 *
 * @param message - The user's response text
 * @param elapsedTime - Current elapsed time in seconds (optional)
 * @returns Interviewer response with question count and metrics
 */
export async function sendTextInterviewMessage(
  message: string,
  elapsedTime?: number
): Promise<TextInterviewMessageResponse> {
  const response = await api.post<{
    message: string;
    question_count: number;
    max_questions: number;
    is_closing_statement: boolean;
    metrics: {
      filler_word_count: number;
      total_words_spoken: number;
      total_speaking_time: number;
      filler_words_detected: string[];
    };
  }>(
    '/api/v1/text-interview/message',
    { message, elapsed_time: elapsedTime },
    { timeout: 60000 }
  );

  // Transform snake_case response to camelCase
  return {
    message: response.data.message,
    questionCount: response.data.question_count,
    maxQuestions: response.data.max_questions,
    isClosingStatement: response.data.is_closing_statement,
    metrics: {
      fillerWordCount: response.data.metrics.filler_word_count,
      totalWordsSpoken: response.data.metrics.total_words_spoken,
      totalSpeakingTime: response.data.metrics.total_speaking_time,
      fillerWordsDetected: response.data.metrics.filler_words_detected,
    },
  };
}

/**
 * Pause the text interview and save current state.
 *
 * @param elapsedTime - Current elapsed time in seconds
 * @param metrics - Current interview metrics (optional)
 */
export async function pauseTextInterview(
  elapsedTime: number,
  metrics?: TextInterviewMetrics
): Promise<{ success: boolean; message: string }> {
  // Convert camelCase metrics to snake_case for backend
  const backendMetrics = metrics ? {
    filler_word_count: metrics.fillerWordCount,
    total_words_spoken: metrics.totalWordsSpoken,
    total_speaking_time: metrics.totalSpeakingTime,
    filler_words_detected: metrics.fillerWordsDetected,
  } : undefined;

  const response = await api.post<{ success: boolean; message: string }>(
    '/api/v1/text-interview/pause',
    { elapsed_time: elapsedTime, metrics: backendMetrics }
  );
  return response.data;
}

/**
 * Resume a paused text interview with full context.
 *
 * @returns Resume response with previous messages and state
 */
export async function resumeTextInterview(): Promise<ResumeTextInterviewResponse> {
  const response = await api.post<{
    session_id: string;
    messages: Array<{
      id: string;
      role: 'interviewer' | 'user';
      content: string;
      timestamp: number;
    }>;
    question_count: number;
    elapsed_time: number;
    metrics: {
      filler_word_count: number;
      total_words_spoken: number;
      total_speaking_time: number;
      filler_words_detected: string[];
    };
    interview_config: {
      min_questions: number;
      max_questions: number;
      duration: string;
      difficulty: string;
      interview_type: string;
    };
    resume_message: string;
  }>(
    '/api/v1/text-interview/resume',
    {},
    { timeout: 30000 }
  );

  // Transform snake_case response to camelCase
  return {
    sessionId: response.data.session_id,
    messages: response.data.messages,
    questionCount: response.data.question_count,
    elapsedTime: response.data.elapsed_time,
    metrics: {
      fillerWordCount: response.data.metrics.filler_word_count,
      totalWordsSpoken: response.data.metrics.total_words_spoken,
      totalSpeakingTime: response.data.metrics.total_speaking_time,
      fillerWordsDetected: response.data.metrics.filler_words_detected,
    },
    interviewConfig: {
      minQuestions: response.data.interview_config.min_questions,
      maxQuestions: response.data.interview_config.max_questions,
      duration: response.data.interview_config.duration,
      difficulty: response.data.interview_config.difficulty,
      interviewType: response.data.interview_config.interview_type,
    },
    resumeMessage: response.data.resume_message,
  };
}

/**
 * Get current text interview state for resume capability.
 *
 * @returns Current interview state or indication that none exists
 */
export async function getTextInterviewState(): Promise<TextInterviewStateResponse> {
  const response = await api.get<{
    has_state: boolean;
    session_id?: string;
    status?: 'active' | 'paused' | 'completed';
    messages: Array<{
      id: string;
      role: 'interviewer' | 'user';
      content: string;
      timestamp: number;
    }>;
    question_count: number;
    elapsed_time: number;
    metrics?: {
      filler_word_count: number;
      total_words_spoken: number;
      total_speaking_time: number;
      filler_words_detected: string[];
    };
    interview_config?: {
      min_questions: number;
      max_questions: number;
      duration: string;
      difficulty: string;
      interview_type: string;
    };
  }>('/api/v1/text-interview/state');

  // Transform snake_case response to camelCase
  return {
    hasState: response.data.has_state,
    sessionId: response.data.session_id,
    status: response.data.status,
    messages: response.data.messages || [],
    questionCount: response.data.question_count || 0,
    elapsedTime: response.data.elapsed_time || 0,
    metrics: response.data.metrics ? {
      fillerWordCount: response.data.metrics.filler_word_count,
      totalWordsSpoken: response.data.metrics.total_words_spoken,
      totalSpeakingTime: response.data.metrics.total_speaking_time,
      fillerWordsDetected: response.data.metrics.filler_words_detected,
    } : undefined,
    interviewConfig: response.data.interview_config ? {
      minQuestions: response.data.interview_config.min_questions,
      maxQuestions: response.data.interview_config.max_questions,
      duration: response.data.interview_config.duration,
      difficulty: response.data.interview_config.difficulty,
      interviewType: response.data.interview_config.interview_type,
    } : undefined,
  };
}

/**
 * End the text interview and get transcript for feedback.
 *
 * @returns Transcript and metrics for feedback generation
 */
export async function endTextInterview(): Promise<{
  success: boolean;
  message: string;
  transcript: TranscriptEntry[];
  metrics: TextInterviewMetrics;
}> {
  const response = await api.post<{
    success: boolean;
    message: string;
    transcript: Array<{
      id: string;
      speaker: 'agent' | 'user';
      text: string;
      timestamp: number;
    }>;
    metrics: {
      filler_word_count: number;
      total_words_spoken: number;
      total_speaking_time: number;
      filler_words_detected: string[];
    };
  }>('/api/v1/text-interview/end', {}, {
    timeout: 60000, // 60 seconds - end may involve cleanup
  });

  // Transform snake_case response to camelCase
  return {
    success: response.data.success,
    message: response.data.message,
    transcript: response.data.transcript,
    metrics: {
      fillerWordCount: response.data.metrics.filler_word_count,
      totalWordsSpoken: response.data.metrics.total_words_spoken,
      totalSpeakingTime: response.data.metrics.total_speaking_time,
      fillerWordsDetected: response.data.metrics.filler_words_detected,
    },
  };
}

/**
 * Get the text interview transcript in feedback-compatible format.
 *
 * @returns Transcript ready for feedback generation
 */
export async function getTextInterviewTranscript(): Promise<{
  session_id: string;
  transcript: Array<{ id: string; speaker: string; text: string; timestamp: number }>;
  question_count: number;
  elapsed_time: number;
  metrics: TextInterviewMetrics;
}> {
  const response = await api.get('/api/v1/text-interview/transcript');
  return response.data;
}

export async function generateFeedback(
  sessionId: string,
  data: GenerateFeedbackRequest
): Promise<{ feedbackId: string }> {
  const response = await api.post<{ feedbackId: string }>(
    '/api/v1/feedback/generate',
    {
      session_id: sessionId,
      transcript: data.transcript,
    }
  );
  return response.data;
}

export async function getFeedbackStatus(sessionId: string): Promise<FeedbackStatusResponse> {
  const response = await api.get<FeedbackStatusResponse>(`/api/v1/feedback/${sessionId}/status`);
  return response.data;
}

export async function getFeedback(sessionId: string): Promise<FeedbackData> {
  const response = await api.get<FeedbackData>(`/api/v1/feedback/${sessionId}`);
  return response.data;
}

export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const response = await api.get<{ status: string; timestamp: string }>('/health');
  return response.data;
}

// ============================================================================
// JOB BOARD API FUNCTIONS
// ============================================================================

export async function searchJobs(request: JobSearchRequest): Promise<JobSearchResponse> {
  const response = await api.post<JobSearchResponse>('/api/v1/jobs/search', request, {
    timeout: 90000, // Job matching with JSearch + AI analysis may take longer
  });
  return response.data;
}

export async function getRecommendedJobs(limit: number = 5, country?: string): Promise<JobSearchResponse> {
  const response = await api.get<JobSearchResponse>('/api/v1/jobs/recommended', {
    params: { limit, country },
    timeout: 90000, // Real job search + AI analysis
  });
  return response.data;
}

export async function getJobDetails(jobId: string): Promise<JobMatch> {
  const response = await api.get<JobMatch>(`/api/v1/jobs/${jobId}/match`, {
    timeout: 30000,
  });
  return response.data;
}

export async function prepareForJob(jobId: string): Promise<InterviewPrepPlan> {
  const response = await api.post<InterviewPrepPlan>(`/api/v1/jobs/${jobId}/prepare`, {}, {
    timeout: 60000,
  });
  return response.data;
}

// Saved Jobs
export async function saveJob(
  jobId: string,
  fitAnalysis?: FitAnalysis,
  jobData?: JobPosting,
  companyIntel?: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  // Pass fit_analysis, job_data, and company_intel if available to persist with job
  const body: { fit_analysis?: FitAnalysis; job_data?: JobPosting; company_intel?: Record<string, unknown> } = {};
  if (fitAnalysis) body.fit_analysis = fitAnalysis;
  if (jobData) body.job_data = jobData;
  if (companyIntel) body.company_intel = companyIntel;
  const response = await api.post<{ success: boolean; message: string }>(
    `/api/v1/jobs/${jobId}/save`,
    Object.keys(body).length > 0 ? body : undefined
  );
  return response.data;
}

export async function unsaveJob(jobId: string): Promise<{ success: boolean; message: string }> {
  const response = await api.delete<{ success: boolean; message: string }>(`/api/v1/jobs/${jobId}/save`);
  return response.data;
}

export async function getSavedJobs(): Promise<JobSearchResponse> {
  const response = await api.get<JobSearchResponse>('/api/v1/jobs/saved/list', {
    timeout: 90000, // May include AI analysis
  });
  return response.data;
}

/**
 * Get a single saved job by ID.
 * Returns the job with all artifacts (cover letter, company intel).
 */
export async function getSavedJob(jobId: string): Promise<JobMatch | null> {
  try {
    const response = await getSavedJobs();
    return response.jobs.find((job) => job.job.jobId === jobId) || null;
  } catch (error) {
    console.error(`[API] Failed to get saved job ${jobId}:`, error);
    return null;
  }
}

export async function markJobApplied(jobId: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(`/api/v1/jobs/${jobId}/apply`);
  return response.data;
}

// Cover Letter Generation
export interface GenerateCoverLetterRequest {
  jobData: JobPosting;
  resumeMarkdown: string;
  targetRole?: string;
  targetCompany?: string;
}

export interface GenerateCoverLetterResponse {
  coverLetter: string;
  jobSaved: boolean;
  savedJobId?: string;
}

export async function generateCoverLetter(
  jobId: string,
  request: GenerateCoverLetterRequest
): Promise<GenerateCoverLetterResponse> {
  const response = await api.post<GenerateCoverLetterResponse>(
    `/api/v1/jobs/${jobId}/cover-letter`,
    {
      job_data: request.jobData,
      resume_markdown: request.resumeMarkdown,
      target_role: request.targetRole,
      target_company: request.targetCompany,
    },
    { timeout: 60000 }
  );
  return response.data;
}

export async function generateCoverLetterStream(
  jobId: string,
  request: GenerateCoverLetterRequest,
  onChunk: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  let token: string | null = null;
  try {
    const { getCurrentUserToken } = await import('./firebase');
    token = await getCurrentUserToken();
  } catch (error) {
    console.debug('[API] No Firebase token for streaming');
  }

  const response = await fetch(`${API_URL}/api/v1/jobs/${jobId}/cover-letter/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      job_data: request.jobData,
      resume_markdown: request.resumeMarkdown,
      target_role: request.targetRole,
      target_company: request.targetCompany,
    }),
  });

  if (!response.ok) {
    onError(`HTTP error: ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; 

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim()) {
            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                onError(data.error);
                return;
              }
              if (data.chunk) {
                onChunk(data.chunk);
              }
              if (data.done && data.fullText) {
                onComplete(data.fullText);
                return;
              }
            } catch (e) {
              console.warn('[API] Failed to parse SSE event:', jsonStr);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}


// Update Job Application Status
export type ApplicationStatusType = 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'ghosted';

export async function updateJobStatus(
  jobId: string,
  status: ApplicationStatusType,
  notes?: string,
  followUpDate?: string
): Promise<{ success: boolean; message: string }> {
  const response = await api.patch<{ success: boolean; message: string }>(
    `/api/v1/jobs/${jobId}/status`,
    {
      status,
      notes,
      follow_up_date: followUpDate,
    }
  );
  return response.data;
}

// ============================================================================
// COACH API FUNCTIONS
// ============================================================================

/**
 * Detect the coaching phase for the user's active session.
 *
 * Enables the Unified Interview Coach - automatically determines
 * whether to provide pre-interview or post-interview coaching
 * based on available data:
 * - No completed feedback → PRE_INTERVIEW
 * - Completed feedback exists → POST_INTERVIEW
 */
export interface DetectPhaseResponse {
  phase: 'pre_interview' | 'post_interview';
  hasFeedback: boolean;
  hasResume: boolean;
  sessionId: string;
}

export async function detectCoachingPhase(): Promise<DetectPhaseResponse> {
  const response = await api.get<DetectPhaseResponse>('/api/v1/coach/detect-phase');
  return response.data;
}

export async function startCoaching(request: StartCoachingRequest): Promise<StartCoachingResponse> {
  const response = await api.post<StartCoachingResponse>('/api/v1/coach/start', request, {
    timeout: 30000,
  });
  return response.data;
}

export async function sendCoachMessage(message: string): Promise<CoachMessageResponse> {
  const response = await api.post<CoachMessageResponse>('/api/v1/coach/message', {
    message
  }, {
    timeout: 60000, // Coach responses may take longer
  });
  return response.data;
}

export async function getCoachHistory(): Promise<CoachSessionHistory> {
  const response = await api.get<CoachSessionHistory>('/api/v1/coach/history');
  return response.data;
}

export async function getCoachStatus(): Promise<CoachStatus> {
  const response = await api.get<CoachStatus>('/api/v1/coach/status');
  return response.data;
}

export async function endCoachSession(): Promise<{ sessionId: string; messageCount: number; summary: string }> {
  const response = await api.post<{ sessionId: string; messageCount: number; summary: string }>('/api/v1/coach/end');
  return response.data;
}

export async function getCoachTTS(text: string): Promise<Blob> {
  const response = await api.post('/api/v1/coach/tts', {
    text
  }, {
    responseType: 'blob',
    timeout: 60000,
  });
  return response.data;
}

export interface VoiceCoachingResponse {
  signedUrl: string;
  agentId: string;
  expiresAt: string;
  overrides: {
    systemPrompt: string;
    firstMessage: string;
  };
}

export async function startVoiceCoaching(request: StartCoachingRequest): Promise<VoiceCoachingResponse> {
  const response = await api.post<VoiceCoachingResponse>('/api/v1/coach/voice/start', request, {
    timeout: 30000,
  });
  return response.data;
}

// Voice Coaching Persistence Functions

export interface VoiceTranscriptEntry {
  id: string;
  speaker: 'coach' | 'user';
  text: string;
  timestamp: number;
}

export interface VoiceCoachingStateResponse {
  hasState: boolean;
  sessionId?: string;
  transcript: VoiceTranscriptEntry[];
  elapsedTime: number;
  status?: string;
  coachType?: string;
}

/**
 * Save voice coaching transcript entries to Firestore.
 * Uses batched saves with ArrayUnion to prevent duplicates.
 */
export async function saveVoiceCoachTranscript(
  entries: VoiceTranscriptEntry[],
  elapsedTime?: number
): Promise<{ status: string; count: number }> {
  const response = await api.post<{ status: string; count: number }>(
    '/api/v1/coach/voice/transcript',
    { entries, elapsedTime }
  );
  return response.data;
}

/**
 * Mark voice coaching session as interrupted.
 * Called when ElevenLabs connection is lost unexpectedly.
 */
export async function markVoiceCoachingInterrupted(): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>('/api/v1/coach/voice/mark-interrupted');
  return response.data;
}

/**
 * Get saved voice coaching state for resuming.
 * Returns transcript and elapsed time if a resumable session exists.
 */
export async function getVoiceCoachingState(): Promise<VoiceCoachingStateResponse> {
  const response = await api.get<VoiceCoachingStateResponse>('/api/v1/coach/voice/state');
  return response.data;
}

/**
 * Resume an interrupted voice coaching session.
 * Injects previous conversation context into the new ElevenLabs session.
 */
export async function resumeVoiceCoaching(): Promise<VoiceCoachingResponse> {
  const response = await api.post<VoiceCoachingResponse>('/api/v1/coach/voice/resume', {}, {
    timeout: 30000,
  });
  return response.data;
}

// ============================================================================
// PHASE 4: UNIFIED TEXT/VOICE MEMORY
// ============================================================================

export interface UnifiedCoachingHistoryResponse {
  sessionId: string;
  textMessages: Array<{
    id: string;
    role: 'coach' | 'user';
    content: string;
    timestamp: string;
    suggestions?: string[];
  }>;
  voiceTranscript: VoiceTranscriptEntry[];
  sessionNotes: string[];
  actionItems: string[];
  lastMode: 'text' | 'voice' | null;
}

/**
 * Get unified coaching history including both text and voice modes.
 * Returns all messages, transcripts, notes, and action items from the session.
 */
export async function getUnifiedCoachingHistory(): Promise<UnifiedCoachingHistoryResponse> {
  const response = await api.get<UnifiedCoachingHistoryResponse>('/api/v1/coach/unified-history');
  return response.data;
}

/**
 * Save coaching notes and action items to the unified coaching session.
 * Appends to existing notes rather than replacing.
 */
export async function saveCoachingNotes(
  notes: string[],
  actionItems: string[] = []
): Promise<{ status: string; notesCount: number; actionItemsCount: number }> {
  const response = await api.post<{ status: string; notesCount: number; actionItemsCount: number }>(
    '/api/v1/coach/save-notes',
    { notes, actionItems }
  );
  return response.data;
}

// ============================================================================
// PHASE 5: VOICE SESSION NOTES EXTRACTION
// ============================================================================

export interface VoiceSessionEndResponse {
  sessionNotes: string[];
  actionItems: string[];
  summary: string;
  messageCount: number;
}

/**
 * End voice coaching session and extract session notes using Gemini.
 * Analyzes the voice transcript to extract key insights and action items.
 */
export async function endVoiceCoaching(): Promise<VoiceSessionEndResponse> {
  const response = await api.post<VoiceSessionEndResponse>('/api/v1/coach/voice/end', {}, {
    timeout: 60000, // Longer timeout for Gemini analysis
  });
  return response.data;
}

// ============================================================================
// AUTH API FUNCTIONS
// ============================================================================

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  plan: 'free' | 'pro' | 'enterprise';
  provider: string;
}

export interface CredentialsResponse {
  hasCredentials: boolean;
  agentId?: string;
}

export interface SaveCredentialsRequest {
  apiKey: string;
  agentId: string;
}

export async function getUserProfile(token?: string): Promise<UserProfile> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get<UserProfile>('/api/v1/auth/me', { headers });
  return response.data;
}

export async function getCredentials(): Promise<CredentialsResponse> {
  const response = await api.get<CredentialsResponse>('/api/v1/auth/credentials');
  return response.data;
}

export async function saveCredentials(data: SaveCredentialsRequest): Promise<CredentialsResponse> {
  const response = await api.post<CredentialsResponse>('/api/v1/auth/credentials', data);
  return response.data;
}

export async function deleteCredentials(): Promise<{ success: boolean; message: string }> {
  const response = await api.delete<{ success: boolean; message: string }>('/api/v1/auth/credentials');
  return response.data;
}

// Session History
export async function getSessionHistory(limit: number = 20, offset: number = 0): Promise<SessionHistoryResponse> {
  const response = await api.get<SessionHistoryResponse>('/api/v1/sessions/history', {
    params: { limit, offset },
  });
  return response.data;
}

export async function getSessionFeedback(sessionId: string): Promise<FeedbackData> {
  const response = await api.get<FeedbackData>(`/api/v1/sessions/${sessionId}/feedback`);
  return response.data;
}

export async function getFullSession(sessionId: string): Promise<FullSessionResponse> {
  const response = await api.get<FullSessionResponse>(`/api/v1/session/${sessionId}/full`);
  return response.data;
}

export async function deleteSession(sessionId: string): Promise<{ deleted: boolean; message: string }> {
  const response = await api.delete<{ deleted: boolean; message: string }>(`/api/v1/session/${sessionId}`);
  return response.data;
}

// User Preferences
export async function getPreferences(): Promise<UserPreferences> {
  const response = await api.get<UserPreferences>('/api/v1/auth/preferences');
  return response.data;
}

export async function updatePreferences(preferences: UserPreferences): Promise<{ success: boolean; message: string }> {
  const response = await api.put<{ success: boolean; message: string }>('/api/v1/auth/preferences', preferences);
  return response.data;
}

// Account Deletion
export async function deleteAccount(): Promise<{
  success: boolean;
  message: string;
  deleted_counts: Record<string, number>;
}> {
  const response = await api.delete<{
    success: boolean;
    message: string;
    deleted_counts: Record<string, number>;
  }>('/api/v1/auth/account');
  return response.data;
}

// ============================================================================
// COMPANY INTELLIGENCE API FUNCTIONS
// ============================================================================

import { CompanyIntelResponse, GenerateCompanyIntelRequest } from '../types';

/**
 * Generate comprehensive company intelligence for interview preparation.
 * Uses Gemini with Google Search grounding for real-time data.
 *
 * @param request - Company intel request with company_name, target_role, etc.
 * @param jobId - Optional job ID to persist intel to saved_jobs (only if job is saved)
 */
export async function generateCompanyIntel(
  request: GenerateCompanyIntelRequest,
  jobId?: string
): Promise<CompanyIntelResponse> {
  const response = await api.post<CompanyIntelResponse>(
    '/api/v1/company/intel',
    request,
    {
      params: jobId ? { job_id: jobId } : undefined,
      timeout: 120000, // 2 minutes - grounded search takes time
    }
  );
  return response.data;
}

/**
 * Get company intel (generates if not cached).
 */
export async function getCompanyIntel(
  companyName: string,
  targetRole?: string
): Promise<CompanyIntelResponse> {
  const response = await api.get<CompanyIntelResponse>(
    `/api/v1/company/intel/${encodeURIComponent(companyName)}`,
    {
      params: { target_role: targetRole },
      timeout: 120000,
    }
  );
  return response.data;
}

/**
 * Get saved company intel from the user's active session.
 * This retrieves previously generated intel from Firestore for persistence.
 * @deprecated Use getJobCompanyIntel for job-specific intel instead
 */
export async function getSavedCompanyIntel(): Promise<CompanyIntelResponse> {
  const response = await api.get<CompanyIntelResponse>(
    '/api/v1/company/intel/saved'
  );
  return response.data;
}

/**
 * Get company intel for a specific saved job.
 * This retrieves job-specific intel from saved_jobs collection.
 */
export async function getJobCompanyIntel(jobId: string): Promise<CompanyIntelResponse> {
  const response = await api.get<CompanyIntelResponse>(
    `/api/v1/company/intel/job/${jobId}`
  );
  return response.data;
}

/**
 * Force refresh company intel (ignores cache).
 *
 * @param companyName - Company name to refresh
 * @param targetRole - Optional target role for context
 * @param jobId - Optional job ID to persist intel to saved_jobs
 */
export async function refreshCompanyIntel(
  companyName: string,
  targetRole?: string,
  jobId?: string
): Promise<CompanyIntelResponse> {
  const response = await api.post<CompanyIntelResponse>(
    `/api/v1/company/intel/refresh/${encodeURIComponent(companyName)}`,
    null,
    {
      params: {
        target_role: targetRole,
        ...(jobId ? { job_id: jobId } : {}),
      },
      timeout: 120000,
    }
  );
  return response.data;
}

// ============================================================================
// GEMINI TTS API FUNCTIONS (Reader Mode)
// ============================================================================

export interface GeminiTTSVoice {
  name: string;
  description: string;
}

export interface GeminiTTSVoicesResponse {
  voices: GeminiTTSVoice[];
  default: string;
}

/**
 * Get available Gemini TTS voices for Reader Mode.
 *
 * @returns List of available voices with descriptions and the default voice
 */
export async function getGeminiTTSVoices(): Promise<GeminiTTSVoicesResponse> {
  const response = await api.get<GeminiTTSVoicesResponse>('/api/v1/coach/gemini-tts/voices');
  return response.data;
}

/**
 * Generate speech using Google Gemini TTS.
 *
 * @param text - The text to convert to speech
 * @param voiceName - Optional voice name (default: Kore)
 * @param stylePrompt - Optional style prompt for tone/delivery
 * @returns ArrayBuffer containing WAV audio data
 */
export async function generateGeminiTTS(
  text: string,
  voiceName?: string,
  stylePrompt?: string
): Promise<ArrayBuffer> {
  const response = await api.post(
    '/api/v1/coach/gemini-tts',
    {
      text,
      voiceName,
      stylePrompt,
    },
    {
      responseType: 'arraybuffer',
      timeout: 60000, // TTS generation may take time
    }
  );
  return response.data;
}

export default api;
