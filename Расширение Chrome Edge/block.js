const countdown = document.getElementById("countdown");
const timerTotal = countdown.querySelector(".timer-total");
const timerLabel = countdown.querySelector(".timer-label");
const timerRemaining = countdown.querySelector(".timer-remaining");
const iconWrap = document.querySelector(".icon-wrap");
const focusArt = document.getElementById("focus-art");
const timerLock = document.getElementById("timer-lock");
const focusToggle = document.getElementById("focus-toggle");
const focusTimepicker = document.getElementById("focus-timepicker");
const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const trackCover = document.getElementById("track-cover");
const musicOpen = document.getElementById("music-open");
const pauseButton = document.querySelector('[data-music-action="pause"]');
const progressRing = document.getElementById("timer-ring-progress");
const calendarFrame = document.querySelector(".calendar-frame");
const calendarThemeButton = document.getElementById("calendar-theme");
const focusHeading = document.getElementById("focus-heading");
const mainPanel = document.querySelector("main");
const settingsButton = document.getElementById("settings-button");
const focusHosts = document.getElementById("focus-hosts");
const focusSaveHosts = document.getElementById("focus-save-hosts");
const focusResetHosts = document.getElementById("focus-reset-hosts");
const focusSettingsStatus = document.getElementById("focusSettingsStatus");
const ringLength = 2 * Math.PI * 95;
const blockedUrl = new URLSearchParams(location.search).get("site");
const isOverlay = new URLSearchParams(location.search).get("overlay") === "1";
const defaultFocusHosts = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
if (focusArt) {
  const artImage = new Image();
  artImage.onload = () => {
    const context = focusArt.getContext("2d");
    const scale = Math.min(focusArt.width / artImage.naturalWidth, focusArt.height / artImage.naturalHeight);
    const width = artImage.naturalWidth * scale;
    const height = artImage.naturalHeight * scale;
    context.clearRect(0, 0, focusArt.width, focusArt.height);
    context.drawImage(artImage, (focusArt.width - width) / 2, (focusArt.height - height) / 2, width, height);
  };
  artImage.src = "block-art.png";
  focusArt.addEventListener("contextmenu", event => event.preventDefault());
}
if (blockedUrl) {
  if (focusHeading) focusHeading.textContent = "Доступ ограничен";
  document.title = "Доступ ограничен";
} else {
  document.title = "Фокус";
}
let timer;
let restored = false;
let pendingTimerMinutes = null;
let confirmTimerSelection = false;
const PICKER_DEBUG = true;
const pickerLog = (...args) => { if (PICKER_DEBUG) console.log("[FocusPicker]", new Date().toISOString(), ...args); };
const pickerState = (label) => {
  const modal = document.querySelector(".timepicker-modal");
  const container = modal?.querySelector(".timepicker-container");
  pickerLog(label, {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    htmlScrollTop: document.documentElement.scrollTop,
    bodyScrollTop: document.body.scrollTop,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyPosition: getComputedStyle(document.body).position,
    modalClass: modal?.className,
    modalRect: modal?.getBoundingClientRect().toJSON?.(),
    containerRect: container?.getBoundingClientRect().toJSON?.()
  });
};
window.addEventListener("scroll", () => pickerState("window scroll"), true);
pickerLog("block page loaded", { href: location.href, viewport: [innerWidth, innerHeight] });

function showFocusSettings(open) {
  if (!mainPanel || !settingsButton) return;
  mainPanel.classList.toggle("focus-settings-open", open);
  settingsButton.setAttribute("aria-label", open ? "Вернуться в режим концентрации" : "Открыть настройки сайтов");
  settingsButton.innerHTML = open
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/></svg>';
  if (open && focusHosts) {
    chrome.storage.sync.get({ hosts: defaultFocusHosts }, settings => {
      focusHosts.value = (Array.isArray(settings.hosts) ? settings.hosts : defaultFocusHosts).join("\n");
      focusHosts.focus();
    });
  }
}

function showFocusSettingsStatus() {
  if (!focusSettingsStatus) return;
  focusSettingsStatus.textContent = "Сохранено";
  setTimeout(() => { focusSettingsStatus.textContent = ""; }, 2000);
}

async function saveFocusHosts(hosts) {
  const normalized = hosts.map(host => host.trim()).filter(Boolean);
  await chrome.storage.sync.set({ hosts: normalized });
  showFocusSettingsStatus();
}

settingsButton?.addEventListener("click", event => {
  event.preventDefault();
  showFocusSettings(!mainPanel?.classList.contains("focus-settings-open"));
});
chrome.storage.sync.get({ hosts: defaultFocusHosts }, settings => {
  if (focusHosts) focusHosts.value = (Array.isArray(settings.hosts) ? settings.hosts : defaultFocusHosts).join("\n");
});
focusSaveHosts?.addEventListener("click", () => {
  if (focusHosts) saveFocusHosts(focusHosts.value.split(/\r?\n/));
});
focusResetHosts?.addEventListener("click", async () => {
  if (!focusHosts) return;
  focusHosts.value = defaultFocusHosts.join("\n");
  await saveFocusHosts(defaultFocusHosts);
});

