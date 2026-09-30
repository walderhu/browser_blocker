(() => {
  if (window.__focusModeContentLoaded) return;
  window.__focusModeContentLoaded = true;

  const defaultHosts = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
  let overlay = null;

  function isBlocked(hosts) {
    const host = location.hostname.toLowerCase();
    return hosts.some((value) => {
      const domain = value.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0];
      return domain && (host === domain || host.endsWith("." + domain));
    });
  }

  function stopMedia() {
    document.querySelectorAll("video, audio").forEach((media) => {
      media.pause();
      media.muted = true;
    });
  }

  function showOverlay() {
    if (overlay) return;
    stopMedia();
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
    overlay?.remove();
    overlay = null;
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
