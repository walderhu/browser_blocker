const defaults = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const enabled = document.getElementById("enabled");
const hosts = document.getElementById("hosts");
const state = document.getElementById("state");
const status = document.getElementById("status");
const timerMinutes = document.getElementById("timerMinutes");
const timepicker = document.getElementById("timepicker");
let toastTimer;
let timepickerInstance;

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
    timerMinutes.value = settings.timerMinutes;
    renderTimepicker();
    initTimepicker();
  });
}

function renderTimepicker() {
  const total = Number(timerMinutes.value) || 30;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  timepicker.value = [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")].join(":");
}

function saveProtectionMode(enabledValue = enabled.checked, modeValue = "permanent") {
  const minutes = Math.max(1, Math.min(1440, Number(timerMinutes.value) || 30));
  timerMinutes.value = minutes;
  chrome.storage.sync.set({ enabled: enabledValue, mode: modeValue, timerMinutes: minutes, timerEndsAt: 0 }, () => showToast("Сохранено"));
}

function initTimepicker() {
  timepickerInstance?.destroy();
  timepickerInstance = M.Timepicker.init(timepicker, {
    twelveHour: false,
    showClearBtn: true,
    defaultTime: timepicker.value || "00:30",
    autoClose: true,
    vibrate: true,
    i18n: { cancel: "Отмена", clear: "Очистить", done: "OK" },
    onSelect: (hours, minutes) => {
      timerMinutes.value = hours * 60 + minutes;
      timepicker.value = [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")].join(":");
    }
  });
}

enabled.addEventListener("change", () => {
  showState(enabled.checked);
  saveProtectionMode(enabled.checked);
});

timepicker.addEventListener("change", () => {
  const match = timepicker.value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return;
  timerMinutes.value = Number(match[1]) * 60 + Number(match[2]);
  enabled.checked = true;
  showState(true);
  saveProtectionMode(true, "timer");
});

document.getElementById("save").addEventListener("click", () => {
  const list = hosts.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  chrome.storage.sync.set({ hosts: list }, () => { showToast("Сохранено"); });
});

document.getElementById("reset").addEventListener("click", () => {
  hosts.value = defaults.join("\n");
  chrome.storage.sync.set({ hosts: defaults }, () => { showToast("Сохранено"); });
});

load();