function renderFocusToggle(enabled) {
  if (!focusToggle) return;
  focusToggle.classList.toggle("is-on", enabled);
  focusToggle.setAttribute("aria-checked", String(enabled));
  focusToggle.setAttribute("aria-label", enabled ? "Выключить режим концентрации" : "Включить режим концентрации");
}

function getFocusTimerMinutes() {
  const match = focusTimepicker?.value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes > 0 ? minutes : 0;
}

chrome.storage.sync.get({ enabled: true, mode: "permanent", timerMinutes: 0 }, settings => {
  renderFocusToggle(settings.enabled);
  if (settings.mode === "timer" && Number(settings.timerMinutes) > 0) {
    const totalMinutes = Number(settings.timerMinutes);
    setFocusTimerValue(`${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`);
  }
});
focusToggle?.addEventListener("click", async () => {
  const settings = await chrome.storage.sync.get({ enabled: true });
  const enabled = !settings.enabled;
  if (!enabled) {
    await chrome.storage.sync.set({ enabled: false });
    return;
  }
  const picker = focusTimepicker && window.M?.Timepicker?.getInstance(focusTimepicker);
  if (picker) {
    picker.open();
    return;
  }
  const timerMinutes = getFocusTimerMinutes();
  await chrome.storage.sync.set({
    enabled: true,
    mode: timerMinutes ? "timer" : "permanent",
    timerMinutes: timerMinutes || 0,
    timerEndsAt: 0
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enabled) renderFocusToggle(changes.enabled.newValue);
});

function setFocusTimerValue(value) {
  if (focusTimepicker) focusTimepicker.value = value;
}

if (focusTimepicker && window.M?.Timepicker) {
  const pinPickerModal = () => {
    const modal = document.querySelector(".timepicker-modal");
    if (!modal) return;
    Object.assign(modal.style, {
      position: "fixed",
      top: "0px",
      left: "0px",
      right: "0px",
      bottom: "0px",
      width: "100vw",
      height: "100vh",
      maxWidth: "none",
      maxHeight: "none",
      margin: "0px",
      transform: "none"
    });
    pickerLog("modal pinned", { rect: modal.getBoundingClientRect().toJSON?.(), inline: modal.getAttribute("style") });
  };
  const lockFocusPage = () => {
    pickerLog("lock start");
    pickerState("before lock");
    document.documentElement.classList.add("timepicker-lock");
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.body.style.overflow = "hidden";
    pickerLog("normal lock applied");
    requestAnimationFrame(() => pickerState("after lock frame"));
  };
  const unlockFocusPage = () => {
    pickerLog("unlock start");
    pickerState("before unlock");
    document.documentElement.classList.remove("timepicker-lock");
    document.body.style.overflow = "";
    window.scrollTo(0, 0);
    pickerState("after unlock");
  };
  focusTimepicker.addEventListener("mousedown", () => { pickerLog("timepicker mousedown"); lockFocusPage(); }, true);
  focusTimepicker.addEventListener("focus", () => pickerLog("timepicker focus"), true);
  focusTimepicker.addEventListener("touchstart", () => { pickerLog("timepicker touchstart"); lockFocusPage(); }, true);
  M.Timepicker.init(focusTimepicker, {
    twelveHour: false,
    showClearBtn: true,
    defaultTime: "00:30",
    autoClose: true,
    vibrate: true,
    onOpenStart: () => {
      pickerLog("Materialize onOpenStart");
      lockFocusPage();
      pinPickerModal();
      setTimeout(() => pickerState("open + 0ms"), 0);
      setTimeout(() => { pinPickerModal(); pickerState("open + 100ms"); }, 100);
      setTimeout(() => { pinPickerModal(); pickerState("open + 500ms"); }, 500);
    },
    onCloseEnd: () => {
      pickerLog("Materialize onCloseEnd");
      unlockFocusPage();
      if (confirmTimerSelection && pendingTimerMinutes !== null) {
        if (pendingTimerMinutes === 0) setFocusTimerValue("-:-");
        chrome.storage.sync.set({
          enabled: true,
          mode: pendingTimerMinutes > 0 ? "timer" : "permanent",
          timerMinutes: pendingTimerMinutes,
          timerEndsAt: 0
        });
      }
      pendingTimerMinutes = null;
      confirmTimerSelection = false;
      setTimeout(() => pickerState("close + 100ms"), 100);
    },
    i18n: { cancel: "Отмена", clear: "Перманент", done: "OK" },
    onSelect: async (hours, minutes) => {
      const totalMinutes = Math.max(1, hours * 60 + minutes);
      setFocusTimerValue(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
      pendingTimerMinutes = totalMinutes;
    }
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.classList.contains("timepicker-close")) {
      confirmTimerSelection = button.textContent.trim() === "OK";
    } else if (button.classList.contains("timepicker-clear")) {
      confirmTimerSelection = true;
      pendingTimerMinutes = 0;
      setFocusTimerValue("-:-");
    }
  }, true);
  pickerLog("Materialize Timepicker initialized", M.Timepicker.getInstance(focusTimepicker));
}

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
  if (trackCover.getAttribute("src")) musicOpen.style.display = "none";
});

