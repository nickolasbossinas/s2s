/**
 * Thin proxy to the sherpa-onnx TTS Web Worker.
 * All WASM compilation, model loading, and synthesis run off the main thread.
 */

export type TtsAudio = {
  samples: Float32Array;
  sampleRate: number;
};

export class TtsEngine {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private onAudio: (audio: TtsAudio) => void;

  constructor(onAudio: (audio: TtsAudio) => void) {
    this.onAudio = onAudio;
  }

  /** Load WASM + model in a Web Worker. Idempotent. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private doInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker('/sherpa-tts-worker.js');
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
        reject(new Error(`TTS Worker error: ${err.message}`));
      };

      worker.postMessage({ type: 'init' });
    });
  }

  private handleRuntimeMessage(e: MessageEvent): void {
    const msg = e.data;
    if (msg.type === 'audio') {
      this.onAudio({ samples: msg.samples, sampleRate: msg.sampleRate });
    } else if (msg.type === 'error') {
      console.error('[TtsEngine] Worker error:', msg.message);
    }
  }

  /** Request speech synthesis. Audio comes back via onAudio callback. */
  speak(text: string, sid = 0, speed = 1.0): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'speak', text, sid, speed });
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
