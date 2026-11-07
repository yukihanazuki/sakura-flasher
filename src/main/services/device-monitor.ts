import type {
  Device,
  DeviceMode,
  DeviceSnapshot,
  ToolInfo,
} from '../../shared/types';
import { runCommand } from './command-runner';
import type { LogService } from './logger';

const DETAIL_TTL = 15_000;

interface PollResult {
  adb: { serial: string; state: string; props: string }[];
  fastboot: { serial: string; state: string }[];
  adbRaw: string;
  fastbootRaw: string;
  errors: string[];
}

/**
 * Polls ADB and Fastboot on an interval. Never blocks the main thread with
 * synchronous process calls. Emits a merged snapshot only when something
 * meaningful changed.
 */
export class DeviceMonitor {
  private devices = new Map<string, Device>();
  private detailFetchedAt = new Map<string, number>();
  private enriching = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private started = false;
  private lastFingerprint = '';
  private listeners = new Set<(snapshot: DeviceSnapshot) => void>();
  private tools: { adb: ToolInfo; fastboot: ToolInfo } = {
    adb: { name: 'adb', path: '', available: false },
    fastboot: { name: 'fastboot', path: '', available: false },
  };
  private toolErrors = new Set<string>();

  constructor(
    private log: LogService,
    private getPaths: () => { adb: string; fastboot: string }
  ) {}

  start() {
    if (this.started) return;
    this.started = true;
    void this.refreshNow();
    this.timer = setInterval(() => {
      void this.refreshNow();
    }, 2000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  subscribe(cb: (snapshot: DeviceSnapshot) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values()).sort((a, b) =>
      a.serial.localeCompare(b.serial)
    );
  }

  getDevice(serial: string): Device | undefined {
    return this.devices.get(serial);
  }

  getSnapshot(): DeviceSnapshot {
    return {
      devices: this.getDevices(),
      scannedAt: Date.now(),
      adb: this.tools.adb,
      fastboot: this.tools.fastboot,
      scanning: this.polling,
    };
  }

  async refreshNow(): Promise<DeviceSnapshot> {
    if (this.polling) return this.getSnapshot();
    this.polling = true;
    this.emit();
    try {
      const paths = this.getPaths();
      const [adbRes, fbRes] = await Promise.all([
        runCommand(paths.adb, ['devices', '-l'], { timeoutMs: 8000 }),
        runCommand(paths.fastboot, ['devices'], { timeoutMs: 8000 }),
      ]);

      const adbDevices = this.parseAdb(adbRes.stdout);
      const fbDevices = this.parseFastboot(fbRes.stdout);
      const errors: string[] = [];
      if (adbRes.error) {
        errors.push(`ADB not found: ${adbRes.error.message}`);
      } else if (adbRes.timedOut) {
        errors.push('ADB poll timed out.');
      }
      if (fbRes.error) {
        errors.push(`Fastboot not found: ${fbRes.error.message}`);
      } else if (fbRes.timedOut) {
        errors.push('Fastboot poll timed out.');
      }

      this.tools = {
        adb: {
          name: 'adb',
          path: paths.adb,
          available: !adbRes.error && !adbRes.timedOut,
          error: adbRes.error?.message,
        },
        fastboot: {
          name: 'fastboot',
          path: paths.fastboot,
          available: !fbRes.error && !fbRes.timedOut,
          error: fbRes.error?.message,
        },
      };

      const next = new Map<string, Device>();
      const now = Date.now();

      for (const d of adbDevices) {
        const prev = this.devices.get(d.serial);
        const mode = adbStateToMode(d.state);
        const sameMode = prev?.mode === mode;
        const base: Device = sameMode && prev
          ? { ...prev, mode, lastSeen: now }
          : this.emptyDevice(d.serial, mode, prev?.firstSeen ?? now);
        next.set(d.serial, base);
        if (!sameMode || !prev?.detailLoaded) {
          void this.enrichAdb(base);
        }
      }

      for (const d of fbDevices) {
        const prev = this.devices.get(d.serial);
        const mode: DeviceMode = d.state.toLowerCase().includes('fastbootd')
          ? 'fastbootd'
          : 'fastboot';
        const sameMode = prev?.mode === mode;
        const base: Device = sameMode && prev
          ? { ...prev, mode, lastSeen: now }
          : this.emptyDevice(d.serial, mode, prev?.firstSeen ?? now);
        next.set(d.serial, base);
        if (!sameMode || !prev?.detailLoaded) {
          void this.enrichFastboot(base);
        }
      }

      // Log transitions and removals
      for (const [serial, prev] of this.devices) {
        const cur = next.get(serial);
        if (!cur) {
          this.log.log('info', 'device', `Device disconnected: ${prev.serial}`);
          continue;
        }
        if (prev.mode !== cur.mode) {
          this.log.log(
            'info',
            'device',
            `Device ${serial} switched from ${prev.mode} to ${cur.mode}`
          );
        }
      }

      // Find newly connected serials
      const previousSerials = new Set(this.devices.keys());
      for (const [serial] of next) {
        if (!previousSerials.has(serial)) {
          this.log.log('success', 'device', `Device connected: ${serial}`);
        }
      }

      this.devices = next;
      for (const e of errors) {
        if (!this.toolErrors.has(e)) {
          this.toolErrors.add(e);
          this.log.log('error', 'device', e);
        }
      }
      this.emit(true);
    } finally {
      this.polling = false;
      this.emit(true);
    }
    return this.getSnapshot();
  }

  private parseAdb(raw: string) {
    const out: { serial: string; state: string; props: string }[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (
        !trimmed ||
        trimmed.startsWith('List of devices') ||
        trimmed.startsWith('* daemon') ||
        trimmed.startsWith('ADB server') ||
        trimmed.startsWith('adb:')
      ) {
        continue;
      }
      const match = trimmed.match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/);
      if (!match) continue;
      out.push({
        serial: match[1],
        state: match[2],
        props: match[3] || '',
      });
    }
    return out;
  }

