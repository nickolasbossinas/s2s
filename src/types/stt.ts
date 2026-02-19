export type SttStatus = 'idle' | 'loading' | 'ready' | 'recording' | 'error';

export interface SttLoadProgress {
  phase: 'downloading' | 'initializing';
  percent: number;
  detail: string;
}

export interface SherpaStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  free(): void;
}

export interface SherpaRecognizer {
  createStream(): SherpaStream;
  isReady(stream: SherpaStream): boolean;
  decode(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { text: string };
  isEndpoint(stream: SherpaStream): boolean;
  reset(stream: SherpaStream): void;
  free(): void;
}
