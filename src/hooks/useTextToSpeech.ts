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

  // Load TTS engine in Web Worker on mount
  useEffect(() => {
    setTtsStatus('loading');

    const engine = new TtsEngine((audio) => {
      // Play synthesized audio via Web Audio API
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate);
      buffer.getChannelData(0).set(audio.samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      source.onended = () => {
        setTtsStatus('ready');
        sourceRef.current = null;
      };

      // Stop any currently playing audio
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (_) { /* ignore */ }
      }

      sourceRef.current = source;
      setTtsStatus('speaking');
      source.start();
    });

    engineRef.current = engine;

    engine.init().then(() => {
      setTtsStatus('ready');
    }).catch((err) => {
      console.error('[TTS] Init failed:', err);
      setTtsStatus('error');
    });
  }, []);

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

    engineRef.current.speak(text);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) { /* ignore */ }
      sourceRef.current = null;
      setTtsStatus('ready');
    }
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
