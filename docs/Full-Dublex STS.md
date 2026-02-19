# Voice AI Research Summary

> Research conducted February 2026.

## Goal

Build a full-duplex voice interface where:
- **STT (Speech-to-Text)** runs locally in the browser via WebAssembly
- **Echo cancellation** handled by WebRTC's native AEC via `getUserMedia`
- **LLM** remains a cloud API (Claude) — only text is sent over the network
- **TTS (Text-to-Speech)** runs locally in the browser via WebAssembly/WebGPU
- No audio is sent to any online service

## Architecture

Microphone
→ getUserMedia({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })
→ MediaStream (echo-cancelled audio)
→ AudioContext + AudioWorkletNode (extract PCM samples)
→ Silero VAD (detect speech start/stop, ~2 MB model, <1ms)
→ WASM STT engine (local transcription)
→ Text sent to Claude API
→ Response text received
→ WASM/WebGPU TTS engine (local speech synthesis)
→ Web Audio API playback through speakers
→ Browser AEC prevents speaker audio from feeding back to mic



## Key Insight

The browser's `SpeechRecognition` API (Web Speech API) manages its own audio stream and **bypasses WebRTC echo cancellation entirely** — this is why the microphone hears the TTS output. By using `getUserMedia()` with `echoCancellation: true` and piping audio to our own STT engine, we get browser-native AEC for free.

## Recommended Components

### Echo Cancellation
- **Method:** `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`
- Browser-native WebRTC AEC — free, zero download, battle-tested
- Chrome's AEC3 implementation is the most mature
- Safari/WebKit AEC has historically been buggy — test thoroughly on iPads

### Voice Activity Detection (VAD)
- **Silero VAD** via `@ricky0123/vad-web` (npm package)
- ~2 MB ONNX model, <1ms inference per 30ms audio chunk
- Detects speech start/stop — avoids sending silence to STT
- GitHub: https://github.com/ricky0123/vad

### Speech-to-Text (STT) — Two Options

#### Option A: Sherpa-onnx WASM (Recommended for conversational feel)
- **True streaming** — transcribes as you speak, not in chunks
- Models: 80-300 MB (zipformer-transducer for streaming ASR)
- Latency: <500ms on desktop
- 10.3k GitHub stars, very actively maintained (commits Feb 2026)
- Official WASM builds maintained by the project
- Also includes TTS (MATCHA models, <10 MB) and VAD
- Languages: 12+ (English, Chinese, etc.)
- GitHub: https://github.com/k2-fsa/sherpa-onnx
- Live WASM demos: https://k2-fsa.github.io/sherpa/onnx/wasm/index.html
- No WebGPU needed (ONNX Runtime WASM)

#### Option B: Whisper via Transformers.js (Best accuracy)
- **Chunked processing** — processes ~5-second audio blocks, not true streaming
- Whisper tiny.en: 75 MB, base.en: 142 MB, small.en: 466 MB
- Latency: ~1s per chunk with WebGPU, 2-3s without
- Word error rate: ~8% (tiny), ~5% (base) — better than Sherpa-onnx
- WebGPU acceleration via Transformers.js v3+
- Real-time Whisper WebGPU demo: https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu
- GitHub: https://github.com/huggingface/transformers.js
- Falls back to WASM on devices without WebGPU (slower)

#### Comparison
| | Sherpa-onnx | Whisper (Transformers.js) |
|---|---|---|
| Streaming | True real-time | 5-second chunks |
| Conversational feel | More natural | Slight pauses |
| Accuracy | Good | Better |
| WebGPU needed? | No | Strongly preferred |
| Tablet/mobile | Works well | Slow without WebGPU |
| TTS bundled? | Yes | No |

### Text-to-Speech (TTS) — Two Options

#### Option A: Kokoro.js (Best voice quality)
- Neural TTS, 82M parameters, excellent English voices
- Model: 86 MB (q4 quantized) to 326 MB (fp32)
- Latency: ~500ms for ~10s of speech with WebGPU, 1-2s without
- WebGPU accelerated with WASM fallback
- npm: `kokoro-js`
- Browser: Chrome 120+, Edge 120+, Safari 17+
- GitHub (parent): https://github.com/hexgrad/kokoro

#### Option B: Sherpa-onnx MATCHA TTS (Lightest weight)
- Neural TTS, good quality
- Model: <10 MB
- Latency: <500ms
- Part of the Sherpa-onnx package (unified STT + TTS)
- No WebGPU needed
- 40+ language support via VITS-Piper voices (15-80 MB per voice)

### Audio Pipeline (Web APIs)
- **AudioContext** + **AudioWorkletNode** for PCM extraction
- AudioWorklet runs on dedicated audio thread (low-latency)
- Pattern: accumulate 128-sample frames in ring buffer → feed to WASM STT
- Reference: https://googlechromelabs.github.io/web-audio-samples/audio-worklet/design-pattern/wasm/

## Recommended Stack Combinations

### Combo 1: Sherpa-onnx All-in-One (Simplest)
- VAD: Sherpa-onnx built-in
- STT: Sherpa-onnx streaming ASR (~80-300 MB)
- TTS: Sherpa-onnx MATCHA (<10 MB)
- Total download: ~90-310 MB
- Pros: One library, unified API, true streaming, works without WebGPU
- Cons: Lower STT accuracy than Whisper, less natural TTS than Kokoro

