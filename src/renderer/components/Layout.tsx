import { ReactNode } from 'react';
import {
  Smartphone,
  Rocket,
  FastForward,
  ScrollText,
  Settings as SettingsIcon,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Usb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';

export type PageId = 'fastboot' | 'rom' | 'partitions' | 'logs' | 'settings';

const NAV: { id: PageId; label: string; kana: string; icon: ReactNode }[] = [
  { id: 'rom', label: 'Fastboot Tools', kana: 'ファストツール', icon: <Rocket size={15} /> },
  { id: 'fastboot', label: 'Custom ROM', kana: 'カスタムロム', icon: <FastForward size={15} /> },
  { id: 'partitions', label: 'Backup Kernel', kana: 'バックアップ', icon: <Smartphone size={15} /> },
  { id: 'logs', label: 'Log', kana: 'ログ', icon: <ScrollText size={15} /> },
  { id: 'settings', label: 'Settings', kana: 'せってい', icon: <SettingsIcon size={15} /> },
];

export function Sidebar({ page, setPage }: { page: PageId; setPage: (p: PageId) => void }) {
  const { devices } = useApp();
  const device = devices[0];
  return (
    <aside className="glass-bare relative z-20 flex w-60 shrink-0 flex-col border-r-2 border-line bg-surface">
      {/* Brand Header */}
      <div className="flex h-20 items-center gap-3 border-b-2 border-line bg-surface px-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-line bg-accent font-display text-[18px] text-white">
          桜
        </div>
        <div className="flex flex-col">
          <span className="font-display text-[15px] font-bold leading-tight tracking-tight text-text">
            SAKURA
            <br />
            FLASHER
          </span>
          <span className="kana mt-0.5 text-[9px] uppercase text-sakura">サクラフラッシャー</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label="Navigasi utama">
        <div className="flex flex-col gap-2" aria-label="Main navigation">
          {NAV.map((n) => {
            const active = page === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setPage(n.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[44px] items-center gap-2.5 border-2 px-3 py-2 text-left transition-all',
                  active
                    ? 'border-accent bg-accent text-white shadow-[3px_3px_0_0_rgb(var(--line-strong)/0.85)]'
                    : 'border-line bg-surface2 text-muted hover:border-lineStrong hover:text-text'
                )}
              >
                <span className={cn('shrink-0', active ? 'text-white' : 'text-accent')}>{n.icon}</span>
                <span className="text-[13px] font-bold">{n.label}</span>
                <span
                  className={cn(
                    'kana ml-auto shrink-0 text-[9px]',
                    active ? 'text-white/90' : 'text-sakura/70'
                  )}
                >
                  {n.kana}
                </span>
              </button>
            );
          })}
        </div>

        {/* Device info card */}
        <div className="mt-6 border-2 border-line bg-surface2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              Device
            </span>
            <Usb size={12} className={device ? 'text-success' : 'text-faint'} />
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <Row k="Model" v={device?.model ?? '—'} />
            <Row k="Codename" v={device?.codename ?? '—'} />
            <Row k="Serial" v={device?.serial ?? '—'} />
            <Row k="Slot" v={device?.slot ? device.slot.toUpperCase() : '—'} />
            <div className="flex items-center justify-between border-t border-line/40 pt-1.5">
              <span className="text-muted">USB</span>
              <span className={cn('font-bold', device ? 'text-success' : 'text-faint')}>
                {device ? 'Detected' : 'Not detected'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Status footer */}
      <div className="border-t-2 border-line px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-muted" />
          <span className="kana text-[9px] uppercase text-faint">
            Device connected
          </span>
        </div>
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="truncate text-right text-text" title={v}>
        {v}
      </span>
    </div>
  );
}

export function TopBar({ page }: { page: PageId }) {
  const { devices, snapshot, refreshDevices } = useApp();
  const currentNav = NAV.find((n) => n.id === page);
  const scanning = snapshot?.scanning ?? false;
  const flagged = devices.filter((d) => d.bootloader === 'locked' || d.mode === 'unauthorized');

  return (
    <header className="glass-bare relative z-20 flex h-16 shrink-0 items-center justify-between border-b-2 border-line bg-surface px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-line bg-surface2 text-accent">
          {currentNav?.icon}
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm font-semibold tracking-tight text-text">{currentNav?.label ?? 'Fastboot Tools'}</span>
          <span className="kana text-[9px] uppercase text-faint">{currentNav?.kana}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {flagged.length > 0 ? (
          <div className="flex items-center gap-1.5 border-2 border-warning/60 bg-warning/10 px-3 py-1.5 font-mono text-[11px] font-bold text-warning">
            <AlertTriangle size={13} />
            <span>{flagged.length} locked</span>
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-2 border-line bg-surface2 px-3 py-1.5 font-mono text-[11px] text-muted">
          <span
            className={cn(
              'h-2 w-2',
              devices.length > 0 ? 'bg-success' : 'bg-faint',
              scanning && 'animate-spin bg-warning'
            )}
          />
          <span>{devices.length > 0 ? `${devices.length} Connected` : 'No Device'}</span>
        </div>

        <button
          type="button"
          onClick={() => void refreshDevices()}
          className="font-display flex min-h-[36px] items-center gap-1.5 border-2 border-line bg-surface2 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted transition-all hover:border-lineStrong hover:text-text active:translate-y-[1px]"
        >
          <RefreshCw size={13} className={cn(scanning && 'animate-spin text-accent')} />
          <span>Scan</span>
        </button>
      </div>
    </header>
  );
}
