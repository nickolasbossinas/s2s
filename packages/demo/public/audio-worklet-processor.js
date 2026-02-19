/**
 * AudioWorklet processor that captures mono PCM from the microphone
 * and posts Float32Array chunks to the main thread.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // Channel 0, mono — Float32Array of 128 samples per render quantum
    this.port.postMessage({ type: 'pcm', samples: input[0].slice() });
    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
