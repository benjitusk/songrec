import { Header } from '@/components/Header.tsx'
import { AudioControls } from '@/components/AudioControls.tsx'
import { SongCard } from '@/components/SongCard.tsx'
import { SongHistory } from '@/components/SongHistory.tsx'
import { useRecognition } from '@/hooks/useRecognition.ts'
import { Music2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card.tsx'

function App() {
  const { state, startListening, stopListening, recognizeFromFile, clearHistory } =
    useRecognition()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            <AudioControls
              state={state}
              onStartListening={startListening}
              onStopListening={stopListening}
              onFileSelect={recognizeFromFile}
            />

            {/* Recognition result */}
            <div>
              {state.currentSong ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Recognition Result
                  </h2>
                  <SongCard song={state.currentSong} />
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Music2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold">No song recognized yet</h3>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Start the microphone to listen for music, or upload an audio file to identify
                      a song using Shazam&apos;s recognition technology.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <SongHistory history={state.history} onClear={clearHistory} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
