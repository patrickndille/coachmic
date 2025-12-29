/**
 * TextInterviewScreen - Text-based mock interview with Gemini AI.
 *
 * Provides the same interview experience as voice interviews but through text chat.
 * Features:
 * - Same interview prompts as voice (reuses build_prompt_overrides)
 * - Reader Mode: TTS for interviewer messages
 * - Hybrid Input: Type or use STT to speak responses
 * - Real-time metrics (filler words, word count)
 * - Pause/Resume capability
 * - Same feedback system as voice interviews
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import {
  startTextInterview,
  sendTextInterviewMessage,
  pauseTextInterview,
  resumeTextInterview,
  endTextInterview,
  getTextInterviewState,
  generateFeedback,
  getGeminiTTSVoices,
  generateGeminiTTS,
  GeminiTTSVoice,
} from '../services/api';
import {
  TextInterviewMessage,
  TextInterviewMetrics,
  TextInterviewConfig,
} from '../types';
import { ApplicationToolsPanel, ApplicationToolsTab } from '../components/tools';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { getAudioPlayer } from '../utils/audioPlayer';
import {
  ClockIcon,
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  PlayIcon,
  StopIcon,
  PauseIcon,
  WrenchScrewdriverIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';

type SessionStatus = 'idle' | 'starting' | 'active' | 'paused' | 'ending';

export default function TextInterviewScreen() {
  const navigate = useNavigate();
  const { state } = useApp();

  // Session state
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [messages, setMessages] = useState<TextInterviewMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Interview config and progress
  const [, setInterviewConfig] = useState<TextInterviewConfig | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<TextInterviewMetrics>({
    fillerWordCount: 0,
    totalWordsSpoken: 0,
    totalSpeakingTime: 0,
    fillerWordsDetected: [],
  });

  // Reader Mode (TTS)
  const [readerMode, setReaderMode] = useState<boolean>(() => {
    return localStorage.getItem('coachmic_reader_mode') === 'true';
  });
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('coachmic_tts_voice') || 'Kore';
  });
  const [availableVoices, setAvailableVoices] = useState<GeminiTTSVoice[]>([]);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);

  // UI state
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [toolsDefaultTab] = useState<ApplicationToolsTab>('notes');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [hasExistingInterview, setHasExistingInterview] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayedMessagesRef = useRef<Set<string>>(new Set());

  // STT hook for hybrid input
  const {
    isListening: isSTTListening,
    isConnecting: isSTTConnecting,
    error: sttError,
    startListening: startSTT,
    stopListening: stopSTT,
  } = useVoiceInput(inputValue, (text) => {
    setInputValue(text);
  });

  // Load TTS voices
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await getGeminiTTSVoices();
        setAvailableVoices(response.voices);
        if (!selectedVoice && response.default) {
          setSelectedVoice(response.default);
        }
      } catch (error) {
        console.error('[TextInterview] Failed to load TTS voices:', error);
      }
    };
    loadVoices();
  }, [selectedVoice]);

  // Save reader mode preference
  useEffect(() => {
    localStorage.setItem('coachmic_reader_mode', String(readerMode));
  }, [readerMode]);

  // Save voice preference
  useEffect(() => {
    if (selectedVoice) {
      localStorage.setItem('coachmic_tts_voice', selectedVoice);
    }
  }, [selectedVoice]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer effect
  useEffect(() => {
    if (sessionStatus === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionStatus]);

  // Check for resumable interview on mount
  useEffect(() => {
    if (!state.sessionId) {
      navigate('/setup');
      return;
    }

    const checkForResumableInterview = async () => {
      try {
        const savedState = await getTextInterviewState();
        if (savedState.hasState && savedState.messages.length > 0) {
          console.log('[TextInterview] Found resumable interview:', savedState.messages.length, 'messages');
          setHasExistingInterview(true);
          setMessages(savedState.messages);
          setQuestionCount(savedState.questionCount);
          setElapsedTime(savedState.elapsedTime);
          if (savedState.metrics) {
            setMetrics(savedState.metrics);
          }
          if (savedState.interviewConfig) {
            setInterviewConfig(savedState.interviewConfig);
            setMaxQuestions(savedState.interviewConfig.maxQuestions);
          }
          if (savedState.status === 'paused') {
            setSessionStatus('paused');
          } else if (savedState.status === 'active') {
            setSessionStatus('active');
          }
        }
      } catch (error) {
        console.error('[TextInterview] Failed to check for resumable interview:', error);
      }
    };

    checkForResumableInterview();
  }, [state.sessionId, navigate]);

  // Play TTS for a message
  const handlePlayTTS = useCallback(async (messageId: string, text: string) => {
    if (ttsPlaying === messageId) {
      // Stop playing
      const player = getAudioPlayer();
      player.stop();
      setTtsPlaying(null);
      return;
    }

    setTtsLoading(messageId);
    try {
      const audioData = await generateGeminiTTS(
        text,
        selectedVoice,
        'Speak clearly as a professional interviewer'
      );

      const player = getAudioPlayer();
      setTtsLoading(null);
      setTtsPlaying(messageId);

      await player.play(audioData, messageId, () => {
        setTtsPlaying(null);
      });
    } catch (error) {
      console.error('[TextInterview] TTS error:', error);
      setTtsLoading(null);
      toast.error('Failed to play audio');
    }
  }, [ttsPlaying, selectedVoice]);

  // Auto-play TTS for new interviewer messages when Reader Mode is on
  useEffect(() => {
    if (!readerMode || sessionStatus !== 'active') return;

    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === 'interviewer' &&
      !autoPlayedMessagesRef.current.has(lastMessage.id)
    ) {
      autoPlayedMessagesRef.current.add(lastMessage.id);
      handlePlayTTS(lastMessage.id, lastMessage.content);
    }
  }, [messages, readerMode, sessionStatus, handlePlayTTS]);

  // Start new interview
  const handleStart = useCallback(async (clearExisting: boolean = false) => {
    if (!state.sessionId) {
      toast.error('No session found');
      navigate('/setup');
      return;
    }

    setSessionStatus('starting');
    try {
      // Clear existing state if starting fresh
      if (clearExisting) {
        setMessages([]);
        setQuestionCount(0);
        setElapsedTime(0);
        setMetrics({
          fillerWordCount: 0,
          totalWordsSpoken: 0,
          totalSpeakingTime: 0,
          fillerWordsDetected: [],
        });
        autoPlayedMessagesRef.current.clear();
      }

      const response = await startTextInterview(clearExisting);

      // Set initial state
      setInterviewConfig(response.interviewConfig);
      setMaxQuestions(response.interviewConfig.maxQuestions);
      setQuestionCount(1);
      setCandidateName(response.candidateName || null);

      // Add first message
      const firstMessage: TextInterviewMessage = {
        id: crypto.randomUUID(),
        role: 'interviewer',
        content: response.firstMessage,
        timestamp: Date.now(),
      };
      setMessages([firstMessage]);

      setSessionStatus('active');
      setHasExistingInterview(false);
      toast.success('Interview started!');

      // Focus input
      inputRef.current?.focus();
    } catch (error) {
      console.error('[TextInterview] Failed to start:', error);
      toast.error('Failed to start interview');
      setSessionStatus('idle');
    }
  }, [state.sessionId, navigate]);

  // Resume paused interview
  const handleResume = useCallback(async () => {
    setSessionStatus('starting');
    try {
      const response = await resumeTextInterview();

      // Restore full state
      setMessages(response.messages);
      setQuestionCount(response.questionCount);
      setElapsedTime(response.elapsedTime);
      setMetrics(response.metrics);
      setInterviewConfig(response.interviewConfig);
      setMaxQuestions(response.interviewConfig.maxQuestions);

      // Add the resume message
      const resumeMessage: TextInterviewMessage = {
        id: crypto.randomUUID(),
        role: 'interviewer',
        content: response.resumeMessage,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, resumeMessage]);

      setSessionStatus('active');
      toast.success('Interview resumed!');
      inputRef.current?.focus();
    } catch (error) {
      console.error('[TextInterview] Failed to resume:', error);
      toast.error('Failed to resume interview');
      setSessionStatus('paused');
    }
  }, []);

  // Send message
  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading || sessionStatus !== 'active') return;

    // Stop STT if active
    if (isSTTListening) {
      stopSTT();
    }

    // Add user message immediately
    const userMessage: TextInterviewMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendTextInterviewMessage(text, elapsedTime);

      // Add interviewer response
      const interviewerMessage: TextInterviewMessage = {
        id: crypto.randomUUID(),
        role: 'interviewer',
        content: response.message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, interviewerMessage]);

      // Update state
      setQuestionCount(response.questionCount);
      setMaxQuestions(response.maxQuestions);
      setMetrics(response.metrics);

      // Check for interview end
      if (response.isClosingStatement) {
        toast.success('Interview complete! Generating feedback...');
        setTimeout(() => handleEnd(), 3000);
      }
    } catch (error) {
      console.error('[TextInterview] Failed to send message:', error);
      toast.error('Failed to get response');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, sessionStatus, elapsedTime, isSTTListening, stopSTT]);

  // Pause interview
  const handlePause = useCallback(async () => {
    try {
      await pauseTextInterview(elapsedTime, metrics);
      setSessionStatus('paused');
      setHasExistingInterview(true);
      toast.success('Interview paused');
    } catch (error) {
      console.error('[TextInterview] Failed to pause:', error);
      toast.error('Failed to pause interview');
    }
  }, [elapsedTime, metrics]);

  // End interview
  const handleEnd = useCallback(async () => {
    setSessionStatus('ending');
    try {
      // Stop TTS if playing
      const player = getAudioPlayer();
      player.stop();
      setTtsPlaying(null);

      // End interview and get transcript
      const endResponse = await endTextInterview();

      // Generate feedback using same endpoint as voice interview
      if (state.sessionId && endResponse.transcript.length > 0) {
        await generateFeedback(state.sessionId, {
          transcript: endResponse.transcript,
        });
        toast.success('Interview complete! Generating feedback...');
        navigate('/feedback');
      } else {
        toast.error('No responses recorded');
        navigate('/setup');
      }
    } catch (error) {
      console.error('[TextInterview] Failed to end:', error);
      toast.error('Failed to end interview. Please try again.');
      setSessionStatus('active');  // Reset status so user can retry
    }
  }, [state.sessionId, navigate]);

  // Handle STT toggle
  const handleSTTToggle = useCallback(async () => {
    if (isSTTListening) {
      stopSTT();
    } else {
      try {
        await startSTT();
      } catch (error) {
        toast.error('Failed to start voice input');
      }
    }
  }, [isSTTListening, startSTT, stopSTT]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercent = maxQuestions > 0 ? Math.min((questionCount / maxQuestions) * 100, 100) : 0;

  // Redirect if no session
  if (!state.sessionId) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showToolsPanel ? 'lg:pr-[440px]' : ''}`}>
        {/* Header - sticky below main nav */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-16 z-10">
          <div className="max-w-4xl mx-auto">
            {/* Top row: Title, Timer, Status */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {state.setup.targetRole} Interview
                  {candidateName && <span className="text-gray-500 font-normal"> - {candidateName}</span>}
                </h1>
                {state.setup.targetCompany && (
                  <p className="text-sm text-gray-600">{state.setup.targetCompany}</p>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Timer */}
                <div className="flex items-center gap-2 text-gray-700">
                  <ClockIcon className="w-5 h-5" />
                  <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
                </div>

                {/* Question Count */}
                <div className="text-sm text-gray-600">
                  Q{questionCount}/{maxQuestions}
                </div>

                {/* Tools Toggle */}
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
              </div>
            </div>

            {/* Progress Bar */}
            {sessionStatus === 'active' && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 font-medium min-w-[3rem]">
                  {Math.round(progressPercent)}%
                </span>
              </div>
            )}

            {/* Metrics Row */}
            {sessionStatus === 'active' && (
              <div className="mt-3 flex items-center justify-center gap-6 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-600" />
                  <div>
                    <div className="text-xs text-gray-600">Filler Words</div>
                    <div className="text-lg font-bold text-gray-900">{metrics.fillerWordCount}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">📝</span>
                  <div>
                    <div className="text-xs text-gray-600">Words</div>
                    <div className="text-lg font-bold text-gray-900">{metrics.totalWordsSpoken}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Reader Mode Toggle */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Reader Mode Toggle */}
                <button
                  onClick={() => setReaderMode(!readerMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    readerMode
                      ? 'bg-green-100 text-green-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <SpeakerWaveIcon className="w-4 h-4" />
                  Reader Mode {readerMode ? 'ON' : 'OFF'}
                </button>

                {/* Voice Selection */}
                {readerMode && (
                  <div className="relative">
                    <button
                      onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <span>{selectedVoice}</span>
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    {showVoiceSettings && (
                      <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[150px]">
                        {availableVoices.map((voice) => (
                          <button
                            key={voice.name}
                            onClick={() => {
                              setSelectedVoice(voice.name);
                              setShowVoiceSettings(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                              selectedVoice === voice.name ? 'bg-primary-50 text-primary-700' : ''
                            }`}
                          >
                            {voice.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Session Status */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    sessionStatus === 'active'
                      ? 'bg-green-500'
                      : sessionStatus === 'starting' || sessionStatus === 'ending'
                      ? 'bg-yellow-500 animate-pulse'
                      : sessionStatus === 'paused'
                      ? 'bg-orange-500'
                      : 'bg-gray-400'
                  }`}
                />
                <span className="text-sm text-gray-600 capitalize">{sessionStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 && sessionStatus === 'idle' && !hasExistingInterview ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ChatBubbleLeftRightIcon className="w-10 h-10 text-primary-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Text Chat Interview</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Practice your interview skills through text. Type or speak your responses.
                  The AI interviewer will provide the same experience as voice interviews.
                </p>
                <button
                  onClick={() => handleStart(false)}
                  className="btn-primary px-8 py-3 text-lg"
                >
                  Start Interview
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-primary-500 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}
                    >
                      {/* Message Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium opacity-70">
                          {message.role === 'user' ? 'You' : 'Interviewer'}
                        </span>
                        {message.role === 'interviewer' && (
                          <button
                            onClick={() => handlePlayTTS(message.id, message.content)}
                            disabled={ttsLoading === message.id}
                            className={`p-1 rounded-full transition-colors ${
                              ttsPlaying === message.id
                                ? 'bg-green-200 text-green-700'
                                : 'hover:bg-gray-200 text-gray-500'
                            }`}
                          >
                            {ttsLoading === message.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : ttsPlaying === message.id ? (
                              <StopIcon className="w-4 h-4" />
                            ) : (
                              <PlayIcon className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                      {/* Message Content */}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 p-4 rounded-2xl rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        {(sessionStatus === 'active' || sessionStatus === 'paused') && (
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto">
              {sessionStatus === 'paused' ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-gray-600">Interview paused. Ready to continue?</p>
                  <div className="flex gap-4">
                    <button onClick={handleResume} className="btn-primary px-6 py-2">
                      Resume Interview
                    </button>
                    <button onClick={() => handleStart(true)} className="btn-secondary px-6 py-2">
                      Start Fresh
                    </button>
                    <button onClick={() => navigate('/setup')} className="btn-secondary px-6 py-2">
                      Back to Setup
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* STT Error */}
                  {sttError && (
                    <div className="mb-2 text-sm text-red-600">
                      {sttError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {/* Text Input */}
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={isLoading}
                        placeholder={isSTTListening ? 'Listening...' : 'Type your response or click the mic to speak...'}
                        className="w-full px-4 py-3 pr-12 border rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        rows={2}
                      />

                      {/* STT Button */}
                      <button
                        onClick={handleSTTToggle}
                        disabled={isLoading}
                        className={`absolute right-3 bottom-3 p-2 rounded-full transition-colors ${
                          isSTTListening
                            ? 'bg-red-500 text-white animate-pulse'
                            : isSTTConnecting
                            ? 'bg-yellow-500 text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        <MicrophoneIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Send Button */}
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="btn-primary px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-gray-500">
                      Press Enter to send, Shift+Enter for new line
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handlePause}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <PauseIcon className="w-4 h-4" />
                        Pause
                      </button>
                      <button
                        onClick={handleEnd}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        End Interview
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Initial State: Start/Resume Options */}
        {sessionStatus === 'idle' && hasExistingInterview && (
          <div className="bg-white border-t border-gray-200 p-6">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-gray-600 mb-4">
                You have an existing interview with {messages.length} messages. Would you like to continue?
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleStart(true)}
                  className="btn-secondary px-6 py-2"
                >
                  Start Fresh
                </button>
                <button
                  onClick={handleResume}
                  className="btn-primary px-6 py-2"
                >
                  Resume Interview
                </button>
                <button
                  onClick={() => navigate('/setup')}
                  className="btn-secondary px-6 py-2"
                >
                  Back to Setup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Starting State */}
        {sessionStatus === 'starting' && (
          <div className="bg-white border-t border-gray-200 p-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 text-primary-600">
                <ArrowPathIcon className="w-6 h-6 animate-spin" />
                <span className="text-lg">Starting interview...</span>
              </div>
            </div>
          </div>
        )}

        {/* Ending State */}
        {sessionStatus === 'ending' && (
          <div className="bg-white border-t border-gray-200 p-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 text-primary-600">
                <ArrowPathIcon className="w-6 h-6 animate-spin" />
                <span className="text-lg">Ending interview and generating feedback...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Application Tools Panel */}
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
