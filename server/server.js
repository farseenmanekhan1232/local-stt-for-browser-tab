const WebSocket = require("ws");
const DeepSpeech = require("deepspeech");
const libsamplerate = require("libsamplerate.js");

const modelPath = "./models/deepspeech-0.9.3-models.pbmm";
const scorerPath = "./models/deepspeech-0.9.3-models.scorer";
const model = new DeepSpeech.Model(modelPath);
model.enableExternalScorer(scorerPath);

const server = new WebSocket.Server({ port: 8080 });

server.on("connection", (ws) => {
  let sampleRate;
  let sttStream;

  ws.on("message", (message) => {
    if (typeof message === "string") {
      const data = JSON.parse(message);
      if (data.type === "start") {
        sampleRate = data.sampleRate;
        sttStream = model.createStream();
        console.log(`Started transcription with sample rate: ${sampleRate} Hz`);
      } else if (data.type === "stop") {
        if (sttStream) {
          const transcription = sttStream.finishStream();
          console.log("Final transcription:", transcription);
          ws.send(
            JSON.stringify({ type: "transcription", text: transcription })
          );
          sttStream = null;
        }
      }
    } else {
      const int16Array = new Int16Array(
        message.buffer,
        message.byteOffset,
        message.byteLength / 2
      );
      const floatArray = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        floatArray[i] = int16Array[i] / 32768;
      }
      const resampledFloat = libsamplerate.resample(
        floatArray,
        sampleRate,
        16000,
        1
      );
      const resampledInt16 = floatToInt16(resampledFloat);
      const buffer = Buffer.from(resampledInt16.buffer);
      if (sttStream) {
        sttStream.feedAudioContent(buffer);
        const interim = sttStream.intermediateDecode();
        if (interim) {
          console.log("Interim transcription:", interim);
          ws.send(JSON.stringify({ type: "transcription", text: interim }));
        }
      }
    }
  });

  ws.on("close", () => {
    if (sttStream) {
      const transcription = sttStream.finishStream();
      console.log("Connection closed. Final transcription:", transcription);
      sttStream = null;
    }
  });
});

function floatToInt16(floatArray) {
  const int16Array = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i++) {
    int16Array[i] = Math.max(
      -32768,
      Math.min(32767, Math.round(floatArray[i] * 32768))
    );
  }
  return int16Array;
}

console.log("WebSocket server running on ws://localhost:8080");
