/**
 * Shazam API communication module.
 * Communicates via a local proxy server to avoid CORS issues.
 */
import type { DecodedSignature } from './fingerprinting/signature_format.ts'
import { encodeSignatureToUri } from './fingerprinting/signature_format.ts'

export interface ShazamSong {
  title: string
  subtitle: string // artist
  coverArtUrl?: string
  youtubeUrl?: string
  shazamUrl?: string
  genres?: string[]
  label?: string
  releaseDate?: string
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

  const song: ShazamSong = {
    title: (track.title as string | undefined) ?? 'Unknown',
    subtitle: (track.subtitle as string | undefined) ?? 'Unknown Artist',
    coverArtUrl,
    youtubeUrl,
    shazamUrl: (track.url as string | undefined),
    genres: genreList,
    label: (track.label as string | undefined),
    releaseDate: (track.releasedate as string | undefined),
  }

  return { song, raw: data }
}
