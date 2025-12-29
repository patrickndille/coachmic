import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import {
  endInterview,
  generateFeedback,
  startInterview,
  resumeInterview,
  markInterviewInterrupted,
  getPreferences,
  saveTranscriptEntries,
  pauseInterview as pauseInterviewApi,
  getInterviewState,
} from '../services/api';
import { TranscriptEntry, UserPreferences } from '../types';
import { ApplicationToolsPanel, ApplicationToolsTab } from '../components/tools';
import { ChevronRightIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { MicrophoneIcon, ClockIcon, ChatBubbleLeftRightIcon, BoltIcon } from '@heroicons/react/24/solid';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
type MicPermission = 'unknown' | 'granted' | 'denied' | 'requesting';

/**
 * Filter transcript to remove trailing unanswered questions before feedback generation.
 * This ensures we only send Q&A pairs where the user actually responded.
 */
/**
 * Detect if an agent message is a closing statement indicating the interview is complete.
 * This is used to auto-end the interview when the agent naturally finishes.
 */
const CLOSING_PHRASES = [
  'that concludes our interview',
  'concludes our interview',
  'thank you for your time today',
  'best of luck',
  "that's all the questions i have",
  'end of our interview',
];

function isClosingStatement(message: string): boolean {
  const lower = message.toLowerCase();
  return CLOSING_PHRASES.some(phrase => lower.includes(phrase));
}

function filterTranscriptForFeedback(transcript: TranscriptEntry[]): TranscriptEntry[] {
  if (transcript.length === 0) return transcript;

  // Find the last user response
  let lastUserIndex = -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].speaker === 'user') {
      lastUserIndex = i;
      break;
    }
  }

  // If no user responses, return empty
  if (lastUserIndex === -1) return [];

  // Include everything up to and including the last user response
  // Plus any agent acknowledgment immediately after (but not a new question)
  let endIndex = lastUserIndex;

  // Check if there's an agent message right after that's an acknowledgment (not a question)
  if (lastUserIndex + 1 < transcript.length) {
    const nextEntry = transcript[lastUserIndex + 1];
    if (nextEntry.speaker === 'agent') {
      const text = nextEntry.text;
      // If it's short and doesn't contain a question mark, it's likely acknowledgment
      if (text.length < 100 && !text.includes('?')) {
        endIndex = lastUserIndex + 1;
      }
    }
  }

  return transcript.slice(0, endIndex + 1);
}

