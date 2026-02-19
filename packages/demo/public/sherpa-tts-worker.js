/**
 * Web Worker for sherpa-onnx WASM text-to-speech.
 * Runs all WASM compilation, model loading, and synthesis off the main thread.
 *
 * Messages IN (from main thread):
 *   { type: 'init', assetPath?: string }                                      — load WASM + model
 *   { type: 'speak', text: string, sid?: number, speed?: number, id: number } — synthesize speech
 *   { type: 'destroy' }                                                       — free resources
 *
 * Messages OUT (to main thread):
 *   { type: 'ready', numSpeakers: number }                              — TTS engine ready
 *   { type: 'audio', samples: Float32Array, sampleRate: number, id: number } — synthesized audio chunk
 *   { type: 'done', id: number }                                        — all chunks for this id sent
 *   { type: 'error', message: string }                                  — error
 */

/* global importScripts, createOfflineTts */

let tts = null;

self.onmessage = function (e) {
  const msg = e.data;

  if (msg.type === 'init') {
    doInit(msg.assetPath);
  } else if (msg.type === 'speak') {
    doSpeak(msg.text, msg.sid || 0, msg.speed || 1.0, msg.id);
  } else if (msg.type === 'destroy') {
    doDestroy();
  }
};

function doInit(assetPath) {
  var basePath = assetPath || '/sherpa-onnx-tts/';
  if (basePath[basePath.length - 1] !== '/') basePath += '/';

  try {
    self.Module = {
      locateFile: function (path) {
        return basePath + path;
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
    importScripts(basePath + 'sherpa-onnx-wasm-main-tts.js');
    importScripts(basePath + 'sherpa-onnx-tts.js');
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
}

/**
 * Split text into sentences and synthesize each one separately,
 * sending audio chunks back as soon as each is ready.
 */
function doSpeak(text, sid, speed, id) {
  if (!tts) return;

  try {
    // Split on sentence-ending punctuation followed by whitespace (or end)
    var sentences = text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g);
    if (!sentences) sentences = [text];

    var sampleRate = tts.sampleRate;

    for (var i = 0; i < sentences.length; i++) {
      var sentence = sentences[i].trim();
      if (!sentence) continue;

      var audio = tts.generate({ text: sentence, sid: sid, speed: speed });
      self.postMessage(
        { type: 'audio', samples: audio.samples, sampleRate: sampleRate, id: id },
        [audio.samples.buffer]
      );
    }

    self.postMessage({ type: 'done', id: id });
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
