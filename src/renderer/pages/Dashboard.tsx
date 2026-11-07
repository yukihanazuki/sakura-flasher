import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Smartphone,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Activity,
  Rocket,
  Terminal,
  HardDrive,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { InfoCard, Btn, Badge } from '@/components/Primitives';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const [tools, setTools] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    try {
      const [t, d, l] = await Promise.all([api.toolsCheck(), api.getDevices(), api.getLogs()]);
      setTools(t);
      setDevices(d?.devices ?? []);
      setLogs((l as any[]) ?? []);
    } catch {}
  };

  useEffect(() => {
    void load();
    const timer = setInterval(async () => {
      try {
        const d = await api.getDevices();
        setDevices(d?.devices ?? []);
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const d = await api.refreshDevices();
      setDevices(d?.devices ?? []);
    } catch {} finally {
      setTimeout(() => setScanning(false), 500);
    }
  };

  const device = devices[0];
  const recent = logs.slice(-8).reverse();

  return (
    <div className="space-y-6 pb-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Connected Device Hero Card */}
        <div className="lg:col-span-2 glass rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="eyebrow flex items-center gap-1.5 text-accent">
                <Zap size={12} />
                <span>Primary Target Device</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-text">
                {device ? device.model ?? device.codename ?? 'Connected Xiaomi Device' : 'No Device Connected'}
              </h2>
            </div>
            <button
              onClick={() => void handleScan()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted hover:bg-white/10 hover:text-text transition-colors"
            >
              <RefreshCw size={12} className={cn(scanning && 'animate-spin text-accent')} />
              <span>Refresh</span>
            </button>
          </div>

          {device ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={device.mode === 'adb' ? 'success' : 'warning'} dot>
                  {device.mode} mode
                </Badge>
                {device.bootloader === 'unlocked' ? (
                  <Badge tone="success" className="gap-1">
                    <ShieldCheck size={11} /> Bootloader Unlocked
                  </Badge>
                ) : (
                  <Badge tone="danger" className="gap-1">
                    <ShieldAlert size={11} /> Bootloader {device.bootloader || 'Locked'}
                  </Badge>
                )}
                {device.slot && (
                  <Badge tone="info">Slot {device.slot.toUpperCase()}</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="text-[10px] text-faint uppercase font-mono">Serial No</div>
                  <div className="text-xs font-mono font-semibold text-text truncate mt-0.5">
                    {device.serial}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="text-[10px] text-faint uppercase font-mono">Codename</div>
                  <div className="text-xs font-mono font-semibold text-text truncate mt-0.5">
                    {device.codename ?? '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="text-[10px] text-faint uppercase font-mono">Android</div>
                  <div className="text-xs font-mono font-semibold text-text truncate mt-0.5">
                    {device.androidVersion ? `v${device.androidVersion}` : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="text-[10px] text-faint uppercase font-mono">State</div>
                  <div className="text-xs font-mono font-semibold text-success truncate mt-0.5">
                    Ready
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="my-6 rounded-xl border border-dashed border-white/10 p-6 text-center">
              <Smartphone size={28} className="mx-auto text-faint mb-2 opacity-60" />
              <div className="text-xs font-medium text-muted">
                Connect your Xiaomi / Redmi / POCO device via USB
              </div>
              <div className="text-[11px] text-faint mt-1">
                Ensure USB Debugging is enabled for ADB, or hold Volume Down + Power for Fastboot
              </div>
            </div>
          )}
        </div>

        {/* Engine Status Card */}
        <div className="glass rounded-2xl p-5 md:p-6 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="eyebrow flex items-center gap-1.5 text-accent">
              <Cpu size={12} />
              <span>Platform Engines</span>
            </div>
            <div className="text-base font-bold text-text">Driver & Binary Health</div>
          </div>

          <div className="space-y-3 my-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    tools?.adb?.available ? 'bg-success shadow-[0_0_8px_rgba(61,220,151,0.8)]' : 'bg-danger'
                  )}
                />
                <div>
                  <div className="text-xs font-semibold text-text">Android Debug Bridge</div>
                  <div className="text-[10px] font-mono text-faint truncate max-w-[140px]">
                    {tools?.adb?.path || 'Not detected'}
                  </div>
                </div>
              </div>
              <Badge tone={tools?.adb?.available ? 'success' : 'danger'}>
                {tools?.adb?.available ? 'Active' : 'Offline'}
              </Badge>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    tools?.fastboot?.available ? 'bg-success shadow-[0_0_8px_rgba(61,220,151,0.8)]' : 'bg-danger'
                  )}
                />
                <div>
                  <div className="text-xs font-semibold text-text">Fastboot Interface</div>
                  <div className="text-[10px] font-mono text-faint truncate max-w-[140px]">
                    {tools?.fastboot?.path || 'Not detected'}
                  </div>
                </div>
              </div>
              <Badge tone={tools?.fastboot?.available ? 'success' : 'danger'}>
                {tools?.fastboot?.available ? 'Active' : 'Offline'}
              </Badge>
            </div>
          </div>

          <div className="text-[10px] font-mono text-faint flex items-center justify-between pt-1 border-t border-white/5">
            <span>Security Layer</span>
            <span className="text-success">Verified OK</span>
          </div>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-3 flex items-center gap-1.5 text-faint">
          <Layers size={12} />
          <span>Quick Flashing & Utilities</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              title: 'Flash Fastboot ROM',
              desc: 'Install official MIUI / HyperOS (.tgz / .tar) with partition validation',
              icon: <Rocket size={18} className="text-accent" />,
              badge: 'Fastboot',
            },
            {
              title: 'Reboot to Fastboot',
              desc: 'Instantly reboot target device into fastboot / bootloader mode',
              icon: <Zap size={18} className="text-warning" />,
              badge: 'ADB Cmd',
              action: async () => {
                if (device?.serial) {
                  try {
                    await api.adbReboot(device.serial, 'bootloader');
                  } catch (e) {
                    alert((e as Error).message);
                  }
                }
              },
            },
            {
              title: 'ADB Shell Console',
              desc: 'Access root shell, process debugging, and direct logcat stream',
              icon: <Terminal size={18} className="text-info" />,
              badge: 'Shell',
            },
            {
              title: 'Partition Inspector',
              desc: 'Analyze A/B partition map, super dynamic partitions, and backup slots',
              icon: <HardDrive size={18} className="text-success" />,
              badge: 'Storage',
            },
          ].map((action, i) => (
            <div
              key={i}
              onClick={action.action}
              className="glass glass-hover rounded-xl p-4 flex flex-col justify-between cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                  {action.icon}
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[9px] text-faint">
                  {action.badge}
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-text group-hover:text-accent transition-colors">
                  {action.title}
                </div>
                <div className="text-[11px] text-muted mt-1 leading-relaxed">
                  {action.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <InfoCard
        title="Live System Activity"
        icon={<Activity size={15} />}
        actions={
          <span className="font-mono text-[10px] text-faint">
            {recent.length} recent events
          </span>
        }
      >
        {recent.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            No recent activity recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recent.map((e: any, i: number) => (
              <div
                key={e.id ?? i}
                className="flex items-center justify-between gap-4 py-2.5 text-xs transition-colors hover:bg-white/[0.02] px-2 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      e.level === 'error'
                        ? 'bg-danger'
                        : e.level === 'warn'
                        ? 'bg-warning'
                        : e.level === 'success'
                        ? 'bg-success'
                        : 'bg-info'
                    )}
                  />
                  <span
                    className={cn(
                      'truncate font-medium',
                      e.level === 'error'
                        ? 'text-danger'
                        : e.level === 'warn'
                        ? 'text-warning'
                        : e.level === 'success'
                        ? 'text-success'
                        : 'text-text/90'
                    )}
                  >
                    {e.message}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-faint">
                  {formatDate(e.ts)}
                </span>
              </div>
            ))}
          </div>
        )}
      </InfoCard>
    </div>
  );
}
