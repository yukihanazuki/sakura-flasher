import type { ChildProcess } from 'node:child_process';
import { runCommand, splitOutputLines } from './command-runner';
import type { LogService } from './logger';

export interface FBResult {
  ok: boolean;
  output: string;
  code: number | null;
  timedOut: boolean;
  error?: Error;
}

const FAILURE_RE =
  /(failed|failure|(ERROR|FAILED).+(device|command)|not allowed|unauthorized|unknown partition|no such file|insufficient|cannot|metadata|too large|FAILED\s*\()/i;

export function failureReason(output: string): string | null {
  for (const line of splitOutputLines(output)) {
    if (FAILURE_RE.test(line)) return line;
  }
  return null;
}

export function parseFastbootVars(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    let t = line.trim();
    t = t.replace(/^\(bootloader\)\s*/i, '');
    if (!t || /^total time/i.test(t) || /^finished/i.test(t)) continue;
    const idx = t.indexOf(':');
    if (idx <= 0) continue;
    const key = t.slice(0, idx).trim();
    const value = t.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

interface ExecOptions {
  serial?: string;
  timeoutMs?: number;
  cwd?: string;
  onLine?: (line: string, stream: 'stdout' | 'stderr') => void;
  onSpawn?: (child: ChildProcess) => void;
  expectFailure?: boolean;
}

export class FastbootService {
  constructor(
    private getPath: () => string,
    private log: LogService
  ) {}

  async exec(args: string[], opts: ExecOptions = {}): Promise<FBResult> {
    const bin = this.getPath();
    if (!bin || !require('node:fs').existsSync(bin)) {
      const msg = 'Fastboot binary not found. Set path in Settings.';
      this.log.log('error', 'fastboot', msg);
      return { ok: false, output: msg, code: null, timedOut: false };
    }
    const finalArgs = opts.serial ? ['-s', opts.serial, ...args] : args;
    this.log.log('command', 'fastboot', `fastboot ${opts.serial ? `-s ${opts.serial} ` : ''}${args.join(' ')}`);
    const res = await runCommand(bin, finalArgs, {
      timeoutMs: opts.timeoutMs ?? 60_000,
      cwd: opts.cwd,
      onSpawn: opts.onSpawn,
      onStdout: (chunk, stream) => {
        for (const line of splitOutputLines(chunk)) {
          opts.onLine?.(line, stream);
        }
      },
    });
    const output = `${res.stdout}\n${res.stderr}`;
    const failure = opts.expectFailure ? null : failureReason(output);
    const ok = res.code === 0 && !res.timedOut && !failure;
    if (failure && !opts.expectFailure) this.log.log('error', 'fastboot', failure);
    return { ok, output, code: res.code, timedOut: res.timedOut, error: res.error };
  }

  devices(): Promise<{ serial: string; state: string }[]> {
    void this;
    return runCommand(this.getPath(), ['devices'], { timeoutMs: 8000 }).then((res) => {
      const lines = splitOutputLines(res.stdout + res.stderr);
      const out: { serial: string; state: string }[] = [];
      for (const line of lines) {
        const m = line.match(/^(\S+)\s+(\S+)$/);
        if (m && m[2] !== 'devices') out.push({ serial: m[1], state: m[2] });
      }
      return out;
    });
  }

  getvar(serial: string, name?: string): Promise<{ ok: boolean; vars: Record<string, string>; raw: string }> {
    void this;
    const args = name ? ['getvar', name] : ['getvar', 'all'];
    // vars are printed on stderr for fastboot (fastboot vars go to stderr)
    return runCommand(this.getPath(), ['-s', serial, ...args], { timeoutMs: 20_000 }).then((res) => {
      const raw = `${res.stdout}\n${res.stderr}`;
      return { ok: res.code === 0, vars: parseFastbootVars(raw), raw };
    });
  }

  reboot(serial: string, target: 'system' | 'recovery' | 'bootloader' | 'fastbootd'): Promise<FBResult> {
    void this;
    const args = target === 'bootloader'
      ? ['reboot-bootloader']
      : target === 'fastbootd'
        ? ['reboot', 'fastbootd']
        : ['reboot', target].filter(Boolean);
    return runCommand(this.getPath(), ['-s', serial, ...args], { timeoutMs: 30_000 }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }

  flash(serial: string, partition: string, imagePath: string, onLine?: (line: string, stream: 'stdout' | 'stderr') => void): Promise<FBResult> {
    void this;
    return runCommand(this.getPath(), ['-s', serial, 'flash', partition, imagePath], {
      timeoutMs: 600_000,
      onStdout: (chunk, stream) => {
        for (const line of splitOutputLines(chunk)) {
          onLine?.(line, stream);
        }
      },
    }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }

  erase(serial: string, partition: string): Promise<FBResult> {
    void this;
    return runCommand(this.getPath(), ['-s', serial, 'erase', partition], {
      timeoutMs: 120_000,
    }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }

  boot(serial: string, imagePath: string): Promise<FBResult> {
    void this;
    return runCommand(this.getPath(), ['-s', serial, 'boot', imagePath], {
      timeoutMs: 180_000,
    }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }

  setActive(serial: string, slot: 'a' | 'b'): Promise<FBResult> {
    void this;
    return runCommand(this.getPath(), ['-s', serial, '--set-active', slot], {
      timeoutMs: 60_000,
    }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }

  oem(serial: string, args: string[]): Promise<FBResult> {
    void this;
    return runCommand(this.getPath(), ['-s', serial, 'oem', ...args], {
      timeoutMs: 60_000,
    }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      // oem commands often report failures on stderr with non-zero codes
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }

  flashing(serial: string, args: string[]): Promise<FBResult> {
    void this;
    return runCommand(this.getPath(), ['-s', serial, 'flashing', ...args], {
      timeoutMs: 120_000,
    }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }

  lock(serial: string, command: 'oem lock' | 'flashing lock'): Promise<FBResult> {
    const parts = command.split(/\s+/);
    return parts[0] === 'oem' ? this.oem(serial, [parts[1]]) : this.flashing(serial, [parts[1]]);
  }

  fetchPart(serial: string, partition: string, outFile: string): Promise<FBResult> {
    void this;
    return runCommand(this.getPath(), ['-s', serial, 'fetch', partition, outFile], {
      timeoutMs: 600_000,
    }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const failure = failureReason(output);
      return { ok: res.code === 0 && !failure, output, code: res.code, timedOut: res.timedOut, error: res.error };
    });
  }
}
