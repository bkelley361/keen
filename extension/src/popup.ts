import { db, id, tx } from "./db";

// ── helpers ────────────────────────────────────────────────────────────────

function $(sel: string) { return document.querySelector(sel) as HTMLElement; }
function show(el: HTMLElement | null) { if (el) el.style.display = ""; }
function hide(el: HTMLElement | null) { if (el) el.style.display = "none"; }

function setMsg(elId: string, text: string, type: "success" | "error" | "") {
  const el = $(elId);
  el.textContent = text;
  el.className = text ? `msg msg-${type}` : "";
}

// ── tab switching ──────────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab!;
    hide($("#tab-monitor"));
    hide($("#tab-feed"));
    show($(`#tab-${tab}`));
  });
});

// ── auth ───────────────────────────────────────────────────────────────────

let currentEmail = "";

$("#send-code-btn").addEventListener("click", async () => {
  const email = ($("#auth-email") as HTMLInputElement).value.trim();
  if (!email) return;
  currentEmail = email;
  setMsg("#auth-msg", "", "");
  try {
    await db.auth.sendMagicCode({ email });
    hide($("#email-step"));
    show($("#code-step"));
  } catch {
    setMsg("#auth-msg", "Failed to send code. Try again.", "error");
  }
});

$("#verify-code-btn").addEventListener("click", async () => {
  const code = ($("#auth-code") as HTMLInputElement).value.trim();
  if (!code) return;
  setMsg("#auth-msg", "", "");
  try {
    await db.auth.signInWithMagicCode({ email: currentEmail, code });
    // subscribeAuth in background will persist userId; popup will re-render
  } catch {
    setMsg("#auth-msg", "Invalid code. Try again.", "error");
  }
});

$("#back-to-email-btn").addEventListener("click", () => {
  hide($("#code-step"));
  show($("#email-step"));
  setMsg("#auth-msg", "", "");
});

// ── sign out ───────────────────────────────────────────────────────────────

$("#signout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  chrome.storage.local.remove(["userId", "userEmail"]);
  renderAuth();
});

// ── element picker ─────────────────────────────────────────────────────────

let picking = false;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

$("#pick-btn").addEventListener("click", async () => {
  picking = true;
  show($("#picking-banner"));
  hide($("#pick-btn"));
  const tab = await getActiveTab();
  await chrome.tabs.sendMessage(tab.id!, { type: "START_PICKER" });
  window.close(); // close popup so user can interact with the page
});

$("#cancel-pick-btn").addEventListener("click", async () => {
  picking = false;
  hide($("#picking-banner"));
  show($("#pick-btn"));
  const tab = await getActiveTab();
  await chrome.tabs.sendMessage(tab.id!, { type: "STOP_PICKER" });
});

// Listen for picked element (sent from content → background → popup via storage)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.pickedSelector) {
    const selector = changes.pickedSelector.newValue as string;
    ($("#mon-selector") as HTMLInputElement).value = selector;
    picking = false;
    hide($("#picking-banner"));
    show($("#pick-btn"));
    chrome.storage.local.remove("pickedSelector");
  }
});

// ── page info ──────────────────────────────────────────────────────────────

async function loadPageInfo() {
  try {
    const tab = await getActiveTab();

    // Autofill URL and name immediately from tab info — no content script needed
    if (tab.url) ($("#mon-url") as HTMLInputElement).value = tab.url;
    if (tab.title) {
      ($("#mon-name") as HTMLInputElement).value = tab.title;
      ($("#feed-name") as HTMLInputElement).value = tab.title;
    }

    // Ask content script for detected RSS feeds
    if (!tab.id) return;
    const response: { url: string; title: string; feeds: { title: string; url: string }[] } =
      await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });

    const container = $("#detected-feeds");
    container.innerHTML = "";
    if (response.feeds.length > 0) {
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = "Detected feeds";
      container.appendChild(label);

      response.feeds.forEach((f) => {
        const pill = document.createElement("div");
        pill.className = "feed-pill";
        pill.innerHTML = `<span>${f.title || f.url}</span><span class="feed-pill-use">Use →</span>`;
        pill.addEventListener("click", () => {
          ($("#feed-url") as HTMLInputElement).value = f.url;
          ($("#feed-name") as HTMLInputElement).value = f.title || response.title;
        });
        container.appendChild(pill);
      });

      // Auto-fill feed URL if exactly one detected
      if (response.feeds.length === 1) {
        ($("#feed-url") as HTMLInputElement).value = response.feeds[0].url;
        ($("#feed-name") as HTMLInputElement).value = response.feeds[0].title || response.title;
      }
    }
  } catch {
    // content script not available on this page (e.g. chrome:// urls), that's fine
  }
}

