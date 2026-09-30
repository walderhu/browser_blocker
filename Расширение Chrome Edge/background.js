const defaultHosts = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com"
];

async function getSettings() {
  return await chrome.storage.sync.get({ enabled: true, hosts: defaultHosts });
}

async function enforceOnOpenTabs() {
  const settings = await getSettings();
  if (!settings.enabled) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    await injectIntoTab(tab, settings);
  }
}

async function injectIntoTab(tab, settings = null) {
  const current = settings || await getSettings();
  if (!current.enabled || !tab?.id || !tab.url || !isBlocked(tab.url, current.hosts)) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (_) {
    // Браузерные служебные страницы не разрешают инъекцию скриптов.
  }
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

// Если защита была включена, пока заблокированный сайт уже был открыт,
// сразу заменяем такую вкладку страницей блокировки и выключаем звук.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enabled?.newValue === true) enforceOnOpenTabs();
});

// Дополнительная проверка для вкладок, открытых до включения защиты.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await injectIntoTab(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") await injectIntoTab(tab);
});
