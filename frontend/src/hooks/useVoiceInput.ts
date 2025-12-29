/**
 * useVoiceInput - Custom hook for managing voice input to text.
 *
 * Provides WebSocket connection to the STT service, audio recording,
 * and real-time transcript state management.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAudioRecorder, AudioRecorder } from '../utils/audioRecorder';
import { getCurrentUserToken } from '../services/firebase';
import { getSTTWebSocketUrl } from '../services/api';

export interface UseVoiceInputResult {
  /** Current transcribed text (accumulates as user speaks) */
  transcript: string;
  /** Whether actively recording and transcribing */
  isListening: boolean;
  /** Whether WebSocket is connecting */
  isConnecting: boolean;
  /** Error message if any */
  error: string | null;
  /** Start voice input */
  startListening: () => Promise<void>;
  /** Stop voice input */
  stopListening: () => void;
  /** Clear the current transcript */
  clearTranscript: () => void;
}

interface STTMessage {
  type: 'auth_success' | 'transcript' | 'error';
  text?: string;
  is_final?: boolean;
  code?: string;
  message?: string;
}

/**
 * Hook for managing voice input with real-time speech-to-text.
 *
 * @param initialText - Optional initial text to prepend to transcript
 * @param onTranscriptUpdate - Optional callback when transcript changes
 * @returns Voice input state and controls
 */
export function useVoiceInput(
  initialText: string = '',
  onTranscriptUpdate?: (text: string, isFinal: boolean) => void
): UseVoiceInputResult {
  const [transcript, setTranscript] = useState(initialText);
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  // Keep track of accumulated finalized text
  const finalizedTextRef = useRef<string>(initialText);
  // Track the current interim text (replaces with each update)
  const currentInterimRef = useRef<string>('');
  // Track the best (longest) display text to prevent flickering
  const bestDisplayRef = useRef<string>(initialText);

  /**
   * Clean up WebSocket and recorder.
   */
  const cleanup = useCallback(() => {
    // Stop recorder
    if (recorderRef.current?.isRecording()) {
      recorderRef.current.stop();
    }

    // Close WebSocket
    if (wsRef.current) {
      try {
        // Send stop message before closing
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
      } catch (e) {
        // Ignore close errors
      }
      wsRef.current = null;
    }

    setIsListening(false);
    setIsConnecting(false);
  }, []);

  /**
   * Start listening for voice input.
   */
  const startListening = useCallback(async () => {
    if (isListening || isConnecting) {
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      // Check AudioWorklet support
      if (!AudioRecorder.isSupported()) {
        throw new Error('Voice input is not supported in this browser');
      }

      // Get auth token
      const token = await getCurrentUserToken();
      if (!token) {
        throw new Error('Please sign in to use voice input');
      }

      // Store current text as base for this session
      finalizedTextRef.current = transcript;
      currentInterimRef.current = '';
      bestDisplayRef.current = transcript;

      // Create WebSocket connection
      const wsUrl = getSTTWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set up WebSocket handlers
      ws.onopen = () => {
        console.log('[useVoiceInput] WebSocket connected');
        // Send auth message
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = async (event) => {
        try {
          const message: STTMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'auth_success':
              console.log('[useVoiceInput] Authenticated, starting recorder');
              // Start recording after auth success
              const recorder = getAudioRecorder();
              recorderRef.current = recorder;

              await recorder.start((audioData) => {
                // Send audio chunk to WebSocket
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(audioData);
                }
              });

              setIsConnecting(false);
              setIsListening(true);
              break;

            case 'transcript':
              if (message.text !== undefined) {
                const trimmedText = message.text.trim();

                if (message.is_final && trimmedText) {
                  // Final transcript - append to accumulated text
                  console.log('[useVoiceInput] Final:', trimmedText);
                  const separator = finalizedTextRef.current && !finalizedTextRef.current.endsWith(' ') ? ' ' : '';
                  finalizedTextRef.current = finalizedTextRef.current + separator + trimmedText;
                  currentInterimRef.current = '';
                  bestDisplayRef.current = finalizedTextRef.current;
                  setTranscript(finalizedTextRef.current);
                  onTranscriptUpdate?.(finalizedTextRef.current, true);
                } else if (!message.is_final) {
                  // Interim transcript - show accumulated + current interim
                  currentInterimRef.current = trimmedText;
                  const separator = finalizedTextRef.current && trimmedText && !finalizedTextRef.current.endsWith(' ') ? ' ' : '';
                  const displayText = finalizedTextRef.current + separator + trimmedText;

                  // Only update display if we have more content (prevents flickering)
                  if (displayText.length >= bestDisplayRef.current.length || trimmedText.length > 0) {
                    if (displayText.length > bestDisplayRef.current.length) {
                      bestDisplayRef.current = displayText;
                    }
                    setTranscript(displayText);
                    onTranscriptUpdate?.(displayText, false);
                  }
                }
              }
              break;

            case 'error':
              console.error('[useVoiceInput] STT error:', message.message);
              setError(message.message || 'Speech recognition error');
              cleanup();
              break;
          }
        } catch (e) {
          console.error('[useVoiceInput] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[useVoiceInput] WebSocket error:', event);
        setError('Connection error. Please try again.');
        cleanup();
      };

      ws.onclose = (event) => {
        console.log('[useVoiceInput] WebSocket closed:', event.code, event.reason);
        if (isListening) {
          cleanup();
        }
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to start voice input';
      console.error('[useVoiceInput] Start error:', e);
      setError(errorMessage);
      setIsConnecting(false);
      cleanup();
    }
  }, [isListening, isConnecting, transcript, cleanup, onTranscriptUpdate]);

  /**
   * Stop listening for voice input.
   */
  const stopListening = useCallback(() => {
    if (!isListening && !isConnecting) {
      return;
    }

    console.log('[useVoiceInput] Stopping');

    // Capture the best text before cleanup (includes any unfinalized speech)
    // Use the longer of: finalized + current interim, or best display seen
    const finalWithInterim = currentInterimRef.current
      ? `${finalizedTextRef.current} ${currentInterimRef.current}`.trim()
      : finalizedTextRef.current;
    const textToKeep = finalWithInterim.length >= bestDisplayRef.current.length
      ? finalWithInterim
      : bestDisplayRef.current;

    cleanup();

    // Keep accumulated text (including any interim that wasn't finalized)
    setTranscript(textToKeep);
    onTranscriptUpdate?.(textToKeep, true);
  }, [isListening, isConnecting, cleanup, onTranscriptUpdate]);

  /**
   * Clear the transcript.
   */
  const clearTranscript = useCallback(() => {
    setTranscript('');
    finalizedTextRef.current = '';
    currentInterimRef.current = '';
    bestDisplayRef.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Sync refs when initialText changes (and not listening)
  useEffect(() => {
    if (!isListening && !isConnecting) {
      finalizedTextRef.current = initialText;
      bestDisplayRef.current = initialText;
      setTranscript(initialText);
    }
  }, [initialText, isListening, isConnecting]);

  return {
    transcript,
    isListening,
    isConnecting,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}
