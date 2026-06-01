// Detect RSS feeds from <link> tags in the page head
function detectRssFeeds(): { title: string; url: string }[] {
  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[type="application/rss+xml"], link[type="application/atom+xml"]'
  );
  const results: { title: string; url: string }[] = [];
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    const url = href.startsWith("http") ? href : new URL(href, location.href).href;
    results.push({ title: link.title || document.title, url });
  });
  return results;
}

// Element picker — highlights on hover, returns a CSS selector on click
let pickerActive = false;
let highlighted: Element | null = null;
let overlay: HTMLDivElement | null = null;

function getCssSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    let selector = cur.tagName.toLowerCase();
    if (cur.className && typeof cur.className === "string") {
      const classes = cur.className.trim().split(/\s+/).slice(0, 2);
      selector += "." + classes.map((c) => CSS.escape(c)).join(".");
    }
    parts.unshift(selector);
    cur = cur.parentElement;
    if (parts.length >= 3) break;
  }
  return parts.join(" > ");
}

function createOverlay() {
  overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    background: rgba(99, 102, 241, 0.25);
    border: 2px solid rgb(99, 102, 241);
    border-radius: 2px;
    transition: all 0.1s;
    box-sizing: border-box;
  `;
  document.body.appendChild(overlay);
}

function moveOverlay(el: Element) {
  if (!overlay) return;
  const rect = el.getBoundingClientRect();
  overlay.style.top = rect.top + "px";
  overlay.style.left = rect.left + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
}

function onMouseOver(e: MouseEvent) {
  const target = e.target as Element;
  if (!target || target === document.body) return;
  highlighted = target;
  moveOverlay(target);
}

function onMouseOut() {
  highlighted = null;
  if (overlay) overlay.style.width = "0";
}

function onClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (!highlighted) return;
  const selector = getCssSelector(highlighted);
  const value = highlighted.textContent?.trim() || "";
  stopPicker();
  chrome.runtime.sendMessage({ type: "ELEMENT_PICKED", selector, value });
}

function stopPicker() {
  pickerActive = false;
  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("mouseout", onMouseOut, true);
  document.removeEventListener("click", onClick, true);
  overlay?.remove();
  overlay = null;
  document.body.style.cursor = "";
}

function startPicker() {
  if (pickerActive) return;
  pickerActive = true;
  createOverlay();
  document.body.style.cursor = "crosshair";
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  document.addEventListener("click", onClick, true);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_PAGE_INFO") {
    const feeds = detectRssFeeds();
    sendResponse({ url: location.href, title: document.title, feeds });
    return true;
  }
  if (msg.type === "START_PICKER") startPicker();
  if (msg.type === "STOP_PICKER") stopPicker();
});

export {};
