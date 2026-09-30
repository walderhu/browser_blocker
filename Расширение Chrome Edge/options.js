const defaults = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const enabled = document.getElementById("enabled");
const hosts = document.getElementById("hosts");
const state = document.getElementById("state");
const status = document.getElementById("status");

function showState(value) {
  enabled.checked = value;
  state.textContent = value ? "Блокировка активна" : "Блокировка выключена";
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

load();
