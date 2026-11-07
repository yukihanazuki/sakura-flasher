import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ChildProcess } from 'node:child_process';

import { LogService } from './services/logger';
import { SettingsService } from './services/settings-service';
import { DeviceMonitor } from './services/device-monitor';
import { runCommand } from './services/command-runner';
import { AdbService } from './services/adb-service';
import { FastbootService } from './services/fastboot-service';
import { FlashManager } from './services/flash-manager';
import { analyzeArchive } from './services/rom-service';
import { startShellSession, sendToStdin, stopStdin, killChild } from './services/shell-session';

import type { FlashRunOptions, RomAnalysis, Settings } from '../shared/types';


const USER_DATA = app.getPath('userData');
const LOG_DIR = path.join(USER_DATA, 'logs');
const TEMP_DIR = path.join(USER_DATA, 'temp');
const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'index.js');
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');


const logService = new LogService(LOG_DIR);
const settings = new SettingsService(USER_DATA);

const getAdbPath = () => settings.get().adbPath || settings.detectToolPath('adb');
const getFastbootPath = () => settings.get().fastbootPath || settings.detectToolPath('fastboot');

const adbService = new AdbService(getAdbPath, logService);
const fastbootService = new FastbootService(getFastbootPath, logService);

const deviceMonitor = new DeviceMonitor(logService, () => ({
  adb: getAdbPath(),
  fastboot: getFastbootPath(),
}));

const flashManager = new FlashManager(fastbootService, logService, deviceMonitor, (channel, payload) => {
  sendToRenderer(channel, payload);
});

/** Recently analyzed ROMs, keyed by analysis id. */
const analyses = new Map<string, RomAnalysis>();

/** Interactive adb shell sessions. */
const shellSessions = new Map<string, ChildProcess>();


let mainWindow: BrowserWindow | null = null;
let ipcSetup = false;

function sendToRenderer(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      w.webContents.send(channel, payload);
    } catch {
      // ignore
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1100,
    minHeight: 700,
    title: 'HayaseTools',
    backgroundColor: '#0A0A0B',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_PATH,
    },
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#0A0A0B',
            symbolColor: '#EDEDEF',
            height: 40,
          },
        }
      : {}),
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
    mainWindow.loadFile(indexPath).catch((err) => console.error('Failed to load renderer:', err));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}


