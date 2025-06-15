let socket;
let stream;
let audioContext;

const keepAliveInterval = setInterval(() => {
  chrome.runtime.sendMessage({ type: "keep-alive" });
}, 20000);

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === "start-capture") {
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      console.log("Capture is already in progress or connecting.");
      return;
    }
    await startCapture(message.streamId);
  } else if (message.action === "stop-capture") {
    await stopCapture();
  }
});

async function startCapture(streamId) {
  console.log("OFFSCREEN: Attempting startCapture for streamId:", streamId);
  try {
    console.log(
      "OFFSCREEN: Creating new WebSocket connection to ws://localhost:8080..."
    );
    socket = new WebSocket("ws://localhost:8080");

    socket.onopen = async () => {
      // **** THIS IS THE MOST IMPORTANT LOG ****
      // If you don't see this, the connection failed.
      console.log("OFFSCREEN: WebSocket connection opened successfully.");

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
          },
        },
      });

      console.log("OFFSCREEN: Media stream acquired.");

      audioContext = new AudioContext();
      const sampleRate = audioContext.sampleRate;
      const source = audioContext.createMediaStreamSource(stream);

      await audioContext.audioWorklet.addModule("audio-processor.js");
      const audioWorkletNode = new AudioWorkletNode(
        audioContext,
        "audio-processor"
      );

      audioWorkletNode.port.onmessage = (event) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };

      // This line enables audio playback. It will only run if the connection succeeds.
      source.connect(audioWorkletNode).connect(audioContext.destination);
      console.log(
        "OFFSCREEN: Audio graph connected for processing and playback."
      );

      socket.send(JSON.stringify({ type: "start", sampleRate: sampleRate }));
    };

    socket.onmessage = (event) => {
      console.log("OFFSCREEN: Received message from server:", event.data);
      chrome.runtime.sendMessage({
        type: "transcription-data",
        data: event.data,
      });
    };

    // --- ADDED DETAILED ERROR AND CLOSE LOGGING ---
    socket.onerror = (error) => {
      console.error(
        "OFFSCREEN: WebSocket error observed. Check if the server is running and accessible.",
        error
      );
      chrome.runtime.sendMessage({
        type: "transcription-error",
        message: "Error: WebSocket connection failed. Is the server running?",
      });
    };

    socket.onclose = (event) => {
      console.log(
        `OFFSCREEN: WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`
      );
    };
  } catch (error) {
    console.error(
      "OFFSCREEN: A critical error occurred in the startCapture function:",
      error
    );
  }
}

async function stopCapture() {
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
    console.log("OFFSCREEN: AudioContext closed.");
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (socket) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop" }));
    }
    socket.close();
    socket = null;
  }
  console.log("OFFSCREEN: Capture stopped. Closing offscreen document.");
  window.close();
}
