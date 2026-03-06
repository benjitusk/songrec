/**
 * React hook for audio recognition.
 * Handles microphone input, file input, and recognition state.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { SignatureGenerator } from '@/lib/fingerprinting/algorithm.ts';
import { recognizeSongFromSignature, fetchLyrics } from '@/lib/communication.ts';
import type { ShazamSong, LyricLine } from '@/lib/communication.ts';

export interface SongHistoryEntry {
	id: string;
	song: ShazamSong;
	timestamp: Date;
}

export type RecognitionStatus =
	| 'idle'
	| 'recording'
	| 'processing'
	| 'success'
	| 'no_match'
	| 'error';

export type LyricsStatus = 'idle' | 'loading' | 'loaded' | 'unavailable';

export interface RecognitionState {
	status: RecognitionStatus;
	currentSong: ShazamSong | null;
	/** Time-synced lyrics fetched from LRCLIB after recognition */
	lyrics: LyricLine[] | null;
	lyricsStatus: LyricsStatus;
	/** Song duration in ms (from LRCLIB) — used for karaoke auto-restart */
	songDurationMs: number | null;
	history: SongHistoryEntry[];
	errorMessage: string | null;
	isListening: boolean;
	karaokeMode: boolean;
	/**
	 * Wall-clock timestamp (ms) representing when the song started playing.
	 * Calculated as: Date.now() - (shazam_offset_seconds * 1000)
	 * so that lyrics sync correctly to the actual playback position.
	 */
	songStartedAt: number | null;
}

// Downsample audio buffer from source sample rate to 16kHz
function downsampleBuffer(
	buffer: Float32Array,
	sourceSampleRate: number,
	targetSampleRate = 16000,
): Float32Array {
	if (sourceSampleRate === targetSampleRate) return buffer;

	const ratio = sourceSampleRate / targetSampleRate;
	const outputLength = Math.floor(buffer.length / ratio);
	const result = new Float32Array(outputLength);

	for (let i = 0; i < outputLength; i++) {
		const srcIdx = Math.floor(i * ratio);
		result[i] = buffer[srcIdx]!;
	}

	return result;
}

// Convert stereo to mono by averaging channels
function toMono(channelData: Float32Array[]): Float32Array {
	if (channelData.length === 1) return channelData[0]!;

	const length = channelData[0]!.length;
	const mono = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		let sum = 0;
		for (const channel of channelData) {
			sum += channel[i]!;
		}
		mono[i] = sum / channelData.length;
	}
	return mono;
}

