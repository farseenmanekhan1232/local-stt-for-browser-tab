const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");

startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.runtime.sendMessage({ action: "start", tabId: tabId });
  });
});

stopBtn.addEventListener("click", () => {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.runtime.sendMessage({ action: "stop", tabId: tabId });
  });
});
