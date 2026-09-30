const countdown = document.getElementById("countdown");
let timer;

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

function updateCountdown() {
  chrome.storage.sync.get({ enabled: true, mode: "permanent", timerEndsAt: 0 }, (settings) => {
    const hasActiveTimer = settings.mode === "timer" && settings.timerEndsAt > Date.now();
    const isBlocked = settings.enabled && (settings.mode !== "timer" || !settings.timerEndsAt || hasActiveTimer);
    document.documentElement.style.overflow = isBlocked ? "hidden" : "auto";
    document.body.style.overflow = isBlocked ? "hidden" : "auto";

    if (!settings.enabled || settings.mode !== "timer" || !settings.timerEndsAt) {
      countdown.textContent = "";
      return;
    }
    const remaining = settings.timerEndsAt - Date.now();
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