### Combo 2: Best-of-Breed (Best quality)
- VAD: Silero VAD via @ricky0123/vad-web (~2 MB)
- STT: Whisper via Transformers.js + WebGPU (75-142 MB)
- TTS: Kokoro.js + WebGPU (86 MB)
- Total download: ~163-230 MB
- Pros: Best accuracy, best voice quality, WebGPU accelerated
- Cons: Multiple libraries, chunked STT (not true streaming), needs WebGPU

### Combo 3: Hybrid (Best of both)
- VAD: Silero VAD (~2 MB)
- STT: Sherpa-onnx streaming (~80-300 MB)
- TTS: Kokoro.js (86 MB)
- Total download: ~168-388 MB
- Pros: True streaming STT + best voice quality TTS
- Cons: Two different ecosystems to integrate

## Reference Projects

- **irelate-ai/voice-chat** — Full in-browser pipeline: Silero VAD → Whisper → WebLLM → TTS. Closest to target architecture. https://github.com/irelate-ai/voice-chat
- **BrowserAI** — WebGPU LLMs + Kokoro TTS + speech recognition in browser. https://github.com/sauravpanda/BrowserAI
- **whisper.cpp WASM streaming demo** — https://ggml.ai/whisper.cpp/stream.wasm/
- **Sherpa-onnx WASM ASR demo** — https://k2-fsa.github.io/sherpa/onnx/wasm/index.html
- **Sherpa-onnx WASM TTS demo** — https://huggingface.co/spaces/k2-fsa/web-assembly-tts-sherpa-onnx-en

## Performance Notes

- **Desktop (modern, with GPU):** All options work well. WebGPU gives 2-10x speedup for Whisper/Kokoro
- **Tablet/mobile:** Sherpa-onnx works; Whisper WASM is too slow (5-10s per chunk); WebGPU on mobile still maturing
- **Browser memory limit:** ~4 GB WASM per tab. Budget ~200-400 MB for models — well within limits
- **First load:** Models should be cached via Service Worker / Cache API after first download
- **Safari AEC:** Historically unreliable. Test thoroughly. Chrome is the gold standard for WebRTC AEC

## Full-Duplex Commercial Landscape (for comparison)

| Solution | Type | Cost/min | Echo Cancellation | Notes |
|---|---|---|---|---|
| OpenAI Realtime API | S2S | ~$0.30 | WebRTC (client) | GPT-4o only |
| Gemini Live API | S2S | ~$0.005-0.01 | External | Cheapest, needs relay |
| ElevenLabs Conv. AI | Platform | ~$0.10+ | WebRTC | Best voice quality |
| Amazon Nova Sonic | S2S (AWS) | ~$0.017 | None (headset req) | Not in ap-southeast-2 |
| LiveKit | Framework | ~$0.006-0.01* | WebRTC + Krisp | Open-source |
| Deepgram Voice Agent | API | ~$0.075 | Client-side | All-in-one |
| Pipecat/Daily | Framework | ~$0.01* | WebRTC | Open-source |
| Hume EVI 3 | S2S | ~$0.05-0.06 | SDK | Emotion-aware |
| **Our approach** | **Custom** | **$0 (local)** | **WebRTC native** | **Only Claude API text costs** |

*Infrastructure only — provider costs additional

## Local LLMs — Why Not Replace Claude?

Research into BitNet b1.58 and browser-capable LLMs (Qwen3, SmolLM3, Phi-4-Mini, Gemma 3) concluded:

- **BitNet b1.58 2B4T**: 0.4 GB, 45 tok/s on M2 CPU, MIT license — but **no WASM/WebGPU build exists**. Cannot run in browser.
- **Browser-capable models** (2-3B, Q4 quantized, 1-2 GB): Can run via WebLLM (WebGPU) or Wllama (WASM CPU) at 10-50 tok/s
- **Hallucination rates**: 2-3B models hallucinate 25-30% on domain-specific knowledge. Claude/GPT-4 class: 1.5-5%
- **Aviation safety**: A small model will confidently state incorrect CHT limits, fabricate FAR numbers, and invent maintenance intervals. Unacceptable for safety-critical domains.
- **Verdict**: Claude stays as the brain. Local models could serve as a fast intent-classifier/router in a future hybrid architecture, but not as the primary knowledge source.

### Browser LLM Engines (for reference)
| Engine | GPU Accel | Best For |
|---|---|---|
| WebLLM (MLC AI) | WebGPU | Fastest inference, pre-compiled models |
| Wllama | CPU only (WASM) | Max compatibility, any GGUF model |
| Transformers.js v4 | WebGPU | Broadest model support (~200 architectures) |
| MediaPipe LLM | WebGPU | Gemma models, memory-efficient 7B+ loading |
| ONNX Runtime Web | WebGPU/WebGL/WebNN | Microsoft ecosystem (Phi) |

## Decision Record

- **Why not browser SpeechRecognition API?** It bypasses WebRTC AEC — microphone hears TTS output, creating feedback loop
- **Why not cloud STT (Deepgram etc.)?** Goal is to keep all audio local, only send text to Claude
- **Why not local LLM instead of Claude?** 2-3B browser models hallucinate 25-30% on domain-specific knowledge. Aviation safety requires Claude-class accuracy with RAG
- **Why WebRTC AEC?** Industry standard, free, built into every browser. All commercial voice AI solutions use it