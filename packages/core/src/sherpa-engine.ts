/**
 * Thin proxy to the sherpa-onnx STT Web Worker.
 * All WASM compilation, model loading, and recognition run off the main thread.
 */

export interface SherpaEngineOptions {
  workerPath?: string;
  assetPath?: string;
}

export type SherpaResult = {
  text: string;
  isEndpoint: boolean;
};

export class SherpaEngine {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private onResult: (result: SherpaResult) => void;
  private workerUrl: string;
  private assetPath: string;

  constructor(
    onResult: (result: SherpaResult) => void,
    options?: SherpaEngineOptions,
  ) {
    this.onResult = onResult;
    const base = options?.workerPath ?? '/';
    this.workerUrl = base + 'sherpa-worker.js';
    this.assetPath = options?.assetPath ?? '/sherpa-onnx-asr/';
  }

  /** Load WASM + model in a Web Worker. Idempotent. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private doInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(this.workerUrl);
      this.worker = worker;

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          worker.onmessage = this.handleRuntimeMessage.bind(this);
          resolve();
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
      };

      worker.onerror = (err) => {
        reject(new Error(`Worker error: ${err.message}`));
      };

      worker.postMessage({ type: 'init', assetPath: this.assetPath });
    });
  }

  private handleRuntimeMessage(e: MessageEvent): void {
    const msg = e.data;
    if (msg.type === 'result') {
      this.onResult({ text: msg.text, isEndpoint: msg.isEndpoint });
    } else if (msg.type === 'error') {
      console.error('[SherpaEngine] Worker error:', msg.message);
    }
  }

  /** Send 16 kHz mono PCM audio to the worker for recognition. */
  feedAudio(samples16k: Float32Array): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'feed', samples: samples16k }, [samples16k.buffer]);
  }

  /** Clean up worker and resources. */
  destroy(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'destroy' });
      this.worker = null;
    }
    this.initPromise = null;
  }
}
