chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start-ui") {
    createTranscriptionSidebar();
  } else if (message.action === "stop-ui") {
    removeTranscriptionSidebar();
  } else if (message.type === "transcription-data") {
    const data = JSON.parse(message.data);
    if (data.type === "transcription") {
      updateTranscriptionContainer(data.text);
    }
  } else if (message.type === "transcription-error") {
    updateTranscriptionContainer(message.message);
  }
});

function createTranscriptionSidebar() {
  if (document.getElementById("transcription-sidebar")) return; // Don't create if it exists

  const sidebar = document.createElement("div");
  sidebar.id = "transcription-sidebar";
  sidebar.style.position = "fixed"; // Use 'fixed' to stay in place when scrolling
  sidebar.style.top = "0";
  sidebar.style.right = "0";
  sidebar.style.width = "300px";
  sidebar.style.height = "100vh";
  sidebar.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  sidebar.style.borderLeft = "1px solid #ccc";
  sidebar.style.padding = "10px";
  sidebar.style.boxSizing = "border-box";
  sidebar.style.overflowY = "auto";
  sidebar.style.zIndex = "99999999"; // Ensure it's on top
  sidebar.style.fontFamily = "sans-serif";
  sidebar.style.fontSize = "14px";
  sidebar.style.lineHeight = "1.5";

  const content = document.createElement("p");
  content.id = "transcription-content";
  content.textContent = "Starting transcription...";
  sidebar.appendChild(content);

  document.body.appendChild(sidebar);
}

function updateTranscriptionContainer(text) {
  const content = document.getElementById("transcription-content");
  if (content) {
    content.textContent = text;
  }
}

function removeTranscriptionSidebar() {
  const sidebar = document.getElementById("transcription-sidebar");
  if (sidebar) {
    sidebar.remove();
  }
}
