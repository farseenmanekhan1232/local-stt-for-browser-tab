let socket;
let stream;
let audioContext;
let processor;

function startCapture() {
  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    chrome.tabCapture.capture(
      { audio: true, video: false },
      (captureStream) => {
        if (!captureStream) {
          console.error("Failed to capture audio");
          return;
        }
        stream = captureStream;
        audioContext = new AudioContext();
        const sampleRate = audioContext.sampleRate;
        const source = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioContext.destination);
        processor.onaudioprocess = (e) => {
          const floatData = e.inputBuffer.getChannelData(0);
          const int16Data = floatToInt16(floatData);
          socket.send(int16Data.buffer);
        };
        socket.send(JSON.stringify({ type: "start", sampleRate: sampleRate }));
      }
    );
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "transcription") {
      updateTranscriptionContainer(data.text);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    updateTranscriptionContainer("Error: WebSocket connection failed");
  };

  createTranscriptionSidebar();
}

function stopCapture() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (audioContext) {
    audioContext.close().then(() => {
      audioContext = null;
    });
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (socket) {
    socket.send(JSON.stringify({ type: "stop" }));
    socket.close();
    socket = null;
  }
  removeTranscriptionSidebar();
}

function createTranscriptionSidebar() {
  const sidebar = document.createElement("div");
  sidebar.id = "transcription-sidebar";
  sidebar.style.position = "absolute";
  sidebar.style.top = "0";
  sidebar.style.right = "0";
  sidebar.style.width = "300px";
  sidebar.style.height = "100vh";
  sidebar.style.backgroundColor = "white";
  sidebar.style.borderLeft = "1px solid black";
  sidebar.style.padding = "10px";
  sidebar.style.overflowY = "auto";
  sidebar.textContent = "Transcription: ";
  document.body.appendChild(sidebar);

  // Adjust page content to prevent overlap
  document.body.style.marginRight = "300px";
}

function updateTranscriptionContainer(text) {
  const sidebar = document.getElementById("transcription-sidebar");
  if (sidebar) {
    sidebar.textContent = "Transcription: " + text;
  }
}

function removeTranscriptionSidebar() {
  const sidebar = document.getElementById("transcription-sidebar");
  if (sidebar) {
    sidebar.remove();
  }
  // Restore original layout
  document.body.style.marginRight = "0";
}

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start") {
    startCapture();
  } else if (message.action === "stop") {
    stopCapture();
  }
});
