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
const googleLogin = document.getElementById("google-login");
const GOOGLE_CLIENT_ID = "205794802854-d4204vbt7jj6pfgcbbi1ca3om1ojm3o8.apps.googleusercontent.com";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar";
const GOOGLE_CALENDARS = ["tru60117@gmail.com", "o9h6dglqoqrdrocjvh81m53490@group.calendar.google.com"];
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

async function getGoogleToken(interactive = false) {
  const stored = await chrome.storage.local.get({ googleAccessToken: "", googleTokenExpiresAt: 0 });
  if (stored.googleAccessToken && stored.googleTokenExpiresAt > Date.now() + 60000) return stored.googleAccessToken;
  if (!interactive) return null;
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, response_type: "token", redirect_uri: redirectUri, scope: GOOGLE_SCOPE, prompt: "consent" });
  const redirected = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  const hash = new URL(redirected).hash.slice(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  if (!accessToken) throw new Error("Google authorization was cancelled");
  const expiresIn = Number(params.get("expires_in")) || 3600;
  await chrome.storage.local.set({ googleAccessToken: accessToken, googleTokenExpiresAt: Date.now() + expiresIn * 1000 });
  return accessToken;
}

async function googleRequest(url, options = {}, interactive = false) {
  const token = await getGoogleToken(interactive);
  if (!token) return null;
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  if (response.status === 401) {
    await chrome.storage.local.remove(["googleAccessToken", "googleTokenExpiresAt"]);
    return null;
  }
  if (!response.ok) throw new Error(`Google Calendar API: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function loadGoogleEvents() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 2);
  const query = new URLSearchParams({ timeMin: today.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "100" });
  const events = [];
  for (const calendarId of GOOGLE_CALENDARS) {
    const data = await googleRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
    if (!data) return null;
    for (const event of data.items || []) {
      const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      events.push({ id: event.id, calendarId, title: event.summary || "Без названия", date: start ? dateKey(start) : event.start?.date, time: start ? start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "Весь день", google: true });
    }
  }
  return events;
}

function drawCalendar(events) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const days = [today, tomorrow];
  calendarDays.innerHTML = days.map((day, index) => {
      const key = dateKey(day);
      const dayEvents = events.filter(event => event.date === key).sort((a, b) => a.time.localeCompare(b.time));
      const label = index === 0 ? "Сегодня" : "Завтра";
      const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(day);
      const content = dayEvents.length ? dayEvents.map(event => `<div class="calendar-event"><div><time>${escapeHtml(event.time)}</time><strong>${escapeHtml(event.title)}</strong></div><button class="delete-event" type="button" data-delete-event="${escapeHtml(event.id)}" data-delete-calendar="${escapeHtml(event.calendarId || "")}" data-google-event="${event.google ? "1" : "0"}" aria-label="Удалить событие">×</button></div>`).join("") : '<div class="empty-day">Нет событий</div>';
      return `<div class="calendar-day"><div class="day-header">${label}<small>${dateLabel}</small></div><div class="day-events">${content}</div></div>`;
    }).join("");
}

async function renderCalendar() {
  const googleEvents = await loadGoogleEvents().catch(() => null);
  if (googleEvents) {
    drawCalendar(googleEvents);
    googleLogin.textContent = "Google подключён";
    return;
  }
  chrome.storage.local.get({ focusEvents: [] }, ({ focusEvents }) => drawCalendar(focusEvents));
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
googleLogin?.addEventListener("click", async () => {
  try {
    await getGoogleToken(true);
    await renderCalendar();
  } catch (error) {
    googleLogin.textContent = "Войти Google";
  }
});
cancelEvent?.addEventListener("click", () => eventDialog.close());
eventForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const googleToken = await getGoogleToken(false);
  if (googleToken) {
    const start = new Date(`${eventDate.value}T${eventTime.value}:00`);
    const end = new Date(start.getTime() + 60 * 60000);
    await googleRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDARS[0])}/events`, { method: "POST", body: JSON.stringify({ summary: eventTitle.value.trim(), start: { dateTime: start.toISOString(), timeZone: "Europe/Moscow" }, end: { dateTime: end.toISOString(), timeZone: "Europe/Moscow" } }) });
  } else {
    const { focusEvents } = await chrome.storage.local.get({ focusEvents: [] });
    focusEvents.push({ id: crypto.randomUUID(), title: eventTitle.value.trim(), date: eventDate.value, time: eventTime.value });
    await chrome.storage.local.set({ focusEvents });
  }
  eventDialog.close();
  renderCalendar();
});
calendarDays?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-event]");
  if (!button) return;
  if (button.dataset.googleEvent === "1") {
    await googleRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(button.dataset.deleteCalendar)}/events/${encodeURIComponent(button.dataset.deleteEvent)}`, { method: "DELETE" });
  } else {
    const { focusEvents } = await chrome.storage.local.get({ focusEvents: [] });
    await chrome.storage.local.set({ focusEvents: focusEvents.filter(item => item.id !== button.dataset.deleteEvent) });
  }
  renderCalendar();
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
