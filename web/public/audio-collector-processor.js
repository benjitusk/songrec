/**
 * AudioWorklet processor for collecting audio samples.
 * Runs on a dedicated audio rendering thread for better performance.
 */
class AudioCollectorProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input && input[0] && input[0].length > 0) {
      // Send a copy of the channel data to the main thread
      this.port.postMessage({ samples: input[0].slice() })
    }
    return true // Keep processor alive
  }
}

registerProcessor('audio-collector', AudioCollectorProcessor)
