/**
 * Simple radix-2 Cooley-Tukey FFT implementation.
 * Computes the real FFT of a signal, returning complex interleaved output.
 */

export class RealFFT {
  private readonly n: number
  private readonly cosTable: Float64Array
  private readonly sinTable: Float64Array

  constructor(size: number) {
    this.n = size
    this.cosTable = new Float64Array(size / 2)
    this.sinTable = new Float64Array(size / 2)
    for (let i = 0; i < size / 2; i++) {
      const angle = (-2 * Math.PI * i) / size
      this.cosTable[i] = Math.cos(angle)
      this.sinTable[i] = Math.sin(angle)
    }
  }

  /**
   * Compute FFT of real input.
   * @param input - real-valued array of length n
   * @returns complex interleaved array of length n+2 (n/2+1 complex values)
   */
  forward(input: Float32Array): Float32Array {
    const n = this.n
    const re = new Float64Array(n)
    const im = new Float64Array(n)

    for (let i = 0; i < n; i++) re[i] = input[i]!

    // Bit-reversal permutation
    let j = 0
    for (let i = 1; i < n; i++) {
      let bit = n >> 1
      while (j & bit) {
        j ^= bit
        bit >>= 1
      }
      j ^= bit
      if (i < j) {
        ;[re[i], re[j]] = [re[j]!, re[i]!]
        ;[im[i], im[j]] = [im[j]!, im[i]!]
      }
    }

    // Cooley-Tukey iterative FFT
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1
      const step = n / len
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < halfLen; k++) {
          const tableIdx = k * step
          const wr = this.cosTable[tableIdx]!
          const wi = this.sinTable[tableIdx]!
          const ur = re[i + k]!
          const ui = im[i + k]!
          const vr = re[i + k + halfLen]! * wr - im[i + k + halfLen]! * wi
          const vi = re[i + k + halfLen]! * wi + im[i + k + halfLen]! * wr
          re[i + k] = ur + vr
          im[i + k] = ui + vi
          re[i + k + halfLen] = ur - vr
          im[i + k + halfLen] = ui - vi
        }
      }
    }

    // Return first n/2+1 complex values (interleaved re/im)
    const numOutputs = n / 2 + 1
    const output = new Float32Array(numOutputs * 2)
    for (let i = 0; i < numOutputs; i++) {
      output[i * 2] = re[i]!
      output[i * 2 + 1] = im[i]!
    }
    return output
  }
}