  private parseFastboot(raw: string) {
    const out: { serial: string; state: string }[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('List of devices')) continue;
      const match = trimmed.match(/^(\S+)\s+(\S+)$/);
      if (match) out.push({ serial: match[1], state: match[2] });
    }
    return out;
  }

  private emptyDevice(serial: string, mode: DeviceMode, firstSeen: number): Device {
    return {
      serial,
      mode,
      bootloader: 'unknown',
      vars: {},
      detailLoaded: false,
      firstSeen,
      lastSeen: Date.now(),
    };
  }

  private async enrichAdb(dev: Device) {
    if (dev.mode !== 'adb' && dev.mode !== 'recovery' && dev.mode !== 'sideload') return;
    const key = dev.serial;
    if (this.enriching.has(key)) return;
    if (
      dev.detailLoaded &&
      Date.now() - (this.detailFetchedAt.get(key) || 0) < DETAIL_TTL
    ) {
      return;
    }
    this.enriching.add(key);
    try {
      const paths = this.getPaths();
      const res = await runCommand(
        paths.adb,
        ['-s', dev.serial, 'shell', 'getprop'],
        { timeoutMs: 10_000 }
      );
      if (res.code !== 0 && !res.stdout.trim()) return;
      const props = parseGetprop(res.stdout);
      const current = this.devices.get(key);
      if (!current) return;
      const merged: Device = {
        ...current,
        model: props['ro.product.model'] || current.model,
        codename:
          props['ro.product.device'] ||
          props['ro.product.name'] ||
          current.codename,
        productName: props['ro.product.name'] || current.productName,
        brand: props['ro.product.brand'] || current.brand,
        androidVersion:
          props['ro.build.version.release'] || current.androidVersion,
        buildId:
          props['ro.build.version.incremental'] ||
          props['ro.build.id'] ||
          current.buildId,
        slot: normalizeSlot(props['ro.boot.slot_suffix']) || current.slot,
        hasSlot: Boolean(props['ro.boot.slot_suffix']),
        bootloader: bootloaderFromProps(props),
        verifiedBoot:
          props['ro.boot.verifiedbootstate'] || current.verifiedBoot,
        vars: { ...current.vars, ...pickProps(props) },
        detailLoaded: true,
      };
      this.devices.set(key, merged);
      this.detailFetchedAt.set(key, Date.now());
      this.emit(true);
    } catch (e) {
      this.log.log('warn', 'device', `Failed to read ADB properties: ${(e as Error).message}`);
    } finally {
      this.enriching.delete(key);
    }
  }

  private async enrichFastboot(dev: Device) {
    const key = dev.serial;
    if (this.enriching.has(key)) return;
    if (
      dev.detailLoaded &&
      Date.now() - (this.detailFetchedAt.get(key) || 0) < DETAIL_TTL
    ) {
      return;
    }
    this.enriching.add(key);
    try {
      const paths = this.getPaths();
      const res = await runCommand(
        paths.fastboot,
        ['-s', dev.serial, 'getvar', 'all'],
        { timeoutMs: 15_000 }
      );
      const merged = `${res.stdout}\n${res.stderr}`;
      const vars = parseFastbootVars(merged);
      const current = this.devices.get(key);
      if (!current) return;
      const unlockedRaw =
        vars['unlocked'] || vars['oem-unlock'] || vars['flashing-unlocked'] || '';
      const bootloader =
        unlockedRaw.toLowerCase() === 'yes'
          ? 'unlocked'
          : unlockedRaw.toLowerCase() === 'no'
            ? 'locked'
            : 'unknown';
      const antiRaw = vars['anti'] || vars['anti-version'];
      const anti = antiRaw && /^\d+$/.test(antiRaw.trim())
        ? parseInt(antiRaw.trim(), 10)
        : undefined;
      const updated: Device = {
        ...current,
        model: vars['product'] || current.model,
        codename: vars['product'] || current.codename,
        productName: vars['product'] || current.productName,
        androidVersion: undefined,
        buildId: vars['version-bootloader'] || current.buildId,
        slot: normalizeSlot(vars['current-slot']) || current.slot,
        hasSlot: Boolean(vars['current-slot']),
        bootloader,
        verifiedBoot: vars['secure'] ? (vars['secure'] === 'yes' ? 'secure' : 'unsecure') : current.verifiedBoot,
        anti,
        vars,
        detailLoaded: true,
      };
      this.devices.set(key, updated);
      this.detailFetchedAt.set(key, Date.now());
      this.emit(true);
    } catch (e) {
      this.log.log('warn', 'device', `Failed to read Fastboot variables: ${(e as Error).message}`);
    } finally {
      this.enriching.delete(key);
    }
  }

  private emit(force = false) {
    const snapshot = this.getSnapshot();
    const fingerprint = JSON.stringify(
      snapshot.devices.map((d) => [
        d.serial, d.mode, d.codename, d.model, d.slot, d.bootloader,
        d.androidVersion, d.detailLoaded, d.anti,
      ])
    ) + `${this.tools.adb.available}:${this.tools.fastboot.available}:${this.polling}`;
    if (!force && fingerprint === this.lastFingerprint) return;
    this.lastFingerprint = fingerprint;
    for (const cb of this.listeners) {
      try {
        cb(snapshot);
      } catch {
        // ignore subscriber errors
      }
    }
  }
}


