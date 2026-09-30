(() => {
  if (window.__focusModeContentLoaded) return;
  window.__focusModeContentLoaded = true;

  const defaultHosts = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
  let overlay = null;
  let originalTitle = null;
  let titleObserver = null;
  const mediaStates = new Map();

  function lockTitle() {
    if (originalTitle === null) originalTitle = document.title;
    document.title = "Доступ ограничен";
    const titleNode = document.querySelector("title") || document.head?.appendChild(document.createElement("title"));
    titleObserver?.disconnect();
    if (titleNode) {
      titleObserver = new MutationObserver(() => {
        if (overlay && document.title !== "Доступ ограничен") document.title = "Доступ ограничен";
      });
      titleObserver.observe(titleNode, { childList: true, characterData: true, subtree: true });
    }
  }

  function isBlocked(hosts) {
    const host = location.hostname.toLowerCase();
    return hosts.some((value) => {
      const domain = value.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0];
      return domain && (host === domain || host.endsWith("." + domain));
    });
  }

  function stopMedia() {
    document.querySelectorAll("video, audio").forEach((media) => {
      if (!mediaStates.has(media)) mediaStates.set(media, { muted: media.muted, paused: media.paused });
      media.pause();
      media.muted = true;
    });
  }

  function restoreMedia() {
    for (const [media, state] of mediaStates) {
      media.muted = state.muted;
      if (!state.paused) media.play().catch(() => {});
    }
    mediaStates.clear();
  }

  function showOverlay() {
    if (overlay) return;
    stopMedia();
    lockTitle();
    overlay = document.createElement("div");
    overlay.id = "focus-mode-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      width: "100vw",
      height: "100vh",
      background: "#090909",
      pointerEvents: "auto"
    });
    const frame = document.createElement("iframe");
    frame.src = chrome.runtime.getURL("block.html?overlay=1&site=" + encodeURIComponent(location.href));
    Object.assign(frame.style, {
      width: "100%",
      height: "100%",
      border: "0",
      display: "block"
    });
    frame.setAttribute("title", "Доступ ограничен");
    overlay.appendChild(frame);
    (document.documentElement || document.body).appendChild(overlay);
  }

  function hideOverlay() {
    restoreMedia();
    overlay?.remove();
    overlay = null;
    titleObserver?.disconnect();
    titleObserver = null;
    if (originalTitle !== null) {
      document.title = originalTitle;
      originalTitle = null;
    }
  }

  function apply(settings) {
    if (settings.enabled && isBlocked(settings.hosts)) showOverlay();
    else hideOverlay();
  }

  chrome.storage.sync.get({ enabled: true, hosts: defaultHosts }, apply);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || (!changes.enabled && !changes.hosts)) return;
    chrome.storage.sync.get({ enabled: true, hosts: defaultHosts }, apply);
  });
})();
