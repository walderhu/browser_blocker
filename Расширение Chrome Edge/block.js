const countdown = document.getElementById("countdown");
const timerTotal = countdown.querySelector(".timer-total");
const timerLabel = countdown.querySelector(".timer-label");
const timerRemaining = countdown.querySelector(".timer-remaining");
const iconWrap = document.querySelector(".icon-wrap");
const timerLock = document.getElementById("timer-lock");
const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const trackCover = document.getElementById("track-cover");
const progressRing = document.getElementById("timer-ring-progress");
const calendarPanel = document.querySelector(".calendar-panel");
const calendarThemeButton = document.getElementById("calendar-theme");
const calendarDays = document.getElementById("calendar-days");
const addEventButton = document.getElementById("add-event");
const eventDialog = document.getElementById("event-dialog");
const eventForm = document.getElementById("event-form");
const eventTitle = document.getElementById("event-title");
const eventDate = document.getElementById("event-date");
const eventTime = document.getElementById("event-time");
const cancelEvent = document.getElementById("cancel-event");
const ringLength = 2 * Math.PI * 95;
const blockedUrl = new URLSearchParams(location.search).get("site");
const isOverlay = new URLSearchParams(location.search).get("overlay") === "1";
let timer;
let restored = false;

function setTimerLock(locked) {
  iconWrap.classList.toggle("timer-locked", locked);
  timerLock.setAttribute("aria-label", locked ? "Открепить таймер" : "Закрепить таймер");
  timerLock.innerHTML = locked
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.65"/><path d="M16 10V7"/></svg>';
  localStorage.setItem("timerLocked", String(locked));
}

setTimerLock(localStorage.getItem("timerLocked") === "true");
timerLock.addEventListener("click", (event) => {
  event.stopPropagation();
  setTimerLock(!iconWrap.classList.contains("timer-locked"));
});

trackCover.addEventListener("error", () => {
  trackCover.style.display = "none";
});

function setCalendarTheme(isLight) {
  if (!calendarPanel || !calendarThemeButton) return;
  calendarPanel.classList.toggle("is-light", isLight);
  calendarThemeButton.innerHTML = isLight
    ? '<svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15.2A9 9 0 1 1 8.8 3.3 6.8 6.8 0 0 0 21 15.2Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  calendarThemeButton.setAttribute("aria-label", isLight ? "Включить тёмную тему календаря" : "Включить светлую тему календаря");
  localStorage.setItem("calendarTheme", isLight ? "light" : "dark");
}

setCalendarTheme(localStorage.getItem("calendarTheme") === "light");
calendarThemeButton?.addEventListener("click", () => setCalendarTheme(!calendarPanel.classList.contains("is-light")));

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
}

function renderCalendar() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const days = [today, tomorrow];
  chrome.storage.local.get({ focusEvents: [] }, ({ focusEvents }) => {
    calendarDays.innerHTML = days.map((day, index) => {
      const key = dateKey(day);
      const events = focusEvents.filter(event => event.date === key).sort((a, b) => a.time.localeCompare(b.time));
      const label = index === 0 ? "Сегодня" : "Завтра";
      const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(day);
      const content = events.length ? events.map(event => `<div class="calendar-event"><div><time>${escapeHtml(event.time)}</time><strong>${escapeHtml(event.title)}</strong></div><button class="delete-event" type="button" data-delete-event="${escapeHtml(event.id)}" aria-label="Удалить событие">×</button></div>`).join("") : '<div class="empty-day">Нет событий</div>';
      return `<div class="calendar-day"><div class="day-header">${label}<small>${dateLabel}</small></div><div class="day-events">${content}</div></div>`;
    }).join("");
  });
}

function openEventDialog() {
  const now = new Date();
  eventTitle.value = "";
  eventDate.value = dateKey(now);
  eventTime.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  eventDialog.showModal();
  eventTitle.focus();
}

addEventButton?.addEventListener("click", openEventDialog);
cancelEvent?.addEventListener("click", () => eventDialog.close());
eventForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  chrome.storage.local.get({ focusEvents: [] }, ({ focusEvents }) => {
    focusEvents.push({ id: crypto.randomUUID(), title: eventTitle.value.trim(), date: eventDate.value, time: eventTime.value });
    chrome.storage.local.set({ focusEvents }, () => { eventDialog.close(); renderCalendar(); });
  });
});
calendarDays?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-event]");
  if (!button) return;
  chrome.storage.local.get({ focusEvents: [] }, ({ focusEvents }) => {
    chrome.storage.local.set({ focusEvents: focusEvents.filter(item => item.id !== button.dataset.deleteEvent) }, renderCalendar);
  });
});
renderCalendar();

document.querySelectorAll("[data-music-action]").forEach((button) => {
  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "musicControl", action: button.dataset.musicAction });
  });
});

function updateTrackTitle() {
  chrome.runtime.sendMessage({ type: "musicInfo" }, (response) => {
    if (chrome.runtime.lastError || !response?.title) {
      trackTitle.textContent = "";
      trackArtist.textContent = "";
      trackCover.style.display = "none";
      return;
    }
    trackTitle.textContent = response.title;
    trackArtist.textContent = response.artist || "";
    if (response.cover) {
      trackCover.src = response.cover;
      trackCover.style.display = "block";
    }
  });
}

updateTrackTitle();
setInterval(updateTrackTitle, 2000);

progressRing.style.strokeDasharray = ringLength;

function setRingProgress(progress) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  progressRing.style.strokeDashoffset = ringLength * (1 - boundedProgress);
}

function restoreBlockedPage() {
  if (restored || isOverlay || !blockedUrl || !/^https?:$/i.test(new URL(blockedUrl).protocol)) return;
  restored = true;
  location.replace(blockedUrl);
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

function updateCountdown() {
  chrome.storage.sync.get({ enabled: true, mode: "permanent", timerEndsAt: 0 }, (settings) => {
    if (settings.mode !== "timer" || !settings.timerEndsAt) {
      setRingProgress(1);
    }

    const hasActiveTimer = settings.mode === "timer" && settings.timerEndsAt > Date.now();
    const isBlocked = settings.enabled && (settings.mode !== "timer" || !settings.timerEndsAt || hasActiveTimer);
    document.documentElement.style.overflow = isBlocked ? "hidden" : "auto";
    document.body.style.overflow = isBlocked ? "hidden" : "auto";

    if (!settings.enabled || settings.mode !== "timer" || !settings.timerEndsAt) {
      timerTotal.textContent = "";
      timerLabel.textContent = "";
      timerRemaining.textContent = "";
      if (!settings.enabled) restoreBlockedPage();
      return;
    }
    const remaining = settings.timerEndsAt - Date.now();
    chrome.storage.sync.get({ timerMinutes: 30 }, (timerSettings) => {
      const totalMilliseconds = Math.max(1, Number(timerSettings.timerMinutes) || 30) * 60000;
      const startedAt = settings.timerEndsAt - totalMilliseconds;
      timerTotal.textContent = formatRemaining(totalMilliseconds);
      timerLabel.textContent = "Осталось";
      timerRemaining.textContent = formatRemaining(Math.max(0, remaining));
      setRingProgress((Date.now() - startedAt) / totalMilliseconds < 1
        ? remaining / totalMilliseconds
        : 0);
    });
    if (remaining <= 0) {
      document.documentElement.style.overflow = "auto";
      document.body.style.overflow = "auto";
      if (!settings.enabled) restoreBlockedPage();
    }
  });
}

updateCountdown();
timer = setInterval(updateCountdown, 1000);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.enabled || changes.mode || changes.timerEndsAt)) updateCountdown();
});
