# S2S — Full-Duplex Speech-to-Speech

A full-duplex voice interface running STT and TTS locally in the browser via WebAssembly, with Claude as the cloud LLM. See [talk.md](talk.md) for architecture details.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the chatbot page uses a mock LLM that echoes your input.

## Project Structure

```
src/
  components/Chat/   — Chat UI components
  services/llm.ts    — LLM service (currently mock, will become Claude API)
  types/chat.ts      — Shared TypeScript types
```

## Tech Stack

- React 19 + TypeScript + Vite
- CSS Modules (zero-dependency styling)
