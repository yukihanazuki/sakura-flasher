import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  DeviceSnapshot,
  FlashResult,
  FlashRunOptions,
  LogEntry,
  RomAnalysis,
  Settings,
  ToolInfo,
  UpdateInfo,
  AppInfo,
} from '../shared/types';
import type { FlashMethod, FilePickResult } from '../shared/types';


const EVENT_CHANNELS = new Set([
  'devices:changed',
  'log:entry',
  'flash:started',
  'flash:progress',
  'flash:log',
  'flash:done',
  'rom:progress',
  'transfer:progress',
  'shell:data',
  'shell:exit',
  'shell:error',
  'app:toast',
  'settings:changed',
]);

type EventCallback<T = unknown> = (payload: T) => void;

const perChannelHandlers = new Map<string, Set<(e: IpcRendererEvent, ...args: unknown[]) => void>>();

function addListener<T>(channel: string, cb: EventCallback<T>): () => void {
  if (!EVENT_CHANNELS.has(channel)) {
    throw new Error(`Channel "${channel}" is not allowed for renderer subscription.`);
  }
  const handler = (_e: IpcRendererEvent, payload: unknown) => cb(payload as T);
  let set = perChannelHandlers.get(channel);
  if (!set) {
    set = new Set();
    perChannelHandlers.set(channel, set);
  }
  set.add(handler);
  ipcRenderer.on(channel, handler);
  return () => {
    set!.delete(handler);
    ipcRenderer.removeListener(channel, handler);
  };
}


