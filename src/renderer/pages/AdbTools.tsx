import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { InfoCard, Btn } from '@/components/Primitives';
import { Terminal, Send, Smartphone, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdbTools() {
  const { devices } = useApp();
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [recoveryZip, setRecoveryZip] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-fill the serial from the first connected device so the form is
  // usable without any manual copy/paste. The user can still override it.
  useEffect(() => {
    if (!serial && devices.length > 0) {
      setSerial(devices[0].serial);
    }
  }, [devices, serial]);

  // Fall back to the first connected device when nothing was typed in.
  const effectiveSerial = serial || devices[0]?.serial || '';

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setResult('running…');
      await fn();
      setResult('done');
    } catch (e) {
      setResult('error: ' + (e as Error).message);
    }
  };

  const rebootSystem = async () => {
    try {
      setResult('running…');
      await api.adbReboot(serial, 'system');
      setResult('done');
    } catch (e) {
      setResult('error: ' + (e as Error).message);
    }
  };
  const rebootRecovery = async () => {
    try {
      setResult('running…');
      await api.adbReboot(serial, 'recovery');
      setResult('done');
    } catch (e) {
      setResult('error: ' + (e as Error).message);
    }
  };
  const rebootBootloader = async () => {
    try {
      setResult('running…');
      await api.adbReboot(serial, 'bootloader');
      setResult('done');
    } catch (e) {
      setResult('error: ' + (e as Error).message);
    }
  };

  const pickRecoveryZip = async () => {
    setBusy(true);
    try {
      const res = await api.pickFile?.(['zip']);
      if (res?.path) {
        setRecoveryZip(res.path);
      }
    } catch (e) {
      setResult('error: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const installRecoveryZip = async () => {
    if (!effectiveSerial || !recoveryZip) return;
    setBusy(true);
    try {
      setResult('Sideload started — waiting for the device…');
      await api.adbSideload(effectiveSerial, recoveryZip);
      setResult('done');
    } catch (e) {
      setResult('error: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const actionButtons = [
    { label: 'Reboot System', icon: Smartphone, onClick: rebootSystem },
    { label: 'Reboot Recovery', icon: Smartphone, onClick: rebootRecovery },
    { label: 'Reboot Bootloader', icon: Smartphone, onClick: rebootBootloader },
  ];

  return (
    <div className="space-y-6 pb-8">
      <InfoCard title="ADB Interface">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-muted">Device Serial</label>
              <span className="font-mono text-[10px] text-faint">
                {devices.length > 0 ? 'auto-detected' : 'optional'}
              </span>
            </div>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-mono text-text placeholder:text-faint/80 focus:border-accent/60 outline-none backdrop-blur-md"
              placeholder={devices.length > 0 ? devices[0].serial : 'No device detected — enter serial manually'}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
            />
            {devices.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {devices.map((d) => (
                  <button
                    key={d.serial}
                    type="button"
                    onClick={() => setSerial(d.serial)}
                    className={cn(
                      'rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors',
                      effectiveSerial === d.serial
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-white/10 bg-white/[0.02] text-muted hover:text-text'
                    )}
                  >
                    {d.serial}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-medium text-muted mb-2 block">Quick ADB Actions</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {actionButtons.map((btn) => (
                <Btn
                  key={btn.label}
                  onClick={() => void run(() => btn.onClick())}
                  label={btn.label}
                  icon={<btn.icon size={13} />}
                  variant="glass"
                  size="sm"
                  disabled={!effectiveSerial}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Archive size={14} className="text-accent" />
                <span className="text-xs font-semibold text-text">Install Recovery ROM (.zip)</span>
              </div>
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[9px] text-faint uppercase">
                ADB Sideload
              </span>
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              Reboot the device into sideload mode and push a custom recovery ROM archive
              (<code>.zip</code>) directly over ADB.
            </p>

            <div
              onClick={() => void pickRecoveryZip()}
              className={cn(
                'group relative rounded-lg border border-dashed p-4 text-center cursor-pointer transition-all',
                recoveryZip
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-white/10 bg-white/[0.01] hover:border-white/25'
              )}
            >
              {recoveryZip ? (
                <div className="font-mono text-[11px] text-accent truncate">{recoveryZip}</div>
              ) : (
                <div className="text-[11px] text-muted">
                  {busy ? 'Opening file picker…' : 'Click to browse a recovery .zip file'}
                </div>
              )}
            </div>

            <Btn
              onClick={() => void installRecoveryZip()}
              label="Install Recovery ZIP"
              icon={<Send size={13} />}
              variant="accent"
              size="sm"
              disabled={!effectiveSerial || !recoveryZip || busy}
            />
          </div>

          <div className="rounded-xl bg-black/20 border border-white/5 p-3 flex items-start gap-2">
            <Terminal size={14} className="mt-0.5 text-info shrink-0" />
            <span className="text-xs text-muted leading-relaxed">
              ADB provides remote access to the Android application layer. Use <span className="text-text">adb shell</span> for debugging shell access,
              or the actions above for device lifecycle management. Recovery ZIP install requires the device to support sideload mode.
            </span>
          </div>

          <div className="glass rounded-xl p-3">
            <label className="text-xs font-medium text-muted mb-2 block uppercase">Command Status</label>
            {result ? (
              <div className="font-mono text-[11px] text-text overflow-x-auto whitespace-pre-wrap">
                {result}
              </div>
            ) : (
              <div className="text-sm text-faint italic">
                Select an action to see ADB execution status here.
              </div>
            )}
          </div>
        </div>
      </InfoCard>
    </div>
  );
}
