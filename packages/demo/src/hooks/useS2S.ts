import { useState, useRef, useCallback, useEffect } from 'react';
import { S2SClient } from 's2s-core';
import type { S2SOptions } from 's2s-core';
import type { SttStatus } from '../types/stt';

export interface UseS2SReturn {
  sttStatus: SttStatus;
  partialText: string;
  finalText: string;
  error: string | null;
  toggleRecording: () => Promise<void>;
  speak: (text: string, sid?: number, speed?: number) => void;
  stopSpeaking: () => void;
  clearText: () => void;
}

/**
 * React hook that wraps S2SClient for easy use in components.
 */
export function useS2S(options?: S2SOptions): UseS2SReturn {
  const [sttStatus, setSttStatus] = useState<SttStatus>('loading');
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<S2SClient | null>(null);
  const finalsRef = useRef<string[]>([]);
  const sttStatusRef = useRef<SttStatus>('loading');

  // Keep ref in sync with state
  const updateSttStatus = useCallback((status: SttStatus) => {
    sttStatusRef.current = status;
    setSttStatus(status);
  }, []);

  useEffect(() => {
    const client = new S2SClient(options);
    clientRef.current = client;

    client.on('status', (status) => {
      if (status === 'ready') updateSttStatus('ready');
      else if (status === 'error') updateSttStatus('error');
    });

    client.on('sttPartial', (text: string) => setPartialText(text));

    client.on('sttFinal', (text: string) => {
      if (text) {
        finalsRef.current.push(text);
        setFinalText(finalsRef.current.join(' '));
      }
      setPartialText('');
    });

    client.on('error', (err: Error) => {
      console.error('[S2S]', err);
      setError(err.message);
    });

    client.init().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to initialize S2S';
      setError(msg);
      updateSttStatus('error');
    });

    return () => {
      client.destroy();
      clientRef.current = null;
    };
  // Options are typically stable (passed once at mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateSttStatus]);

  const toggleRecording = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const current = sttStatusRef.current;

    if (current === 'recording') {
      client.stopListening();
      updateSttStatus('ready');
      return;
    }

    if (current !== 'ready') return;

    try {
      await client.startListening();
      updateSttStatus('recording');
    } catch (err) {
      const msg = err instanceof DOMException
        ? err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow mic access in browser settings.'
          : err.name === 'NotFoundError'
            ? 'No microphone found. Please connect a microphone.'
            : `Microphone error: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Failed to start recording';
      setError(msg);
      updateSttStatus('error');
    }
  }, [updateSttStatus]);

  const speak = useCallback((text: string, sid?: number, speed?: number) => {
    clientRef.current?.speak(text, sid, speed);
  }, []);

  const stopSpeaking = useCallback(() => {
    clientRef.current?.stopSpeaking();
  }, []);

  const clearText = useCallback(() => {
    finalsRef.current = [];
    setFinalText('');
    setPartialText('');
  }, []);

  return { sttStatus, partialText, finalText, error, toggleRecording, speak, stopSpeaking, clearText };
}
