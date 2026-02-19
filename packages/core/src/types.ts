export interface S2SOptions {
  /** Base path to STT WASM + model assets (default: '/sherpa-onnx-asr/') */
  sttAssetPath?: string;
  /** Base path to TTS WASM + model assets (default: '/sherpa-onnx-tts/') */
  ttsAssetPath?: string;
  /** Base path where worker JS files are served (default: '/') */
  workerPath?: string;
  /** Default TTS voice settings */
  ttsVoice?: { sid?: number; speed?: number };
}

export interface S2SEvents {
  sttPartial: (text: string) => void;
  sttFinal: (text: string) => void;
  ttsStart: () => void;
  ttsEnd: () => void;
  status: (status: S2SStatus) => void;
  error: (error: Error) => void;
}

export type S2SStatus = 'loading' | 'ready' | 'error';
export type SttState = 'idle' | 'listening' | 'error';
export type TtsState = 'idle' | 'speaking';
