import ctypes
import os
import shutil
import subprocess
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import messagebox


APP_TITLE = "Детский Интернет"
MARKER_START = "# >>> CHILD_SAFE_BLOCK_START >>>"
MARKER_END = "# <<< CHILD_SAFE_BLOCK_END <<<"
HOSTS_PATH = Path(os.environ.get("WINDIR", r"C:\Windows")) / "System32" / "drivers" / "etc" / "hosts"

# Основные домены YouTube. Список можно расширить в окне программы.
DEFAULT_DOMAINS = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "ytimg.com",
    "www.ytimg.com",
    "youtubei.googleapis.com",
    "googlevideo.com",
    "www.googlevideo.com",
    "gvt1.com",
    "yt.be",
]


def is_admin():
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def read_hosts():
    return HOSTS_PATH.read_text(encoding="utf-8", errors="replace")


def write_hosts(text):
    backup = HOSTS_PATH.with_name("hosts.child-safe-backup")
    if not backup.exists():
        shutil.copy2(HOSTS_PATH, backup)
    HOSTS_PATH.write_text(text, encoding="utf-8", newline="\r\n")
    subprocess.run(["ipconfig", "/flushdns"], capture_output=True, text=True)


def remove_our_block(text):
    start = text.find(MARKER_START)
    end = text.find(MARKER_END)
    if start == -1 or end == -1 or end < start:
        return text.rstrip() + "\n"
    end += len(MARKER_END)
    return (text[:start].rstrip() + "\n" + text[end:].lstrip()).rstrip() + "\n"


def domain_lines(domains):
    lines = [MARKER_START, "# Добавлено приложением «Детский Интернет»"]
    for domain in domains:
        domain = domain.strip().lower().replace("https://", "").split("/")[0]
        if domain:
            lines.append(f"0.0.0.0 {domain}")
            lines.append(f"127.0.0.1 {domain}")
    lines.append(MARKER_END)
    return "\n".join(lines)


class App:
    def __init__(self, root):
        self.root = root
        root.title(APP_TITLE)
        root.geometry("650x500")
        root.minsize(560, 420)

        tk.Label(root, text=APP_TITLE, font=("Segoe UI", 18, "bold")).pack(pady=(18, 2))
        tk.Label(
            root,
            text="Блокировка сайтов для этого компьютера через системный hosts-файл",
            fg="#555555",
        ).pack()

        frame = tk.Frame(root)
        frame.pack(fill="both", expand=True, padx=24, pady=18)
        tk.Label(frame, text="Домены для блокировки (по одному на строку):", anchor="w").pack(fill="x")

        self.domains = tk.Text(frame, height=12, font=("Consolas", 11))
        self.domains.pack(fill="both", expand=True, pady=(6, 12))
        self.domains.insert("1.0", "\n".join(DEFAULT_DOMAINS))

        buttons = tk.Frame(frame)
        buttons.pack(fill="x")
        tk.Button(buttons, text="Заблокировать", command=self.block, height=2).pack(side="left", fill="x", expand=True, padx=(0, 6))
        tk.Button(buttons, text="Снять блокировку", command=self.unblock, height=2).pack(side="left", fill="x", expand=True, padx=(6, 0))

        self.status = tk.Label(root, text="Проверка статуса…", anchor="w", justify="left")
        self.status.pack(fill="x", padx=24, pady=(0, 6))
        tk.Label(
            root,
            text="Важно: для работы нужны права администратора. После блокировки перезапустите браузер.",
            fg="#8a4b08",
            wraplength=600,
        ).pack(padx=24, pady=(0, 16))
        self.refresh_status()

    def get_domains(self):
        return [x.strip() for x in self.domains.get("1.0", "end").splitlines() if x.strip() and not x.strip().startswith("#")]

    def block(self):
        if not is_admin():
            messagebox.showerror("Нужны права администратора", "Закройте программу и запустите файл «Запустить от администратора.bat».")
            return
        try:
            current = remove_our_block(read_hosts())
            updated = current.rstrip() + "\n\n" + domain_lines(self.get_domains()) + "\n"
            write_hosts(updated)
            self.refresh_status()
            messagebox.showinfo("Готово", "Сайты добавлены в блокировку. Перезапустите браузер.")
        except Exception as exc:
            messagebox.showerror("Ошибка", str(exc))

    def unblock(self):
        if not is_admin():
            messagebox.showerror("Нужны права администратора", "Закройте программу и запустите файл «Запустить от администратора.bat».")
            return
        try:
            write_hosts(remove_our_block(read_hosts()))
            self.refresh_status()
            messagebox.showinfo("Готово", "Блокировка приложения снята.")
        except Exception as exc:
            messagebox.showerror("Ошибка", str(exc))

    def refresh_status(self):
        try:
            active = MARKER_START in read_hosts()
            self.status.config(text=("Статус: блокировка включена" if active else "Статус: блокировка выключена"))
        except Exception:
            self.status.config(text="Статус: запустите приложение от имени администратора")


if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
