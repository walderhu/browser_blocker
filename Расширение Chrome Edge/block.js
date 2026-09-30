const countdown = document.getElementById("countdown");
const progressRing = document.getElementById("timer-ring-progress");
const ringLength = 2 * Math.PI * 104;
let timer;

progressRing.style.strokeDasharray = ringLength;

function setRingProgress(progress) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  progressRing.style.strokeDashoffset = ringLength * (1 - boundedProgress);
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
    }
  });
}

updateCountdown();
timer = setInterval(updateCountdown, 1000);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.enabled || changes.mode || changes.timerEndsAt)) updateCountdown();
});
