import { useState, useRef, useCallback, useEffect } from 'react';
import { TtsEngine } from '../services/tts-engine';

export type TtsStatus = 'idle' | 'loading' | 'ready' | 'speaking' | 'error';

export interface UseTextToSpeechReturn {
  ttsStatus: TtsStatus;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>('idle');

  const engineRef = useRef<TtsEngine | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const speakIdRef = useRef(0);
  const doneRef = useRef(false);

  const playNext = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const next = queueRef.current.shift();
    if (!next) {
      // Queue empty — if generation is done, we're finished speaking
      sourceRef.current = null;
      if (doneRef.current) {
        setTtsStatus('ready');
      }
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = next;
    source.connect(ctx.destination);
    source.onended = () => {
      sourceRef.current = null;
      playNext();
    };

    sourceRef.current = source;
    source.start();
  }, []);

  // Load TTS engine in Web Worker on mount
  useEffect(() => {
    setTtsStatus('loading');

    const engine = new TtsEngine(
      // onAudio — receive a sentence chunk
      (audio) => {
        // Discard chunks from a stale speak request
        if (audio.id !== speakIdRef.current) return;

        const ctx = audioCtxRef.current;
        if (!ctx) return;

        const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate);
        buffer.getChannelData(0).set(audio.samples);

        queueRef.current.push(buffer);

        // If nothing is currently playing, kick off playback
        if (!sourceRef.current) {
          setTtsStatus('speaking');
          playNext();
        }
      },
      // onDone — all chunks for this id have been sent
      (id) => {
        if (id !== speakIdRef.current) return;
        doneRef.current = true;
        // If playback already finished (queue was fast enough), set ready
        if (!sourceRef.current && queueRef.current.length === 0) {
          setTtsStatus('ready');
        }
      },
    );

    engineRef.current = engine;

    engine.init().then(() => {
      setTtsStatus('ready');
    }).catch((err) => {
      console.error('[TTS] Init failed:', err);
      setTtsStatus('error');
    });
  }, [playNext]);

  const speak = useCallback((text: string) => {
    if (!engineRef.current || !text.trim()) return;

    // Create / resume AudioContext inside a user-gesture call stack
    // so the browser doesn't block autoplay
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    // Cancel any in-flight generation + playback
    const id = ++speakIdRef.current;
    queueRef.current = [];
    doneRef.current = false;
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) { /* ignore */ }
      sourceRef.current = null;
    }

    setTtsStatus('speaking');
    engineRef.current.speak(text, 0, 1.0, id);
  }, []);

  const stopSpeaking = useCallback(() => {
    // Increment id so any in-flight chunks are discarded
    speakIdRef.current++;
    queueRef.current = [];
    doneRef.current = true;
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) { /* ignore */ }
      sourceRef.current = null;
    }
    setTtsStatus('ready');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (_) { /* ignore */ }
      }
      audioCtxRef.current?.close();
      engineRef.current?.destroy();
    };
  }, []);

  return { ttsStatus, speak, stopSpeaking };
}
