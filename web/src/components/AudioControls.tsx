import { useRef } from 'react'
import { Mic, MicOff, Upload, Loader2, Music2, AlertCircle } from 'lucide-react'
import type { RecognitionState } from '@/hooks/useRecognition.ts'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.tsx'

interface AudioControlsProps {
  state: RecognitionState
  onStartListening: () => void
  onStopListening: () => void
  onFileSelect: (file: File) => void
}

function StatusIndicator({ status }: { status: RecognitionState['status'] }) {
  switch (status) {
    case 'recording':
      return (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          Listening for music...
        </div>
      )
    case 'processing':
      return (
        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Identifying song...
        </div>
      )
    case 'success':
      return (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Music2 className="h-4 w-4" />
          Song identified!
        </div>
      )
    case 'no_match':
      return (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          No match found
        </div>
      )
    case 'error':
      return null
    default:
      return <p className="text-sm text-muted-foreground">Ready to recognize songs</p>
  }
}

export function AudioControls({
  state,
  onStartListening,
  onStopListening,
  onFileSelect,
}: AudioControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isProcessing = state.status === 'processing'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music2 className="h-5 w-5" />
          Recognize Songs
        </CardTitle>
        <CardDescription>
          Listen via microphone or upload an audio file to identify songs using Shazam
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {/* Microphone button */}
          {state.isListening ? (
            <Button
              variant="destructive"
              onClick={onStopListening}
              className="gap-2"
              disabled={isProcessing}
            >
              <MicOff className="h-4 w-4" />
              Stop Microphone
            </Button>
          ) : (
            <Button
              onClick={onStartListening}
              disabled={isProcessing}
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              Start Microphone
            </Button>
          )}

          {/* File upload button */}
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || state.isListening}
            className="gap-2"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isProcessing ? 'Processing...' : 'Pick a file...'}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="min-h-6">
          <StatusIndicator status={state.status} />
          {state.errorMessage && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{state.errorMessage}</span>
            </div>
          )}
        </div>

        {state.isListening && (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <strong>How it works:</strong> The app listens for ~5 seconds, identifies the song, then
            listens again automatically. Make sure music is playing.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
