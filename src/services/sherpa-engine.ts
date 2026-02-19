import type { SherpaRecognizer, SherpaStream, SttLoadProgress } from '../types/stt';

declare global {
  interface Window {
    Module: Record<string, unknown>;
    createOnlineRecognizer: (module: Record<string, unknown>) => SherpaRecognizer;
  }
}

/**
 * Wraps the sherpa-onnx Emscripten WASM module behind a clean TypeScript API.
 * The WASM files must be present in /sherpa-onnx-asr/ (served from public/).
 */
export class SherpaEngine {
  private recognizer: SherpaRecognizer | null = null;
  private stream: SherpaStream | null = null;
  private onProgress: (progress: SttLoadProgress) => void;
  private initPromise: Promise<void> | null = null;

  constructor(onProgress: (progress: SttLoadProgress) => void) {
    this.onProgress = onProgress;
  }

  /** Load WASM + model. Idempotent — second call returns the same promise. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private doInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const module: Record<string, unknown> = {};

      module.locateFile = (path: string) => `/sherpa-onnx-asr/${path}`;

      module.setStatus = (status: string) => {
        const match = status.match(/Downloading data\.\.\. \((\d+)\/(\d+)\)/);
        if (match) {
          const downloaded = Number(match[1]);
          const total = Number(match[2]);
          const percent = total === 0 ? 0 : (downloaded / total) * 100;
          this.onProgress({ phase: 'downloading', percent, detail: `Downloading model: ${percent.toFixed(0)}%` });
        } else if (status === 'Running...') {
          this.onProgress({ phase: 'initializing', percent: 100, detail: 'Initializing recognizer...' });
        }
      };

      module.onRuntimeInitialized = () => {
        try {
          if (!window.createOnlineRecognizer) {
            throw new Error('createOnlineRecognizer not found — sherpa-onnx-asr.js may not have loaded');
          }
          this.recognizer = window.createOnlineRecognizer(module);
          this.stream = this.recognizer.createStream();
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      window.Module = module;

      // Load API script (defines createOnlineRecognizer global)
      const apiScript = document.createElement('script');
      apiScript.src = '/sherpa-onnx-asr/sherpa-onnx-asr.js';
      apiScript.onerror = () => reject(new Error('Failed to load sherpa-onnx API script'));
      document.head.appendChild(apiScript);

      // Load Emscripten glue script (reads window.Module, fetches .wasm + .data)
      const glueScript = document.createElement('script');
      glueScript.src = '/sherpa-onnx-asr/sherpa-onnx-wasm-main-asr.js';
      glueScript.onerror = () => reject(new Error('Failed to load WASM glue script'));
      document.head.appendChild(glueScript);
    });
  }

  /** Feed a chunk of 16 kHz mono PCM audio. */
  feedAudio(samples16k: Float32Array): void {
    if (!this.recognizer || !this.stream) return;
    this.stream.acceptWaveform(16000, samples16k);
    while (this.recognizer.isReady(this.stream)) {
      this.recognizer.decode(this.stream);
    }
  }

  /** Get current partial text. */
  getPartialText(): string {
    if (!this.recognizer || !this.stream) return '';
    return this.recognizer.getResult(this.stream).text;
  }

  /** Check if the recognizer detected an endpoint (speaker stopped). */
  checkEndpoint(): boolean {
    if (!this.recognizer || !this.stream) return false;
    return this.recognizer.isEndpoint(this.stream);
  }

  /** Reset stream for next utterance (call after endpoint detected). */
  resetStream(): void {
    if (!this.recognizer || !this.stream) return;
    this.recognizer.reset(this.stream);
  }

  /** Clean up all resources. */
  destroy(): void {
    if (this.stream) {
      this.stream.free();
      this.stream = null;
    }
    if (this.recognizer) {
      this.recognizer.free();
      this.recognizer = null;
    }
    this.initPromise = null;
  }
}
