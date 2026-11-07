import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes?: number | null, decimals = 1): string {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatTime(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(ms?: number): string {
  if (ms == null || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function shortenedSerial(serial: string, max = 22): string {
  if (serial.length <= max) return serial;
  return `${serial.slice(0, max - 5)}…${serial.slice(-3)}`;
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural || singular + 's'}`;
}

export function isUsbSerial(serial: string): boolean {
  return /^[A-Za-z0-9]{6,}$/.test(serial);
}

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function dirname(p: string): string {
  const parts = p.split(/[\\/]/);
  parts.pop();
  return parts.join('\\') || p;
}

export function humanizeMode(mode: string): string {
  switch (mode) {
    case 'adb':
      return 'ADB';
    case 'fastboot':
      return 'Fastboot';
    case 'fastbootd':
      return 'Fastbootd';
    case 'recovery':
      return 'Recovery';
    case 'sideload':
      return 'Sideload';
    case 'unauthorized':
      return 'Unauthorized';
    case 'offline':
      return 'Offline';
    default:
      return mode;
  }
}

export function modeColor(mode: string): string {
  switch (mode) {
    case 'adb':
      return 'text-success';
    case 'fastboot':
    case 'fastbootd':
      return 'text-warning';
    case 'recovery':
      return 'text-info';
    case 'sideload':
      return 'text-info';
    case 'unauthorized':
      return 'text-danger';
    default:
      return 'text-faint';
  }
}
