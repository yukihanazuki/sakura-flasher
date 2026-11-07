// Shared type definitions between main, preload, and renderer

export type DeviceMode =
  | 'adb'
  | 'recovery'
  | 'sideload'
  | 'fastboot'
  | 'fastbootd'
  | 'unauthorized'
  | 'offline';

export type BootloaderState = 'locked' | 'unlocked' | 'unknown' | 'relocked' | 'unlocked-critical';

export interface ToolInfo {
  name: 'adb' | 'fastboot';
  path: string;
  available: boolean;
  version?: string;
  error?: string;
}

export interface Device {
  serial: string;
  mode: DeviceMode;
  model?: string;
  codename?: string;
  productName?: string;
  brand?: string;
  androidVersion?: string;
  buildId?: string;
  slot?: 'a' | 'b';
  hasSlot?: boolean;
  bootloader: BootloaderState;
  verifiedBoot?: string;
  anti?: number;
  transfer?: number;
  vars: Record<string, string>;
  detailLoaded: boolean;
  firstSeen: number;
  lastSeen: number;
}

export interface DeviceSnapshot {
  devices: Device[];
  scannedAt: number;
  adb: ToolInfo;
  fastboot: ToolInfo;
  scanning: boolean;
}

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  source: string;
  message: string;
}

export type LogLevel =
  | 'info'
  | 'warn'
  | 'error'
  | 'success'
  | 'debug'
  | 'command'
  | 'output';


export type FlashMethod = 'clean-all' | 'save-data' | 'clean-all-lock';

export type RomKind = 'fastboot' | 'recovery' | 'unknown';

export type RomCommandKind =
  | 'flash'
  | 'erase'
  | 'reboot'
  | 'reboot-bootloader'
  | 'set-active'
  | 'boot'
  | 'lock'
  | 'oem'
  | 'flashing'
  | 'format'
  | 'wipe-super'
  | 'other';

export interface RomCommand {
  kind: RomCommandKind;
  raw: string;
  partition?: string;
  file?: string;
  fileSize?: number;
  flags: string[];
  args: string[];
  display: string;
  line: number;
  source: string;
  derived?: boolean;
}

export interface RomScript {
  name: string;
  source: 'script' | 'derived' | 'generated';
  scriptPath: string;
  commands: RomCommand[];
  lockCommand?: string;
  error?: string;
}

export interface RomAnalysis {
  id: string;
  archivePath: string;
  filename: string;
  format: 'tgz' | 'tar' | 'zip' | 'unknown';
  sizeBytes: number;
  kind: RomKind;
  rootDir?: string;
  extracted: boolean;
  extractionProgress?: number;
  codename?: string;
  romVersion?: string;
  region?: string;
  androidVersion?: string;
  antiVersion?: number;
  files: string[];
  images: string[];
  body: Record<string, string>;
  responses: string[];
  notes: string[];
  scripts: Record<FlashMethod, RomScript | null>;
  issues: RomIssue[];
}

export interface RomIssue {
  severity: 'info' | 'warn' | 'error';
  code: string;
  message: string;
}

export interface FlashRunOptions {
  analysisId: string;
  method: FlashMethod;
  serial: string;
  lockCommand?: 'oem lock' | 'flashing lock';
  confirmedCodename?: string;
  acknowledgeUnlock?: boolean;
  continueOnError?: boolean;
  removeUserData?: boolean;
  skipReboot?: boolean;
  dryRun?: boolean;
}

export type FlashStatus =
  | 'idle'
  | 'validating'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface FlashProgress {
  totalSteps: number;
  completedSteps: number;
  currentStep?: number;
  stepLabel?: string;
  stepPartition?: string;
  currentFile?: string;
  percent?: number;
  stepPercent?: number;
  stepSuffix?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface FlashResult {
  runId: string;
  status: FlashStatus;
  serial?: string;
  method?: FlashMethod;
  error?: string;
  completedSteps: number;
  totalSteps: number;
  logFile?: string;
  startTs: number;
  endTs: number;
  commands: RomCommand[];
  relockSuggested?: boolean;
  activeCommand?: string;
}

export interface Partition {
  name: string;
  sizeBytes?: number;
  type?: string;
  slot?: 'a' | 'b' | 'both';
  dynamic?: boolean;
  logical?: boolean;
  source: 'fastboot' | 'adb';
}

export interface PartitionList {
  serial: string;
  mode: DeviceMode;
  partitions: Partition[];
  currentSlot?: string;
  slotCount?: number;
  dynamicSuper?: boolean;
  fetchedAt: number;
  note?: string;
}

export interface AndroidImageInfo {
  path: string;
  name: string;
  sizeBytes: number;
  format: 'android-boot' | 'sparse' | 'raw' | 'ext4' | 'zip' | 'gzip' | 'unknown';
  magic?: string;
  notes?: string[];
}

export interface Settings {
  adbPath: string;
  fastbootPath: string;
  theme: 'dark' | 'light' | 'system';
  language: 'en';
  tempDir: string;
  logDir: string;
  notifications: {
    enabled: boolean;
    onDeviceConnect: boolean;
    onFlashComplete: boolean;
    onError: boolean;
  };
  confirmDestructive: boolean;
  autoRefresh: boolean;
  refreshIntervalMs: number;
  showTimestamps: boolean;
  showLogLevel: boolean;
  defaultFlashMethod: FlashMethod;
  updateRepo: string;
}

export interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
  resourcesPath: string;
  logDir: string;
  tempDir: string;
}

export interface UpdateInfo {
  repo: string;
  configured: boolean;
  current: string;
  latest?: string;
  url?: string;
  publishedAt?: string;
  error?: string;
}

export interface ShellSession {
  id: string;
  serial: string;
  pid?: number;
  started: number;
  exited: boolean;
}

export interface FilePickResult {
  ok: boolean;
  canceled: boolean;
  path: string;
  paths: string[];
  error?: string;
}

// IPC event envelope
export interface IpcEventMap {
  'devices:changed': DeviceSnapshot;
  'devices:tools': { adb: ToolInfo; fastboot: ToolInfo };
  'log:entry': LogEntry;
  'flash:progress': { runId: string; progress: FlashProgress };
  'flash:log': { runId: string; entry: LogEntry };
  'flash:done': { runId: string; result: FlashResult };
  'flash:started': { runId: string; options: FlashRunOptions; commands: RomCommand[] };
  'rom:progress': { id: string; stage: string; percent?: number; detail?: string };
  'transfer:progress': { id: string; label: string; percent?: number; detail?: string };
  'tool:busy': { tool: 'adb' | 'fastboot'; busy: boolean; label: string };
  'shell:data': { sessionId: string; data: string };
  'shell:exit': { sessionId: string; code: number | null };
  'shell:error': { sessionId: string; error: string };
  'app:toast': { level: LogLevel; title: string; message: string };
  'settings:changed': Settings;
  'window:fullscreen': boolean;
}
