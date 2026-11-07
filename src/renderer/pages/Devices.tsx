import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Smartphone, RefreshCw, ShieldCheck, ShieldAlert, Cpu, HardDrive } from 'lucide-react';
import { Badge, Btn } from '@/components/Primitives';

export function Devices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const d = await api.refreshDevices();
      setDevices(d?.devices ?? []);
    } catch {} finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void (async () => {
        try {
          const d = await api.getDevices();
          setDevices(d?.devices ?? []);
        } catch {}
      })();
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text">Device Manager</h2>
          <p className="text-xs text-muted">
            List of connected Android devices via ADB and Fastboot interface
          </p>
        </div>
        <Btn
          onClick={() => void load()}
          disabled={busy}
          icon={<RefreshCw size={13} className={cn(busy && 'animate-spin text-accent')} />}
          label={busy ? 'Scanning…' : 'Scan Devices'}
          variant="glass"
        />
      </div>

      {devices.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-faint">
            <Smartphone size={26} />
          </div>
          <div className="text-sm font-semibold text-text">
            No Xiaomi device detected
          </div>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Connect your device using a high-quality USB data cable. Enable USB Debugging or hold Volume Down + Power to enter Fastboot mode.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {devices.map((d: any) => (
            <div key={d.serial} className="glass rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text flex items-center gap-2">
                      <span>{d.model || d.codename || 'Xiaomi Device'}</span>
                      <span className="font-mono text-xs text-faint">({d.serial})</span>
                    </div>
                    <div className="text-[11px] text-muted">
                      {d.productName || 'Xiaomi Corporation'} • {d.brand || 'Xiaomi'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone={d.mode === 'adb' ? 'success' : 'warning'} dot>
                    {d.mode} mode
                  </Badge>
                  {d.bootloader === 'unlocked' ? (
                    <Badge tone="success" className="gap-1">
                      <ShieldCheck size={11} /> Unlocked
                    </Badge>
                  ) : (
                    <Badge tone="danger" className="gap-1">
                      <ShieldAlert size={11} /> Locked
                    </Badge>
                  )}
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-faint font-mono uppercase">
                    <Cpu size={12} className="text-accent" /> Codename
                  </div>
                  <div className="font-mono font-bold text-text">{d.codename ?? '—'}</div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-faint font-mono uppercase">
                    <Smartphone size={12} className="text-info" /> Android
                  </div>
                  <div className="font-mono font-bold text-text">
                    {d.androidVersion ? `Android ${d.androidVersion}` : '—'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-faint font-mono uppercase">
                    <HardDrive size={12} className="text-warning" /> Partition Slot
                  </div>
                  <div className="font-mono font-bold text-text">
                    {d.slot ? `Slot ${d.slot.toUpperCase()}` : 'Non-A/B'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-faint font-mono uppercase">
                    <ShieldCheck size={12} className="text-success" /> Anti Rollback
                  </div>
                  <div className="font-mono font-bold text-text">
                    {d.anti !== undefined ? `Level ${d.anti}` : 'Standard'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