export function parseGetprop(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\[([^\]]+)\]:\s*\[(.*)\]$/);
    if (m) out[m[1]] = m[2];
  }
  // Some adb versions output "key: value"
  if (Object.keys(out).length === 0) {
    for (const line of raw.split(/\r?\n/)) {
      const idx = line.indexOf(': ');
      if (idx > 0) {
        out[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
      }
    }
  }
  return out;
}

export function parseFastbootVars(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    let t = line.trim();
    if (!t || t === 'Finished. Total time: 0.000s') continue;
    const bootloaderMatch = t.match(/^\(bootloader\)\s+(.*)$/);
    if (bootloaderMatch) t = bootloaderMatch[1];
    t = t.replace(/^\(.*?\)\s+/, '');
    const idx = t.indexOf(':');
    if (idx <= 0) continue;
    const key = t.slice(0, idx).trim();
    const value = t.slice(idx + 1).trim();
    if (key && !key.startsWith('Finished')) out[key] = value;
  }
  return out;
}

function pickProps(props: Record<string, string>): Record<string, string> {
  const keys = [
    'ro.product.model',
    'ro.product.device',
    'ro.product.name',
    'ro.product.brand',
    'ro.product.manufacturer',
    'ro.build.version.release',
    'ro.build.version.sdk',
    'ro.build.version.incremental',
    'ro.build.id',
    'ro.boot.slot_suffix',
    'ro.boot.flash.locked',
    'ro.boot.verifiedbootstate',
    'ro.boot.vbmeta.device_state',
    'ro.product.cpu.abi',
    'ro.miui.ui.version.name',
    'ro.mi.os.version.name',
    'ro.build.characteristics',
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    if (props[k]) out[k] = props[k];
  }
  return out;
}

function bootloaderFromProps(props: Record<string, string>): Device['bootloader'] {
  const flashLocked = props['ro.boot.flash.locked'];
  const vbState = props['ro.boot.vbmeta.device_state'];
  if (flashLocked === '1' || vbState === 'locked') return 'locked';
  if (flashLocked === '0' || vbState === 'unlocked') return 'unlocked';
  const verified = props['ro.boot.verifiedbootstate'];
  if (verified === 'orange') return 'unlocked';
  if (verified === 'green' || verified === 'yellow') return 'locked';
  return 'unknown';
}

function normalizeSlot(raw?: string): 'a' | 'b' | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/^_/, '').toLowerCase();
  if (cleaned === 'a' || cleaned === 'b') return cleaned;
  return undefined;
}

function adbStateToMode(state: string): DeviceMode {
  switch (state.toLowerCase()) {
    case 'device':
      return 'adb';
    case 'recovery':
      return 'recovery';
    case 'sideload':
      return 'sideload';
    case 'unauthorized':
      return 'unauthorized';
    case 'bootloader':
      return 'fastboot';
    case 'offline':
      return 'offline';
    default:
      return 'offline';
  }
}
