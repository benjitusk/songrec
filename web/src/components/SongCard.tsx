import { ExternalLink, Youtube, Music, Calendar, Tag } from 'lucide-react'
import type { ShazamSong } from '@/lib/communication.ts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Badge } from '@/components/ui/badge.tsx'

interface SongCardProps {
  song: ShazamSong
}

export function SongCard({ song }: SongCardProps) {
  const handleYouTubeSearch = () => {
    const query = encodeURIComponent(`${song.subtitle} - ${song.title}`)
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank')
  }

  const handleShazamLink = () => {
    if (song.shazamUrl) {
      window.open(song.shazamUrl, '_blank')
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-0">
        {song.coverArtUrl && (
          <div className="shrink-0">
            <img
              src={song.coverArtUrl}
              alt={`${song.title} cover art`}
              className="h-40 w-40 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg leading-tight">{song.title}</CardTitle>
            <p className="text-sm font-medium text-muted-foreground">{song.subtitle}</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-3">
            <div className="flex flex-wrap gap-1">
              {song.genres?.map((genre) => (
                <Badge key={genre} variant="secondary" className="text-xs">
                  <Tag className="mr-1 h-3 w-3" />
                  {genre}
                </Badge>
              ))}
              {song.label && (
                <Badge variant="outline" className="text-xs">
                  <Music className="mr-1 h-3 w-3" />
                  {song.label}
                </Badge>
              )}
              {song.releaseDate && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="mr-1 h-3 w-3" />
                  {song.releaseDate}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleYouTubeSearch}>
                <Youtube className="h-4 w-4" />
                Search on YouTube
              </Button>
              {song.shazamUrl && (
                <Button size="sm" variant="ghost" onClick={handleShazamLink}>
                  <ExternalLink className="h-4 w-4" />
                  Shazam
                </Button>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
