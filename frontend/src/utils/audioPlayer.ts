/**
 * Audio playback utility for managing TTS audio in CoachMic.
 *
 * Handles single-track playback with stop-on-new functionality.
 * Uses Web Audio API for reliable playback and control.
 */

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentMessageId: string | null = null;
  private onPlaybackEndCallback: (() => void) | null = null;
  private isPlayingState: boolean = false;

  /**
   * Ensure AudioContext is initialized and running.
   * AudioContext must be created after user interaction (browser policy).
   */
  private async ensureContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Play WAV audio data, stopping any currently playing audio.
   *
   * @param audioData - ArrayBuffer containing WAV audio data
   * @param messageId - Unique identifier for the message being played
   * @param onEnd - Optional callback when playback ends
   */
  async play(
    audioData: ArrayBuffer,
    messageId: string,
    onEnd?: () => void
  ): Promise<void> {
    // Stop any current playback first
    this.stop();

    try {
      const context = await this.ensureContext();

      // Decode the audio data
      const audioBuffer = await context.decodeAudioData(audioData.slice(0));

      // Create source node
      this.currentSource = context.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(context.destination);

      // Track state
      this.currentMessageId = messageId;
      this.onPlaybackEndCallback = onEnd || null;
      this.isPlayingState = true;

      // Handle playback end
      this.currentSource.onended = () => {
        this.isPlayingState = false;
        this.currentMessageId = null;
        this.currentSource = null;
        if (this.onPlaybackEndCallback) {
          this.onPlaybackEndCallback();
          this.onPlaybackEndCallback = null;
        }
      };

      // Start playback
      this.currentSource.start(0);
      console.log(`[AudioPlayer] Started playing message: ${messageId}`);
    } catch (error) {
      console.error('[AudioPlayer] Error playing audio:', error);
      this.isPlayingState = false;
      this.currentMessageId = null;
      this.currentSource = null;
      throw error;
    }
  }

  /**
   * Stop current playback immediately.
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
        console.log(`[AudioPlayer] Stopped playing message: ${this.currentMessageId}`);
      } catch (e) {
        // Source may already be stopped
      }
      this.currentSource = null;
    }
    this.isPlayingState = false;
    this.currentMessageId = null;
    this.onPlaybackEndCallback = null;
  }

  /**
   * Check if audio is currently playing.
   *
   * @param messageId - Optional: check if a specific message is playing
   * @returns true if playing (or if the specific message is playing)
   */
  isPlaying(messageId?: string): boolean {
    if (!messageId) {
      return this.isPlayingState;
    }
    return this.isPlayingState && this.currentMessageId === messageId;
  }

  /**
   * Get the ID of the currently playing message.
   *
   * @returns Message ID or null if nothing is playing
   */
  getCurrentMessageId(): string | null {
    return this.currentMessageId;
  }

  /**
   * Clean up resources. Call when done with the player.
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('[AudioPlayer] Disposed');
  }
}

// Singleton instance for app-wide use
let audioPlayerInstance: AudioPlayer | null = null;

/**
 * Get the singleton AudioPlayer instance.
 *
 * @returns The shared AudioPlayer instance
 */
export function getAudioPlayer(): AudioPlayer {
  if (!audioPlayerInstance) {
    audioPlayerInstance = new AudioPlayer();
  }
  return audioPlayerInstance;
}

/**
 * Reset the singleton instance (useful for testing or cleanup).
 */
export function resetAudioPlayer(): void {
  if (audioPlayerInstance) {
    audioPlayerInstance.dispose();
    audioPlayerInstance = null;
  }
}
