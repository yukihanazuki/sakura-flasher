import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { LogService } from './logger';

export interface ShellSession {
  id: string;
  serial: string;
  started: number;
  exited: boolean;
  exitCode: number | null;
}

/**
 * Spawn an interactive adb shell session on the given serial.
 * The caller owns the child process: feed stdin via sendToStdin(child, input)
 * and stop it via stopStdin(child). Output is forwarded line-by-line to the
 * renderer's shell:data / shell:exit events and mirrored to the log service.
 */
export function startShellSession(
  adbPath: string,
  serial: string,
  log: LogService,
  send: (channel: string, payload: unknown) => void
): { session: ShellSession; child: ChildProcess } {
  const child = spawn(adbPath, ['-s', serial, 'shell'], {
    cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm' },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const session: ShellSession = {
    id: `${serial}-shell-${Date.now()}`,
    serial,
    started: Date.now(),
    exited: false,
    exitCode: null,
  };

  let stdoutBuf = '';
  child.stdout?.on('data', (buf: Buffer) => {
    stdoutBuf += buf.toString('utf8');
    let last = '';
    for (const line of stdoutBuf.split(/\r?\n/)) {
      last = line;
      const t = line.trim();
      if (!t) continue;
      send('shell:data', { sessionId: session.id, data: line, stream: 'stdout' });
      log.log('debug', 'adb', `shell[${serial}]: ${t}`);
    }
    stdoutBuf = last;
  });

  let stderrBuf = '';
  child.stderr?.on('data', (buf: Buffer) => {
    stderrBuf += buf.toString('utf8');
    let last = '';
    for (const line of stderrBuf.split(/\r?\n/)) {
      last = line;
      const t = line.trim();
      if (!t) continue;
      send('shell:data', { sessionId: session.id, data: line, stream: 'stderr' });
      log.log('debug', 'adb', `shell[${serial}]: ${t}`);
    }
    stderrBuf = last;
  });

  child.on('exit', (code) => {
    session.exited = true;
    session.exitCode = code;
    send('shell:exit', { sessionId: session.id, code });
  });

  child.on('error', (err) => {
    session.exited = true;
    send('shell:error', { sessionId: session.id, error: (err as Error).message });
  });

  return { session, child };
}

export function sendToStdin(child: ChildProcess, input: string): void {
  if (child.stdin) {
    child.stdin.write(input + '\n');
  }
}

export function stopStdin(child: ChildProcess): void {
  if (child.stdin) {
    try {
      child.stdin.end();
    } catch {
      // ignore
    }
  }
}

export function killChild(child: ChildProcess): void {
  try {
    child.kill();
  } catch {
    // ignore
  }
}
