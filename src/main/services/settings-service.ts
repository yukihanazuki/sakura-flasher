import type { Settings } from '../../shared/types';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

export const DEFAULT_SETTINGS: Settings = {
  adbPath: '',
  fastbootPath: '',
  theme: 'dark',
  language: 'en',
  tempDir: path.join(os.tmpdir(), 'XiaomiFlashTool'),
  logDir: path.join(os.homedir(), 'AppData', 'Roaming', 'XiaomiFlashTool', 'logs'),
  notifications: {
    enabled: true,
    onDeviceConnect: true,
    onFlashComplete: true,
    onError: true,
  },
  confirmDestructive: true,
  autoRefresh: true,
  refreshIntervalMs: 2000,
  showTimestamps: true,
  showLogLevel: true,
  defaultFlashMethod: 'clean-all',
  updateRepo: '',
};

const COMMON_DIR = (execName: string) => [
  path.join('D:', 'Android', 'Sdk', 'platform-tools', execName),
  path.join(process.env.ANDROID_HOME ?? '', 'platform-tools', execName),
  path.join(process.env.ANDROID_SDK_ROOT ?? '', 'platform-tools', execName),
  path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', execName),
  path.join('C:', 'Android', 'Sdk', 'platform-tools', execName),
  path.join('C:', 'Program Files', 'platform-tools', execName),
  path.join(fs.realpathSync(process.resourcesPath ?? process.cwd()), 'platform-tools', execName),
];

function findToolPath(execName: string): string {
  for (const candidate of COMMON_DIR(execName)) {
    if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  // PATH lookup
  try {
    const out = process.platform === 'win32'
      ? spawnSync('where', [execName], { encoding: 'utf8', windowsHide: true })
      : spawnSync('which', [execName], { encoding: 'utf8' });
    const candidate = (out.stdout || '').split(/\r?\n/)[0]?.trim();
    if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  } catch {
    // ignore
  }
  return '';
}

export function detectToolPath(execName: string): string {
  const suffix = process.platform === 'win32' ? 'adp.exe' : 'adp';
  void suffix;
  return findToolPath(execName);
}

function findToolDir(execName: string): string {
  const p = findToolPath(execName);
  return p ? path.dirname(p) : '';
}

export { findToolPath, findToolDir };

export class SettingsService {
  private settings!: Settings;
  private listeners = new Set<(s: Settings) => void>();

  constructor(private dir: string) {
    const defaults: Settings = {
      ...DEFAULT_SETTINGS,
      adbPath: detectToolPath('adb'),
      fastbootPath: detectToolPath('fastboot'),
    };
    try {
      const p = path.join(dir, 'settings.json');
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw) as Partial<Settings>;
        this.settings = { ...defaults, ...parsed };
      } else {
        this.settings = defaults;
        fs.writeFileSync(p, JSON.stringify(defaults, null, 2));
      }
    } catch {
      this.settings = defaults;
    }
    // Ensure directories exist.
    try {
      fs.mkdirSync(this.settings.tempDir, { recursive: true });
      fs.mkdirSync(this.settings.logDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  detectToolPath(execName: 'adb' | 'fastboot'): string {
    return findToolPath(execName);
  }

  get(): Settings {
    return { ...this.settings, notifications: { ...this.settings.notifications } };
  }

  update(partial: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...partial };
    try {
      const p = path.join(this.dir, 'settings.json');
      fs.writeFileSync(p, JSON.stringify(this.settings, null, 2));
    } catch {
      // ignore
    }
    const snapshot = this.get();
    this.listeners.forEach((cb) => cb(snapshot));
    return snapshot;
  }

  set(partial: Partial<Settings>) {
    return this.update(partial);
  }

  subscribe(cb: (s: Settings) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  resolveAdbPath(): string {
    return this.settings.adbPath || detectToolPath('adb');
  }

  resolveFastbootPath(): string {
    return this.settings.fastbootPath || detectToolPath('fastboot');
  }
}
