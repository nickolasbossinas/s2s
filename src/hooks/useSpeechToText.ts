import { useState, useRef, useCallback, useEffect } from 'react';
import { SherpaEngine } from '../services/sherpa-engine';
import type { SttStatus } from '../types/stt';

/** Downsample a Float32Array from inputRate to outputRate via simple averaging. */
function downsample(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const len = Math.round(buffer.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const start = Math.round(i * ratio);
    const end = Math.round((i + 1) * ratio);
    let sum = 0;
    for (let j = start; j < end && j < buffer.length; j++) sum += buffer[j];
    out[i] = sum / (end - start);
  }
  return out;
}

/** Normalize ASR output: lowercase and capitalize first letter. */
function normalizeText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  return lower[0].toUpperCase() + lower.slice(1);
}

function checkBrowserSupport(): string | null {
  if (!navigator.mediaDevices?.getUserMedia) return 'Microphone access not supported in this browser.';
  if (!window.AudioContext) return 'Web Audio API not supported in this browser.';
  if (typeof AudioWorkletNode === 'undefined') return 'AudioWorklet not supported. Use Chrome, Edge, or Firefox.';
  if (typeof WebAssembly === 'undefined') return 'WebAssembly not supported in this browser.';
  return null;
}

export interface UseSpeechToTextReturn {
  status: SttStatus;
  partialText: string;
  finalText: string;
  error: string | null;
  toggleRecording: () => Promise<void>;
  clearText: () => void;
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [status, setStatus] = useState<SttStatus>('idle');
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<SherpaEngine | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const bufferLenRef = useRef(0);
  const finalsRef = useRef<string[]>([]);

  // Send accumulated PCM samples to the worker
  const processBatch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const audioCtx = audioCtxRef.current;
    const nativeRate = audioCtx?.sampleRate ?? 48000;

    // Merge accumulated chunks
    const merged = new Float32Array(bufferLenRef.current);
    let offset = 0;
    for (const chunk of bufferRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    bufferRef.current = [];
    bufferLenRef.current = 0;

    // Downsample to 16 kHz and send to worker
    const samples16k = downsample(merged, nativeRate, 16000);
    engine.feedAudio(samples16k);
  }, []);

  // Load WASM engine in Web Worker on mount (background)
  useEffect(() => {
    const supportError = checkBrowserSupport();
    if (supportError) {
      setError(supportError);
      setStatus('error');
      return;
    }

    setStatus('loading');

    // Results come back asynchronously from the worker
    const engine = new SherpaEngine((result) => {
      const normalized = normalizeText(result.text);
      setPartialText(normalized);

      if (result.isEndpoint) {
        if (normalized) {
          finalsRef.current.push(normalized);
          setFinalText(finalsRef.current.join(' '));
        }
        setPartialText('');
      }
    });
    engineRef.current = engine;

    engine.init().then(() => {
      setStatus('ready');
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load speech recognition engine');
      setStatus('error');
    });
  }, []);

  const toggleRecording = useCallback(async () => {
    // If recording, stop
    if (status === 'recording') {
      sourceRef.current?.disconnect();
      setStatus('ready');
      return;
    }

    // If already set up (mic connected before), just reconnect
    if (status === 'ready' && workletRef.current && sourceRef.current) {
      sourceRef.current.connect(workletRef.current);
      setStatus('recording');
      return;
    }

    // First mic click: set up audio pipeline (engine already loaded in worker)
    if (status !== 'ready') return;

    try {
      // Request mic with echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;

      // Create AudioContext (user gesture required — this runs inside a click handler)
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      // Add worklet module
      await audioCtx.audioWorklet.addModule('/audio-worklet-processor.js');
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
      workletRef.current = workletNode;

      // Handle PCM chunks from worklet
      workletNode.port.onmessage = (e: MessageEvent<{ type: string; samples: Float32Array }>) => {
        if (e.data.type !== 'pcm') return;
        bufferRef.current.push(e.data.samples);
        bufferLenRef.current += e.data.samples.length;

        // Process in batches of ~4096 native-rate samples (~85ms at 48 kHz)
        if (bufferLenRef.current >= 4096) {
          processBatch();
        }
      };

      // Connect mic → worklet (don't connect to destination — no mic playback)
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(workletNode);

      setStatus('recording');
    } catch (err) {
      const msg = err instanceof DOMException
        ? err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow mic access in browser settings.'
          : err.name === 'NotFoundError'
            ? 'No microphone found. Please connect a microphone.'
            : `Microphone error: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Failed to initialize speech recognition';
      setError(msg);
      setStatus('error');
    }
  }, [status, processBatch]);

  const clearText = useCallback(() => {
    finalsRef.current = [];
    setFinalText('');
    setPartialText('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sourceRef.current?.disconnect();
      workletRef.current?.disconnect();
      audioCtxRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      engineRef.current?.destroy();
    };
  }, []);

  return { status, partialText, finalText, error, toggleRecording, clearText };
}
