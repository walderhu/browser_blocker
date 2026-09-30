const defaults = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const enabled = document.getElementById("enabled");
const hosts = document.getElementById("hosts");
const state = document.getElementById("state");
const status = document.getElementById("status");
const mode = document.getElementById("mode");
const timerMinutes = document.getElementById("timerMinutes");
let toastTimer;

function showToast(text) {
  status.textContent = text;
  status.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => status.classList.remove("show"), 2000);
}

function showState(value) {
  enabled.checked = value;
  state.textContent = value ? "Блокировка активна" : "Блокировка выключена";
}

function load() {
  chrome.storage.sync.get({ enabled: true, hosts: defaults, mode: "permanent", timerMinutes: 30 }, (settings) => {
    showState(settings.enabled);
    hosts.value = settings.hosts.join("\n");
    mode.value = settings.mode;
    timerMinutes.value = settings.timerMinutes;
  });
}

function saveProtectionMode(enabledValue = enabled.checked) {
  const minutes = Math.max(1, Math.min(1440, Number(timerMinutes.value) || 30));
  timerMinutes.value = minutes;
  chrome.storage.sync.set({ enabled: enabledValue, mode: mode.value, timerMinutes: minutes, timerEndsAt: 0 }, () => showToast("Сохранено"));
}

enabled.addEventListener("change", () => {
  showState(enabled.checked);
  saveProtectionMode(enabled.checked);
});

mode.addEventListener("change", () => saveProtectionMode());
timerMinutes.addEventListener("change", () => { if (mode.value === "timer" && enabled.checked) saveProtectionMode(); });

document.getElementById("save").addEventListener("click", () => {
  const list = hosts.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  chrome.storage.sync.set({ hosts: list }, () => { showToast("Сохранено"); });
});

document.getElementById("reset").addEventListener("click", () => {
  hosts.value = defaults.join("\n");
  chrome.storage.sync.set({ hosts: defaults }, () => { showToast("Сохранено"); });
});

load();
