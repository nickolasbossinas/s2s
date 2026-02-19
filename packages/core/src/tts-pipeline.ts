import { Emitter } from './emitter';
import { TtsEngine } from './tts-engine';
import type { TtsAudio } from './tts-engine';
import type { TtsState } from './types';

export interface TtsPipelineOptions {
  workerPath?: string;
  assetPath?: string;
}

interface TtsPipelineEvents {
  start: () => void;
  end: () => void;
  stateChange: (state: TtsState) => void;
  error: (error: Error) => void;
}

/**
 * TtsEngine → AudioBuffer queue → sequential playback.
 * Framework-agnostic TTS pipeline.
 */
export class TtsPipeline extends Emitter<TtsPipelineEvents> {
  private engine: TtsEngine;
  private audioCtx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private queue: AudioBuffer[] = [];
  private speakId = 0;
  private done = false;
  private _state: TtsState = 'idle';

  constructor(options?: TtsPipelineOptions) {
    super();
    this.engine = new TtsEngine(
      (audio: TtsAudio) => this.handleAudio(audio),
      (id: number) => this.handleDone(id),
      { workerPath: options?.workerPath, assetPath: options?.assetPath },
    );
  }

  /** Load WASM + model. Call once before speak(). */
  async init(): Promise<void> {
    await this.engine.init();
  }

  get state(): TtsState {
    return this._state;
  }

  /** Synthesize and play text. Cancels any in-progress speech. */
  speak(text: string, sid = 0, speed = 1.0): void {
    if (!text.trim()) return;

    // Create / resume AudioContext in call stack (may be user gesture)
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    // Cancel any in-flight generation + playback
    const id = ++this.speakId;
    this.queue = [];
    this.done = false;
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch (_) { /* ignore */ }
      this.sourceNode = null;
    }

    this.setState('speaking');
    this.emit('start');
    this.engine.speak(text, sid, speed, id);
  }

  /** Stop current speech immediately. */
  stop(): void {
    this.speakId++;
    this.queue = [];
    this.done = true;
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch (_) { /* ignore */ }
      this.sourceNode = null;
    }
    this.setState('idle');
    this.emit('end');
  }

  /** Release all resources. */
  destroy(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch (_) { /* ignore */ }
    }
    this.audioCtx?.close();
    this.engine.destroy();
    this.audioCtx = null;
    this.sourceNode = null;
  }

  private setState(state: TtsState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit('stateChange', state);
  }

  private handleAudio(audio: TtsAudio): void {
    if (audio.id !== this.speakId) return;

    const ctx = this.audioCtx;
    if (!ctx) return;

    const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate);
    buffer.getChannelData(0).set(audio.samples);

    this.queue.push(buffer);

    // If nothing is currently playing, kick off playback
    if (!this.sourceNode) {
      this.playNext();
    }
  }

  private handleDone(id: number): void {
    if (id !== this.speakId) return;
    this.done = true;
    // If playback already finished (queue was fast enough), signal end
    if (!this.sourceNode && this.queue.length === 0) {
      this.setState('idle');
      this.emit('end');
    }
  }

  private playNext(): void {
    const ctx = this.audioCtx;
    if (!ctx) return;

    const next = this.queue.shift();
    if (!next) {
      this.sourceNode = null;
      if (this.done) {
        this.setState('idle');
        this.emit('end');
      }
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = next;
    source.connect(ctx.destination);
    source.onended = () => {
      this.sourceNode = null;
      this.playNext();
    };

    this.sourceNode = source;
    source.start();
  }
}
