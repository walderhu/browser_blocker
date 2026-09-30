const countdown = document.getElementById("countdown");
const trackTitle = document.getElementById("track-title");
const progressRing = document.getElementById("timer-ring-progress");
const calendarFrame = document.querySelector(".calendar-frame");
const calendarThemeButton = document.getElementById("calendar-theme");
const ringLength = 2 * Math.PI * 95;
const blockedUrl = new URLSearchParams(location.search).get("site");
const isOverlay = new URLSearchParams(location.search).get("overlay") === "1";
let timer;
let restored = false;

const darkCalendarUrl = calendarFrame?.src || "";
const lightCalendarUrl = darkCalendarUrl.replace("bgcolor=%23151515", "bgcolor=%23ffffff");

function setCalendarTheme(isLight) {
  if (!calendarFrame || !calendarThemeButton) return;
  calendarFrame.src = isLight ? lightCalendarUrl : darkCalendarUrl;
  calendarFrame.classList.toggle("is-light", isLight);
  calendarThemeButton.innerHTML = isLight
    ? '<svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 1 1 8.5 3.5a7 7 0 0 0 12 12Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  calendarThemeButton.setAttribute("aria-label", isLight ? "Включить тёмную тему календаря" : "Включить светлую тему календаря");
  localStorage.setItem("calendarTheme", isLight ? "light" : "dark");
}

setCalendarTheme(localStorage.getItem("calendarTheme") === "light");
calendarThemeButton?.addEventListener("click", () => setCalendarTheme(!calendarFrame.classList.contains("is-light")));

document.querySelectorAll("[data-music-action]").forEach((button) => {
  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "musicControl", action: button.dataset.musicAction });
  });
});

function updateTrackTitle() {
  chrome.runtime.sendMessage({ type: "musicInfo" }, (response) => {
    if (chrome.runtime.lastError || !response?.title) {
      trackTitle.textContent = "";
      return;
    }
    trackTitle.textContent = response.title;
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
      countdown.textContent = "";
      if (!settings.enabled) restoreBlockedPage();
      return;
    }
    const remaining = settings.timerEndsAt - Date.now();
    chrome.storage.sync.get({ timerMinutes: 30 }, (timerSettings) => {
      const totalMilliseconds = Math.max(1, Number(timerSettings.timerMinutes) || 30) * 60000;
      const startedAt = settings.timerEndsAt - totalMilliseconds;
      setRingProgress((Date.now() - startedAt) / totalMilliseconds < 1
        ? remaining / totalMilliseconds
        : 0);
    });
    countdown.textContent = remaining > 0 ? `Осталось: ${formatRemaining(remaining)}` : "Время вышло";
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