musicOpen.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "openMusic" });
});

function setCalendarTheme(isLight) {
  if (!calendarFrame || !calendarThemeButton) return;
  const darkUrl = calendarFrame.dataset.darkUrl || calendarFrame.src;
  const lightUrl = darkUrl.replace("bgcolor=%23151515", "bgcolor=%23ffffff");
  calendarFrame.dataset.darkUrl = darkUrl;
  calendarFrame.src = isLight ? lightUrl : darkUrl;
  calendarFrame.classList.toggle("is-light", isLight);
  calendarThemeButton.innerHTML = isLight
    ? '<svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15.2A9 9 0 1 1 8.8 3.3 6.8 6.8 0 0 0 21 15.2Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  calendarThemeButton.setAttribute("aria-label", isLight ? "Включить тёмную тему календаря" : "Включить светлую тему календаря");
  localStorage.setItem("calendarTheme", isLight ? "light" : "dark");
}

setCalendarTheme(localStorage.getItem("calendarTheme") === "light");
calendarThemeButton?.addEventListener("click", () => setCalendarTheme(!calendarFrame.classList.contains("is-light")));

/* Legacy custom calendar kept below for reference; the Google embed is active.
function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
}

async function getGoogleToken(interactive = false) {
  const response = await chrome.runtime.sendMessage({ type: "googleAuth", interactive });
  if (response?.error) throw new Error(response.error);
  return response?.token || null;
}

async function googleRequest(url, options = {}, interactive = false) {
  const token = await getGoogleToken(interactive);
  if (!token) return null;
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  if (response.status === 401) {
    const token = await getGoogleToken(false);
    if (token) await chrome.identity.removeCachedAuthToken({ token });
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
  googleLogin.textContent = "Вход...";
  googleLogin.disabled = true;
  try {
    await getGoogleToken(true);
    await renderCalendar();
  } catch (error) {
    googleLogin.textContent = "Войти Google";
    googleLogin.title = error.message || "Не удалось выполнить вход";
  } finally {
    googleLogin.disabled = false;
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
*/

document.querySelectorAll("[data-music-action]").forEach((button) => {
  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "musicControl", action: button.dataset.musicAction }, () => {
      if (button.dataset.musicAction === "pause") setTimeout(updateTrackTitle, 150);
    });
  });
});

function updatePauseButton(paused) {
  if (!pauseButton || typeof paused !== "boolean") return;
  pauseButton.querySelector("svg").innerHTML = paused
    ? '<path d="m8 5 11 7-11 7V5Z"/>'
    : '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
  pauseButton.setAttribute("aria-label", paused ? "Воспроизвести" : "Пауза");
}

function updateTrackTitle() {
  chrome.runtime.sendMessage({ type: "musicInfo" }, (response) => {
    if (chrome.runtime.lastError || !response?.title) {
      trackTitle.textContent = "";
      trackArtist.textContent = "";
      musicOpen.style.display = "none";
      return;
    }
    trackTitle.textContent = response.title;
    trackArtist.textContent = response.artist || "";
    updatePauseButton(response.paused);
    if (response.cover) {
      trackCover.src = response.cover;
      musicOpen.style.display = "grid";
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
    iconWrap.classList.toggle("focus-active", Boolean(settings.enabled));
    if (settings.mode !== "timer" || !settings.timerEndsAt) {
      setRingProgress(1);
    }

    const hasActiveTimer = settings.mode === "timer" && settings.timerEndsAt > Date.now();
    const isBlocked = settings.enabled && (settings.mode !== "timer" || !settings.timerEndsAt || hasActiveTimer);
    document.documentElement.style.overflow = isBlocked ? "hidden" : "auto";
    document.body.style.overflow = isBlocked ? "hidden" : "auto";

    if (!settings.enabled) {
      timerTotal.textContent = "";
      timerLabel.textContent = "";
      timerRemaining.textContent = "";
      restoreBlockedPage();
      return;
    }
    if (settings.mode !== "timer" || !settings.timerEndsAt) {
      timerTotal.textContent = "";
      timerLabel.textContent = settings.mode === "permanent" ? "Перманент" : "";
      timerRemaining.textContent = "";
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
