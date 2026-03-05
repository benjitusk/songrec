/**
 * Shazam fingerprinting algorithm.
 * Ported from the Rust implementation in src/fingerprinting/algorithm.rs
 *
 * Key points:
 * - Expects mono 16kHz f32 PCM samples
 * - Uses a 2048-sample sliding window FFT, advanced every 128 samples
 * - Finds frequency peaks in four bands: 250-520, 520-1450, 1450-3500, 3500-5500 Hz
 * - Encodes peaks into the Shazam binary signature format
 */

import { HANNING_WINDOW_2048 } from './hanning.ts'
import { RealFFT } from './fft.ts'
import {
  type DecodedSignature,
  type FrequencyPeak,
  FrequencyBand,
  createEmptySignature,
} from './signature_format.ts'

const FFT_SIZE = 2048
const STEP_SIZE = 128
const NUM_FFT_OUTPUTS = FFT_SIZE / 2 + 1 // 1025

// Peak magnitude constants (from the Shazam algorithm specification)
const MAGNITUDE_SCALE = 1477.3
const MAGNITUDE_OFFSET = 6144.0
const MIN_MAGNITUDE = Math.log(1.0 / 64.0) * MAGNITUDE_SCALE + MAGNITUDE_OFFSET

export class SignatureGenerator {
  private ringBufferOfSamples: Int16Array = new Int16Array(FFT_SIZE)
  private ringBufferIndex = 0

  // Ring buffers of FFT outputs (256 entries each with 1025 values)
  private fftOutputs: Float32Array[] = Array.from({ length: 256 }, () => new Float32Array(NUM_FFT_OUTPUTS))
  private fftOutputsIndex = 0

  private spreadFftOutputs: Float32Array[] = Array.from({ length: 256 }, () => new Float32Array(NUM_FFT_OUTPUTS))
  private spreadFftOutputsIndex = 0

  private numSpreadFftsDone = 0

  private fft = new RealFFT(FFT_SIZE)
  private fftInputBuffer: Float32Array = new Float32Array(FFT_SIZE)

  private signature: DecodedSignature

  constructor(numberSamples: number) {
    this.signature = createEmptySignature(16000, numberSamples)
  }

