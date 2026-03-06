# SongRec Web

A React/TypeScript/Vite/Shadcn web implementation of [SongRec](https://github.com/marin-m/songrec), the open-source Shazam client.

![SongRec Web UI](https://github.com/user-attachments/assets/52f05cde-c92f-4d01-8ccf-7b43a5c49a42)

## Features

- 🎙️ **Microphone recognition** — Continuously listens and identifies songs in real time
- 📁 **File recognition** — Upload any audio/video file to identify the song
- 📋 **Song history** — Keeps a session log of all recognized songs
- 🎵 **Rich results** — Displays album art, genre, label, and release date
- ▶️ **YouTube search** — Instantly search for any recognized song on YouTube

## How It Works

The app ports the Shazam fingerprinting algorithm from the original Rust/SongRec implementation to TypeScript:

1. **Audio capture** — Records audio via the Web Audio API (`getUserMedia`) or decodes uploaded files
2. **Downsampling** — Resamples audio to 16 kHz mono PCM (matching Shazam's requirements)
3. **Fingerprinting** — Applies a sliding 2048-sample window FFT with Hanning windowing, then detects frequency peaks in four bands (250–520 Hz, 520–1450 Hz, 1450–3500 Hz, 3500–5500 Hz)
4. **Signature encoding** — Encodes peaks into Shazam's proprietary binary format with CRC32 checksum
5. **Recognition** — Sends the fingerprint to Shazam's API via a local proxy server (needed for CORS)
6. **Display** — Shows the identified song with metadata and links

## Stack

- **Frontend**: React 19 + TypeScript + Vite 7
- **UI**: Shadcn-style components with Tailwind CSS v4
- **Icons**: Lucide React
- **Fingerprinting**: Custom TypeScript FFT + Shazam algorithm port
- **Backend proxy**: Express.js (Node.js) — required to forward requests to Shazam's API

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Development

Start both the proxy server and the Vite dev server:

```bash
cd web

# Install dependencies
npm install

# Start the Shazam API proxy (in one terminal)
npm run server

# Start the Vite dev server (in another terminal)
npm run dev
```

Open http://localhost:5173 in your browser.

> **Note**: The proxy server (`npm run server`) is required for song recognition because Shazam's API does not allow direct browser requests (CORS restriction). The Vite dev server automatically proxies `/api` requests to `http://localhost:3001`.

### Production Build

```bash
cd web
npm run build
```

The built files will be in `web/dist/`. Deploy alongside the proxy server (`server.cjs`) for full functionality.

## Project Structure

```
web/
├── src/
│   ├── components/
│   │   ├── ui/          # Shadcn UI primitives (Button, Card, Badge, etc.)
│   │   ├── Header.tsx
│   │   ├── AudioControls.tsx   # Microphone/file controls + status
│   │   ├── SongCard.tsx        # Recognized song display with album art
│   │   └── SongHistory.tsx     # Session recognition history
│   ├── hooks/
│   │   └── useRecognition.ts   # Main recognition state and logic
│   ├── lib/
│   │   ├── fingerprinting/
│   │   │   ├── algorithm.ts    # Shazam fingerprinting algorithm (FFT, peak detection)
│   │   │   ├── fft.ts          # Radix-2 Cooley-Tukey FFT implementation
│   │   │   ├── hanning.ts      # Hanning window computation
│   │   │   └── signature_format.ts  # Binary signature encoding with CRC32
│   │   ├── communication.ts    # Shazam API communication
│   │   └── utils.ts            # Tailwind class utilities
│   ├── App.tsx
│   └── main.tsx
├── server.cjs       # Express proxy server for CORS handling
├── vite.config.ts
└── package.json
```

## Privacy

This web app, like the original SongRec, sends only audio fingerprints (sequences of frequency peaks) to Shazam's servers — never raw audio. See the [SongRec Privacy section](../README.md#privacy) for details.
