import { pipeline } from "@xenova/transformers";
import { WebSocketServer } from "ws";
// --- THE FINAL FIX ---
// The default import is an object containing the library's exports.
// We import the whole object and then access the .create function from it.
import sampleRateConverter from "@alexanderolsen/libsamplerate-js";

// --- TRANSFORMERS.JS (WHISPER) SETUP ---
// This will download the model on the first run.
console.log("Loading speech-to-text model... This may take a moment.");
const transcriber = await pipeline(
  "automatic-speech-recognition",
  "Xenova/whisper-small"
);
console.log("Model loaded successfully.");
// --- END SETUP ---

const server = new WebSocketServer({ port: 8080 });
console.log("WebSocket server running on ws://localhost:8080");

server.on("connection", (ws) => {
  console.log("SERVER: New client connected.");
  let resampler = null;

  ws.on("message", async (message) => {
    let command;
    try {
      command = JSON.parse(message.toString());
    } catch (e) {
      /* Not a command, must be audio */
    }

    if (command && command.type === "start") {
      const sampleRate = command.sampleRate;
      console.log(
        `SERVER: Start command received. Input sample rate: ${sampleRate} Hz`
      );

      if (sampleRate !== 16000) {
        try {
          // This call will now work correctly by accessing the 'create' property.
          resampler = await sampleRateConverter.create(1, sampleRate, 16000);
          console.log("SERVER: Audio resampler created.");
        } catch (e) {
          console.error("SERVER: Error creating resampler:", e);
          resampler = null;
        }
      }
    } else if (command && command.type === "stop") {
      console.log("SERVER: Stop command received.");
    } else {
      // This block handles the binary audio data.
      try {
        const int16Array = new Int16Array(
          message.buffer,
          message.byteOffset,
          message.byteLength / 2
        );
        let floatArray = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          floatArray[i] = int16Array[i] / 32768;
        }

        // Resample if necessary
        if (resampler) {
          floatArray = resampler.full(floatArray);
        }

        // Transcribe the audio
        const output = await transcriber(floatArray, {
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        const transcription = output.text;
        if (transcription) {
          console.log(`SERVER: Sending transcription: "${transcription}"`);
          ws.send(
            JSON.stringify({ type: "transcription", text: transcription })
          );
        }
      } catch (error) {
        console.error("SERVER: CRITICAL ERROR during audio processing:", error);
      }
    }
  });

  ws.on("close", () => {
    console.log("SERVER: Client disconnected.");
    if (resampler) {
      resampler.destroy();
      resampler = null;
    }
  });
});
