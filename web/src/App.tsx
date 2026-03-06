import { Header } from '@/components/Header.tsx'
import { AudioControls } from '@/components/AudioControls.tsx'
import { SongCard } from '@/components/SongCard.tsx'
import { SongHistory } from '@/components/SongHistory.tsx'
import { LyricsDisplay } from '@/components/LyricsDisplay.tsx'
import { useRecognition } from '@/hooks/useRecognition.ts'
import { Music2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card.tsx'

function App() {
  const { state, startListening, stopListening, recognizeFromFile, clearHistory, toggleKaraokeMode } =
    useRecognition()

  const hasSong = state.currentSong !== null

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Top row: controls (left) + compact song card (right) */}
          <div className="grid gap-4 lg:grid-cols-2">
            <AudioControls
              state={state}
              onStartListening={startListening}
              onStopListening={stopListening}
              onFileSelect={recognizeFromFile}
              onToggleKaraokeMode={toggleKaraokeMode}
            />

            {hasSong ? (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">Recognition Result</h2>
                <SongCard song={state.currentSong!} />
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Music2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-1 text-lg font-semibold">No song recognized yet</h3>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Start the microphone to listen for music, or upload an audio file to identify a
                    song using Shazam&apos;s recognition technology.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Central focus: Lyrics display */}
          {hasSong && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Lyrics</h2>
              <LyricsDisplay
                lyrics={state.lyrics}
                lyricsStatus={state.lyricsStatus}
                songStartedAt={state.songStartedAt}
              />
            </div>
          )}

          {/* History */}
          <SongHistory history={state.history} onClear={clearHistory} />
        </div>
      </main>
    </div>
  )
}

export default App
