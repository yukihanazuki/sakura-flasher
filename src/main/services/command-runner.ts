import { spawn, type ChildProcess } from 'node:child_process';

const DEFAULT_TIMEOUT = 60_000;

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  input?: string;
  onStdout?: (chunk: string, stream: 'stdout' | 'stderr') => void;
  onStderr?: (chunk: string) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  onSpawn?: (child: ChildProcess) => void;
  windowsHide?: boolean;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: Error;
}

export class CommandError extends Error {
  constructor(
    message: string,
    public readonly code: number | null = null,
    public readonly timedOut = false
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

export function runCommand(
  bin: string,
  args: string[] = [],
  opts: RunOptions = {}
): Promise<RunResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stdout = '';
    let stderr = '';
    let child;

    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    try {
      child = spawn(bin, args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        windowsHide: opts.windowsHide ?? true,
        shell: false,
        stdio: [opts.input != null ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        code: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        error: err as Error,
      });
      return;
    }

    if (opts.onSpawn) {
      try {
        opts.onSpawn(child!);
      } catch {
        // ignore
      }
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT);

    child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8');
      stdout += text;
      opts.onStdout?.(text, 'stdout');
    });

    child.stderr?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8');
      stderr += text;
      opts.onStdout?.(text, 'stderr');
      opts.onStderr?.(text);
    });

    child.on('error', (err) => {
      finish({ code: null, stdout, stderr: stderr || err.message, timedOut: false, error: err });
    });

    child.on('close', (code, signal) => {
      opts.onExit?.(code, signal);
      finish({ code, stdout, stderr, timedOut });
    });

    if (opts.input != null) {
      child.stdin?.write(opts.input);
      child.stdin?.end();
    }
  });
}

export interface AdbDeviceRaw {
  serial: string;
  state: string;
  props: Record<string, string>;
}

export function parseAdbDevices(raw: string): AdbDeviceRaw[] {
  const out: AdbDeviceRaw[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (
      !t ||
      t.startsWith('List of devices') ||
      t.startsWith('* daemon') ||
      t.startsWith('ADB server') ||
      t.startsWith('adb:')
    ) {
      continue;
    }
    const parts = t.split(/\s+/);
    if (parts.length < 2) continue;
    const props: Record<string, string> = {};
    for (const p of parts.slice(2)) {
      const idx = p.indexOf(':');
      if (idx > 0) props[p.slice(0, idx)] = p.slice(idx + 1);
    }
    out.push({ serial: parts[0], state: parts[1], props });
  }
  return out;
}

export function parseFastbootDevices(raw: string): { serial: string; state: string }[] {
  const out: { serial: string; state: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('List of devices')) continue;
    const m = t.match(/^(\S+)\s+(\S+)$/);
    if (m) out.push({ serial: m[1], state: m[2] });
  }
  return out;
}

/** Splits process output into sensible lines, treating \r as a line break (fastboot progress). */
export function splitOutputLines(chunk: string): string[] {
  return chunk
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
}
