import { Trash2, Youtube, Clock } from 'lucide-react'
import type { SongHistoryEntry } from '@/hooks/useRecognition.ts'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { Separator } from '@/components/ui/separator.tsx'

interface SongHistoryProps {
  history: SongHistoryEntry[]
  onClear: () => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function SongHistory({ history, onClear }: SongHistoryProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Recognition History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No songs recognized yet. Try recognizing a song from a file or your microphone.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Recognition History
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {history.length}
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          {history.map((entry, index) => (
            <div key={entry.id}>
              {index > 0 && <Separator />}
              <div className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors">
                {entry.song.coverArtUrl && (
                  <img
                    src={entry.song.coverArtUrl}
                    alt={entry.song.title}
                    className="h-10 w-10 rounded object-cover shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                {!entry.song.coverArtUrl && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                    <span className="text-xs text-muted-foreground">♪</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{entry.song.subtitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatTime(entry.timestamp)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      const query = encodeURIComponent(`${entry.song.subtitle} - ${entry.song.title}`)
                      window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank')
                    }}
                  >
                    <Youtube className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
