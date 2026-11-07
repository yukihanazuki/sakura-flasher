import { runCommand } from './command-runner';
import type { LogService } from './logger';

export interface CmdResult {
  ok: boolean;
  output: string;
  code: number | null;
  timedOut: boolean;
  error?: Error;
}

const FAILURE_RE =
  /(failed|failure|error|not allowed|unauthorized|unknown partition|no such file|insufficient|cannot|exception|traceback)/i;

export function failureReason(output: string): string | null {
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    if (FAILURE_RE.test(line)) return line.trim();
  }
  return null;
}

export function isOk(res: { code: number | null; timedOut: boolean; error?: Error }): boolean {
  const failed = Boolean(res.error) || res.timedOut || res.code !== 0;
  return !failed;
}

export class AdbService {
  constructor(
    private getPath: () => string,
    private log: LogService
  ) {}

  async version(): Promise<CmdResult> {
    const res = await runCommand(this.getPath(), ['version'], { timeoutMs: 10_000 });
    const ok = !res.error && !res.timedOut && res.code === 0;
    if (res.error) this.log.log('error', 'adb', `adb version failed: ${res.error.message}`);
    if (res.timedOut) this.log.log('error', 'adb', 'adb version timed out');
    return { ok, output: `${res.stdout}\n${res.stderr}`, code: res.code, timedOut: res.timedOut, error: res.error };
  }

  devices(): Promise<{ serial: string; state: string }[]> {
    const bin = this.getPath();
    // delegate to a lightweight spawn via runCommand on the same binary
    // (adb devices)
    return runCommand(bin, ['devices', '-l'], { timeoutMs: 8000 }).then((res) => {
      // reuse a minimal parser
      const raw = res.stdout + res.stderr;
      const out: { serial: string; state: string }[] = [];
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('List of devices') || t.startsWith('* daemon') || t.startsWith('ADB server')) continue;
        const parts = t.split(/\s+/);
        if (parts.length < 2) continue;
        const serial = parts[0];
        const state = parts[1];
        if (state === 'offline') continue;
        out.push({ serial, state });
      }
      return out;
    });
  }

  shell(serial: string, cmd: string): Promise<string> {
    const bin = this.getPath();
    return runCommand(bin, ['-s', serial, 'shell', cmd], { timeoutMs: 30_000 }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const reason = failureReason(output);
      if (reason) this.log.log('error', 'adb', `shell ${cmd}: ${reason}`);
      if (!isOk(res)) throw new Error(`adb shell failed: ${reason ?? res.error?.message ?? 'unknown error'}`);
      return res.stdout;
    });
  }

  reboot(
    serial: string,
    target: 'system' | 'recovery' | 'bootloader' | 'fastbootd'
  ): Promise<void> {
    const bin = this.getPath();
    const arg =
      target === 'bootloader'
        ? 'bootloader'
        : target === 'fastbootd'
          ? 'fastbootd'
          : target;
    return runCommand(bin, ['-s', serial, 'reboot', arg], { timeoutMs: 60_000 }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const reason = failureReason(output);
      if (reason) this.log.log('error', 'adb', `reboot ${arg}: ${reason}`);
      if (res.code !== 0) throw new Error(`adb reboot failed: ${reason ?? 'unknown error'}`);
    });
  }

  install(serial: string, apkPath: string, onLine?: (line: string, stream: 'stdout' | 'stderr') => void): Promise<void> {
    const bin = this.getPath();
    return runCommand(bin, ['-s', serial, 'install', '-r', apkPath], { timeoutMs: 300_000, onStdout: onLine }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const reason = failureReason(output);
      if (reason) this.log.log('error', 'adb', `install: ${reason}`);
      if (res.code !== 0) throw new Error(`adb install failed: ${reason ?? 'unknown error'}`);
    });
  }

  /** Push local file to device. Progress is reported via onLine ("pushed:<n>") style callbacks. */
  push(serial: string, local: string, remote: string): Promise<void> {
    const bin = this.getPath();
    return runCommand(bin, ['-s', serial, 'push', local, remote], { timeoutMs: 600_000 }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const reason = failureReason(output);
      if (reason) this.log.log('error', 'adb', `push: ${reason}`);
      if (res.code !== 0) throw new Error(`adb push failed: ${reason ?? 'unknown error'}`);
    });
  }

  pull(serial: string, remote: string, local: string): Promise<void> {
    const bin = this.getPath();
    return runCommand(bin, ['-s', serial, 'pull', remote, local], { timeoutMs: 600_000 }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const reason = failureReason(output);
      if (reason) this.log.log('error', 'adb', `pull: ${reason}`);
      if (res.code !== 0) throw new Error(`adb pull failed: ${reason ?? 'unknown error'}`);
    });
  }

  /** Sideload via recovery. Streams raw fastboot-ish output lines for progress. */
  sideload(serial: string, zipPath: string, onLine?: (line: string, stream: 'stdout' | 'stderr') => void): Promise<void> {
    const bin = this.getPath();
    return runCommand(bin, ['-s', serial, 'sideload', zipPath], { timeoutMs: 300_000, onStdout: onLine }).then((res) => {
      const output = `${res.stdout}\n${res.stderr}`;
      const reason = failureReason(output);
      if (reason) this.log.log('error', 'adb', `sideload: ${reason}`);
      if (res.code !== 0) throw new Error(`adb sideload failed: ${reason ?? 'unknown error'}`);
    });
  }
}

export const adbResult = (res: { code: number | null; timedOut: boolean; error?: Error; output: string }): CmdResult => ({
  ok: !res.error && !res.timedOut && res.code === 0,
  output: res.output,
  code: res.code,
  timedOut: res.timedOut,
  error: res.error,
});