// ── add monitor ────────────────────────────────────────────────────────────

$("#add-monitor-btn").addEventListener("click", async () => {
  const name = ($("#mon-name") as HTMLInputElement).value.trim();
  const url = ($("#mon-url") as HTMLInputElement).value.trim();
  const selector = ($("#mon-selector") as HTMLInputElement).value.trim();
  const type = ($("#mon-type") as HTMLSelectElement).value;

  if (!name || !url) { setMsg("#main-msg", "Name and URL are required.", "error"); return; }
  if (type === "webpage" && !selector) { setMsg("#main-msg", "CSS selector is required for web page monitors.", "error"); return; }

  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) { setMsg("#main-msg", "Not signed in.", "error"); return; }

  try {
    const monitorId = id();
    await db.transact(
      tx.monitors[monitorId].update({
        userId,
        name,
        type,
        url,
        selector: type === "webpage" ? selector : "",
        clickSelector: "",
        lastValue: "",
        lastChecked: 0,
        active: true,
        createdAt: Date.now(),
      })
    );
    setMsg("#main-msg", "Monitor added!", "success");
    ($("#mon-name") as HTMLInputElement).value = "";
    ($("#mon-selector") as HTMLInputElement).value = "";
  } catch {
    setMsg("#main-msg", "Failed to add monitor.", "error");
  }
});

// ── add feed ───────────────────────────────────────────────────────────────

$("#add-feed-btn").addEventListener("click", async () => {
  const name = ($("#feed-name") as HTMLInputElement).value.trim();
  const feedUrl = ($("#feed-url") as HTMLInputElement).value.trim();

  if (!name || !feedUrl) { setMsg("#main-msg", "Name and feed URL are required.", "error"); return; }

  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) { setMsg("#main-msg", "Not signed in.", "error"); return; }

  try {
    const feedId = id();
    await db.transact(
      tx.feeds[feedId].update({
        userId,
        name,
        feedUrl,
        active: true,
        lastFetch: 0,
        itemCount: 0,
        createdAt: Date.now(),
      })
    );
    setMsg("#main-msg", "Feed added!", "success");
    ($("#feed-name") as HTMLInputElement).value = "";
    ($("#feed-url") as HTMLInputElement).value = "";
  } catch {
    setMsg("#main-msg", "Failed to add feed.", "error");
  }
});

// ── render ─────────────────────────────────────────────────────────────────

function renderAuth() {
  hide($("#spinner"));
  hide($("#main-view"));
  show($("#auth-view"));
  hide($("#signout-btn"));
  $("#header-email").textContent = "";
  show($("#email-step"));
  hide($("#code-step"));
}

function renderMain(email: string) {
  hide($("#spinner"));
  hide($("#auth-view"));
  show($("#main-view"));
  show($("#signout-btn"));
  $("#header-email").textContent = email;
  loadPageInfo();
}

// ── init ───────────────────────────────────────────────────────────────────

db.subscribeAuth((auth) => {
  if (auth.user) {
    renderMain(auth.user.email ?? "");
  } else {
    renderAuth();
  }
});

// Forward picked element from background storage
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "ELEMENT_PICKED") {
    chrome.storage.local.set({ pickedSelector: msg.selector });
  }
});