export default function InterviewScreen() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const [isEnding, setIsEnding] = useState(false);
  const [shouldAutoEnd, setShouldAutoEnd] = useState(false); // Triggers auto-end when agent says closing statement
  const [elapsedTime, setElapsedTime] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown');
  const [showTranscript, setShowTranscript] = useState(true);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [toolsDefaultTab, setToolsDefaultTab] = useState<ApplicationToolsTab>('notes');
  const transcriptRef = useRef<HTMLDivElement>(null);

  // User preferences
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Real-time metrics state
  const [fillerWordCount, setFillerWordCount] = useState(0);
  const [wordsPerMinute, setWordsPerMinute] = useState(0);
  const [currentAnswerDuration, setCurrentAnswerDuration] = useState(0);

  // Hybrid text input state (allows typing responses alongside voice)
  const [textInput, setTextInput] = useState('');

  // Refs to avoid stale closures in callbacks
  const currentAnswerStartTimeRef = useRef<number | null>(null);
  const totalWordsSpokenRef = useRef(0);
  const totalSpeakingTimeRef = useRef(0);

  // Persistence refs for debounced transcript saving
  const pendingEntriesRef = useRef<TranscriptEntry[]>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPausing, setIsPausing] = useState(false);
  const [hasExistingInterview, setHasExistingInterview] = useState(false);

  // Flush pending entries to Firestore
  const flushPendingEntries = useCallback(async () => {
    if (pendingEntriesRef.current.length === 0) return;

    const entries = [...pendingEntriesRef.current];
    pendingEntriesRef.current = [];

    try {
      await saveTranscriptEntries(
        entries,
        elapsedTime,
        questionCount,
        {
          fillerWordCount,
          totalWordsSpoken: totalWordsSpokenRef.current,
          totalSpeakingTime: totalSpeakingTimeRef.current,
        }
      );
      console.log('[Interview] Persisted', entries.length, 'transcript entries to Firestore');
    } catch (error) {
      console.error('[Interview] Failed to persist transcript entries:', error);
      // Re-add failed entries to retry on next flush
      pendingEntriesRef.current.unshift(...entries);
    }
  }, [elapsedTime, questionCount, fillerWordCount]);

  // Add entry to pending queue and schedule flush
  const persistTranscriptEntry = useCallback((entry: TranscriptEntry) => {
    pendingEntriesRef.current.push(entry);

    // Clear existing timer
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }

    // Flush immediately if we have 5+ entries, otherwise wait 2 seconds
    if (pendingEntriesRef.current.length >= 5) {
      flushPendingEntries();
    } else {
      flushTimerRef.current = setTimeout(flushPendingEntries, 2000);
    }
  }, [flushPendingEntries]);

  // Estimate total questions based on interview length preference
  const getTotalQuestions = (length: 'short' | 'medium' | 'long' | undefined): number => {
    switch (length) {
      case 'short': return 6;  // 5-7 questions
      case 'medium': return 11; // 10-12 questions
      case 'long': return 17;   // 15-20 questions
      default: return 11;       // Default to medium
    }
  };
  const totalQuestions = getTotalQuestions(preferences?.default_interview_length);

  // Check microphone permission on mount
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown');

        result.onchange = () => {
          setMicPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown');
        };
      } catch {
        // Permissions API not supported, will request on start
        setMicPermission('unknown');
      }
    };
    checkMicPermission();
  }, []);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getPreferences();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load preferences:', error);
        // Use defaults if loading fails - short/easy to encourage usage
        setPreferences({
          default_interview_type: 'behavioral',
          default_interview_length: 'short',
          difficulty_level: 'easy',
          voice_speed: 1.0,
          voice_accent: 'us-english',
          email_notifications: true,
          practice_reminders: true,
          weekly_summary: true,
          share_anonymous_data: false,
          show_real_time_metrics: true,
          auto_save_transcripts: true,
        });
      }
    };
    loadPreferences();
  }, []);

  // Check for resumable interview state on mount
  useEffect(() => {
    const checkForResumableInterview = async () => {
      if (!state.sessionId) return;

      try {
        const savedState = await getInterviewState();

        if (savedState.hasState && savedState.transcript && savedState.transcript.length > 0) {
          console.log('[Interview] Found resumable interview with', savedState.transcript.length, 'entries');

          // Mark that we have an existing interview
          setHasExistingInterview(true);

          // Skip restoring if we already have transcript entries (in case of re-render)
          if (state.transcript.length > 0) return;

          // Restore transcript
          dispatch({ type: 'SET_TRANSCRIPT', payload: savedState.transcript });

          // Restore timing and metrics
          setElapsedTime(savedState.elapsedTime || 0);
          setQuestionCount(savedState.questionCount || 0);

          if (savedState.metrics) {
            setFillerWordCount(savedState.metrics.fillerWordCount || 0);
            totalWordsSpokenRef.current = savedState.metrics.totalWordsSpoken || 0;
            totalSpeakingTimeRef.current = savedState.metrics.totalSpeakingTime || 0;

            // Calculate WPM if we have speaking time
            if (totalSpeakingTimeRef.current > 0) {
              const wpm = Math.round((totalWordsSpokenRef.current / totalSpeakingTimeRef.current) * 60);
              setWordsPerMinute(wpm);
            }
          }
        } else {
          setHasExistingInterview(false);
        }
      } catch (error) {
        console.error('[Interview] Failed to check for resumable interview:', error);
        setHasExistingInterview(false);
      }
    };

    checkForResumableInterview();
  }, [state.sessionId, state.transcript.length, dispatch]);

  // Request microphone permission
  const requestMicPermission = async (): Promise<boolean> => {
    setMicPermission('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
      setMicPermission('granted');
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicPermission('denied');
      toast.error('Microphone access is required for the interview');
      return false;
    }
  };

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      console.log('[Interview] Connected to conversation:', conversationId);
      toast.success('Connected to interviewer');
      // Initialize answer timing when connected
      const now = Date.now();
      currentAnswerStartTimeRef.current = now;
    },
    onDisconnect: () => {
      console.log('[Interview] Disconnected from conversation');
      console.log('[Interview] Transcript entries at disconnect:', state.transcript.length);

      // Flush any pending transcript entries immediately
      flushPendingEntries();

      // Only show warning if disconnected unexpectedly with no transcript
      if (state.transcript.length === 0 && !isEnding) {
        console.warn('[Interview] Disconnected with empty transcript - possible connection issue');
      }

      // Mark as interrupted if we have transcript and wasn't intentionally ending
      if (!isEnding && state.transcript.length > 0) {
        markInterviewInterrupted().catch(err => {
          console.error('[Interview] Failed to mark as interrupted:', err);
        });
        setHasExistingInterview(true);
        toast('Connection lost. Click "Resume" to continue.', { icon: 'ℹ️' });
      }
    },
    onMessage: (message: any) => {
      // Determine speaker - use 'source' property ('ai' for agent, anything else for user)
      const speaker = message.source === 'ai' ? 'agent' : 'user';
      console.log('[Interview] Message received:', speaker, message.message?.substring(0, 50));

      // Add ALL messages immediately to transcript (no isFinal check - that was the bug!)
      const entry: TranscriptEntry = {
        id: crypto.randomUUID(),
        speaker,
        text: message.message,
        timestamp: Date.now(),
      };

      dispatch({ type: 'ADD_TRANSCRIPT_ENTRY', payload: entry });
      persistTranscriptEntry(entry); // Persist to Firestore

      if (speaker === 'user') {
        // Real-time metrics for user response
        const text = message.message.toLowerCase();
        const fillerWords = ['um', 'uh', 'like', 'you know', 'so', 'actually', 'basically', 'literally'];
        let count = 0;
        fillerWords.forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'g');
          const matches = text.match(regex);
          if (matches) count += matches.length;
        });
        setFillerWordCount(prev => prev + count);

        // Calculate speaking metrics
        const words = message.message.trim().split(/\s+/).length;
        totalWordsSpokenRef.current += words;
        const startTime = currentAnswerStartTimeRef.current;
        if (startTime) {
          const duration = Math.floor((Date.now() - startTime) / 1000);
          setCurrentAnswerDuration(duration);
          totalSpeakingTimeRef.current += Math.max(duration, 1);
          if (totalSpeakingTimeRef.current > 0) {
            const wpm = Math.round((totalWordsSpokenRef.current / totalSpeakingTimeRef.current) * 60);
            setWordsPerMinute(wpm);
          }
        }
      } else if (speaker === 'agent') {
        // Count ALL agent messages as questions - agent only speaks to ask questions or follow up
        // Previous bug: only counted messages with '?' which missed "Tell me about yourself." etc.
        setQuestionCount((prev) => prev + 1);
        currentAnswerStartTimeRef.current = Date.now();
        setCurrentAnswerDuration(0);

        // Auto-detect interview completion when agent says closing statement
        if (isClosingStatement(message.message)) {
          console.log('[Interview] Closing statement detected:', message.message.substring(0, 50));
          // Delay to let TTS finish speaking the closing message
          setTimeout(() => {
            setShouldAutoEnd(true);
          }, 4000); // 4 second delay for TTS to finish
        }
      }
    },
    onError: (error) => {
      console.error('[Interview] Conversation error:', error);
      // Provide more helpful error messages - error can be string or Error
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : String(error);
      if (errorMessage.includes('CLOSING') || errorMessage.includes('CLOSED')) {
        toast.error('Connection lost. Please try starting again.');
      } else if (errorMessage.includes('permission') || errorMessage.includes('microphone')) {
        toast.error('Microphone access required. Please enable and try again.');
      } else {
        toast.error('Connection error. Please try again.');
      }
    },
    onStatusChange: ({ status }) => {
      console.log('Status changed:', status);
    },
  });

  // Get current status from conversation hook
  const connectionStatus: ConnectionStatus = conversation.status;
  const isSpeaking = conversation.isSpeaking;

  // Detect if AI is thinking (last message from user, waiting for AI response)
  const lastMessage = state.transcript[state.transcript.length - 1];
  const isThinking = connectionStatus === 'connected' && !isSpeaking && lastMessage?.speaker === 'user';

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (connectionStatus === 'connected') {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [state.transcript]);

  // Helper to start ElevenLabs session with given overrides
  const startElevenLabsSession = useCallback(async (response: { signedUrl: string; overrides: { systemPrompt: string; firstMessage: string } }) => {
    console.log('[Interview] Starting ElevenLabs session...');
    await conversation.startSession({
      signedUrl: response.signedUrl,
      overrides: {
        agent: {
          prompt: {
            prompt: response.overrides.systemPrompt,
          },
          firstMessage: response.overrides.firstMessage,
        },
        // Enable client events for user transcript capture
        // TypeScript types don't include this but it's supported by the SDK
        clientEvents: ['user_transcript', 'agent_response', 'interruption'],
      } as any,
    });
    console.log('[Interview] ElevenLabs session started successfully');
  }, [conversation]);

  // Start fresh - clears existing interview and starts new
  const handleStartFresh = useCallback(async () => {
    if (!state.sessionId) {
      toast.error('No session found');
      navigate('/setup');
      return;
    }

    console.log('[Interview] Starting fresh interview for session:', state.sessionId);

    // Clear local state if starting fresh
    if (hasExistingInterview) {
      dispatch({ type: 'SET_TRANSCRIPT', payload: [] });
      setElapsedTime(0);
      setQuestionCount(0);
      setFillerWordCount(0);
      totalWordsSpokenRef.current = 0;
      totalSpeakingTimeRef.current = 0;
      setWordsPerMinute(0);
    }

    // Request microphone permission if not already granted
    if (micPermission !== 'granted') {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) return;
    }

    try {
      // Get signed URL and overrides from backend (clear existing interview data)
      console.log('[Interview] Fetching signed URL from backend (clearExisting:', hasExistingInterview, ')...');
      const response = await startInterview({ clearExisting: hasExistingInterview });

      console.log('[Interview] Got signed URL, expires at:', response.expiresAt);
      await startElevenLabsSession(response);
      setHasExistingInterview(false);
    } catch (error) {
      console.error('[Interview] Failed to start interview:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('microphone') || errorMessage.includes('permission')) {
        toast.error('Microphone access required. Please enable and try again.');
      } else if (errorMessage.includes('agent') || errorMessage.includes('404')) {
        toast.error('Interview agent not available. Please try again later.');
      } else {
        toast.error('Failed to connect. Please try again.');
      }
    }
  }, [state.sessionId, conversation, navigate, micPermission, hasExistingInterview, dispatch, startElevenLabsSession]);

  // Resume - continues from last state with full context recovery
  const handleResume = useCallback(async () => {
    if (!state.sessionId) {
      toast.error('No session found');
      navigate('/setup');
      return;
    }

    console.log('[Interview] Resuming interview for session:', state.sessionId);

    // Request microphone permission if not already granted
    if (micPermission !== 'granted') {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) return;
    }

    try {
      // Get signed URL with context-aware overrides from backend
      console.log('[Interview] Fetching resume URL from backend...');
      const response = await resumeInterview();

      console.log('[Interview] Got resume URL, continuing interview...');
      await startElevenLabsSession(response);
      toast.success('Interview resumed');
    } catch (error) {
      console.error('[Interview] Failed to resume interview:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('No interview state') || errorMessage.includes('No transcript')) {
        toast.error('No previous interview found. Starting fresh.');
        // Fall back to start fresh
        handleStartFresh();
      } else if (errorMessage.includes('microphone') || errorMessage.includes('permission')) {
        toast.error('Microphone access required. Please enable and try again.');
      } else {
        toast.error('Failed to resume. Please try again.');
      }
    }
  }, [state.sessionId, conversation, navigate, micPermission, startElevenLabsSession, handleStartFresh]);

  // Back to setup
  const handleBackToSetup = useCallback(() => {
    navigate('/setup');
  }, [navigate]);

  // End conversation
  const handleEnd = useCallback(async () => {
    if (!state.sessionId) return;

    setIsEnding(true);
    console.log('[Interview] Ending interview with', state.transcript.length, 'transcript entries');

    try {
      // Stop ElevenLabs conversation
      await conversation.endSession();

      // Notify backend
      await endInterview();

      // Filter transcript to remove trailing unanswered questions
      const filteredTranscript = filterTranscriptForFeedback(state.transcript);
      console.log('[Interview] Filtered transcript:', filteredTranscript.length, 'entries (from', state.transcript.length, 'total)');

      // Check if we have enough transcript for feedback
      const userResponses = filteredTranscript.filter(
        entry => entry.speaker === 'user' && entry.text && entry.text.trim().length > 5
      );
      console.log('[Interview] User responses for feedback:', userResponses.length);

      if (userResponses.length < 1) {
        console.warn('[Interview] Not enough transcript entries for feedback');
        toast.error('No responses recorded. Please answer at least one question to get feedback.');
        navigate('/setup');
        return;
      }

      // Generate feedback with filtered transcript (only answered Q&A pairs)
      dispatch({ type: 'SET_STATUS', payload: 'processing' });

      await generateFeedback(state.sessionId, {
        transcript: filteredTranscript,
      });

      toast.success('Interview complete! Generating feedback...');
      navigate('/feedback');
    } catch (error) {
      console.error('[Interview] Failed to end interview:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if error is due to empty transcript
      if (errorMessage.includes('No interview responses') || errorMessage.includes('400')) {
        toast.error('No responses recorded. Please answer at least one question.');
        navigate('/setup');
      } else {
        toast.error('Error generating feedback. Please try again.');
        navigate('/feedback');
      }
    } finally {
      setIsEnding(false);
    }
  }, [state.sessionId, state.transcript, conversation, dispatch, navigate]);

  // Auto-end interview when agent says closing statement
  useEffect(() => {
    if (shouldAutoEnd && !isEnding) {
      console.log('[Interview] Auto-ending interview after closing statement detected');
      handleEnd();
    }
  }, [shouldAutoEnd, isEnding, handleEnd]);

  // Pause conversation (saves state for later resume)
  const handlePause = useCallback(async () => {
    if (!state.sessionId) return;

    setIsPausing(true);
    console.log('[Interview] Pausing interview with', state.transcript.length, 'transcript entries');

    try {
      // Flush any pending transcript entries
      await flushPendingEntries();

      // Save pause state to Firestore
      await pauseInterviewApi(
        elapsedTime,
        questionCount,
        {
          fillerWordCount,
          totalWordsSpoken: totalWordsSpokenRef.current,
          totalSpeakingTime: totalSpeakingTimeRef.current,
        }
      );

      // End ElevenLabs session
      await conversation.endSession();

      toast.success('Interview paused. You can resume later.');
      navigate('/setup');
    } catch (error) {
      console.error('[Interview] Failed to pause interview:', error);
      toast.error('Failed to pause interview. Please try again.');
    } finally {
      setIsPausing(false);
    }
  }, [state.sessionId, state.transcript.length, conversation, navigate, flushPendingEntries, elapsedTime, questionCount, fillerWordCount]);

  // Handle text input submission (hybrid mode - works alongside voice)
  const handleTextSubmit = useCallback(() => {
    const text = textInput.trim();
    if (!text || connectionStatus !== 'connected' || isSpeaking) return;

    // Send text message to ElevenLabs agent
    conversation.sendUserMessage(text);
    setTextInput('');
    console.log('[Interview] Sent text message:', text.substring(0, 50));
  }, [textInput, connectionStatus, isSpeaking, conversation]);

  // Handle text input change with typing activity signal
  const handleTextInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInput(e.target.value);
    // Signal to agent that user is typing (pauses agent for ~2 seconds)
    if (connectionStatus === 'connected' && !isSpeaking) {
      conversation.sendUserActivity();
    }
  }, [connectionStatus, isSpeaking, conversation]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Redirect if no session
  useEffect(() => {
    if (!state.sessionId) {
      navigate('/setup');
    }
  }, [state.sessionId, navigate]);

  // Microphone permission denied UI
  if (micPermission === 'denied') {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <MicrophoneIcon className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Microphone Access Required
          </h2>
          <p className="text-gray-600 mb-6">
            CoachMic needs microphone access to conduct voice interviews.
            Please enable microphone permissions in your browser settings.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <p className="font-medium text-gray-700 mb-2">How to enable:</p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Click the lock icon in your browser's address bar</li>
              <li>Find "Microphone" in the permissions list</li>
              <li>Change the setting to "Allow"</li>
              <li>Refresh this page</li>
            </ol>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh Page
            </button>
            <button
              onClick={() => navigate('/setup')}
              className="btn-secondary"
            >
              Back to Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex">
      {/* Main Interview Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showToolsPanel ? 'lg:pr-[440px]' : ''}`}>
        {/* Top Bar - sticky below main nav */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-16 z-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                {/* Timer */}
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-6 h-6 text-gray-600" />
                  <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
                </div>

                {/* Question Count */}
                <div className="text-sm text-gray-600">
                  Question {questionCount} of {totalQuestions}
                </div>
              </div>

              {/* Connection Status */}
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : connectionStatus === 'disconnecting'
                    ? 'bg-orange-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
            </div>
          </div>

          {/* Question Progress Bar */}
          {connectionStatus === 'connected' && questionCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min((questionCount / totalQuestions) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 font-medium min-w-[3rem]">
                {Math.round(Math.min((questionCount / totalQuestions) * 100, 100))}%
              </span>
            </div>
          )}

          {/* Real-Time Metrics Panel (Optional - based on user preference) */}
          {connectionStatus === 'connected' && preferences?.show_real_time_metrics && (
            <div className="mt-3 flex items-center justify-center gap-6 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              {/* Filler Word Counter */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600 font-medium">Filler Words</div>
                  <div className="text-lg font-bold text-gray-900">{fillerWordCount}</div>
                </div>
              </div>

              {/* Speaking Pace Meter */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <BoltIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600 font-medium">Speaking Pace</div>
                  <div className="text-lg font-bold text-gray-900">
                    {wordsPerMinute > 0 ? `${wordsPerMinute} WPM` : '--'}
                  </div>
                </div>
              </div>

              {/* Time Per Answer */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <ClockIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600 font-medium">Current Answer</div>
                  <div className="text-lg font-bold text-gray-900">
                    {currentAnswerDuration > 0 ? `${currentAnswerDuration}s` : '--'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col">
        {/* Interview Info */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {state.setup.targetRole} Interview
            </h1>
            {state.setup.targetCompany && (
              <p className="text-gray-600">{state.setup.targetCompany}</p>
            )}
          </div>
          <button
            onClick={() => {
              setShowToolsPanel(!showToolsPanel);
              if (!showToolsPanel) {
                setToolsDefaultTab('notes'); // Default to Notes tab
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showToolsPanel
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'
            }`}
          >
            <WrenchScrewdriverIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Tools</span>
          </button>
        </div>

        {/* Transcript Area with Toggle */}
        <div className="flex-1 flex flex-col mb-4">
          {/* Transcript Header with Toggle */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className={`transform transition-transform ${showTranscript ? 'rotate-90' : ''}`}>
                <ChevronRightIcon className="w-4 h-4" />
              </span>
              <span>Transcript</span>
              {state.transcript.length > 0 && (
                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {state.transcript.length}
                </span>
              )}
            </button>
            {showTranscript && state.transcript.length > 0 && (
              <span className="text-xs text-gray-400">
                Auto-saved
              </span>
            )}
          </div>

          {/* Collapsible Transcript Content */}
          {showTranscript && (
            <div
              ref={transcriptRef}
              className="flex-1 bg-white rounded-xl border border-gray-200 p-4 overflow-y-auto min-h-[250px] max-h-[400px]"
            >
              {state.transcript.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                  {connectionStatus === 'connected'
                    ? 'Waiting for interviewer...'
                    : 'Click "Start Interview" to begin'}
                </div>
              ) : (
                <div className="space-y-4">
                  {state.transcript.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          entry.speaker === 'user'
                            ? 'bg-primary-100 text-primary-900'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {entry.speaker === 'user' ? 'You' : 'Interviewer'}
                        </p>
                        <p>{entry.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsed state indicator */}
          {!showTranscript && state.transcript.length > 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-center text-sm text-gray-500">
              Transcript hidden ({state.transcript.length} messages) - Click to expand
            </div>
          )}
        </div>

        {/* Voice Activity Indicator */}
        {connectionStatus === 'connected' && (
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
              {isSpeaking ? (
                <>
                  <div className="flex gap-1">
                    <span className="w-1 h-4 bg-primary-500 rounded animate-pulse" />
                    <span className="w-1 h-6 bg-primary-500 rounded animate-pulse delay-75" />
                    <span className="w-1 h-3 bg-primary-500 rounded animate-pulse delay-150" />
                  </div>
                  <span className="text-sm text-gray-600">Interviewer speaking...</span>
                </>
              ) : isThinking ? (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span className="text-sm text-gray-600">AI is thinking...</span>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-gray-600">Listening...</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Hybrid Text Input - Type or speak your response */}
        {connectionStatus === 'connected' && (
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={handleTextInputChange}
                onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                disabled={isSpeaking}
                placeholder={isSpeaking ? "Wait for interviewer to finish..." : "Or type your response here..."}
                className={`input flex-1 ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || isSpeaking}
                className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              You can speak or type - both work seamlessly
            </p>
          </div>
        )}

        {/* Turn-Taking Visual Cue - Full-Width Banner */}
        {connectionStatus === 'connected' && !isSpeaking && !isThinking && (
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 shadow-lg z-50 animate-pulse">
            <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-lg">Your turn to speak or type</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4">
          {/* Disconnected with existing interview - show three buttons */}
          {connectionStatus === 'disconnected' && hasExistingInterview && (
            <>
              <div className="flex gap-4">
                <button
                  onClick={handleStartFresh}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg text-lg transition-colors"
                >
                  Start Fresh
                </button>
                <button
                  onClick={handleResume}
                  className="btn-primary px-8 py-3 text-lg"
                >
                  Resume Interview
                </button>
                <button
                  onClick={handleBackToSetup}
                  className="btn-secondary px-6 py-3 text-lg"
                >
                  Back to Setup
                </button>
              </div>
              <p className="text-sm text-gray-500">
                You have {state.transcript.length} messages from a previous session
              </p>
            </>
          )}

          {/* Disconnected without existing interview - show just Start */}
          {connectionStatus === 'disconnected' && !hasExistingInterview && (
            <button
              onClick={handleStartFresh}
              className="btn-primary px-8 py-3 text-lg"
            >
              Start Interview
            </button>
          )}

          {connectionStatus === 'connecting' && (
            <button disabled className="btn-primary px-8 py-3 text-lg opacity-50">
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Connecting...
            </button>
          )}

          {connectionStatus === 'connected' && (
            <div className="flex gap-4">
              <button
                onClick={handlePause}
                disabled={isPausing || isEnding}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-6 py-3 rounded-lg text-lg transition-colors"
              >
                {isPausing ? 'Pausing...' : 'Pause'}
              </button>
              <button
                onClick={handleEnd}
                disabled={isEnding || isPausing}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
              >
                {isEnding ? 'Ending...' : 'End Interview'}
              </button>
            </div>
          )}
        </div>

        {/* Tips */}
        {connectionStatus === 'connected' && (
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>Speak naturally. The AI will wait for you to finish before responding.</p>
          </div>
        )}
      </div>
      </div> {/* End of Main Interview Area */}

      {/* Application Tools Panel - 5 tabs: Resume, Cover, Notes, Tips, Intel */}
      <ApplicationToolsPanel
        isOpen={showToolsPanel}
        onClose={() => setShowToolsPanel(false)}
        defaultTab={toolsDefaultTab}
        companyName={state.setup.targetCompany || undefined}
        targetRole={state.setup.targetRole || undefined}
        jobTitle={state.setup.targetRole || undefined}
        title="Interview Tools"
      />
    </div>
  );
}
