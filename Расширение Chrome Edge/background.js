const defaultHosts = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com"
];

async function getSettings() {
  return await chrome.storage.sync.get({ enabled: true, hosts: defaultHosts });
}

function isBlocked(url, hosts) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return hosts.some(domain => {
      domain = domain.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0];
      return domain && (host === domain || host.endsWith("." + domain));
    });
  } catch (_) {
    return false;
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const settings = await getSettings();
  if (!settings.enabled || !isBlocked(details.url, settings.hosts)) return;
  const target = chrome.runtime.getURL("block.html") + "?site=" + encodeURIComponent(details.url);
  chrome.tabs.update(details.tabId, { url: target });
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get(["enabled", "hosts"]);
  await chrome.storage.sync.set({
    enabled: settings.enabled ?? true,
    hosts: settings.hosts?.length ? settings.hosts : defaultHosts
  });
});
