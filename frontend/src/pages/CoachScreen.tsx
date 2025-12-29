import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../context/AppContext';
import {
  startCoaching,
  sendCoachMessage,
  getCoachHistory,
  endCoachSession,
  startVoiceCoaching,
  saveVoiceCoachTranscript,
  markVoiceCoachingInterrupted,
  getVoiceCoachingState,
  resumeVoiceCoaching,
  endVoiceCoaching,
  detectCoachingPhase,
  DetectPhaseResponse,
  VoiceTranscriptEntry,
  getGeminiTTSVoices,
  generateGeminiTTS,
  GeminiTTSVoice,
} from '../services/api';
import { CoachMessage, CoachType } from '../types';
import { HelpTooltip } from '../components/common';
import { ApplicationToolsPanel } from '../components/tools';
import { helpContent } from '../utils/helpContent';
import { getAudioPlayer } from '../utils/audioPlayer';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { MicrophoneIcon, SparklesIcon, ArrowTrendingUpIcon, CheckCircleIcon, ChatBubbleLeftRightIcon, DocumentTextIcon, XMarkIcon, WrenchScrewdriverIcon, SpeakerWaveIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid';

type CoachMode = 'text' | 'voice';
type SessionStatus = 'idle' | 'starting' | 'active' | 'ended';

export default function CoachScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useApp();

  // Session state
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [coachType, setCoachType] = useState<CoachType>('pre_interview');
  const [mode, setMode] = useState<CoachMode>('text');

  // Phase detection state (Unified Coach feature)
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectionResult, setDetectionResult] = useState<DetectPhaseResponse | null>(null);

  // Chat state (for text mode)
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionNotes, setSessionNotes] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [showSessionNotes, setShowSessionNotes] = useState(true); // Toggle for session notes sidebar
  const [showToolsPanel, setShowToolsPanel] = useState(false); // Application Tools panel

  // Reader Mode state (Google Gemini TTS for text mode)
  const [readerMode, setReaderMode] = useState<boolean>(() => {
    return localStorage.getItem('coachmic_reader_mode') === 'true';
  });
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('coachmic_tts_voice') || 'Kore';
  });
  const [ttsLoading, setTtsLoading] = useState<string | null>(null); // messageId being loaded
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null); // messageId currently playing
  const [availableVoices, setAvailableVoices] = useState<GeminiTTSVoice[]>([]);

  // Hybrid Input Mode state (Google Cloud STT for text chat)
  const [inputMode, setInputMode] = useState<'text' | 'stt'>('text');

  // Voice transcript (for voice mode)
  const [voiceTranscript, setVoiceTranscript] = useState<Array<{ speaker: string; text: string }>>([]);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveCoachTranscript, setLiveCoachTranscript] = useState('');

  // Voice persistence state
  const [hasExistingVoiceSession, setHasExistingVoiceSession] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceSessionStartedRef = useRef(false);
  const coachStreamingTimer = useRef<NodeJS.Timeout | null>(null);

  // Voice persistence refs (debounced saving like InterviewScreen)
  const pendingEntriesRef = useRef<VoiceTranscriptEntry[]>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEndingRef = useRef(false);

  // Track auto-played messages to prevent replay loop
  const autoPlayedMessagesRef = useRef<Set<string>>(new Set());

  // Google Cloud STT hook for hybrid text/voice input
  const {
    isListening: isSTTListening,
    isConnecting: isSTTConnecting,
    error: sttError,
    startListening: startSTT,
    stopListening: stopSTT,
  } = useVoiceInput(inputValue, (text) => {
    // Update input value as transcript comes in
    setInputValue(text);
  });

  // Flush pending entries to Firestore
  const flushPendingEntries = useCallback(async () => {
    if (pendingEntriesRef.current.length === 0) return;

    const entries = [...pendingEntriesRef.current];
    pendingEntriesRef.current = [];

    try {
      await saveVoiceCoachTranscript(entries, elapsedTime);
      console.log('[Coach Voice] Persisted', entries.length, 'transcript entries');
    } catch (error) {
      console.error('[Coach Voice] Failed to persist:', error);
      // Re-add failed entries to queue for retry
      pendingEntriesRef.current.unshift(...entries);
    }
  }, [elapsedTime]);

  // Add entry to pending queue with debounced flush
  const persistVoiceEntry = useCallback((entry: VoiceTranscriptEntry) => {
    pendingEntriesRef.current.push(entry);

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }

    // Flush at 5 entries or after 2 seconds
    if (pendingEntriesRef.current.length >= 5) {
      flushPendingEntries();
    } else {
      flushTimerRef.current = setTimeout(flushPendingEntries, 2000);
    }
  }, [flushPendingEntries]);

  const handleCoachMessage = useCallback((message: any) => {
    if (coachStreamingTimer.current) {
      clearInterval(coachStreamingTimer.current);
    }
    setLiveCoachTranscript('');

    const words = message.message.split(/\s+/);
    let currentWordIndex = 0;

    coachStreamingTimer.current = setInterval(() => {
      if (currentWordIndex < words.length) {
        setLiveCoachTranscript(prev => prev + (currentWordIndex > 0 ? ' ' : '') + words[currentWordIndex]);
        currentWordIndex++;
      } else {
        if (coachStreamingTimer.current) {
          clearInterval(coachStreamingTimer.current);
        }
        // Add to transcript and persist
        const entry: VoiceTranscriptEntry = {
          id: crypto.randomUUID(),
          speaker: 'coach',
          text: message.message,
          timestamp: Date.now(),
        };
        setVoiceTranscript(prev => [...prev, { speaker: 'coach', text: message.message }]);
        persistVoiceEntry(entry);
        setLiveCoachTranscript('');
      }
    }, 100);
  }, [persistVoiceEntry]);

  // ElevenLabs conversation hook for voice mode
  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      console.log('[Coach Voice] Connected:', conversationId);
      toast.success('Connected to coach');
    },
    onDisconnect: () => {
      console.log('[Coach Voice] Disconnected');
      // Flush any pending entries before marking interrupted
      flushPendingEntries();

      // Mark session as interrupted if not intentionally ending and has transcript
      if (!isEndingRef.current && voiceTranscript.length > 0) {
        markVoiceCoachingInterrupted().catch(console.error);
        setHasExistingVoiceSession(true);
        toast('Connection lost. Click "Resume" to continue.', { icon: 'ℹ️' });
      }
    },
    onMessage: (message: any) => {
      if (message.source === 'user') {
        if (message.isFinal) {
          setLiveUserTranscript('');
          // Add to transcript and persist
          const entry: VoiceTranscriptEntry = {
            id: crypto.randomUUID(),
            speaker: 'user',
            text: message.message,
            timestamp: Date.now(),
          };
          setVoiceTranscript(prev => [...prev, { speaker: 'user', text: message.message }]);
          persistVoiceEntry(entry);
        } else {
          setLiveUserTranscript(message.message);
        }
      } else if (message.source === 'ai') {
        setLiveUserTranscript('');
        handleCoachMessage(message);
      }
    },
    onError: (error) => {
      console.error('[Coach Voice] Error:', error);
      toast.error('Connection error. Please try again.');
    },
    onStatusChange: ({ status }) => {
      console.log('[Coach Voice] Status:', status);
    },
  });

  const isSpeaking = conversation.isSpeaking;
  const connectionStatus = conversation.status;

  // Auto-detect coaching phase on mount (Unified Coach feature)
  // This replaces manual pre/post selection with intelligent detection
  useEffect(() => {
    const detectPhase = async () => {
      if (!state.sessionId) return;

      try {
        setIsDetecting(true);
        const result = await detectCoachingPhase();
        setDetectionResult(result);
        setCoachType(result.phase);
        console.log('[Coach] Auto-detected phase:', result.phase, 'hasFeedback:', result.hasFeedback, 'hasResume:', result.hasResume);
      } catch (error) {
        console.error('[Coach] Phase detection failed:', error);
        // Default to pre-interview if detection fails
        setCoachType('pre_interview');
      } finally {
        setIsDetecting(false);
      }
    };

    detectPhase();
  }, [state.sessionId]);

  // Check URL params for coach type (override auto-detection if explicitly specified)
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'post_interview' || type === 'pre_interview') {
      setCoachType(type);
      setIsDetecting(false); // Skip detection if URL param specifies type
    }
  }, [searchParams]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceTranscript, liveUserTranscript, liveCoachTranscript]);

  // Check for existing session on mount
  useEffect(() => {
    if (!state.sessionId) {
      toast.error('Please complete setup first');
      navigate('/setup');
      return;
    }

    // Try to restore existing coaching session (text mode only)
    const restoreSession = async () => {
      try {
        const history = await getCoachHistory();
        if (history.messages.length > 0) {
          setMessages(history.messages);
          setSessionStatus('active');
          const lastCoachMsg = [...history.messages].reverse().find(m => m.role === 'coach');
          if (lastCoachMsg?.suggestions) {
            setSuggestions(lastCoachMsg.suggestions);
          }
        }
      } catch {
        // No existing session
      }
    };

    if (mode === 'text') {
      restoreSession();
    }
  }, [state.sessionId, navigate, mode]);

  // Check for resumable voice session on mount
  useEffect(() => {
    if (!state.sessionId || mode !== 'voice') return;

    const checkResumableVoiceSession = async () => {
      try {
        const savedState = await getVoiceCoachingState();
        if (savedState.hasState && savedState.transcript.length > 0) {
          setHasExistingVoiceSession(true);
          // Restore transcript display
          setVoiceTranscript(savedState.transcript.map(e => ({
            speaker: e.speaker,
            text: e.text,
          })));
          setElapsedTime(savedState.elapsedTime);
          console.log('[Coach Voice] Found resumable session with', savedState.transcript.length, 'entries');
        }
      } catch (error) {
        console.error('[Coach Voice] Failed to check resumable:', error);
      }
    };

    checkResumableVoiceSession();
  }, [state.sessionId, mode]);

  // Track conversation in a ref for stable access
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  // Voice session summary for display on ended screen
  const [voiceSummary, setVoiceSummary] = useState('');

  // End coaching session
  const handleEndSession = useCallback(async () => {
    // Mark as intentionally ending to prevent "interrupted" marking
    isEndingRef.current = true;

    if (coachStreamingTimer.current) {
      clearInterval(coachStreamingTimer.current);
    }

    // Flush any pending voice entries before ending
    if (mode === 'voice') {
      await flushPendingEntries();
      if (connectionStatus === 'connected') {
        await conversation.endSession();
      }
    }
    voiceSessionStartedRef.current = false;
    setHasExistingVoiceSession(false);

    try {
      if (mode === 'text') {
        const result = await endCoachSession();
        toast.success(`Coaching session completed! ${result.messageCount} messages exchanged.`);
      } else {
        // For voice mode, use the new endpoint that extracts notes via Gemini
        toast.loading('Analyzing your coaching session...', { id: 'voice-end' });
        try {
          const result = await endVoiceCoaching();
          toast.dismiss('voice-end');

          // Save the extracted notes to state for display
          if (result.sessionNotes.length > 0) {
            setSessionNotes(prev => [...prev, ...result.sessionNotes]);
          }
          if (result.actionItems.length > 0) {
            setActionItems(prev => [...prev, ...result.actionItems]);
          }
          if (result.summary) {
            setVoiceSummary(result.summary);
          }

          toast.success(`Voice coaching session completed! ${result.messageCount} exchanges analyzed.`);
        } catch (e) {
          console.error('[Coach Voice] Failed to extract notes:', e);
          toast.dismiss('voice-end');
          toast.success('Voice coaching session ended.');
        }
      }
      setSessionStatus('ended');
    } catch (error) {
      console.error('Failed to end session:', error);
      setSessionStatus('ended');
    }
  }, [mode, connectionStatus, conversation, flushPendingEntries]);

  // Start text coaching session
  const handleStartTextSession = useCallback(async () => {
    if (!state.sessionId) return;

    setSessionStatus('starting');
    setIsLoading(true);

    try {
      // Don't pass coachType - let backend auto-detect (Unified Coach feature)
      const response = await startCoaching({
        targetRole: state.setup.targetRole,
        targetCompany: state.setup.targetCompany,
      });

      const initialMessage: CoachMessage = {
        id: `coach_${Date.now()}`,
        role: 'coach',
        content: response.initialMessage,
        timestamp: new Date().toISOString(),
        suggestions: response.suggestions,
      };

      setMessages([initialMessage]);
      setSuggestions(response.suggestions);
      setSessionStatus('active');
    } catch (error) {
      console.error('Failed to start coaching session:', error);
      toast.error('Failed to start coaching session');
      setSessionStatus('idle');
    } finally {
      setIsLoading(false);
    }
  }, [state.sessionId, state.setup.targetRole, state.setup.targetCompany]);

  // Start voice coaching session
  const handleStartVoiceSession = useCallback(async () => {
    if (!state.sessionId || voiceSessionStartedRef.current) return;

    voiceSessionStartedRef.current = true;
    setSessionStatus('starting');
    setIsLoading(true);

    try {
      // Don't pass coachType - let backend auto-detect (Unified Coach feature)
      const response = await startVoiceCoaching({
        targetRole: state.setup.targetRole,
        targetCompany: state.setup.targetCompany,
      });

      await conversation.startSession({
        signedUrl: response.signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: response.overrides.systemPrompt },
            firstMessage: response.overrides.firstMessage,
          },
        },
      });

      setSessionStatus('active');
    } catch (error) {
      console.error('Failed to start voice coaching:', error);
      toast.error('Failed to start voice coaching');
      setSessionStatus('idle');
      voiceSessionStartedRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [state.sessionId, state.setup.targetRole, state.setup.targetCompany, conversation]);

  // Resume interrupted voice coaching session
  const handleResumeVoice = useCallback(async () => {
    if (!state.sessionId || voiceSessionStartedRef.current) return;

    voiceSessionStartedRef.current = true;
    isEndingRef.current = false;
    setSessionStatus('starting');
    setIsLoading(true);

    try {
      // Get resume data with context from previous transcript
      const response = await resumeVoiceCoaching();

      await conversation.startSession({
        signedUrl: response.signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: response.overrides.systemPrompt },
            firstMessage: response.overrides.firstMessage,
          },
        },
      });

      setSessionStatus('active');
      setHasExistingVoiceSession(false);
      toast.success('Resumed your coaching session');
    } catch (error) {
      console.error('Failed to resume voice coaching:', error);
      toast.error('Failed to resume session. Starting fresh.');
      // Fall back to new session
      voiceSessionStartedRef.current = false;
      setHasExistingVoiceSession(false);
      handleStartVoiceSession();
    } finally {
      setIsLoading(false);
    }
  }, [state.sessionId, conversation, handleStartVoiceSession]);

  // Start session based on mode
  const handleStartSession = useCallback(() => {
    if (mode === 'voice') {
      handleStartVoiceSession();
    } else {
      handleStartTextSession();
    }
  }, [mode, handleStartVoiceSession, handleStartTextSession]);

  // Send message to coach (text mode)
  const handleSendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;

    // Stop STT if active (user clicked Send while in voice input mode)
    if (isSTTListening) {
      stopSTT();
      setInputMode('text');
    }

    setInputValue('');
    setIsLoading(true);

    const userMessage: CoachMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      suggestions: [],
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await sendCoachMessage(text);
      const coachMessage: CoachMessage = {
        id: `coach_${Date.now()}`,
        role: 'coach',
        content: response.message,
        timestamp: new Date().toISOString(),
        suggestions: response.suggestions,
      };

      setMessages(prev => [...prev, coachMessage]);
      setSuggestions(response.suggestions);

      if (response.sessionNotes.length > 0) {
        setSessionNotes(prev => [...prev, ...response.sessionNotes]);
      }
      if (response.actionItems.length > 0) {
        setActionItems(prev => [...prev, ...response.actionItems]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, isSTTListening, stopSTT]);

  // Handle mic button click for hybrid text/voice input
  const handleMicClick = useCallback(async () => {
    if (inputMode === 'stt') {
      // Stop listening, switch back to text mode
      stopSTT();
      setInputMode('text');
    } else {
      // Stop any TTS playback first (duck audio)
      getAudioPlayer().stop();
      setTtsPlaying(null);

      // Start listening
      setInputMode('stt');
      await startSTT();
    }
  }, [inputMode, stopSTT, startSTT]);

    // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  // ============================================================================
  // READER MODE (Google Gemini TTS) HANDLERS
  // ============================================================================

  // Load available TTS voices on mount
  useEffect(() => {
    if (mode === 'text') {
      getGeminiTTSVoices()
        .then((response) => {
          setAvailableVoices(response.voices);
          // Set default voice if not already set
          if (!localStorage.getItem('coachmic_tts_voice')) {
            setSelectedVoice(response.default);
          }
        })
        .catch((error) => console.error('[Reader Mode] Failed to load voices:', error));
    }
  }, [mode]);

  // TTS playback handler
  const handlePlayTTS = useCallback(async (messageId: string, text: string) => {
    const player = getAudioPlayer();

    // If already playing this message, stop it
    if (player.isPlaying(messageId)) {
      player.stop();
      setTtsPlaying(null);
      return;
    }

    // Stop any other playing audio
    player.stop();
    setTtsPlaying(null);
    setTtsLoading(messageId);

    try {
      const audioData = await generateGeminiTTS(
        text,
        selectedVoice,
        'warmly and encouragingly, like a supportive career coach'
      );

      await player.play(audioData, messageId, () => {
        // Callback when playback ends
        setTtsPlaying(null);
      });
      setTtsPlaying(messageId);
    } catch (error) {
      console.error('[Reader Mode] TTS generation failed:', error);
      toast.error('Failed to generate audio. Please try again.');
    } finally {
      setTtsLoading(null);
    }
  }, [selectedVoice]);

  // Auto-play when reader mode is on and new coach message arrives
  useEffect(() => {
    if (!readerMode || messages.length === 0 || isLoading || mode !== 'text') return;

    const lastMessage = messages[messages.length - 1];
    // Only auto-play coach messages that we haven't auto-played yet
    if (
      lastMessage.role === 'coach' &&
      !autoPlayedMessagesRef.current.has(lastMessage.id)
    ) {
      // Mark as auto-played immediately to prevent duplicate triggers
      autoPlayedMessagesRef.current.add(lastMessage.id);
      // Small delay to ensure the message is rendered first
      const timer = setTimeout(() => {
        handlePlayTTS(lastMessage.id, lastMessage.content);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [messages, readerMode, isLoading, mode, handlePlayTTS]);

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      const player = getAudioPlayer();
      player.stop();
    };
  }, []);

  // Toggle Reader Mode with localStorage persistence
  const toggleReaderMode = useCallback(() => {
    const newValue = !readerMode;
    setReaderMode(newValue);
    localStorage.setItem('coachmic_reader_mode', String(newValue));
    if (!newValue) {
      // Stop audio when disabling reader mode
      getAudioPlayer().stop();
      setTtsPlaying(null);
    }
  }, [readerMode]);

  // Handle voice selection with localStorage persistence
  const handleVoiceChange = useCallback((voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem('coachmic_tts_voice', voice);
  }, []);

  if (sessionStatus === 'idle') {
    return (
      <div className="min-h-[calc(100vh-8rem)] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">AI Career Coach</h1>
          <p className="text-gray-600 mb-8">
            Get personalized coaching based on your current preparation stage.
          </p>

          {/* Auto-detected phase indicator (Unified Coach feature) */}
          {isDetecting ? (
            <div className="p-6 rounded-xl border-2 border-gray-200 bg-gray-50 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600">Analyzing your session data...</p>
              </div>
            </div>
          ) : (
            <div className={`p-6 rounded-xl border-2 mb-8 ${
              coachType === 'pre_interview'
                ? 'border-primary-500 bg-primary-50'
                : 'border-green-500 bg-green-50'
            }`}>
              {coachType === 'pre_interview' ? (
                <>
                  <SparklesIcon className="w-10 h-10 text-primary-600 mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Pre-Interview Coach</h3>
                  <p className="text-sm text-gray-600">
                    You haven't completed an interview yet. Let's prepare you with STAR story
                    refinement, practice questions, and confidence building.
                  </p>
                </>
              ) : (
                <>
                  <ArrowTrendingUpIcon className="w-10 h-10 text-green-600 mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Post-Interview Coach</h3>
                  <p className="text-sm text-gray-600">
                    You've completed an interview! Let's review your feedback, improve specific
                    answers, and create an action plan for your next interview.
                  </p>
                </>
              )}
            </div>
          )}

          {/* No resume warning - only show if no resume in both backend detection AND local state */}
          {!isDetecting && !state.setup.resumeParsedData && detectionResult && !detectionResult.hasResume && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-sm text-amber-800">
                No resume uploaded. Coaching will be general.{' '}
                <button onClick={() => navigate('/setup')} className="underline font-medium">
                  Upload resume for personalized coaching
                </button>
              </p>
            </div>
          )}

          <div className="mb-8">
            <p className="text-sm text-gray-500 mb-3">Communication Mode:</p>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('text')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  mode === 'text'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" /> Text Chat
                <HelpTooltip {...helpContent.coachingMode.text} />
              </button>
              <button
                onClick={() => setMode('voice')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  mode === 'voice'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <MicrophoneIcon className="w-4 h-4" /> Voice Chat (Like Interview)
                <HelpTooltip {...helpContent.coachingMode.voice} />
              </button>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl mb-6">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Target Role:</span> {state.setup.targetRole || 'Not set'}
            </p>
            {state.setup.targetCompany && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Company:</span> {state.setup.targetCompany}
              </p>
            )}
            {state.setup.resumeParsedData && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" /> Resume uploaded - coaching will be personalized
              </p>
            )}
            {mode === 'voice' && (
              <p className="text-sm text-primary-600 mt-2 flex items-center gap-1">
                <MicrophoneIcon className="w-4 h-4" /> Voice mode: Speak naturally like in the interview
              </p>
            )}
          </div>

          {/* Resume button for interrupted voice sessions */}
          {hasExistingVoiceSession && mode === 'voice' && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800 mb-3 flex items-center gap-2">
                <span className="text-lg">⚡</span>
                You have an interrupted voice session. Resume to continue where you left off.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleResumeVoice}
                  disabled={isLoading}
                  className="btn-primary flex-1"
                >
                  {isLoading ? 'Resuming...' : 'Resume Session'}
                </button>
                <button
                  onClick={() => {
                    setHasExistingVoiceSession(false);
                    setVoiceTranscript([]);
                    setElapsedTime(0);
                  }}
                  className="btn-secondary"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleStartSession}
            disabled={isLoading || isDetecting}
            className="btn-primary w-full"
          >
            {isLoading ? 'Starting...' : isDetecting ? 'Detecting...' : hasExistingVoiceSession && mode === 'voice' ? 'Start New Session' : 'Start Coaching Session'}
          </button>

          <button
            onClick={() => navigate(-1)}
            className="btn-secondary w-full mt-3"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }
  
  if (sessionStatus === 'ended') {
    return (
      <div className="min-h-[calc(100vh-8rem)] py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">Coaching Session Complete!</h2>
          <p className="text-gray-600 mb-6">
            Great work! Here's what you covered in this session.
          </p>

          {/* Voice Session Summary */}
          {voiceSummary && (
            <div className="text-left p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
              <p className="text-sm font-medium text-blue-700 uppercase mb-2">Session Summary</p>
              <p className="text-gray-700">{voiceSummary}</p>
            </div>
          )}

          {sessionNotes.length > 0 && (
            <div className="text-left p-4 bg-gray-50 rounded-xl mb-4">
              <p className="text-sm font-medium text-gray-500 uppercase mb-2">Session Notes</p>
              <ul className="space-y-1">
                {sessionNotes.map((note, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span>•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="text-left p-4 bg-primary-50 rounded-xl mb-6">
              <p className="text-sm font-medium text-primary-700 uppercase mb-2">Action Items</p>
              <ul className="space-y-1">
                {actionItems.map((item, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span>☐</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setSessionStatus('idle');
                setMessages([]);
                setVoiceTranscript([]);
                setSessionNotes([]);
                setActionItems([]);
                setSuggestions([]);
                setVoiceSummary('');
                voiceSessionStartedRef.current = false;
              }}
              className="btn-primary"
            >
              Start Another Session
            </button>

            {coachType === 'pre_interview' ? (
              <>
                <button onClick={() => navigate('/interview')} className="btn-secondary">I'm Ready - Start Interview Now</button>
                <button onClick={() => navigate('/setup')} className="btn-secondary">← Back to Setup</button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/feedback')} className="btn-secondary">View Interview Feedback</button>
                <button onClick={() => navigate('/setup')} className="btn-secondary">Practice Another Interview</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render active VOICE coaching session
  if (mode === 'voice') {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col">
        {/* Main content area - adjusts for tools panel */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${showToolsPanel ? 'lg:pr-[440px]' : ''}`}>
        {/* Header - sticky below main nav */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-16 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <MicrophoneIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="font-semibold">
                {coachType === 'pre_interview' ? 'Pre-Interview Coach' : 'Post-Interview Coach'}
              </h1>
              <p className="text-xs text-gray-500">
                Voice Mode • {state.setup.targetRole}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
            </div>
            <button
              onClick={() => setShowToolsPanel(!showToolsPanel)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showToolsPanel
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'
              }`}
            >
              <WrenchScrewdriverIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Tools</span>
            </button>
            <button
              onClick={handleEndSession}
              className="text-sm text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Voice Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {voiceTranscript.map((entry, index) => (
            <div
              key={index}
              className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  entry.speaker === 'user'
                    ? 'bg-primary-500 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                <div className={`prose prose-sm max-w-none ${
                  entry.speaker === 'user'
                    ? 'prose-invert prose-p:text-white prose-strong:text-white prose-em:text-white'
                    : 'prose-gray'
                }`}>
                  <ReactMarkdown>{entry.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {liveUserTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-primary-400 text-white rounded-br-sm">
                <p className="whitespace-pre-wrap text-gray-200">{liveUserTranscript}</p>
              </div>
            </div>
          )}

          {liveCoachTranscript && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-200 text-gray-800 rounded-bl-sm">
                <p className="whitespace-pre-wrap text-gray-600">{liveCoachTranscript}</p>
              </div>
            </div>
          )}

          {voiceTranscript.length === 0 && !liveUserTranscript && !liveCoachTranscript && connectionStatus === 'connected' && (
            <div className="text-center text-gray-500 py-8">
              Waiting for coach to start speaking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Voice Activity Indicator */}
        <div className="border-t bg-white p-4">
          <div className="text-center">
            {connectionStatus === 'connected' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                {isSpeaking ? (
                  <>
                    <div className="flex gap-1">
                      <span className="w-1 h-4 bg-primary-500 rounded animate-pulse" />
                      <span className="w-1 h-6 bg-primary-500 rounded animate-pulse" style={{ animationDelay: '75ms' }} />
                      <span className="w-1 h-3 bg-primary-500 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                    </div>
                    <span className="text-sm text-gray-600">Coach speaking...</span>
                  </>
                ) : (
                  <>
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-600">Listening... Speak naturally</span>
                  </>
                )}
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-full">
                <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-yellow-700">Connecting to coach...</span>
              </div>
            )}
          </div>
        </div>
        </div> {/* End of main content wrapper */}

        {/* Application Tools Panel */}
        <ApplicationToolsPanel
          isOpen={showToolsPanel}
          onClose={() => setShowToolsPanel(false)}
          defaultTab="notes"
          companyName={state.setup.targetCompany || undefined}
          targetRole={state.setup.targetRole || undefined}
          title="Coaching Tools"
        />
      </div>
    );
  }

  // Render active TEXT coaching session
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col">
      {/* Main content area - adjusts for tools panel */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showToolsPanel ? 'lg:pr-[440px]' : ''}`}>
      {/* Header - sticky below main nav */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-16 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <SparklesIcon className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="font-semibold">
              {coachType === 'pre_interview' ? 'Pre-Interview Coach' : 'Post-Interview Coach'}
            </h1>
            <p className="text-xs text-gray-500">
              {state.setup.targetRole} {state.setup.targetCompany && `@ ${state.setup.targetCompany}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Reader Mode Controls - Voice selector + Toggle */}
          {readerMode && availableVoices.length > 0 && (
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              title="Select TTS voice"
            >
              {availableVoices.map((voice) => (
                <option key={voice.name} value={voice.name} title={voice.description}>
                  {voice.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={toggleReaderMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              readerMode
                ? 'bg-green-100 text-green-700 font-medium'
                : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
            }`}
            title={readerMode ? 'Reader Mode ON - Click to disable' : 'Reader Mode OFF - Click to enable audio'}
          >
            <SpeakerWaveIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Reader</span>
          </button>
          <button
            onClick={() => setShowToolsPanel(!showToolsPanel)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showToolsPanel
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'
            }`}
          >
            <WrenchScrewdriverIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Tools</span>
          </button>
          <button
            onClick={handleEndSession}
            className="text-sm text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              <div className={`prose prose-sm max-w-none ${
                message.role === 'user'
                  ? 'prose-invert prose-p:text-white prose-strong:text-white prose-em:text-white'
                  : 'prose-gray'
              }`}>
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
              {/* Message footer with timestamp and TTS controls */}
              <div className={`flex items-center gap-2 mt-1 ${message.role === 'user' ? 'justify-end' : 'justify-between'}`}>
                <p className={`text-xs ${message.role === 'user' ? 'text-primary-100' : 'text-gray-400'}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {/* TTS Play/Stop button - only for coach messages when Reader Mode is on */}
                {message.role === 'coach' && readerMode && (
                  <button
                    onClick={() => handlePlayTTS(message.id, message.content)}
                    disabled={ttsLoading === message.id}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                      ttsPlaying === message.id
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                    title={ttsPlaying === message.id ? 'Stop playback' : 'Play message'}
                  >
                    {ttsLoading === message.id ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : ttsPlaying === message.id ? (
                      <>
                        <StopIcon className="w-3 h-3" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-3 h-3" />
                        <span>Play</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Suggested responses:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-full hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area with Hybrid Text/Voice Input */}
      <div className="border-t bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              className={`input flex-1 w-full pr-12 ${
                inputMode === 'stt' ? 'bg-gray-100' : ''
              }`}
              placeholder={inputMode === 'stt' ? 'Listening...' : 'Type your message...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isLoading || inputMode === 'stt'}
              readOnly={inputMode === 'stt'}
            />
            {/* Mic button inside input */}
            <button
              onClick={handleMicClick}
              disabled={isLoading || isSTTConnecting}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
                inputMode === 'stt'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-gray-400 hover:text-primary-500 hover:bg-gray-100'
              }`}
              title={inputMode === 'stt' ? 'Stop listening' : 'Start voice input'}
            >
              {isSTTConnecting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : inputMode === 'stt' ? (
                <StopIcon className="w-5 h-5" />
              ) : (
                <MicrophoneIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="btn-primary px-6"
          >
            Send
          </button>
        </div>
        {/* Voice input error display */}
        {sttError && (
          <p className="text-xs text-red-500 mt-2">{sttError}</p>
        )}
      </div>

      {/* Session Notes Toggle Button - positioned below sticky header */}
      {(sessionNotes.length > 0 || actionItems.length > 0) && (
        <button
          onClick={() => setShowSessionNotes(!showSessionNotes)}
          className={`fixed right-4 top-36 z-50 p-2 rounded-full shadow-lg transition-colors ${
            showSessionNotes
              ? 'bg-primary-500 text-white'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
          title={showSessionNotes ? 'Hide session notes' : 'Show session notes'}
        >
          <DocumentTextIcon className="w-5 h-5" />
        </button>
      )}

      {/* Session Notes Sidebar */}
      {(sessionNotes.length > 0 || actionItems.length > 0) && showSessionNotes && (
        <div className="fixed right-4 top-48 w-64 max-h-[50vh] overflow-y-auto bg-white rounded-xl border shadow-lg p-4 z-40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase">Session Notes</p>
            <button
              onClick={() => setShowSessionNotes(false)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {sessionNotes.length > 0 && (
            <div className="mb-4">
              <ul className="space-y-1">
                {sessionNotes.slice(-5).map((note, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                    <span>•</span>
                    <span className="line-clamp-2">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-primary-600 uppercase mb-1">Action Items</p>
              <ul className="space-y-1">
                {actionItems.slice(-3).map((item, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                    <span>☐</span>
                    <span className="line-clamp-2">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      </div> {/* End of main content wrapper */}

      {/* Application Tools Panel */}
      <ApplicationToolsPanel
        isOpen={showToolsPanel}
        onClose={() => setShowToolsPanel(false)}
        defaultTab="notes"
        companyName={state.setup.targetCompany || undefined}
        targetRole={state.setup.targetRole || undefined}
        title="Coaching Tools"
      />
    </div>
  );
}
