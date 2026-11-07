import type {
  AndroidImageInfo,
  AppInfo,
  DeviceSnapshot,
  FlashProgress,
  FlashResult,
  FlashRunOptions,
  LogEntry,
  RomAnalysis,
  Settings,
  ToolInfo,
  UpdateInfo,
  FilePickResult,
} from '@shared/types';
import type { FlashMethod } from '@shared/types';

export interface FlashStartedEvent {
  runId: string;
  options: FlashRunOptions & { serial: string };
  commands: import('@shared/types').RomCommand[];
}

export interface FlashProgressEvent {
  runId: string;
  progress: FlashProgress;
}

export interface FlashLogEvent {
  runId: string;
  entry: LogEntry;
}

export interface FlashDoneEvent {
  runId: string;
  result: FlashResult;
}

export interface ShellDataEvent {
  sessionId: string;
  data: string;
  stream?: 'stdout' | 'stderr';
}

export interface XiaomiApi {
  getSettings: () => Promise<Settings>;
  updateSettings: (partial: Partial<Settings>) => Promise<Settings>;
  setTheme: (theme: 'dark' | 'light' | 'system') => Promise<Settings>;
  setLanguage: (language: 'en') => Promise<Settings>;

  toolsCheck: () => Promise<{ adb: ToolInfo; fastboot: ToolInfo }>;

  getDevices: () => Promise<DeviceSnapshot>;
  refreshDevices: () => Promise<DeviceSnapshot>;

  adbShell: (serial: string, cmd: string) => Promise<string>;
  adbReboot: (serial: string, target: 'system' | 'recovery' | 'bootloader' | 'fastbootd') => Promise<void>;
  adbInstall: (serial: string, apkPath: string) => Promise<void>;
  adbSideload: (serial: string, zipPath: string) => Promise<void>;
  adbPull: (serial: string, remote: string, local: string) => Promise<void>;
  adbPush: (serial: string, local: string, remote: string) => Promise<void>;

  shellStart: (serial: string) => Promise<{ sessionId: string; serial: string; started: number }>;
  shellWrite: (sessionId: string, input: string) => Promise<void>;
  shellStop: (sessionId: string) => Promise<void>;

  fastbootCommand: (serial: string, args: string[]) => Promise<FastbootResult>;
  fastbootReboot: (serial: string, target: 'system' | 'recovery' | 'bootloader' | 'fastbootd') => Promise<void>;
  fastbootFlash: (serial: string, partition: string, imagePath: string) => Promise<FastbootResult>;
  fastbootErase: (serial: string, partition: string) => Promise<FastbootResult>;
  fastbootBoot: (serial: string, imagePath: string) => Promise<FastbootResult>;
  fastbootGetVar: (serial: string, varName?: string) => Promise<{ ok: boolean; vars: Record<string, string>; raw: string }>;
  fastbootGetvarAll: (serial: string) => Promise<{ ok: boolean; vars: Record<string, string>; raw: string }>;
  fastbootSetActive: (serial: string, slot: 'a' | 'b') => Promise<void>;
  fastbootFlashCustom: (serial: string, partition: string, imagePath: string) => Promise<FastbootResult>;
  fastbootLock: (serial: string, command: 'oem lock' | 'flashing lock') => Promise<FastbootResult>;

  romAnalyze: (archivePath: string) => Promise<RomAnalysis>;
  romPick: () => Promise<{ ok: boolean; path: string }>;
  flashStart: (options: FlashRunOptions & { serial: string; runId?: string; method: FlashMethod }) => Promise<FlashResult>;
  flashCancel: (runId: string) => Promise<boolean>;
  flashRecordCheck: (serial: string, codename: string) => Promise<boolean>;

  partitionListFastboot: (serial: string) => Promise<Record<string, string>>;
  partitionBackup: (serial: string, partition: string, targetPath: string) => Promise<{ ok: boolean; path: string }>;
  imageAnalyze: (imagePath: string) => Promise<AndroidImageInfo>;

  getLogs: () => Promise<LogEntry[]>;
  exportLogs: (filePath: string) => Promise<void>;
  clearLogs: () => Promise<void>;
  openLogsFolder: () => Promise<void>;

  browsePath: (kind: 'adb' | 'fastboot' | 'temp' | 'log' | 'rom' | 'image' | 'apk') => Promise<{ ok: boolean; path: string }>;
  pickFile: (filters?: string[]) => Promise<FilePickResult>;
  pickDirectory: () => Promise<FilePickResult>;
  saveFile: (defaultPath?: string) => Promise<FilePickResult>;

  appInfo: () => Promise<AppInfo>;
  checkUpdates: () => Promise<UpdateInfo>;
  openExternal: (url: string) => Promise<void>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;

  onEvent: <T>(channel: string, cb: (payload: T) => void) => () => void;
}

export interface FastbootResult {
  ok: boolean;
  output: string;
  code: number | null;
  timedOut: boolean;
  error?: { message?: string };
}

declare global {
  interface Window {
    api?: XiaomiApi;
  }
}

export const api: XiaomiApi = (window as any).api;
