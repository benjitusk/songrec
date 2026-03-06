/**
 * LyricsDisplay: shows time-synced lyrics with the current line emphasized,
 * a progress bar for that line, and surrounding context lines.
 */
import { useRef, useEffect } from 'react'
import type { LyricLine } from '@/lib/communication.ts'
import type { LyricsStatus } from '@/hooks/useRecognition.ts'
import { useLyrics } from '@/hooks/useLyrics.ts'
import { cn } from '@/lib/utils.ts'
import { Loader2, Music2 } from 'lucide-react'

interface LyricsDisplayProps {
  lyrics: LyricLine[] | null
  lyricsStatus: LyricsStatus
  songStartedAt: number | null
}

/** How many lines of context to show above and below the current line */
const CONTEXT_LINES = 3

export function LyricsDisplay({ lyrics, lyricsStatus, songStartedAt }: LyricsDisplayProps) {
  const { currentIndex, progress } = useLyrics(lyrics ?? undefined, songStartedAt)
  const currentRef = useRef<HTMLDivElement>(null)

  // Smooth-scroll the current line into the center of the container
  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentIndex])

  if (lyricsStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground rounded-2xl border bg-card">
        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
        <p className="text-sm">Fetching lyrics…</p>
      </div>
    )
  }

  if (lyricsStatus === 'unavailable' || !lyrics || lyrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground rounded-2xl border bg-card">
        <Music2 className="h-10 w-10 opacity-40" />
        <p className="text-sm">No synced lyrics available for this song</p>
      </div>
    )
  }

  const startIdx = Math.max(0, currentIndex - CONTEXT_LINES)
  const endIdx = Math.min(lyrics.length - 1, Math.max(currentIndex, 0) + CONTEXT_LINES)
  const visibleLines = lyrics.slice(startIdx, endIdx + 1)

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-8">
      {/* Fade-out masks at top and bottom */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent z-10" />

      <div className="space-y-5 overflow-hidden" style={{ minHeight: '18rem' }}>
        {/* Waiting message shown before the first lyric starts */}
        {currentIndex === -1 && (
          <div className="flex items-center justify-center pb-4 text-muted-foreground text-sm">
            Lyrics will appear when the song begins…
          </div>
        )}

        {visibleLines.map((line, idx) => {
          const absoluteIdx = startIdx + idx
          const isCurrent = absoluteIdx === currentIndex
          const isPast = absoluteIdx < currentIndex

          return (
            <div
              key={absoluteIdx}
              ref={isCurrent ? currentRef : undefined}
              className={cn(
                'transition-all duration-300 ease-in-out',
                isCurrent && 'text-foreground font-bold',
                !isCurrent && isPast && 'text-muted-foreground opacity-50',
                !isCurrent && !isPast && 'text-muted-foreground opacity-75',
              )}
            >
              <p
                className={cn(
                  'leading-snug transition-all duration-300',
                  isCurrent ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl',
                )}
              >
                {line.text}
              </p>

              {/* Progress bar — only shown for the active line */}
              {isCurrent && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-none"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
