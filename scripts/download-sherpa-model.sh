#!/usr/bin/env bash
# Downloads pre-built sherpa-onnx WASM + model files from HuggingFace.
# Run once after cloning: bash scripts/download-sherpa-model.sh

set -euo pipefail

DEST="packages/demo/public/sherpa-onnx-asr"
BASE_URL="https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en/resolve/main"

FILES=(
  "sherpa-onnx-asr.js"
  "sherpa-onnx-wasm-main-asr.js"
  "sherpa-onnx-wasm-main-asr.wasm"
  "sherpa-onnx-wasm-main-asr.data"
)

mkdir -p "$DEST"

for file in "${FILES[@]}"; do
  if [ -f "$DEST/$file" ]; then
    echo "Already exists: $DEST/$file — skipping"
  else
    echo "Downloading $file ..."
    curl -L --progress-bar -o "$DEST/$file" "$BASE_URL/$file"
  fi
done

echo ""
echo "STT files in $DEST:"
ls -lh "$DEST"

# --- TTS model ---
TTS_DEST="packages/demo/public/sherpa-onnx-tts"
TTS_BASE_URL="https://huggingface.co/spaces/k2-fsa/web-assembly-tts-sherpa-onnx-en/resolve/main"

TTS_FILES=(
  "sherpa-onnx-tts.js"
  "sherpa-onnx-wasm-main-tts.js"
  "sherpa-onnx-wasm-main-tts.wasm"
  "sherpa-onnx-wasm-main-tts.data"
)

mkdir -p "$TTS_DEST"

for file in "${TTS_FILES[@]}"; do
  if [ -f "$TTS_DEST/$file" ]; then
    echo "Already exists: $TTS_DEST/$file — skipping"
  else
    echo "Downloading $file ..."
    curl -L --progress-bar -o "$TTS_DEST/$file" "$TTS_BASE_URL/$file"
  fi
done

echo ""
echo "TTS files in $TTS_DEST:"
ls -lh "$TTS_DEST"
