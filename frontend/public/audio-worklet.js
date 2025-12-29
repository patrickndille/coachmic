/**
 * PCM Audio Processor Worklet
 *
 * This AudioWorklet processor captures audio from the microphone,
 * converts Float32 samples to Int16 PCM, resamples to 16kHz,
 * and sends chunks to the main thread for streaming.
 *
 * Audio format output:
 * - LINEAR16 (16-bit signed integer PCM)
 * - 16000 Hz sample rate
 * - Mono channel
 * - Little-endian byte order
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Buffer to accumulate samples for resampling
    this.inputBuffer = [];

    // Target sample rate for Google Cloud STT
    this.targetSampleRate = 16000;

    // Will be set from sampleRate global
    this.sourceSampleRate = sampleRate;

    // Calculate resampling ratio
    this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;

    // Send chunks every ~100ms (1600 samples at 16kHz)
    this.chunkSize = 1600;

    // Accumulated resampled buffer
    this.outputBuffer = [];

    console.log(
      `[PCMProcessor] Initialized: source=${this.sourceSampleRate}Hz, target=${this.targetSampleRate}Hz, ratio=${this.resampleRatio}`
    );
  }

  /**
   * Convert Float32 sample (-1.0 to 1.0) to Int16 (-32768 to 32767)
   */
  floatToInt16(sample) {
    // Clamp to -1.0 to 1.0 range
    const clamped = Math.max(-1, Math.min(1, sample));
    // Convert to 16-bit integer
    return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  /**
   * Simple linear interpolation resampling
   */
  resample(inputSamples) {
    const outputLength = Math.floor(inputSamples.length / this.resampleRatio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * this.resampleRatio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      // Linear interpolation between two samples
      output[i] =
        inputSamples[srcIndexFloor] * (1 - fraction) +
        inputSamples[srcIndexCeil] * fraction;
    }

    return output;
  }

  /**
   * Process audio frames from the microphone
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // Check if we have input audio
    if (!input || !input[0] || input[0].length === 0) {
      return true; // Keep processor alive
    }

    // Get mono channel (use first channel if stereo)
    const inputChannel = input[0];

    // Add input samples to buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.inputBuffer.push(inputChannel[i]);
    }

    // Resample when we have enough samples
    // Process in batches to maintain consistent timing
    const samplesNeeded = Math.ceil(this.chunkSize * this.resampleRatio);

    while (this.inputBuffer.length >= samplesNeeded) {
      // Extract samples for this batch
      const samplesToProcess = this.inputBuffer.splice(0, samplesNeeded);
      const inputArray = new Float32Array(samplesToProcess);

      // Resample to 16kHz
      const resampled = this.resample(inputArray);

      // Add to output buffer
      for (let i = 0; i < resampled.length; i++) {
        this.outputBuffer.push(resampled[i]);
      }

      // Send chunk when we have enough
      if (this.outputBuffer.length >= this.chunkSize) {
        const chunk = this.outputBuffer.splice(0, this.chunkSize);

        // Convert to Int16 PCM
        const pcmData = new Int16Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          pcmData[i] = this.floatToInt16(chunk[i]);
        }

        // Send to main thread as ArrayBuffer
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('pcm-processor', PCMProcessor);
