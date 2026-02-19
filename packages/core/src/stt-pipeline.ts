import { Emitter } from './emitter';
import { SherpaEngine } from './sherpa-engine';
import type { SherpaResult } from './sherpa-engine';
import type { SttState } from './types';

export interface SttPipelineOptions {
  workerPath?: string;
  assetPath?: string;
}

interface SttPipelineEvents {
  partial: (text: string) => void;
  final: (text: string) => void;
  stateChange: (state: SttState) => void;
  error: (error: Error) => void;
}

/**
 * Microphone → AudioWorklet → downsample → SherpaEngine → events.
 * Framework-agnostic STT pipeline.
 */
export class SttPipeline extends Emitter<SttPipelineEvents> {
  private engine: SherpaEngine;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private buffer: Float32Array[] = [];
  private bufferLen = 0;
  private _state: SttState = 'idle';
  private workletPath: string;

  constructor(options?: SttPipelineOptions) {
    super();
    const workerPath = options?.workerPath ?? '/';
    this.workletPath = workerPath + 'audio-worklet-processor.js';
    this.engine = new SherpaEngine(
      (result: SherpaResult) => this.handleResult(result),
      { workerPath, assetPath: options?.assetPath },
    );
  }

  /** Check if the browser has all required APIs. Returns error string or null. */
  static checkBrowserSupport(): string | null {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia)
      return 'Microphone access not supported in this browser.';
    if (typeof AudioContext === 'undefined')
      return 'Web Audio API not supported in this browser.';
    if (typeof AudioWorkletNode === 'undefined')
      return 'AudioWorklet not supported. Use Chrome, Edge, or Firefox.';
    if (typeof WebAssembly === 'undefined')
      return 'WebAssembly not supported in this browser.';
    return null;
  }

  /** Load WASM + model. Call once before startListening(). */
  async init(): Promise<void> {
    const err = SttPipeline.checkBrowserSupport();
    if (err) throw new Error(err);
    await this.engine.init();
  }

  get state(): SttState {
    return this._state;
  }

  /** Start capturing from microphone. First call acquires mic permission. */
  async startListening(): Promise<void> {
    // If worklet + source already exist, just reconnect
    if (this.worklet && this.source) {
      this.source.connect(this.worklet);
      this.setState('listening');
      return;
    }

    // First time: full audio pipeline setup
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.mediaStream = stream;

    const audioCtx = new AudioContext();
    this.audioCtx = audioCtx;

    await audioCtx.audioWorklet.addModule(this.workletPath);
    const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
    this.worklet = workletNode;

    workletNode.port.onmessage = (e: MessageEvent) => {
      if (e.data.type !== 'pcm') return;
      this.buffer.push(e.data.samples);
      this.bufferLen += e.data.samples.length;

      // Process in batches of ~4096 native-rate samples (~85ms at 48 kHz)
      if (this.bufferLen >= 4096) {
        this.processBatch();
      }
    };

    const source = audioCtx.createMediaStreamSource(stream);
    this.source = source;
    source.connect(workletNode);

    this.setState('listening');
  }

  /** Stop capturing (mic stays available for quick restart). */
  stopListening(): void {
    this.source?.disconnect();
    this.setState('idle');
  }

  /** Release all resources. */
  destroy(): void {
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.audioCtx?.close();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.engine.destroy();
    this.audioCtx = null;
    this.source = null;
    this.worklet = null;
    this.mediaStream = null;
  }

  private setState(state: SttState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit('stateChange', state);
  }

  private handleResult(result: SherpaResult): void {
    const normalized = SttPipeline.normalizeText(result.text);
    this.emit('partial', normalized);

    if (result.isEndpoint) {
      if (normalized) {
        this.emit('final', normalized);
      }
      this.emit('partial', '');
    }
  }

  private processBatch(): void {
    const nativeRate = this.audioCtx?.sampleRate ?? 48000;

    const merged = new Float32Array(this.bufferLen);
    let offset = 0;
    for (const chunk of this.buffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.buffer = [];
    this.bufferLen = 0;

    const samples16k = SttPipeline.downsample(merged, nativeRate, 16000);
    this.engine.feedAudio(samples16k);
  }

  /** Downsample a Float32Array from inputRate to outputRate via simple averaging. */
  private static downsample(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
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
  private static normalizeText(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    return lower[0].toUpperCase() + lower.slice(1);
  }
}