export function useRecognition() {
	const [state, setState] = useState<RecognitionState>({
		status: 'idle',
		currentSong: null,
		lyrics: null,
		lyricsStatus: 'idle',
		songDurationMs: null,
		history: [],
		errorMessage: null,
		isListening: false,
		karaokeMode: false,
		songStartedAt: null,
	});

	const mediaStreamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const workletNodeRef = useRef<AudioWorkletNode | null>(null);
	const collectedSamplesRef = useRef<Float32Array[]>([]);
	const listeningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const karaokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Refs used inside async callbacks to always see the latest values
	const karaokeModeRef = useRef(false);
	const startListeningRef = useRef<(() => Promise<void>) | null>(null);

	const setStatus = useCallback((status: RecognitionStatus, extra?: Partial<RecognitionState>) => {
		setState((prev) => ({ ...prev, status, errorMessage: null, ...extra }));
	}, []);

	const addToHistory = useCallback((song: ShazamSong) => {
		const entry: SongHistoryEntry = {
			id: crypto.randomUUID(),
			song,
			timestamp: new Date(),
		};
		setState((prev) => ({
			...prev,
			history: [entry, ...prev.history].slice(0, 50), // Keep last 50
		}));
	}, []);

	const toggleKaraokeMode = useCallback(() => {
		setState((prev) => {
			const next = !prev.karaokeMode;
			karaokeModeRef.current = next;
			return { ...prev, karaokeMode: next };
		});
	}, []);

	const scheduleKaraokeRestart = useCallback(
		(durationMs: number, offsetMs: number) => {
			if (!karaokeModeRef.current) return;
			const timeUntilEnd = Math.max(1000, durationMs - offsetMs);
			karaokeTimerRef.current = setTimeout(() => {
				if (karaokeModeRef.current) {
					startListeningRef.current?.();
				}
			}, timeUntilEnd);
		},
		[],
	);

	const recognizeFromBuffer = useCallback(
		async (samples: Float32Array) => {
			try {
				setStatus('processing');
				const sig = SignatureGenerator.makeSignatureFromBuffer(samples);

				const totalPeaks = [...sig.frequencyBandToSoundPeaks.values()].reduce(
					(sum, peaks) => sum + peaks.length,
					0,
				);

				if (totalPeaks === 0) {
					setStatus('no_match');
					return null;
				}

				const result = await recognizeSongFromSignature(sig);

				if (result.song) {
					// Use Shazam's offset to calculate the true song start time.
					// offset = how many seconds into the song recognition occurred.
					const offsetMs = (result.song.offset ?? 0) * 1000;
					const songStartedAt = Date.now() - offsetMs;

					setState((prev) => ({
						...prev,
						status: 'success',
						currentSong: result.song,
						lyrics: null,
						lyricsStatus: 'loading',
						songDurationMs: null,
						errorMessage: null,
						songStartedAt,
					}));
					addToHistory(result.song);

					// Fetch time-synced lyrics from LRCLIB asynchronously
					fetchLyrics(result.song.title, result.song.subtitle)
						.then((lyricsResult) => {
							if (lyricsResult) {
								setState((prev) => ({
									...prev,
									lyrics: lyricsResult.lyrics,
									lyricsStatus: 'loaded',
									songDurationMs: lyricsResult.durationMs ?? null,
								}));
								// Schedule karaoke restart based on real duration + position
								if (lyricsResult.durationMs != null) {
									scheduleKaraokeRestart(lyricsResult.durationMs, offsetMs);
								}
							} else {
								setState((prev) => ({ ...prev, lyricsStatus: 'unavailable' }));
								// Fallback karaoke restart: use a 4-minute timer
								scheduleKaraokeRestart(4 * 60 * 1000, offsetMs);
							}
						})
						.catch(() => {
							setState((prev) => ({ ...prev, lyricsStatus: 'unavailable' }));
							scheduleKaraokeRestart(4 * 60 * 1000, offsetMs);
						});

					return result.song;
				} else {
					setStatus('no_match');
					return null;
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Recognition failed';
				setState((prev) => ({
					...prev,
					status: 'error',
					errorMessage: message,
				}));
				return null;
			}
		},
		[setStatus, addToHistory, scheduleKaraokeRestart],
	);

	const recognizeFromFile = useCallback(
		async (file: File) => {
			try {
				setStatus('processing');

				const arrayBuffer = await file.arrayBuffer();
				const audioContext = new AudioContext();

				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

				// Get all channels
				const channels: Float32Array[] = [];
				for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
					channels.push(audioBuffer.getChannelData(i));
				}

				// Mix to mono
				const mono = toMono(channels);

				// Downsample to 16kHz
				const resampled = downsampleBuffer(mono, audioBuffer.sampleRate, 16000);

				// Take 12 seconds from the middle
				const maxSamples = 12 * 16000;
				let slice = resampled;
				if (resampled.length > maxSamples) {
					const middle = Math.floor(resampled.length / 2);
					const halfWindow = 6 * 16000;
					slice = resampled.slice(middle - halfWindow, middle + halfWindow);
				}

				await audioContext.close();

				return await recognizeFromBuffer(slice);
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to process file';
				setState((prev) => ({
					...prev,
					status: 'error',
					errorMessage: message,
				}));
				return null;
			}
		},
		[recognizeFromBuffer, setStatus],
	);

	const stopListening = useCallback(() => {
		if (karaokeTimerRef.current) {
			clearTimeout(karaokeTimerRef.current);
			karaokeTimerRef.current = null;
		}
		if (listeningIntervalRef.current) {
			clearInterval(listeningIntervalRef.current);
			listeningIntervalRef.current = null;
		}
		if (workletNodeRef.current) {
			workletNodeRef.current.disconnect();
			workletNodeRef.current = null;
		}
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((t) => t.stop());
			mediaStreamRef.current = null;
		}
		if (audioContextRef.current) {
			audioContextRef.current.close();
			audioContextRef.current = null;
		}
		collectedSamplesRef.current = [];
		setState((prev) => ({ ...prev, isListening: false, status: 'idle' }));
	}, []);

	const startListening = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
			mediaStreamRef.current = stream;

			const audioContext = new AudioContext();
			audioContextRef.current = audioContext;

			const source = audioContext.createMediaStreamSource(stream);
			const sampleRate = audioContext.sampleRate;

			// We'll collect about 5 seconds of audio before recognizing
			const secondsToCollect = 5;
			const samplesNeeded = Math.ceil(secondsToCollect * sampleRate);
			let samplesCollected = 0;

			collectedSamplesRef.current = [];

			// Load and add the AudioWorklet module
			await audioContext.audioWorklet.addModule('/audio-collector-processor.js');
			const workletNode = new AudioWorkletNode(audioContext, 'audio-collector');
			workletNodeRef.current = workletNode;

			workletNode.port.onmessage = (event: MessageEvent<{ samples: Float32Array }>) => {
				const samples = event.data.samples;
				const copy = new Float32Array(samples.length);
				copy.set(samples);
				collectedSamplesRef.current.push(copy);
				samplesCollected += copy.length;

				if (samplesCollected >= samplesNeeded) {
					// We have enough samples, process them
					const totalLength = collectedSamplesRef.current.reduce((s, b) => s + b.length, 0);
					const combined = new Float32Array(totalLength);
					let writePosition = 0;
					for (const buf of collectedSamplesRef.current) {
						combined.set(buf, writePosition);
						writePosition += buf.length;
					}

					// Reset for next recognition cycle
					collectedSamplesRef.current = [];
					samplesCollected = 0;

					// Downsample and recognize
					const resampled = downsampleBuffer(combined, sampleRate, 16000);

					// Async - don't await here
					recognizeFromBuffer(resampled).catch(console.error).finally(stopListening);
				}
			};

			source.connect(workletNode);

			setState((prev) => ({ ...prev, isListening: true, status: 'recording' }));
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to access microphone';
			setState((prev) => ({
				...prev,
				status: 'error',
				errorMessage: message,
				isListening: false,
			}));
		}
	}, [recognizeFromBuffer, stopListening]);

	// Keep startListeningRef in sync so karaoke timer can call the latest version
	useEffect(() => {
		startListeningRef.current = startListening;
	}, [startListening]);

	const clearHistory = useCallback(() => {
		setState((prev) => ({ ...prev, history: [] }));
	}, []);

	return {
		state,
		startListening,
		stopListening,
		recognizeFromFile,
		clearHistory,
		toggleKaraokeMode,
	};
}