function setupIpc(win: BrowserWindow) {
  if (ipcSetup) return;
  ipcSetup = true;

  ipcMain.handle('settings:get', async () => settings.get());

  ipcMain.handle('settings:update', async (_e, partial: Partial<Settings>) => {
    const next = settings.update(partial);
    sendToRenderer('settings:changed', next);
    return next;
  });

  ipcMain.handle('tools:check', async () => {
    const checkVersion = async (bin: string) => {
      if (!bin || !fs.existsSync(bin)) return { available: false };
      try {
        const res = await runCommand(bin, ['--version'], { timeoutMs: 5000 });
        const version = (res.stdout + res.stderr).trim().split(/\r?\n/)[0] || 'unknown';
        return { available: true, version };
      } catch {
        return { available: true, version: 'error' };
      }
    };
    const [adb, fastboot] = await Promise.all([checkVersion(getAdbPath()), checkVersion(getFastbootPath())]);
    return {
      adb: { name: 'adb', path: getAdbPath(), available: adb.available, version: adb.version },
      fastboot: { name: 'fastboot', path: getFastbootPath(), available: fastboot.available, version: fastboot.version },
    };
  });

  ipcMain.handle('device:list', async () => deviceMonitor.getSnapshot());
  ipcMain.handle('device:refresh', async () => {
    await deviceMonitor.refreshNow();
    return deviceMonitor.getSnapshot();
  });

  ipcMain.handle('tools:browse', async (_e, kind: string) => {
    if (kind === 'temp' || kind === 'log') {
      const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
      return res.canceled ? { ok: false, path: '' } : { ok: true, path: res.filePaths[0] };
    }
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['exe', ''] }],
    });
    return res.canceled ? { ok: false, path: '' } : { ok: true, path: res.filePaths[0] };
  });

  ipcMain.handle('dialog:openFile', async (_e, { filters }: { filters?: string[] } = {}) => {
    const exts = (filters ?? []).map((f) => f.replace(/^\./, ''));
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: exts.length ? [{ name: 'Supported files', extensions: exts }] : undefined,
    });
    return { ok: !res.canceled, canceled: res.canceled, path: res.filePaths[0] ?? '', paths: res.filePaths };
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    return { ok: !res.canceled, canceled: res.canceled, path: res.filePaths[0] ?? '', paths: res.filePaths };
  });

  ipcMain.handle('dialog:saveFile', async (_e, { defaultPath }: { defaultPath?: string } = {}) => {
    const res = await dialog.showSaveDialog(win, { defaultPath });
    return { ok: !res.canceled, canceled: res.canceled, path: res.filePath ?? '' };
  });

  ipcMain.handle('rom:pick', async () => {
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Fastboot / Recovery ROM', extensions: ['tgz', 'tar', 'gz', 'zip'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    return res.canceled ? { ok: false, path: '' } : { ok: true, path: res.filePaths[0] };
  });

  ipcMain.handle('logs:get', async () => logService.all());
  ipcMain.handle('logs:export', async (_e, filePath: string) => logService.exportTo(filePath));
  ipcMain.handle('logs:clear', async () => {
    logService.clear();
    return true;
  });
  ipcMain.handle('logs:openFolder', async () => {
    void shell.openPath(LOG_DIR);
    return true;
  });

  ipcMain.handle('adb:shell', async (_e, { serial, cmd }: { serial: string; cmd: string }) => adbService.shell(serial, cmd));
  ipcMain.handle('adb:reboot', async (_e, { serial, target }: { serial: string; target: string }) =>
    adbService.reboot(serial, target as 'system' | 'recovery' | 'bootloader' | 'fastbootd'));
  ipcMain.handle('adb:install', async (_e, { serial, apkPath }: { serial: string; apkPath: string }) => adbService.install(serial, apkPath));
  ipcMain.handle('adb:sideload', async (_e, { serial, zipPath }: { serial: string; zipPath: string }) => adbService.sideload(serial, zipPath));
  ipcMain.handle('adb:pull', async (_e, { serial, remote, local }: { serial: string; remote: string; local: string }) => adbService.pull(serial, remote, local));
  ipcMain.handle('adb:push', async (_e, { serial, local, remote }: { serial: string; local: string; remote: string }) => adbService.push(serial, local, remote));

  ipcMain.handle('fastboot:command', async (_e, { serial, args }: { serial: string; args: string[] }) =>
    fastbootService.exec(args, { serial, timeoutMs: 60_000 }));
  ipcMain.handle('fastboot:reboot', async (_e, { serial, target }: { serial: string; target: string }) =>
    fastbootService.reboot(serial, target as 'system' | 'recovery' | 'bootloader' | 'fastbootd'));
  ipcMain.handle('fastboot:flash', async (_e, { serial, partition, imagePath }: { serial: string; partition: string; imagePath: string }) =>
    fastbootService.flash(serial, partition, imagePath));
  ipcMain.handle('fastboot:erase', async (_e, { serial, partition }: { serial: string; partition: string }) =>
    fastbootService.erase(serial, partition));
  ipcMain.handle('fastboot:boot', async (_e, { serial, imagePath }: { serial: string; imagePath: string }) =>
    fastbootService.boot(serial, imagePath));
  ipcMain.handle('fastboot:getvar', async (_e, { serial, varName }: { serial: string; varName?: string }) =>
    fastbootService.getvar(serial, varName));
  ipcMain.handle('fastboot:getvar-all', async (_e, { serial }: { serial: string }) => fastbootService.getvar(serial));
  ipcMain.handle('fastboot:set-active', async (_e, { serial, slot }: { serial: string; slot: 'a' | 'b' }) =>
    fastbootService.setActive(serial, slot));
  ipcMain.handle('fastboot:flash-custom', async (_e, { serial, partition, imagePath }: { serial: string; partition: string; imagePath: string }) =>
    fastbootService.flash(serial, partition, imagePath));
  ipcMain.handle('fastboot:lock', async (_e, { serial, command }: { serial: string; command: 'oem lock' | 'flashing lock' }) =>
    fastbootService.lock(serial, command));

  ipcMain.handle('shell:start', async (_e, serial: string) => {
    const { session, child } = startShellSession(getAdbPath(), serial, logService, sendToRenderer);
    shellSessions.set(session.id, child);
    return { sessionId: session.id, serial, started: session.started };
  });
  ipcMain.handle('shell:write', async (_e, { sessionId, input }: { sessionId: string; input: string }) => {
    const child = shellSessions.get(sessionId);
    if (!child) throw new Error('Shell session not found');
    sendToStdin(child, input);
    return true;
  });
  ipcMain.handle('shell:stop', async (_e, sessionId: string) => {
    const child = shellSessions.get(sessionId);
    if (child) {
      stopStdin(child);
      killChild(child);
      shellSessions.delete(sessionId);
    }
    return true;
  });

  ipcMain.handle('rom:analyze', async (_e, archivePath: string) => {
    const analysis = await analyzeArchive(archivePath, logService, settings.get().tempDir || TEMP_DIR);
    analyses.set(analysis.id, analysis);
    return analysis;
  });

  ipcMain.handle('flash:start', async (_e, options: FlashRunOptions & { serial: string; runId?: string }) => {
    const analysis = analyses.get(options.analysisId);
    if (!analysis) {
      throw new Error('ROM analysis not found — analyze the archive again before flashing.');
    }
    if (analysis.kind === 'recovery') {
      throw new Error('This is a recovery ROM. Use ADB sideload in the ADB Tools page instead.');
    }
    if (!options.serial) {
      throw new Error('Select a device before flashing.');
    }
    const script = analysis.scripts[options.method];
    if (!script || script.commands.length === 0) {
      throw new Error(`No usable ${options.method} script was found in this ROM.`);
    }
    sendToRenderer('flash:started', {
      runId: options.runId ?? '',
      options,
      commands: script.commands,
    });
    const result = await flashManager.start(analysis, options);
    sendToRenderer('flash:done', { runId: result.runId, result });
    return result;
  });

  ipcMain.handle('flash:cancel', async (_e, runId: string) => flashManager.cancel(runId));

  ipcMain.handle('flash:record-check', async (_e, { serial, codename }: { serial: string; codename: string }) => {
    const userData = app.getPath('userData');
    const recPath = path.join(userData, 'flash-records.json');
    try {
      const records = JSON.parse(fs.readFileSync(recPath, 'utf8')) as Array<{ serial: string; codename: string }>;
      return records.some((r) => r.serial === serial && r.codename === codename);
    } catch {
      return false;
    }
  });

  ipcMain.handle('partition:list-fastboot', async (_e, { serial }: { serial: string }) => {
    const res = await fastbootService.getvar(serial);
    const partitions: Record<string, string> = {};
    for (const [key, value] of Object.entries(res.vars)) {
      const m = key.match(/^partition-(size|type):(.+)$/);
      if (m) {
        const name = m[2];
        if (m[1] === 'size') partitions[name] = value;
        else if (!(name in partitions)) partitions[name] = '';
      }
    }
    return partitions;
  });

  ipcMain.handle('partition:backup', async (_e, { serial, partition, targetPath }: { serial: string; partition: string; targetPath: string }) => {
    const res = await fastbootService.fetchPart(serial, partition, targetPath);
    if (!res.ok) throw new Error(`Backup failed: ${res.output.trim().slice(-300)}`);
    return { ok: true, path: targetPath };
  });

  ipcMain.handle('image:analyze', async (_e, imagePath: string) => {
    const { analyzeImage } = await import('./services/image-service');
    return analyzeImage(imagePath);
  });

  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    resourcesPath: process.resourcesPath,
    logDir: LOG_DIR,
    tempDir: TEMP_DIR,
  }));

  ipcMain.handle('app:check-updates', async () => {
    const repo = settings.get().updateRepo.trim();
    const current = app.getVersion();
    if (!repo) return { repo: '', configured: false, current };
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { 'User-Agent': 'xiaomi-flash-tool', Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
      const data = (await res.json()) as { tag_name?: string; html_url?: string; published_at?: string };
      return {
        repo,
        configured: true,
        current,
        latest: (data.tag_name ?? '').replace(/^v/, '') || undefined,
        url: data.html_url,
        publishedAt: data.published_at,
      };
    } catch (e) {
      return { repo, configured: true, current, error: (e as Error).message };
    }
  });

  ipcMain.handle('app:open-external', async (_e, url: string) => {
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('window:minimize', async () => {
    void win.minimize();
    return true;
  });
  ipcMain.handle('window:maximize', async () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return true;
  });
  ipcMain.handle('window:close', async () => {
    void win.close();
    return true;
  });
}


app.whenReady().then(() => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  if (!settings.get().adbPath) settings.update({ adbPath: settings.detectToolPath('adb') });
  if (!settings.get().fastbootPath) settings.update({ fastbootPath: settings.detectToolPath('fastboot') });

  deviceMonitor.start();
  deviceMonitor.subscribe((snapshot) => sendToRenderer('devices:changed', snapshot));
  logService.subscribe((entry) => sendToRenderer('log:entry', entry));
  settings.subscribe((s) => sendToRenderer('settings:changed', s));

  const win = createWindow();
  setupIpc(win);
});

app.on('window-all-closed', () => {
  deviceMonitor.stop();
  for (const child of shellSessions.values()) killChild(child);
  shellSessions.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    void mainWindow.focus();
  }
});