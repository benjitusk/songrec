/**
 * Compute the Hanning window multipliers for N=2048.
 * These are the same values as the precomputed table in the Rust implementation.
 * Formula: h[n] = 0.5 * (1 - cos(2π * n / (N-1)))
 */
export function computeHanningWindow(size: number): Float32Array {
  const window = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)))
  }
  return window
}

export const HANNING_WINDOW_2048 = computeHanningWindow(2048)
