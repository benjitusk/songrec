/**
 * Shazam API communication module.
 * Communicates via a local proxy server to avoid CORS issues.
 *
 * Time-synced lyrics are fetched from LRCLIB (https://lrclib.net),
 * a free open-source lyrics database — Shazam does not provide lyrics.
 */
import type { DecodedSignature } from './fingerprinting/signature_format.ts'
import { encodeSignatureToUri } from './fingerprinting/signature_format.ts'

export interface LyricLine {
  text: string
  startMs: number
}

export interface ShazamSong {
  title: string
  subtitle: string // artist
  coverArtUrl?: string
  youtubeUrl?: string
  shazamUrl?: string
  genres?: string[]
  label?: string
  releaseDate?: string
  /**
   * How far into the song (in seconds) recognition occurred.
   * Comes from Shazam's `matches[0].offset` field.
   * Used to calculate the true song start time for lyrics sync.
   */
  offset?: number
}

export interface RecognitionResult {
  song: ShazamSong | null
  raw: object
}

export async function recognizeSongFromSignature(
  signature: DecodedSignature,
): Promise<RecognitionResult> {
  const sampleMs = Math.round((signature.numberSamples / signature.sampleRateHz) * 1000)
  const timestampMs = Date.now()

  const uri = encodeSignatureToUri(signature)

  const uuid1 = crypto.randomUUID().toUpperCase()
  const uuid2 = crypto.randomUUID()

  const postData = {
    geolocation: {
      altitude: 300,
      latitude: 45,
      longitude: 2,
    },
    signature: {
      samplems: sampleMs,
      timestamp: timestampMs,
      uri,
    },
    timestamp: timestampMs,
    timezone: 'Europe/Paris',
  }

  const url =
    `/api/shazam/discovery/v5/en/US/android/-/tag/${uuid1}/${uuid2}` +
    `?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&video=v3`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Language': 'en_US',
    },
    body: JSON.stringify(postData),
  })

  if (response.status === 429) {
    throw new Error('Your IP has been rate-limited by Shazam')
  }

  if (!response.ok) {
    throw new Error(`Shazam API error: ${response.status}`)
  }

  const data = (await response.json()) as Record<string, unknown>

  const track = (data.track as Record<string, unknown> | undefined) ?? null

  if (!track) {
    return { song: null, raw: data }
  }

  const images = track.images as Record<string, string> | undefined
  const coverArtUrl = images?.coverarthq ?? images?.coverart

  const hub = track.hub as Record<string, unknown> | undefined
  const hubActions = hub?.actions as Array<Record<string, unknown>> | undefined
  const youtubeAction = hubActions?.find(
    (a) => typeof a.uri === 'string' && a.uri.includes('youtube'),
  )
  const youtubeUrl = youtubeAction?.uri as string | undefined

  const genres = track.genres as Record<string, string> | undefined
  const genreList = genres ? Object.values(genres) : []

  // Extract the recognition offset — how far into the song Shazam matched.
  const matches = data.matches as Array<Record<string, unknown>> | undefined
  const offset = matches?.[0]?.offset as number | undefined

  const song: ShazamSong = {
    title: (track.title as string | undefined) ?? 'Unknown',
    subtitle: (track.subtitle as string | undefined) ?? 'Unknown Artist',
    coverArtUrl,
    youtubeUrl,
    shazamUrl: (track.url as string | undefined),
    genres: genreList,
    label: (track.label as string | undefined),
    releaseDate: (track.releasedate as string | undefined),
    offset,
  }

  return { song, raw: data }
}

// ---------------------------------------------------------------------------
// LRCLIB — time-synced lyrics
// ---------------------------------------------------------------------------

interface LrclibResponse {
  syncedLyrics?: string | null
  duration?: number
}

export interface LyricsResult {
  lyrics: LyricLine[]
  durationMs: number | undefined
}

/**
 * Parse an LRC-format string into an array of LyricLines.
 * LRC timestamp format: [MM:SS.xx] or [MM:SS.xxx]
 */
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const rawLine of lrc.split('\n')) {
    const match = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/.exec(rawLine.trim())
    if (!match) continue
    const [, mm, ss, cs, text] = match
    const mins = parseInt(mm!, 10)
    const secs = parseInt(ss!, 10)
    // Pad centiseconds/milliseconds to 3 digits
    const ms = parseInt(cs!.padEnd(3, '0'), 10)
    const startMs = (mins * 60 + secs) * 1000 + ms
    const trimmed = text!.trim()
    if (trimmed) {
      lines.push({ text: trimmed, startMs })
    }
  }
  return lines.sort((a, b) => a.startMs - b.startMs)
}

/**
 * Fetch time-synced lyrics for a track from LRCLIB.
 * Returns null when no synced lyrics are available.
 */
export async function fetchLyrics(
  title: string,
  artist: string,
): Promise<LyricsResult | null> {
  const params = new URLSearchParams({ track_name: title, artist_name: artist })
  const url = `/api/lrclib/api/get?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) return null

  const data = (await response.json()) as LrclibResponse

  if (!data.syncedLyrics) return null

  const lyrics = parseLrc(data.syncedLyrics)
  if (lyrics.length === 0) return null

  return {
    lyrics,
    durationMs: data.duration != null ? Math.round(data.duration * 1000) : undefined,
  }
}

