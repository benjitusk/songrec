/**
 * Hook to track the current lyric line and progress within it,
 * driven by requestAnimationFrame for smooth animation.
 */
import { useState, useEffect, useRef } from 'react'
import type { LyricLine } from '@/lib/communication.ts'

export interface LyricsState {
  /** Index of the currently active lyric line, or -1 if before the first line */
  currentIndex: number
  /** 0–1 progress through the current line's time window */
  progress: number
  /** Milliseconds elapsed since songStartedAt */
  elapsed: number
}

const RESET_STATE: LyricsState = { currentIndex: -1, progress: 0, elapsed: 0 }

export function useLyrics(
  lyrics: LyricLine[] | undefined,
  songStartedAt: number | null,
): LyricsState {
  const [rafState, setRafState] = useState<LyricsState>(RESET_STATE)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!lyrics || lyrics.length === 0 || songStartedAt === null) {
      return
    }

    const tick = () => {
      const elapsed = Date.now() - songStartedAt

      // Binary search for the last lyric whose startMs <= elapsed
      let lo = 0
      let hi = lyrics.length - 1
      let currentIndex = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (lyrics[mid]!.startMs <= elapsed) {
          currentIndex = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      // Progress within the current line (0–1)
      let progress = 0
      if (currentIndex >= 0 && currentIndex < lyrics.length - 1) {
        const lineStart = lyrics[currentIndex]!.startMs
        const lineEnd = lyrics[currentIndex + 1]!.startMs
        progress = Math.min(1, (elapsed - lineStart) / (lineEnd - lineStart))
      } else if (currentIndex === lyrics.length - 1) {
        progress = 1
      }

      setRafState({ currentIndex, progress, elapsed })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [lyrics, songStartedAt])

  // When there are no lyrics or no start time, return the reset state directly
  // so callers always see a consistent value without waiting for a RAF tick.
  if (!lyrics || lyrics.length === 0 || songStartedAt === null) {
    return RESET_STATE
  }

  return rafState
}
