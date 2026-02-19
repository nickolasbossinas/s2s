# Plan: Add Streaming STT via Sherpa-onnx WASM

## Context
Add the speech-to-text pipeline to the existing React chat app. The full mic-to-text flow: mic capture (getUserMedia + echo cancellation) → AudioWorklet (PCM extraction) → sherpa-onnx WASM recognizer (streaming transcription) → transcribed text appears in the chat input field for user review before sending.

Sherpa-onnx provides true streaming ASR — text appears word-by-word as you speak. The WASM build runs entirely in the browser (no audio sent to any server). The Emscripten Module pattern requires dynamic `<script>` injection and global `window.Module`.

## New/Modified Files

### New files
| File | Purpose |
|------|---------|
| `scripts/download-sherpa-model.sh` | Downloads pre-built WASM + model files from HuggingFace to `public/sherpa-onnx-asr/` |
| `public/audio-worklet-processor.js` | AudioWorklet processor: captures mic PCM, posts Float32Array chunks to main thread |
| `src/types/stt.ts` | TypeScript types: `SttStatus`, `SttLoadProgress`, `SherpaRecognizer`, `SherpaStream` |
| `src/services/sherpa-engine.ts` | TypeScript class wrapping Emscripten Module + sherpa-onnx recognizer lifecycle |
| `src/hooks/useSpeechToText.ts` | React hook: mic + AudioWorklet + downsampling + engine + state management |
| `src/components/Chat/MicButton.tsx` | Mic toggle button (idle / loading / recording states) |
| `src/components/Chat/LoadingOverlay.tsx` | Progress bar overlay shown during first-time WASM + model download |

### Modified files
| File | Changes |
|------|---------|
| `src/components/Chat/ChatInput.tsx` | Add MicButton, accept STT text injection props, show partial transcription |
| `src/components/Chat/ChatWindow.tsx` | Wire `useSpeechToText` hook, pass STT props to ChatInput, host LoadingOverlay |
| `src/components/Chat/Chat.module.css` | Add mic button, recording indicator, partial text, loading overlay styles |
| `.gitignore` | Ignore `public/sherpa-onnx-asr/*.wasm` and `*.data` (large binaries) |

## Implementation Steps

### Step 1: Download script + static assets
- Create `scripts/download-sherpa-model.sh` that fetches the 4 files from HuggingFace Space `k2-fsa/web-assembly-asr-sherpa-onnx-en`:
  - `sherpa-onnx-asr.js` (~46 KB, high-level API, defines `createOnlineRecognizer` global)
  - `sherpa-onnx-wasm-main-asr.js` (~92 KB, Emscripten glue)
  - `sherpa-onnx-wasm-main-asr.wasm` (~11.5 MB, WASM binary)
  - `sherpa-onnx-wasm-main-asr.data` (~191 MB, model weights via Emscripten --preload-file)
- Place in `public/sherpa-onnx-asr/`
- Update `.gitignore` to exclude `*.wasm` and `*.data`

### Step 2: AudioWorklet processor (`public/audio-worklet-processor.js`)
- `PcmCaptureProcessor extends AudioWorkletProcessor`
- `process()`: takes mono channel 0 (Float32Array of 128 samples), copies and posts to main thread via `this.port.postMessage({ type: 'pcm', samples })`
- Thin processor — downsampling happens on main thread

### Step 3: Type definitions (`src/types/stt.ts`)
```typescript
SttStatus = 'idle' | 'loading' | 'ready' | 'recording' | 'error'
SttLoadProgress = { phase: 'downloading' | 'initializing'; percent: number; detail: string }
SherpaStream   — acceptWaveform(sampleRate, samples), free()
SherpaRecognizer — createStream(), isReady(), decode(), getResult(), isEndpoint(), reset(), free()
```

### Step 4: Sherpa engine (`src/services/sherpa-engine.ts`)
- `SherpaEngine` class with `init()`, `feedAudio()`, `getPartialText()`, `checkEndpoint()`, `resetStream()`, `destroy()`
- `init()` — sets up `window.Module` with `locateFile` (points to `/sherpa-onnx-asr/`), `setStatus` (parses Emscripten download progress), `onRuntimeInitialized` (calls `createOnlineRecognizer(Module)`)
- Dynamically injects two `<script>` tags for the API + glue JS files
- Returns a Promise that resolves when the recognizer is ready
- `feedAudio(samples16k: Float32Array)` — calls `stream.acceptWaveform(16000, samples)` then `while (isReady) decode()`
- `getPartialText()` — returns `recognizer.getResult(stream).text`
- `checkEndpoint()` — returns `recognizer.isEndpoint(stream)`
- `resetStream()` — calls `recognizer.reset(stream)` for next utterance

### Step 5: `useSpeechToText` hook (`src/hooks/useSpeechToText.ts`)
Returns: `{ status, partialText, finalText, loadProgress, error, toggleRecording, clearText }`

**toggleRecording flow:**
1. First call (idle → loading → recording):
   - Create SherpaEngine, call `init()` (progress updates → `loadProgress` state)
   - Call `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`
   - Create AudioContext (48kHz), `addModule('/audio-worklet-processor.js')`, create AudioWorkletNode
   - Connect mic source → worklet
   - `workletNode.port.onmessage`: accumulate samples in buffer, when buffer ≥ 4096 native samples → downsample to 16kHz → `engine.feedAudio()` → update `partialText` → check endpoint (if yes: append to `finalText`, reset stream)

2. Subsequent toggles (recording ↔ ready):
   - Disconnect/reconnect mic source (don't destroy engine — expensive to reinitialize)

**Downsampling** (48kHz → 16kHz): simple averaging resampler ported from sherpa-onnx demo's `downsampleBuffer()`.

**Refs vs state**: Engine, AudioContext, WorkletNode, MediaStream stored in `useRef`. Only status/text/progress/error as `useState`.

**Cleanup on unmount**: `engine.destroy()`, close AudioContext, stop MediaStreamTracks.

### Step 6: UI components

**MicButton.tsx** — circular button next to Send, inline SVG mic icon. States:
- Idle/ready: gray background
- Recording: red background + pulse animation
- Loading: disabled with spinner

**LoadingOverlay.tsx** — absolute-positioned overlay on chatWindow, shown when `status === 'loading'`. Progress bar + status text.

**ChatInput.tsx changes:**
- New props: `sttText`, `onSttTextConsumed`, `sttPartial`, `sttStatus`, `onMicToggle`
- `useEffect` watches `sttText` → appends to local `text` state → calls `onSttTextConsumed()`
- MicButton placed between input and Send button
- Partial text line shown below the input bar when recording

**ChatWindow.tsx changes:**
- Call `useSpeechToText()` hook
- Pass STT props to ChatInput
- Call `clearText()` in `handleSend`
- Add `position: relative` on container for LoadingOverlay
- Render `<LoadingOverlay>` when loading

### Step 7: Error handling
- Browser support check: getUserMedia, AudioContext, AudioWorkletNode, WebAssembly
- Mic permission denied → descriptive error message
- WASM script load failure → error state
- Safari AudioContext restriction → create AudioContext inside click handler (user gesture)

## Verification
1. Run `bash scripts/download-sherpa-model.sh` to get WASM + model files
2. `npm run dev`
3. Click mic button → see loading overlay with progress bar as model downloads
4. Once loaded, speak into mic → see partial text appear below input in real-time
5. Stop speaking → finalized text appears in input field
6. Press Send → text goes to chat as user message, echo response appears
7. Click mic again → immediately starts recording (no re-download)
8. `npm run build` — no TypeScript errors
