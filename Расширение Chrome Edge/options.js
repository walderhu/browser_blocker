const defaults = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const enabled = document.getElementById("enabled");
const hosts = document.getElementById("hosts");
const state = document.getElementById("state");
const status = document.getElementById("status");
const mode = document.getElementById("mode");
const timerMinutes = document.getElementById("timerMinutes");
const timerReadout = document.getElementById("timerReadout");
const timerPhase = document.getElementById("timerPhase");
const clock = document.getElementById("clock");
let toastTimer;
let selectedHours = 0;

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
    renderTimerReadout();
    showHours();
  });
}

function renderTimerReadout() {
  const total = Number(timerMinutes.value) || 30;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  timerReadout.textContent = [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")].join(":");
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

function drawClock(values, onPick) {
  clock.innerHTML = "";
  const radius = 92;
  values.forEach((value, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clock-choice";
    button.textContent = String(value).padStart(2, "0");
    const angle = (index / values.length) * Math.PI * 2 - Math.PI / 2;
    button.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
    button.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
    button.addEventListener("click", () => onPick(value));
    clock.appendChild(button);
  });
}

function showHours() {
  timerPhase.textContent = "Выбери часы";
  drawClock([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], (hours) => {
    selectedHours = hours;
    showMinutes();
  });
  const zero = document.createElement("button");
  zero.type = "button";
  zero.className = "clock-choice";
  zero.textContent = "00";
  zero.style.left = "50%";
  zero.style.top = "50%";
  zero.style.background = "#383838";
  zero.addEventListener("click", () => { selectedHours = 0; showMinutes(); });
  clock.appendChild(zero);
}

function showMinutes() {
  timerPhase.textContent = "Теперь выбери минуты";
  drawClock(Array.from({ length: 12 }, (_, index) => index * 5), (minutes) => {
    const total = selectedHours * 60 + minutes;
    if (total === 0) return;
    timerMinutes.value = total;
    renderTimerReadout();
    if (mode.value === "timer" && enabled.checked) saveProtectionMode();
    showHours();
  });
}

document.getElementById("save").addEventListener("click", () => {
  const list = hosts.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  chrome.storage.sync.set({ hosts: list }, () => { showToast("Сохранено"); });
});

document.getElementById("reset").addEventListener("click", () => {
  hosts.value = defaults.join("\n");
  chrome.storage.sync.set({ hosts: defaults }, () => { showToast("Сохранено"); });
});

load();
