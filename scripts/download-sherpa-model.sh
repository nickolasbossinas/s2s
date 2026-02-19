#!/usr/bin/env bash
# Downloads pre-built sherpa-onnx WASM + model files from HuggingFace.
# Run once after cloning: bash scripts/download-sherpa-model.sh

set -euo pipefail

DEST="public/sherpa-onnx-asr"
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
echo "Done. Files in $DEST:"
ls -lh "$DEST"
