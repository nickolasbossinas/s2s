/**
 * Web Worker for sherpa-onnx WASM text-to-speech.
 * Runs all WASM compilation, model loading, and synthesis off the main thread.
 *
 * Messages IN (from main thread):
 *   { type: 'init' }                                          — load WASM + model
 *   { type: 'speak', text: string, sid?: number, speed?: number } — synthesize speech
 *   { type: 'destroy' }                                       — free resources
 *
 * Messages OUT (to main thread):
 *   { type: 'ready', numSpeakers: number }                    — TTS engine ready
 *   { type: 'audio', samples: Float32Array, sampleRate: number } — synthesized audio
 *   { type: 'error', message: string }                        — error
 */

/* global importScripts, createOfflineTts */

let tts = null;

self.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === 'init') {
    doInit();
  } else if (msg.type === 'speak') {
    doSpeak(msg.text, msg.sid || 0, msg.speed || 1.0);
  } else if (msg.type === 'destroy') {
    doDestroy();
  }
};

function doInit() {
  try {
    self.Module = {
      locateFile: function (path) {
        return '/sherpa-onnx-tts/' + path;
      },
      setStatus: function () {
        // no-op in worker
      },
      onRuntimeInitialized: function () {
        try {
          if (typeof createOfflineTts === 'undefined') {
            self.postMessage({
              type: 'error',
              message: 'createOfflineTts not found — sherpa-onnx-tts.js may not have loaded',
            });
            return;
          }

          // Pass explicit config because the downloaded sherpa-onnx-tts.js
          // may not match the model filenames baked into the .data package.
          var ttsConfig = {
            offlineTtsModelConfig: {
              offlineTtsVitsModelConfig: {
                model: './en_US-libritts_r-medium.onnx',
                lexicon: '',
                tokens: './tokens.txt',
                dataDir: './espeak-ng-data',
                noiseScale: 0.667,
                noiseScaleW: 0.8,
                lengthScale: 1.0,
              },
              offlineTtsMatchaModelConfig: {
                acousticModel: '',
                vocoder: '',
                lexicon: '',
                tokens: '',
                dataDir: '',
                noiseScale: 0.667,
                lengthScale: 1.0,
              },
              offlineTtsKokoroModelConfig: {
                model: '',
                voices: '',
                tokens: '',
                dataDir: '',
                lengthScale: 1.0,
                lexicon: '',
                lang: '',
              },
              offlineTtsKittenModelConfig: {
                model: '',
                voices: '',
                tokens: '',
                dataDir: '',
                lengthScale: 1.0,
              },
              numThreads: 1,
              debug: 0,
              provider: 'cpu',
            },
            ruleFsts: '',
            ruleFars: '',
            maxNumSentences: 1,
          };

          tts = createOfflineTts(self.Module, ttsConfig);
          self.postMessage({
            type: 'ready',
            numSpeakers: tts.numSpeakers || 0,
          });
        } catch (err) {
          self.postMessage({ type: 'error', message: err.message || String(err) });
        }
      },
    };

    // Glue script first (sets up Emscripten Module), then API script
    importScripts('/sherpa-onnx-tts/sherpa-onnx-wasm-main-tts.js');
    importScripts('/sherpa-onnx-tts/sherpa-onnx-tts.js');
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
}

function doSpeak(text, sid, speed) {
  if (!tts) return;

  try {
    var audio = tts.generate({ text: text, sid: sid, speed: speed });
    self.postMessage(
      { type: 'audio', samples: audio.samples, sampleRate: tts.sampleRate },
      [audio.samples.buffer]
    );
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
}

function doDestroy() {
  try {
    if (tts) {
      tts.free();
      tts = null;
    }
  } catch (_) {
    // ignore cleanup errors
  }
  self.close();
}
