# Sakura Flasher

Sakura Flasher (aka **Sakura Flash Tools**) is a desktop application for flashing and backing up Xiaomi, Redmi, and POCO devices. Built with **Electron + React + TypeScript + Vite**, it features a sharp **manga-style UI** with an ink-black canvas, cream borders, vermilion accents, and a flat banner illustration with katakana labels.

It replaces generic firmware flashers with three main workflows: **Fastboot Tools** (official Xiaomi ROM), **Custom ROM** (.zip recovery sideload / fastboot), and **Backup Kernel** (auto-detect device → pick partitions → save `.img` backups).

> ⚠️ Disclaimer: Use at your own risk. Unlocking the bootloader and flashing custom firmware may void your warranty, trigger anti-rollback protection, or permanently brick your device. Always back up your data first and ensure your bootloader is unlocked.

---

## What is Sakura Flash Tools?

**Sakura Flasher** (formerly Xiaomi Flash Tool) is a Windows desktop flasher for Xiaomi/Redmi/POCO smartphones. It is designed as a fixed desktop mockup-style UI, not a standalone web page, with no Liquid Glass effects — just clean flat manga panels:

- **Canvas:** ink black `#12111A`
- **Panels:** `#1B1A26` with 2px cream `#F2EDE4` borders
- **Accents:** vermilion `#FF5A3C`
- **Detail:** sakura `#FFB7C9` petals only
- **Fonts:** Dela Gothic One (display), Zen Kaku Gothic New (UI), JetBrains Mono (path/log/hash)
- **Banner:** 140px flat night sky gradient scrim, halftone dots, vermilion sun, Fuji silhouette, torii gate, falling sakura petals per page

---

## Features

### 1. Fastboot Tools (`/fastboot`)
- Select official Xiaomi Fastboot ROM archives (`.tgz`, `.tar`, `.zip`)
- Analyze ROM metadata: codename, version, Android, anti-rollback
- Flash methods: Clean All, Save User Data, Clean All & Lock
- Direct fastboot commands: flash image, boot image, erase partition, get variables
- Reboot modes: system, recovery, bootloader, fastbootd

### 2. Custom ROM (`/custom-rom`)
- Pick a Custom ROM archive (`.zip`, `.tgz`, `.tar`)
- Automatic format detection and metadata analysis
- Recovery-based ROMs → reboot device to recovery and **ADB Sideload** the ZIP
- Fastboot-based ROMs → manual flash via the tools above
- Bootloader unlock reminder

### 3. Backup Kernel (`/backup-kernel`)
- Auto-detects the connected Xiaomi device — **no manual serial input**
- Pick a destination folder via native folder picker
- Backup partitions: **boot**, **vendor_boot**, **dtbo**, **vbmeta**
- Saves each as `<folder>/<partition>.img`
- SHA-256 note and restore confirmation warning
- Backup history table (illustrative sample data)

### 4. Device Monitor & Logs
- Live device list with model, codename, serial, slot, USB status
- Bootloader lock / unauthorized flags
- Application logs with export/clear

### 5. Settings
- **Theme:** Dark / Light / Follow System (applies to entire UI via `data-theme`)
- **Language:** locked to **English** (read-only)
- **Paths:** ADB, Fastboot, temp ROM directory, logs directory with native browse
- **Developer:** Telegram channel and account links

---

## Installation

Download the latest installer from the **Releases** section:

- `Sakura Flasher Setup 1.0.0.exe` — installer with optional install location and desktop shortcut
- `Sakura Flasher.exe` — portable `win-unpacked` build

> The installer is **not code-signed**. Windows SmartScreen may show "Unknown publisher". Choose **More info → Run anyway**.

Before flashing, install [Android SDK Platform-Tools](https://developer.android.com/tools/releases/platform-tools) and ensure `adb` and `fastboot` are available, or let the app auto-detect them.

---

## Development

### Requirements
- Node.js (LTS)
- Windows 10/11 (target platform)

### Install dependencies
```bash
npm install
```

### Run in dev mode
```bash
npm run dev
```
Concurrently starts Electron main, Vite renderer, and the Electron app (default dev port `5173`).

### Build (web renderer only)
```bash
npm run build
```

### Type check
```bash
npm run typecheck
```

### Build installer (.exe)
```bash
npm run dist
```
Outputs:
- `release\Sakura Flasher Setup 1.0.0.exe` (NSIS installer)
- `release\win-unpacked\Sakura Flasher.exe` (portable)

### Clean build artifacts
```bash
npm run clean
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 45 |
| UI | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| IPC | Electron `contextBridge` + `ipcMain` |
| Packaging | electron-builder (NSIS) |

---

## Developer

Built and maintained by **yuyuarumi**.

- Telegram Channel: <https://t.me/yuyuarumi>
- Telegram Account: `@wannesyht`

Join the channel for updates or message directly for support. Terima kasih sudah memakai Sakura Flasher!

---

## License

MIT License — see [LICENSE](LICENSE).