  static makeSignatureFromBuffer(f32Mono16kHzBuffer: Float32Array): DecodedSignature {
    const gen = new SignatureGenerator(f32Mono16kHzBuffer.length)

    // Convert f32 to i16
    const s16Buffer = new Int16Array(f32Mono16kHzBuffer.length)
    for (let i = 0; i < f32Mono16kHzBuffer.length; i++) {
      const v = f32Mono16kHzBuffer[i]!
      s16Buffer[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)))
    }

    // Process in 128-sample chunks
    for (let i = 0; i + STEP_SIZE <= s16Buffer.length; i += STEP_SIZE) {
      const chunk = s16Buffer.subarray(i, i + STEP_SIZE)
      gen.doFft(chunk)
      gen.doPeakSpreading()
      gen.numSpreadFftsDone++

      if (gen.numSpreadFftsDone >= 46) {
        gen.doPeakRecognition()
      }
    }

    return gen.signature
  }

  private doFft(s16Chunk: Int16Array): void {
    // Copy 128 samples into ring buffer
    for (let i = 0; i < STEP_SIZE; i++) {
      this.ringBufferOfSamples[(this.ringBufferIndex + i) & (FFT_SIZE - 1)] = s16Chunk[i]!
    }
    this.ringBufferIndex = (this.ringBufferIndex + STEP_SIZE) & (FFT_SIZE - 1)

    // Reorder and apply Hanning window
    for (let i = 0; i < FFT_SIZE; i++) {
      this.fftInputBuffer[i] =
        this.ringBufferOfSamples[(i + this.ringBufferIndex) & (FFT_SIZE - 1)] *
        HANNING_WINDOW_2048[i]!
    }

    // Perform FFT (returns interleaved re/im for n/2+1 bins)
    const complexOutput = this.fft.forward(this.fftInputBuffer)

    // Convert to real magnitudes
    const realFftResults = this.fftOutputs[this.fftOutputsIndex]!
    for (let i = 0; i < NUM_FFT_OUTPUTS; i++) {
      const re = complexOutput[i * 2]!
      const im = complexOutput[i * 2 + 1]!
      realFftResults[i] = Math.max((re * re + im * im) / (1 << 17), 1e-10)
    }

    this.fftOutputsIndex = (this.fftOutputsIndex + 1) & 255
  }

  private doPeakSpreading(): void {
    const realFftResults = this.fftOutputs[((this.fftOutputsIndex - 1) & 255 + 256) % 256]!
    const spreadFftResults = this.spreadFftOutputs[this.spreadFftOutputsIndex]!

    // Copy
    spreadFftResults.set(realFftResults)

    // Frequency-domain spreading
    for (let pos = 0; pos <= 1022; pos++) {
      spreadFftResults[pos] = Math.max(
        spreadFftResults[pos]!,
        spreadFftResults[pos + 1]!,
        spreadFftResults[pos + 2]!,
      )
    }

    // Time-domain spreading: update previous entries
    const spreadCopy = spreadFftResults.slice()
    for (const formerFftNum of [1, 3, 6]) {
      const idx = ((this.spreadFftOutputsIndex - formerFftNum) & 255 + 256) % 256
      const formerFft = this.spreadFftOutputs[idx]!
      for (let pos = 0; pos < NUM_FFT_OUTPUTS; pos++) {
        if (spreadCopy[pos]! > formerFft[pos]!) {
          formerFft[pos] = spreadCopy[pos]!
        }
      }
    }

    this.spreadFftOutputsIndex = (this.spreadFftOutputsIndex + 1) & 255
  }

  private doPeakRecognition(): void {
    const fftMinus46Idx = ((this.fftOutputsIndex - 46) & 255 + 256) % 256
    const fftMinus49Idx = ((this.spreadFftOutputsIndex - 49) & 255 + 256) % 256

    const fftMinus46 = this.fftOutputs[fftMinus46Idx]!
    const fftMinus49 = this.spreadFftOutputs[fftMinus49Idx]!

    for (let binPos = 10; binPos <= 1014; binPos++) {
      const val = fftMinus46[binPos]!

      if (val >= 1.0 / 64.0 && val >= fftMinus49[binPos - 1]!) {
        // Check frequency-domain local maximum
        let maxNeighborInFftMinus49 = 0
        for (const offset of [-10, -7, -4, -3, 1, 2, 5, 8]) {
          const neighbor = fftMinus49[binPos + offset]!
          if (neighbor > maxNeighborInFftMinus49) maxNeighborInFftMinus49 = neighbor
        }

        if (val > maxNeighborInFftMinus49) {
          // Check time-domain local maximum
          let maxNeighborInOtherAdjacentFfts = maxNeighborInFftMinus49

          for (const otherOffset of [
            -53, -45, 165, 172, 179, 186, 193, 200, 214, 221, 228, 235, 242, 249,
          ]) {
            const idx = ((this.spreadFftOutputsIndex + otherOffset) & 255 + 256) % 256
            const otherFft = this.spreadFftOutputs[idx]!
            const neighbor = otherFft[binPos - 1]!
            if (neighbor > maxNeighborInOtherAdjacentFfts)
              maxNeighborInOtherAdjacentFfts = neighbor
          }

          if (val > maxNeighborInOtherAdjacentFfts) {
            // Found a peak
            const fftPassNumber = this.numSpreadFftsDone - 46

            const peakMagnitude = Math.max(Math.log(val) * MAGNITUDE_SCALE + MAGNITUDE_OFFSET, MIN_MAGNITUDE)
            const peakMagnitudeBefore = Math.max(Math.log(fftMinus46[binPos - 1]!) * MAGNITUDE_SCALE + MAGNITUDE_OFFSET, MIN_MAGNITUDE)
            const peakMagnitudeAfter = Math.max(Math.log(fftMinus46[binPos + 1]!) * MAGNITUDE_SCALE + MAGNITUDE_OFFSET, MIN_MAGNITUDE)

            const peakVariation1 = peakMagnitude * 2 - peakMagnitudeBefore - peakMagnitudeAfter
            if (peakVariation1 < 0) continue // assertion equivalent
            const peakVariation2 = (peakMagnitudeAfter - peakMagnitudeBefore) * 32.0 / peakVariation1

            const correctedPeakFrequencyBin = Math.floor(binPos * 64 + peakVariation2) & 0xffff

            const frequencyHz = correctedPeakFrequencyBin * (16000.0 / 2.0 / 1024.0 / 64.0)

            let band: FrequencyBand | null = null
            const freqInt = Math.floor(frequencyHz)
            if (freqInt >= 250 && freqInt <= 519) band = FrequencyBand._250_520
            else if (freqInt >= 520 && freqInt <= 1449) band = FrequencyBand._520_1450
            else if (freqInt >= 1450 && freqInt <= 3499) band = FrequencyBand._1450_3500
            else if (freqInt >= 3500 && freqInt <= 5500) band = FrequencyBand._3500_5500

            if (band === null) continue

            if (!this.signature.frequencyBandToSoundPeaks.has(band)) {
              this.signature.frequencyBandToSoundPeaks.set(band, [])
            }

            const peak: FrequencyPeak = {
              fftPassNumber,
              peakMagnitude: Math.floor(peakMagnitude) & 0xffff,
              correctedPeakFrequencyBin,
            }

            this.signature.frequencyBandToSoundPeaks.get(band)!.push(peak)
          }
        }
      }
    }
  }
}
