chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start") {
    const tabId = message.tabId;
    chrome.tabs.sendMessage(tabId, { action: "start" });
  } else if (message.action === "stop") {
    const tabId = message.tabId;
    chrome.tabs.sendMessage(tabId, { action: "stop" });
  }
});
