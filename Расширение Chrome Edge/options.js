const defaults = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const enabled = document.getElementById("enabled");
const hosts = document.getElementById("hosts");
const state = document.getElementById("state");
const badge = document.getElementById("badge");
const status = document.getElementById("status");
const historyResults = document.getElementById("historyResults");

const distractingDomains = new Map([
  ["youtube.com", "Видео"], ["youtu.be", "Видео"], ["instagram.com", "Соцсети"],
  ["facebook.com", "Соцсети"], ["x.com", "Соцсети"], ["twitter.com", "Соцсети"],
  ["tiktok.com", "Видео"], ["twitch.tv", "Стримы"], ["pinterest.com", "Лента"],
  ["reddit.com", "Форумы"], ["vk.com", "Соцсети"], ["ok.ru", "Соцсети"],
  ["telegram.org", "Мессенджеры"], ["web.telegram.org", "Мессенджеры"],
  ["netflix.com", "Видео"], ["rutube.ru", "Видео"], ["dzen.ru", "Лента"],
  ["news.google.com", "Новости"], ["pikabu.ru", "Лента"], ["steamcommunity.com", "Игры"]
]);

function showState(value) {
  enabled.checked = value;
  state.textContent = value ? "Блокировка активна" : "Блокировка выключена";
  badge.style.color = value ? "#45c985" : "#8490aa";
}

function load() {
  chrome.storage.sync.get({ enabled: true, hosts: defaults }, (settings) => {
    showState(settings.enabled);
    hosts.value = settings.hosts.join("\n");
  });
}

enabled.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabled.checked }, () => {
    showState(enabled.checked);
    status.textContent = "Состояние сохранено";
  });
});

document.getElementById("save").addEventListener("click", () => {
  const list = hosts.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  chrome.storage.sync.set({ hosts: list }, () => { status.textContent = "Список сайтов сохранён"; });
});

document.getElementById("reset").addEventListener("click", () => {
  hosts.value = defaults.join("\n");
  chrome.storage.sync.set({ hosts: defaults }, () => { status.textContent = "Список восстановлен"; });
});

function baseDomain(host) {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : parts.join(".");
}

document.getElementById("analyze").addEventListener("click", () => {
  historyResults.innerHTML = '<div class="empty">Анализирую историю…</div>';
  chrome.history.search({ text: "", startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, maxResults: 1000 }, (items) => {
    const counts = new Map();
    for (const item of items) {
      try {
        const host = baseDomain(new URL(item.url).hostname);
        if (distractingDomains.has(host)) counts.set(host, (counts.get(host) || 0) + (item.visitCount || 1));
      } catch (_) {}
    }
    const found = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    historyResults.innerHTML = "";
    if (!found.length) {
      historyResults.innerHTML = '<div class="empty">Отвлекающие сайты не найдены.</div>';
      return;
    }
    for (const [domain, visits] of found) {
      const label = document.createElement("label");
      label.className = "history-item";
      label.innerHTML = `<input type="checkbox" value="${domain}"><span><b>${domain}</b><small>${distractingDomains.get(domain)} · посещений: ${visits}</small></span>`;
      historyResults.appendChild(label);
    }
    const add = document.createElement("button");
    add.className = "analyze";
    add.textContent = "Добавить выбранные в блокировку";
    add.addEventListener("click", () => {
      const selected = [...historyResults.querySelectorAll("input:checked")].map(x => x.value);
      const current = hosts.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      hosts.value = [...new Set([...current, ...selected])].join("\n");
      status.textContent = selected.length ? "Сайты добавлены в список — нажми «Сохранить список»" : "Ничего не выбрано";
    });
    historyResults.appendChild(add);
  });
});

load();