const api = {
  // Settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:update', partial),
  setTheme: (theme: 'dark' | 'light' | 'system'): Promise<Settings> =>
    ipcRenderer.invoke('settings:update', { theme }),
  setLanguage: (language: 'en' | 'id'): Promise<Settings> =>
    ipcRenderer.invoke('settings:update', { language }),
  browsePath: (kind: 'adb' | 'fastboot' | 'temp' | 'log' | 'rom' | 'image' | 'apk'):
    Promise<{ ok: boolean; path: string }> => ipcRenderer.invoke('tools:browse', kind),

  // Tools
  toolsCheck: (): Promise<{ adb: ToolInfo; fastboot: ToolInfo }> => ipcRenderer.invoke('tools:check'),

  // Devices
  getDevices: (): Promise<DeviceSnapshot> => ipcRenderer.invoke('device:list'),
  refreshDevices: (): Promise<DeviceSnapshot> => ipcRenderer.invoke('device:refresh'),

  // ADB actions
  adbShell: (serial: string, cmd: string): Promise<string> =>
    ipcRenderer.invoke('adb:shell', { serial, cmd }),
  adbReboot: (serial: string, target: 'system' | 'recovery' | 'bootloader' | 'fastbootd'): Promise<void> =>
    ipcRenderer.invoke('adb:reboot', { serial, target }),
  adbInstall: (serial: string, apkPath: string): Promise<void> =>
    ipcRenderer.invoke('adb:install', { serial, apkPath }),
  adbSideload: (serial: string, zipPath: string): Promise<void> =>
    ipcRenderer.invoke('adb:sideload', { serial, zipPath }),
  adbPull: (serial: string, remote: string, local: string): Promise<void> =>
    ipcRenderer.invoke('adb:pull', { serial, remote, local }),
  adbPush: (serial: string, local: string, remote: string): Promise<void> =>
    ipcRenderer.invoke('adb:push', { serial, local, remote }),

  // Fastboot actions
  fastbootCommand: (serial: string, args: string[]): Promise<unknown> =>
    ipcRenderer.invoke('fastboot:command', { serial, args }),
  fastbootReboot: (serial: string, target: 'system' | 'recovery' | 'bootloader' | 'fastbootd'): Promise<void> =>
    ipcRenderer.invoke('fastboot:reboot', { serial, target }),
  fastbootFlash: (serial: string, partition: string, imagePath: string): Promise<unknown> =>
    ipcRenderer.invoke('fastboot:flash', { serial, partition, imagePath }),
  fastbootErase: (serial: string, partition: string): Promise<unknown> =>
    ipcRenderer.invoke('fastboot:erase', { serial, partition }),
  fastbootBoot: (serial: string, imagePath: string): Promise<unknown> =>
    ipcRenderer.invoke('fastboot:boot', { serial, imagePath }),
  fastbootGetVar: (serial: string, varName?: string): Promise<{ ok: boolean; vars: Record<string, string>; raw: string }> =>
    ipcRenderer.invoke('fastboot:getvar', { serial, varName }),
  fastbootGetvarAll: (serial: string): Promise<{ ok: boolean; vars: Record<string, string>; raw: string }> =>
    ipcRenderer.invoke('fastboot:getvar-all', { serial }),
  fastbootSetActive: (serial: string, slot: 'a' | 'b'): Promise<void> =>
    ipcRenderer.invoke('fastboot:set-active', { serial, slot }),
  fastbootFlashCustom: (serial: string, partition: string, imagePath: string): Promise<unknown> =>
    ipcRenderer.invoke('fastboot:flash-custom', { serial, partition, imagePath }),
  fastbootLock: (serial: string, command: 'oem lock' | 'flashing lock'): Promise<unknown> =>
    ipcRenderer.invoke('fastboot:lock', { serial, command }),

  // Shell sessions
  shellStart: (serial: string): Promise<{ sessionId: string; serial: string; started: number }> =>
    ipcRenderer.invoke('shell:start', serial),
  shellWrite: (sessionId: string, input: string): Promise<void> =>
    ipcRenderer.invoke('shell:write', { sessionId, input }),
  shellStop: (sessionId: string): Promise<void> => ipcRenderer.invoke('shell:stop', sessionId),

  // ROM analysis / flashing
  romAnalyze: (archivePath: string): Promise<RomAnalysis> =>
    ipcRenderer.invoke('rom:analyze', archivePath),
  romPick: (): Promise<{ ok: boolean; path: string }> => ipcRenderer.invoke('rom:pick'),
  flashStart: (options: FlashRunOptions & { serial: string; runId?: string; method: FlashMethod }): Promise<FlashResult> =>
    ipcRenderer.invoke('flash:start', options),
  flashCancel: (runId: string): Promise<boolean> => ipcRenderer.invoke('flash:cancel', runId),
  flashRecordCheck: (serial: string, codename: string): Promise<boolean> =>
    ipcRenderer.invoke('flash:record-check', { serial, codename }),

  // Partition tools
  partitionListFastboot: (serial: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke('partition:list-fastboot', { serial }),
  partitionBackup: (serial: string, partition: string, targetPath: string): Promise<{ ok: boolean; path: string }> =>
    ipcRenderer.invoke('partition:backup', { serial, partition, targetPath }),
  imageAnalyze: (imagePath: string): Promise<unknown> => ipcRenderer.invoke('image:analyze', imagePath),

  // Logs
  getLogs: (): Promise<LogEntry[]> => ipcRenderer.invoke('logs:get'),
  exportLogs: (filePath: string): Promise<void> => ipcRenderer.invoke('logs:export', filePath),
  clearLogs: (): Promise<void> => ipcRenderer.invoke('logs:clear'),
  openLogsFolder: (): Promise<void> => ipcRenderer.invoke('logs:openFolder'),

  // Pickers
  pickFile: (filters?: string[]): Promise<FilePickResult> =>
    ipcRenderer.invoke('dialog:openFile', { filters }),
  pickDirectory: (): Promise<FilePickResult> => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (defaultPath?: string): Promise<FilePickResult> =>
    ipcRenderer.invoke('dialog:saveFile', { defaultPath }),

  // App / updates / window
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  checkUpdates: (): Promise<UpdateInfo> => ipcRenderer.invoke('app:check-updates'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:open-external', url),
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),

  // Event subscription
  onEvent: addListener,
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: typeof api;
  }
}
