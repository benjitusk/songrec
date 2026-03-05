/**
 * Shazam signature format encoder/decoder.
 * Ported from the Rust implementation in src/fingerprinting/signature_format.rs
 */
import CRC32 from 'crc-32'

export const DATA_URI_PREFIX = 'data:audio/vnd.shazam.sig;base64,'

export const FrequencyBand = {
  _250_520: 0,
  _520_1450: 1,
  _1450_3500: 2,
  _3500_5500: 3,
} as const

export type FrequencyBand = (typeof FrequencyBand)[keyof typeof FrequencyBand]

export interface FrequencyPeak {
  fftPassNumber: number
  peakMagnitude: number
  correctedPeakFrequencyBin: number
}

export interface DecodedSignature {
  sampleRateHz: number
  numberSamples: number
  frequencyBandToSoundPeaks: Map<FrequencyBand, FrequencyPeak[]>
}

function sampleRateToId(sampleRate: number): number {
  switch (sampleRate) {
    case 8000:
      return 1
    case 11025:
      return 2
    case 16000:
      return 3
    case 32000:
      return 4
    case 44100:
      return 5
    case 48000:
      return 6
    default:
      throw new Error(`Invalid sample rate: ${sampleRate}`)
  }
}

export function encodeSignatureToBinary(sig: DecodedSignature): Uint8Array {
  // Encode the peaks for each frequency band
  const bandParts = new Map<FrequencyBand, Uint8Array>()
  const sortedBands: FrequencyBand[] = [
    FrequencyBand._250_520,
    FrequencyBand._520_1450,
    FrequencyBand._1450_3500,
    FrequencyBand._3500_5500,
  ]

  for (const band of sortedBands) {
    const peaks = sig.frequencyBandToSoundPeaks.get(band)
    if (!peaks || peaks.length === 0) continue

    const peakBytes: number[] = []
    let fftPassNumber = 0

    for (const peak of peaks) {
      if (peak.fftPassNumber - fftPassNumber >= 255) {
        peakBytes.push(0xff)
        // Write u32 little-endian
        const v = peak.fftPassNumber
        peakBytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff)
        fftPassNumber = peak.fftPassNumber
      }
      peakBytes.push((peak.fftPassNumber - fftPassNumber) & 0xff)
      // peak_magnitude u16 little-endian
      peakBytes.push(peak.peakMagnitude & 0xff, (peak.peakMagnitude >> 8) & 0xff)
      // corrected_peak_frequency_bin u16 little-endian
      peakBytes.push(
        peak.correctedPeakFrequencyBin & 0xff,
        (peak.correctedPeakFrequencyBin >> 8) & 0xff,
      )
      fftPassNumber = peak.fftPassNumber
    }

    bandParts.set(band, new Uint8Array(peakBytes))
  }

  // Calculate total size of peaks section
  let peaksSectionSize = 0
  for (const [, peakData] of bandParts) {
    const padding = (4 - (peakData.length % 4)) % 4
    peaksSectionSize += 8 + peakData.length + padding
  }

  // Total buffer size: 48 byte header + 8 byte size fields + peaks
  const totalSize = 48 + 8 + peaksSectionSize
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  let offset = 0

  const writeU32 = (val: number) => {
    view.setUint32(offset, val, true)
    offset += 4
  }

  // Header (48 bytes)
  writeU32(0xcafe2580) // magic1
  writeU32(0) // crc32 - placeholder
  writeU32(totalSize - 48) // size_minus_header
  writeU32(0x94119c00) // magic2
  writeU32(0) // void1
  writeU32(0)
  writeU32(0)
  writeU32(sampleRateToId(sig.sampleRateHz) << 27) // shifted_sample_rate_id
  writeU32(0) // void2
  writeU32(0)
  writeU32(sig.numberSamples + Math.floor(sig.sampleRateHz * 0.24)) // number_samples_plus_divided_sample_rate
  writeU32((15 << 19) + 0x40000) // fixed_value

  // Size prefix after header
  writeU32(0x40000000)
  writeU32(totalSize - 48) // size_minus_header repeated

  // Write peaks for each band
  for (const band of sortedBands) {
    const peakData = bandParts.get(band)
    if (!peakData) continue

    writeU32(0x60030040 + band) // frequency_band_id
    writeU32(peakData.length) // frequency_peaks_size

    const u8view = new Uint8Array(buffer)
    u8view.set(peakData, offset)
    offset += peakData.length

    // Padding
    const padding = (4 - (peakData.length % 4)) % 4
    for (let i = 0; i < padding; i++) {
      view.setUint8(offset, 0)
      offset++
    }
  }

  // Compute CRC32 over bytes 8..end
  const bytes = new Uint8Array(buffer)
  const crcInput = bytes.slice(8)
  const crc = CRC32.buf(crcInput) >>> 0 // ensure unsigned

  // Write CRC32 at offset 4
  view.setUint32(4, crc, true)

  return bytes
}

export function encodeSignatureToUri(sig: DecodedSignature): string {
  const binary = encodeSignatureToBinary(sig)
  // Convert to base64
  let binaryString = ''
  for (let i = 0; i < binary.length; i++) {
    binaryString += String.fromCharCode(binary[i]!)
  }
  return DATA_URI_PREFIX + btoa(binaryString)
}

export function createEmptySignature(sampleRateHz: number, numberSamples: number): DecodedSignature {
  return {
    sampleRateHz,
    numberSamples,
    frequencyBandToSoundPeaks: new Map(),
  }
}
