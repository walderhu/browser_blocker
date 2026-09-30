const defaults = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const enabled = document.getElementById("enabled");
const hosts = document.getElementById("hosts");
const state = document.getElementById("state");
const message = document.getElementById("message");

function render(settings) {
  enabled.checked = settings.enabled;
  hosts.value = settings.hosts.join("\n");
  state.textContent = settings.enabled ? "Блокировка включена" : "Блокировка выключена";
}

chrome.storage.sync.get({ enabled: true, hosts: defaults }, render);

enabled.addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: enabled.checked });
  state.textContent = enabled.checked ? "Блокировка включена" : "Блокировка выключена";
  message.textContent = "Состояние сохранено";
});

document.getElementById("save").addEventListener("click", async () => {
  const list = hosts.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  await chrome.storage.sync.set({ hosts: list });
  message.textContent = "Сайты сохранены";
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
