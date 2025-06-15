let creating;

chrome.runtime.onMessage.addListener(handleMessages);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "keep-alive") {
    // This log is very noisy, so we can comment it out now that we know it works.
    // console.log("Received keep-alive message from offscreen document.");
  } else if (
    message.type === "transcription-data" ||
    message.type === "transcription-error"
  ) {
    forwardToContentScript(message);
  }
});

async function handleMessages(message, sender, sendResponse) {
  if (message.action === "start") {
    await startCapture(message.tabId);
  } else if (message.action === "stop") {
    await stopCapture(message.tabId);
  }
}

async function sendMessageToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn(`Could not send message to tab ${tabId}.`, error.message);
  }
}

async function forwardToContentScript(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await sendMessageToTab(tab.id, message);
  }
}

async function startCapture(tabId) {
  // --- NEW: Programmatically inject the content script to ensure it's ready ---
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });
  } catch (err) {
    console.error("Failed to inject content script:", err);
    return; // Stop if injection fails
  }
  // --- END NEW ---

  // Now that the script is injected, we can safely send the message to create the UI.
  await sendMessageToTab(tabId, { action: "start-ui" });

  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  });

  await setupOffscreenDocument("offscreen.html");

  chrome.runtime.sendMessage({
    action: "start-capture",
    streamId: streamId,
  });
}

async function stopCapture(tabId) {
  await sendMessageToTab(tabId, { action: "stop-ui" });
  chrome.runtime.sendMessage({ action: "stop-capture" });
}

async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existingContexts.length > 0) {
    return;
  }
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ["USER_MEDIA"],
      justification: "To process audio from tabCapture stream",
    });
    await creating;
    creating = null;
  }
}
