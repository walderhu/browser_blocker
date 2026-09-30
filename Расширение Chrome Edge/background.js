const defaultHosts = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com"
];

chrome.action.onClicked.addListener(async () => {
  const settings = await getSettings();
  if (!settings.enabled) {
    chrome.runtime.openOptionsPage();
    return;
  }

  const focusUrl = chrome.runtime.getURL("block.html");
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(tab => tab.url?.startsWith(focusUrl));
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: focusUrl, active: true });
  }
});

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
  if (message?.type === "googleAuth") {
    chrome.identity.getAuthToken({ interactive: Boolean(message.interactive) })
      .then(result => sendResponse({ token: typeof result === "string" ? result : result?.token || null }))
      .catch(error => sendResponse({ error: error.message || "Google authorization failed" }));
    return true;
  }

  if (message?.type === "openFocusPage") {
    const focusUrl = chrome.runtime.getURL("block.html");
    chrome.tabs.query({}).then(async (tabs) => {
      const existing = tabs.find(tab => tab.url?.startsWith(focusUrl));
      if (existing?.id) {
        await chrome.tabs.update(existing.id, { active: true });
        if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: focusUrl, active: true });
      }
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type !== "musicControl" && message?.type !== "musicInfo") return;

  chrome.tabs.query({ url: ["https://music.yandex.ru/*", "https://music.yandex.com/*"] }, async (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      sendResponse({ ok: false });
      return;
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [message.type === "musicInfo" ? "info" : message.action],
        world: "MAIN",
        func: (action) => {
          if (action === "info") {
            const audio = document.querySelector("audio");
            const metadata = navigator.mediaSession?.metadata;
            const titleElement = document.querySelector("[class*='track__title'], [class*='track__name'], [class*='d-track__name'], [class*='player-controls__track']");
            const artistElement = document.querySelector("[class*='track__artists'], [class*='track__artist'], [class*='d-track__artists'], [class*='d-track__artist']");
            let title = metadata?.title?.trim() || titleElement?.textContent?.trim() || "";
            title = title.replace(/\s*[|—-]\s*Яндекс Музыка.*$/i, "").trim();
            const artist = metadata?.artist?.trim() || artistElement?.textContent?.trim() || "";
            const coverElement = document.querySelector("[class*='track__cover'] img, [class*='track-cover'] img, [class*='player-controls__cover'] img, [class*='d-track__cover'] img, img[src*='avatars.yandex']");
            let cover = metadata?.artwork?.[0]?.src?.replace(/\{w\}/g, "160").replace(/\{h\}/g, "160").replace(/\{c\}/g, "1") || coverElement?.currentSrc || coverElement?.src || "";
            if (!cover && coverElement) {
              cover = getComputedStyle(coverElement).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
            }
            return audio || title ? { title, artist, cover } : null;
          }
          const labels = (element) => [
            element.getAttribute("aria-label"),
            element.getAttribute("title"),
            element.textContent,
            element.className
          ].filter(value => typeof value === "string").join(" ").toLowerCase();

          const buttons = [...document.querySelectorAll("button, [role='button'], [aria-label], [title]")];
          if (action === "pause") {
            const button = buttons.find(element => /пауз|play|pause|player-controls__btn_play/.test(labels(element)))
              || buttons.find(element => /воспроизвед/.test(labels(element)));
            if (button) {
              button.click();
              return true;
            }
            const audio = [...document.querySelectorAll("audio")].find(element => !element.paused)
              || document.querySelector("audio");
            if (!audio) return false;
            if (audio.paused) {
              audio.play().catch(() => {});
            } else {
              audio.pause();
            }
            return true;
          }
          const pattern = action === "next"
            ? /следующ|впер[её]д|next|btn_next|__next/
            : /предыдущ|назад|previous|prev|btn_prev|__prev/;
          const button = buttons.find(element => pattern.test(labels(element)));
          button?.click();
          return Boolean(button);
        }
      });
      sendResponse(message.type === "musicInfo" ? (result[0]?.result || { ok: false }) : { ok: true });
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
