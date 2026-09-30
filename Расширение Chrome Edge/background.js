const defaultHosts = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com"
];

async function getSettings() {
  return await chrome.storage.sync.get({ enabled: true, hosts: defaultHosts, mode: "permanent", timerMinutes: 30, timerEndsAt: 0 });
}

async function syncTimer() {
  const settings = await getSettings();
  await chrome.alarms.clear("focusModeEnd");
  if (!settings.enabled || settings.mode !== "timer") {
    if (settings.timerEndsAt) await chrome.storage.sync.set({ timerEndsAt: 0 });
    return;
  }
  const endsAt = settings.timerEndsAt > Date.now()
    ? settings.timerEndsAt
    : Date.now() + Math.max(1, Number(settings.timerMinutes) || 30) * 60 * 1000;
  await chrome.storage.sync.set({ timerEndsAt: endsAt });
  await chrome.alarms.create("focusModeEnd", { when: endsAt });
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
  const settings = await chrome.storage.sync.get(["enabled", "hosts", "mode", "timerMinutes", "timerEndsAt"]);
  await chrome.storage.sync.set({
    enabled: settings.enabled ?? true,
    hosts: settings.hosts?.length ? settings.hosts : defaultHosts,
    mode: settings.mode ?? "permanent",
    timerMinutes: settings.timerMinutes ?? 30,
    timerEndsAt: settings.timerEndsAt ?? 0
  });
  await syncTimer();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "musicControl") return;

  chrome.tabs.query({ url: ["https://music.yandex.ru/*", "https://music.yandex.com/*"] }, async (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      sendResponse({ ok: false });
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [message.action],
        func: (action) => {
          const selectors = {
            previous: ["[aria-label*='Предыдущий']", "[aria-label*='Previous']", "[class*='player-controls__btn_prev']", "[class*='player-controls__prev']"],
            next: ["[aria-label*='Следующий']", "[aria-label*='Next']", "[class*='player-controls__btn_next']", "[class*='player-controls__next']"]
          };
          if (action === "pause") {
            const audio = document.querySelector("audio");
            if (audio) {
              audio.paused ? audio.play() : audio.pause();
              return;
            }
            document.querySelector("[aria-label*='Пауза'], [aria-label*='Play'], [class*='player-controls__btn_play']")?.click();
            return;
          }
          selectors[action]?.map(selector => document.querySelector(selector)).find(Boolean)?.click();
        }
      });
      sendResponse({ ok: true });
    } catch (_) {
      sendResponse({ ok: false });
    }
  });
  return true;
});

// Если защита была включена, пока заблокированный сайт уже был открыт,
// сразу заменяем такую вкладку страницей блокировки и выключаем звук.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.enabled?.newValue === true) enforceOnOpenTabs();
  if (changes.enabled || changes.mode || changes.timerMinutes) syncTimer();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "focusModeEnd") return;
  await chrome.storage.sync.set({ enabled: false, timerEndsAt: 0 });
});

chrome.runtime.onStartup.addListener(syncTimer);

// Дополнительная проверка для вкладок, открытых до включения защиты.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await injectIntoTab(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") await injectIntoTab(tab);
});
