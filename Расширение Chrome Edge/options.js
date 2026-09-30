const defaults = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const enabled = document.getElementById("enabled");
const hosts = document.getElementById("hosts");
const state = document.getElementById("state");
const status = document.getElementById("status");
const timerMinutes = document.getElementById("timerMinutes");
const timepicker = document.getElementById("timepicker");
const blockedSitesCard = document.querySelector(".blocked-sites-card");
const toggleBlocked = document.getElementById("toggleBlocked");
const blockedHeader = document.getElementById("blockedHeader");
const focusArt = document.getElementById("focus-art");
let toastTimer;
let timepickerInstance;
let countdownTimer;

function drawFocusArt() {
  if (!focusArt) return;
  const image = new Image();
  image.onload = () => {
    const width = focusArt.clientWidth;
    const height = focusArt.clientHeight;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceY = (image.naturalHeight - sourceHeight) * 0.72;
    const pixelRatio = window.devicePixelRatio || 1;
    focusArt.width = width * pixelRatio;
    focusArt.height = height * pixelRatio;
    const context = focusArt.getContext("2d");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  };
  image.src = chrome.runtime.getURL("main-art.png");
}

drawFocusArt();
window.addEventListener("resize", drawFocusArt);

function setBlockedSitesCollapsed(collapsed) {
  blockedSitesCard.classList.toggle("is-collapsed", collapsed);
  toggleBlocked.textContent = ">";
  toggleBlocked.setAttribute("aria-expanded", String(!collapsed));
  localStorage.setItem("blockedSitesCollapsed", String(collapsed));
}

setBlockedSitesCollapsed(localStorage.getItem("blockedSitesCollapsed") === "true");
function toggleBlockedSection() {
  setBlockedSitesCollapsed(!blockedSitesCard.classList.contains("is-collapsed"));
}

blockedHeader.addEventListener("click", toggleBlockedSection);
blockedHeader.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  toggleBlockedSection();
});

function showToast(text) {
  status.textContent = text;
  status.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => status.classList.remove("show"), 2000);
}

function showState(value) {
  enabled.setAttribute("aria-checked", String(value));
  enabled.classList.toggle("is-on", value);
  state.textContent = value ? "Блокировка активна" : "Блокировка выключена";
}

function isEnabled() {
  return enabled.getAttribute("aria-checked") === "true";
}

function load() {
  chrome.storage.sync.get({ enabled: true, hosts: defaults, mode: "permanent", timerMinutes: 30, timerEndsAt: 0 }, (settings) => {
    showState(settings.enabled);
    hosts.value = settings.hosts.join("\n");
    timerMinutes.value = settings.timerMinutes;
    renderTimepicker();
    initTimepicker();
    updateTimerDisplay(settings);
  });
}

function renderTimepicker() {
  timepicker.value = "-:-";
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = undefined;
  timepicker.readOnly = false;
  timepicker.classList.remove("is-countdown");
}

function startCountdown(endsAt) {
  stopCountdown();
  timepicker.readOnly = true;
  timepicker.classList.add("is-countdown");

  const update = () => {
    const remaining = Number(endsAt) - Date.now();
    if (remaining <= 0) {
      stopCountdown();
      renderTimepicker();
      return;
    }
    timepicker.value = formatRemaining(remaining);
  };

  update();
  countdownTimer = setInterval(update, 1000);
}

function updateTimerDisplay(settings) {
  if (settings.enabled && settings.mode === "timer" && Number(settings.timerEndsAt) > Date.now()) {
    startCountdown(settings.timerEndsAt);
  } else {
    stopCountdown();
    renderTimepicker();
  }
}

function saveProtectionMode(enabledValue = isEnabled(), modeValue = "permanent") {
  const minutes = Math.max(1, Math.min(1440, Number(timerMinutes.value) || 30));
  timerMinutes.value = minutes;
  chrome.storage.sync.set({ enabled: enabledValue, mode: modeValue, timerMinutes: minutes, timerEndsAt: 0 }, () => {
    showToast("Сохранено");
    if (enabledValue && modeValue === "timer") chrome.runtime.sendMessage({ type: "openFocusPage" });
  });
}

function initTimepicker() {
  timepickerInstance?.destroy();
  const selectedTime = /^(\d{1,2}):(\d{2})$/.test(timepicker.value) ? timepicker.value : "00:30";
  timepickerInstance = M.Timepicker.init(timepicker, {
    twelveHour: false,
    showClearBtn: true,
    defaultTime: selectedTime,
    autoClose: true,
    vibrate: true,
    i18n: { cancel: "Отмена", clear: "Очистить", done: "OK" },
    onSelect: (hours, minutes) => {
      timerMinutes.value = hours * 60 + minutes;
      timepicker.value = [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")].join(":");
    }
  });
}

enabled.addEventListener("click", () => {
  const value = !isEnabled();
  showState(value);
  const hasTimer = /^(\d{1,2}):(\d{2})$/.test(timepicker.value);
  saveProtectionMode(value, value && hasTimer ? "timer" : "permanent");
});

enabled.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  enabled.click();
});

timepicker.addEventListener("change", () => {
  const match = timepicker.value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return;
  timerMinutes.value = Number(match[1]) * 60 + Number(match[2]);
  showState(true);
  saveProtectionMode(true, "timer");
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || (!changes.enabled && !changes.mode && !changes.timerEndsAt)) return;
  chrome.storage.sync.get({ enabled: true, mode: "permanent", timerEndsAt: 0 }, (settings) => {
    showState(settings.enabled);
    updateTimerDisplay(settings);
  });
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
