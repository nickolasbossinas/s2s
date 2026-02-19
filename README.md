# S2S Core

Full-duplex speech-to-speech in the browser. Zero dependencies. Runs STT (speech-to-text) and TTS (text-to-speech) locally via WebAssembly using [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).

The library is **chatbot-agnostic** — it handles the voice pipeline (mic input, speech recognition, text-to-speech playback) and emits events. You wire up any AI/chatbot in between.

## Features

- **Browser-native** — runs entirely in the browser via WebAssembly, no server needed for speech
- **Full-duplex** — STT and TTS run simultaneously
- **Zero dependencies** — single ~12KB JS bundle
- **Framework-agnostic** — event-based API works with React, Vue, Svelte, vanilla JS, etc.
- **Streaming TTS** — sentences are synthesized and played back as they're ready
- **Echo cancellation** — uses WebRTC AEC to prevent TTS output from being picked up by the mic
- **Multi-speaker TTS** — 904 voices from the LibriTTS-R model, configurable per utterance

## Installation

```bash
npm install s2s-core
```

## Setup

The library requires three types of static assets served by your web server:

### 1. Worker files

Copy from `node_modules/s2s-core/workers/` to your public directory:

```
sherpa-worker.js
sherpa-tts-worker.js
audio-worklet-processor.js
```

### 2. STT model files

Download the sherpa-onnx ASR WASM build from [HuggingFace](https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en):

```
sherpa-onnx-asr.js
sherpa-onnx-wasm-main-asr.js
sherpa-onnx-wasm-main-asr.wasm
sherpa-onnx-wasm-main-asr.data
```

### 3. TTS model files

Download the sherpa-onnx TTS WASM build from [HuggingFace](https://huggingface.co/spaces/k2-fsa/web-assembly-tts-sherpa-onnx-en):

```
sherpa-onnx-tts.js
sherpa-onnx-wasm-main-tts.js
sherpa-onnx-wasm-main-tts.wasm
sherpa-onnx-wasm-main-tts.data
```

Or use the provided download script:

```bash
bash scripts/download-sherpa-model.sh
```

## Quick Start

```js
import { S2SClient } from 's2s-core';

const client = new S2SClient({
  sttAssetPath: '/sherpa-onnx-asr/',
  ttsAssetPath: '/sherpa-onnx-tts/',
  workerPath: '/',
});

await client.init();

client.on('sttPartial', (text) => {
  console.log('Hearing:', text);
});

client.on('sttFinal', (text) => {
  console.log('You said:', text);
});

await client.startListening();
```

## API

### `new S2SClient(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sttAssetPath` | `string` | `'/sherpa-onnx-asr/'` | URL path to STT WASM + model files |
| `ttsAssetPath` | `string` | `'/sherpa-onnx-tts/'` | URL path to TTS WASM + model files |
| `workerPath` | `string` | `'/'` | URL path where worker JS files are served |
| `ttsVoice` | `{ sid?, speed? }` | `{ sid: 0, speed: 1.0 }` | Default TTS voice (speaker ID and speed) |

### Methods

| Method | Description |
|--------|-------------|
| `init()` | Load WASM models for both STT and TTS. Returns a Promise. |
| `startListening()` | Start microphone capture and speech recognition. Returns a Promise (first call requests mic permission). |
| `stopListening()` | Stop capturing. Mic stays available for quick restart. |
| `speak(text, sid?, speed?)` | Synthesize and play text. Cancels any in-progress speech. |
| `stopSpeaking()` | Stop TTS playback immediately. |
| `destroy()` | Release all resources (workers, mic, audio contexts). |

### Events

| Event | Callback | Description |
|-------|----------|-------------|
| `sttPartial` | `(text: string) => void` | Live partial transcription (updates frequently) |
| `sttFinal` | `(text: string) => void` | Finalized sentence (emitted at each endpoint) |
| `ttsStart` | `() => void` | TTS audio playback started |
| `ttsEnd` | `() => void` | TTS audio playback finished |
| `status` | `(status: 'loading' \| 'ready' \| 'error') => void` | Client initialization status changed |
| `error` | `(error: Error) => void` | An error occurred |

```js
client.on('sttFinal', callback);   // subscribe
client.off('sttFinal', callback);  // unsubscribe
```

## Chatbot Integration Example

```js
import { S2SClient } from 's2s-core';

const client = new S2SClient();
await client.init();

// When the user finishes a sentence, send it to your chatbot
// and speak the reply
client.on('sttFinal', async (text) => {
  const reply = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: text }),
  }).then(r => r.json());

  client.speak(reply.text);
});

await client.startListening();
```

## TTS Voice Selection

The bundled LibriTTS-R model includes 904 speakers. Pass a speaker ID to `speak()`:

```js
client.speak('Hello world', 0);       // female voice (default)
client.speak('Hello world', 2);       // male voice
client.speak('Hello world', 100);     // another voice
client.speak('Slow speech', 0, 0.8);  // slower speed
```

Or set defaults in the constructor:

```js
const client = new S2SClient({
  ttsVoice: { sid: 2, speed: 1.0 },
});
```

## Using Individual Pipelines

If you only need STT or TTS, import the pipelines directly:

```js
import { SttPipeline } from 's2s-core';

const stt = new SttPipeline({
  workerPath: '/',
  assetPath: '/sherpa-onnx-asr/',
});

await stt.init();
stt.on('final', (text) => console.log(text));
await stt.startListening();
```

```js
import { TtsPipeline } from 's2s-core';

const tts = new TtsPipeline({
  workerPath: '/',
  assetPath: '/sherpa-onnx-tts/',
});

await tts.init();
tts.speak('Hello world', 0, 1.0);
```

## Project Structure

```
s2s/
├── packages/
│   ├── core/                    s2s-core library (npm package)
│   │   ├── src/
│   │   │   ├── index.ts         public exports
│   │   │   ├── s2s-client.ts    main S2SClient class
│   │   │   ├── stt-pipeline.ts  mic → recognition → events
│   │   │   ├── tts-pipeline.ts  synthesis → audio playback
│   │   │   ├── sherpa-engine.ts STT web worker proxy
│   │   │   ├── tts-engine.ts    TTS web worker proxy
│   │   │   ├── emitter.ts       typed event emitter
│   │   │   └── types.ts         public TypeScript types
│   │   └── workers/             static worker JS files
│   └── demo/                    React demo app
│       ├── src/
│       │   ├── hooks/useS2S.ts  React wrapper around S2SClient
│       │   ├── components/      chat UI components
│       │   └── services/llm.ts  mock chatbot
│       └── public/              WASM assets + worker copies
├── scripts/
│   └── download-sherpa-model.sh
└── package.json                 npm workspaces root
```

## Running the Demo

```bash
git clone <repo-url>
cd s2s
npm install

# Download WASM + model files (~100MB)
bash scripts/download-sherpa-model.sh

# Start dev server
npm run dev
```

Open http://localhost:5173. The demo uses a mock chatbot that echoes your input (say "say long text" for a longer response).

## Browser Requirements

- Chrome, Edge, or Firefox (AudioWorklet + WebAssembly required)
- HTTPS (required for microphone access; `localhost` works for development)
- Microphone permission

## Build

```bash
# Build the core library
npm run build:core

# Build everything (core + demo)
npm run build

# Type check
npm run typecheck
```

## License

MIT
