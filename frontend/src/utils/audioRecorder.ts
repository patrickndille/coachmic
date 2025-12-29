/**
 * Audio recording utility for capturing microphone input.
 *
 * Uses Web Audio API with AudioWorklet for efficient, low-latency
 * audio capture. Outputs PCM audio suitable for streaming to STT services.
 */

export type AudioDataCallback = (data: ArrayBuffer) => void;

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private onAudioData: AudioDataCallback | null = null;
  private isRecordingState: boolean = false;

  /**
   * Check if AudioWorklet is supported in this browser.
   */
  static isSupported(): boolean {
    return (
      typeof AudioContext !== 'undefined' &&
      typeof AudioWorkletNode !== 'undefined'
    );
  }

  /**
   * Request microphone permission.
   *
   * @returns Promise resolving to true if permission granted
   */
  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error('[AudioRecorder] Permission denied:', error);
      return false;
    }
  }

  /**
   * Start recording audio from the microphone.
   *
   * @param onAudioData - Callback invoked with PCM audio chunks
   * @throws Error if microphone access fails or AudioWorklet not supported
   */
  async start(onAudioData: AudioDataCallback): Promise<void> {
    if (this.isRecordingState) {
      console.warn('[AudioRecorder] Already recording');
      return;
    }

    if (!AudioRecorder.isSupported()) {
      throw new Error('AudioWorklet is not supported in this browser');
    }

    this.onAudioData = onAudioData;

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 48000 }, // Browser will pick closest
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new AudioContext();

      // Load the AudioWorklet module
      await this.audioContext.audioWorklet.addModule('/audio-worklet.js');

      // Create source from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

      // Handle audio data from worklet
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        if (this.onAudioData && event.data instanceof ArrayBuffer) {
          this.onAudioData(event.data);
        }
      };

      // Connect the nodes: microphone -> worklet
      this.sourceNode.connect(this.workletNode);
      // Note: We don't connect to destination (speakers) to avoid feedback

      this.isRecordingState = true;
      console.log('[AudioRecorder] Recording started');
    } catch (error) {
      // Cleanup on error
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording and release resources.
   */
  stop(): void {
    if (!this.isRecordingState) {
      return;
    }

    this.cleanup();
    this.isRecordingState = false;
    console.log('[AudioRecorder] Recording stopped');
  }

  /**
   * Clean up all audio resources.
   */
  private cleanup(): void {
    // Disconnect nodes
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.sourceNode = null;
    }

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
        this.workletNode.port.close();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.workletNode = null;
    }

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      });
      this.audioContext = null;
    }

    this.onAudioData = null;
  }

  /**
   * Check if currently recording.
   */
  isRecording(): boolean {
    return this.isRecordingState;
  }

  /**
   * Get the current audio context sample rate.
   * Returns null if not recording.
   */
  getSampleRate(): number | null {
    return this.audioContext?.sampleRate ?? null;
  }
}

// Singleton instance for app-wide use
let audioRecorderInstance: AudioRecorder | null = null;

/**
 * Get the singleton AudioRecorder instance.
 */
export function getAudioRecorder(): AudioRecorder {
  if (!audioRecorderInstance) {
    audioRecorderInstance = new AudioRecorder();
  }
  return audioRecorderInstance;
}

/**
 * Reset the singleton instance (useful for testing or cleanup).
 */
export function resetAudioRecorder(): void {
  if (audioRecorderInstance) {
    audioRecorderInstance.stop();
    audioRecorderInstance = null;
  }
}
