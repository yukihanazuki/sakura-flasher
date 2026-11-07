import type { LogEntry, LogLevel } from '../../shared/types';
import * as fs from 'node:fs';
import * as path from 'node:path';

let nextId = 1;

const LEVEL_RANK: Record<LogLevel, number> = {
  info: 0,
  debug: 0,
  success: 1,
  output: 2,
  warn: 2,
  error: 3,
  command: 3,
};

function timestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ms = Math.floor(d.getMilliseconds());
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(ms).padStart(3, '0')}`;
}

export class LogService {
  private entries: LogEntry[] = [];
  private listeners = new Set<(e: LogEntry) => void>();
  private dir: string;
  private filePath: string = '';
  private seq = 0;
  private fileStream?: fs.WriteStream;

  constructor(private initialDir: string) {
    this.dir = initialDir;
    fs.mkdirSync(this.dir, { recursive: true });
    this.filePath = path.join(
      this.dir,
      `session-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`
    );
    try {
      this.fileStream = fs.createWriteStream(this.filePath, { flags: 'a' });
    } catch {
      this.fileStream = undefined;
    }
  }

  setDir(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  getDir() {
    return this.dir;
  }

  log(level: LogLevel, source: string, message: string): LogEntry {
    const entry: LogEntry = {
      id: nextId++,
      ts: Date.now(),
      level,
      source,
      message,
    };
    this.entries.push(entry);
    if (this.entries.length > 5000) {
      this.entries.splice(0, this.entries.length - 5000);
    }
    this.listeners.forEach((cb) => {
      try {
        cb(entry);
      } catch {
        // ignore listener errors
      }
    });
    const line = `[${timestamp()}] [${level.toUpperCase()}] [${source}] ${message}`;
    try {
      this.fileStream?.write(line + '\n');
    } catch {
      // ignore write errors
    }
    return entry;
  }

  get(level?: LogLevel, source?: string, query?: string): LogEntry[] {
    let out = this.entries.slice();
    if (level) {
      out = out.filter((e) => e.level === level);
    }
    if (source) {
      out = out.filter((e) => e.source === source);
    }
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q)
      );
    }
    return out;
  }

  all(): LogEntry[] {
    return this.entries.slice();
  }

  clear() {
    this.entries = [];
    try {
      if (this.fileStream) {
        this.fileStream.destroy();
      }
      this.fileStream = fs.createWriteStream(this.filePath, { flags: 'w' });
    } catch {
      // ignore
    }
  }

  exportTo(filePath: string): Promise<void> {
    const lines = this.entries.map(
      (e) => `[${timestamp(new Date(e.ts))}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}`
    );
    const content = lines.join('\n') + '\n';
    return new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(filePath, 'utf8');
      ws.on('finish', () => ws.close(() => resolve()));
      ws.on('error', (err) => {
        ws.close();
        reject(err);
      });
      ws.write(content);
    });
  }

  openFolder() {
    try {
      const { shell } = require('electron');
      void shell.openPath(this.dir);
    } catch {
      // ignore
    }
  }

  subscribe(cb: (e: LogEntry) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
export type { LogEntry };
export type { LogLevel };
