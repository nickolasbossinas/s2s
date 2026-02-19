/**
 * Web Worker for sherpa-onnx WASM speech recognition.
 * Runs all WASM compilation, model loading, and recognition off the main thread.
 *
 * Messages IN (from main thread):
 *   { type: 'init', assetPath?: string }      — load WASM + model, create recognizer
 *   { type: 'feed', samples: Float32Array }   — feed 16kHz PCM audio
 *   { type: 'destroy' }                       — free resources
 *
 * Messages OUT (to main thread):
 *   { type: 'ready' }                         — recognizer is ready
 *   { type: 'error', message: string }        — init or runtime error
 *   { type: 'result', text: string, isEndpoint: boolean } — recognition result
 */

/* global importScripts, Module */

let recognizer = null;
let stream = null;

self.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === 'init') {
    doInit(msg.assetPath);
  } else if (msg.type === 'feed') {
    doFeed(msg.samples);
  } else if (msg.type === 'destroy') {
    doDestroy();
  }
};

function doInit(assetPath) {
  var basePath = assetPath || '/sherpa-onnx-asr/';
  if (basePath[basePath.length - 1] !== '/') basePath += '/';

  try {
    // Set up the Emscripten Module object before loading scripts
    self.Module = {
      locateFile: function (path) {
        return basePath + path;
      },
      setStatus: function () {
        // no-op in worker — no UI to update
      },
      onRuntimeInitialized: function () {
        try {
          if (typeof createOnlineRecognizer === 'undefined') {
            self.postMessage({
              type: 'error',
              message: 'createOnlineRecognizer not found — sherpa-onnx-asr.js may not have loaded',
            });
            return;
          }
          recognizer = createOnlineRecognizer(self.Module);
          stream = recognizer.createStream();
          self.postMessage({ type: 'ready' });
        } catch (err) {
          self.postMessage({ type: 'error', message: err.message || String(err) });
        }
      },
    };

    // Load the sherpa-onnx scripts via importScripts (synchronous in workers)
    importScripts(basePath + 'sherpa-onnx-asr.js');
    importScripts(basePath + 'sherpa-onnx-wasm-main-asr.js');
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
}

function doFeed(samples) {
  if (!recognizer || !stream) return;

  try {
    stream.acceptWaveform(16000, samples);

    while (recognizer.isReady(stream)) {
      recognizer.decode(stream);
    }

    var text = recognizer.getResult(stream).text;
    var isEndpoint = recognizer.isEndpoint(stream);

    self.postMessage({ type: 'result', text: text, isEndpoint: isEndpoint });

    if (isEndpoint) {
      recognizer.reset(stream);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
}

function doDestroy() {
  try {
    if (stream) {
      stream.free();
      stream = null;
    }
    if (recognizer) {
      recognizer.free();
      recognizer = null;
    }
  } catch (_) {
    // ignore cleanup errors
  }
  self.close();
}
