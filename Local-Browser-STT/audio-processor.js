/**
 * A custom AudioWorkletProcessor that does two things:
 * 1. Passes stereo audio through to the output, so it can be heard correctly.
 * 2. Buffers the first audio channel (mono) and sends it for transcription.
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this._buffer = new Float32Array(this.bufferSize);
    this._bufferPosition = 0;
  }

  floatToInt16(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]; // This is an array of channels (e.g., [left, right])
    const output = outputs[0]; // This is also an array of channels

    // --- FIX for STEREO AUDIO PLAYBACK ---
    // Copy each input channel to the corresponding output channel.
    // This ensures that if the source is stereo, the playback is also stereo.
    for (let channel = 0; channel < output.length; channel++) {
      if (input[channel]) {
        output[channel].set(input[channel]);
      }
    }
    // --- END FIX ---

    // For transcription, we only need a single (mono) channel. We'll use the first one.
    const monoChannelData = input[0];

    // Buffer the mono audio data before sending
    if (monoChannelData) {
      for (let i = 0; i < monoChannelData.length; i++) {
        this._buffer[this._bufferPosition++] = monoChannelData[i];

        if (this._bufferPosition === this.bufferSize) {
          const int16Data = this.floatToInt16(this._buffer);
          this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
          this._bufferPosition = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
