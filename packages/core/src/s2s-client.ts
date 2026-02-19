import { Emitter } from './emitter';
import { SttPipeline } from './stt-pipeline';
import { TtsPipeline } from './tts-pipeline';
import type { S2SOptions, S2SEvents, S2SStatus } from './types';

/**
 * Main entry point. Composes STT + TTS pipelines into a single event-based client.
 *
 * ```js
 * const client = new S2SClient({ workerPath: '/' });
 * await client.init();
 * client.on('sttFinal', (text) => console.log(text));
 * await client.startListening();
 * ```
 */
export class S2SClient extends Emitter<S2SEvents> {
  private stt: SttPipeline;
  private tts: TtsPipeline;
  private _status: S2SStatus = 'loading';
  private defaultSid: number;
  private defaultSpeed: number;

  constructor(options?: S2SOptions) {
    super();
    const workerPath = options?.workerPath ?? '/';

    this.defaultSid = options?.ttsVoice?.sid ?? 0;
    this.defaultSpeed = options?.ttsVoice?.speed ?? 1.0;

    this.stt = new SttPipeline({
      workerPath,
      assetPath: options?.sttAssetPath,
    });

    this.tts = new TtsPipeline({
      workerPath,
      assetPath: options?.ttsAssetPath,
    });

    // Forward STT events
    this.stt.on('partial', (text) => this.emit('sttPartial', text));
    this.stt.on('final', (text) => this.emit('sttFinal', text));
    this.stt.on('error', (err) => this.emit('error', err));

    // Forward TTS events
    this.tts.on('start', () => this.emit('ttsStart'));
    this.tts.on('end', () => this.emit('ttsEnd'));
    this.tts.on('error', (err) => this.emit('error', err));
  }

  get status(): S2SStatus {
    return this._status;
  }

  /** Initialize both STT and TTS engines (loads WASM + models). */
  async init(): Promise<void> {
    this.setStatus('loading');
    try {
      await Promise.all([this.stt.init(), this.tts.init()]);
      this.setStatus('ready');
    } catch (err) {
      this.setStatus('error');
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /** Start capturing from microphone → STT. */
  async startListening(): Promise<void> {
    return this.stt.startListening();
  }

  /** Stop capturing (mic stays available for quick restart). */
  stopListening(): void {
    this.stt.stopListening();
  }

  /** Synthesize and play text via TTS. */
  speak(text: string, sid?: number, speed?: number): void {
    this.tts.speak(text, sid ?? this.defaultSid, speed ?? this.defaultSpeed);
  }

  /** Stop current TTS playback immediately. */
  stopSpeaking(): void {
    this.tts.stop();
  }

  /** Release all resources. */
  destroy(): void {
    this.stt.destroy();
    this.tts.destroy();
    this.removeAllListeners();
  }

  private setStatus(status: S2SStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.emit('status', status);
  }
}
