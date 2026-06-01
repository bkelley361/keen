import { db } from "./db";

// Keep auth state synced to chrome.storage so popup can read it
db.subscribeAuth((auth) => {
  if (auth.user) {
    chrome.storage.local.set({ userId: auth.user.id, userEmail: auth.user.email });
  } else {
    chrome.storage.local.remove(["userId", "userEmail"]);
  }
});

// Forward element picker result from content script to storage (popup reads it)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "ELEMENT_PICKED") {
    chrome.storage.local.set({ pickedSelector: msg.selector });
  }
  // Forward page info to popup
  if (msg.type === "PAGE_INFO") {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});

export {};
