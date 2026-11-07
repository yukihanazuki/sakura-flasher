import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { InfoCard, Btn, Badge } from '@/components/Primitives';
import { Info, FileCode, FolderArchive } from 'lucide-react';
import type { RomAnalysis } from '@shared/types';
import { cn } from '@/lib/utils';

export function FastbootTools() {
  const { devices } = useApp();
  const [serial, setSerial] = useState('');
  const [target, setTarget] = useState<'system' | 'recovery' | 'bootloader' | 'fastbootd'>('system');
  const [partition, setPartition] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [zipPath, setZipPath] = useState('');
  const [zipAnalysis, setZipAnalysis] = useState<RomAnalysis | null>(null);
  const [zipBusy, setZipBusy] = useState(false);

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

  // Pick a Custom ROM archive (.zip / .tgz / .tar) and inspect its format so
  // the user knows whether it is a recovery ZIP (sideload) or a fastboot package.
  const pickZip = async () => {
    setZipBusy(true);
    try {
      const res = await api.pickFile(['zip', 'tgz', 'tar', 'gz']);
      if (res?.path) {
        setZipPath(res.path);
        const analysis = await api.romAnalyze(res.path);
        setZipAnalysis(analysis);
      }
    } catch (e) {
      alert('Analyze custom ROM failed: ' + (e as Error).message);
    } finally {
      setZipBusy(false);
    }
  };

  // Recovery ZIP flow: reboot the device into recovery, then sideload the ZIP.
  // The user still has to pick "Apply update from ADB" on the device screen.
  const sideloadZip = async () => {
    if (!effectiveSerial || !zipPath) return;
    setZipBusy(true);
    try {
      await api.adbReboot(effectiveSerial, 'recovery');
      await new Promise((r) => setTimeout(r, 5000));
      await api.adbSideload(effectiveSerial, zipPath);
      setResult('sideload complete');
    } catch (e) {
      setResult('sideload error: ' + (e as Error).message);
    } finally {
      setZipBusy(false);
    }
  };

  const rebootCommands: { label: string; target: 'system' | 'recovery' | 'bootloader' | 'fastbootd' }[] = [
    { label: 'Reboot system', target: 'system' },
    { label: 'Reboot recovery', target: 'recovery' },
    { label: 'Reboot bootloader', target: 'bootloader' },
    { label: 'Reboot fastbootd', target: 'fastbootd' },
  ];

  return (
    <div className="space-y-6 pb-8">
      <InfoCard title="Fastboot Utility">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-muted">Device Serial</label>
              <span className="font-mono text-[10px] text-faint">
                {devices.length > 0 ? 'auto-detected' : 'optional'}
              </span>
            </div>
            <input
              className="w-full rounded-sm border border-line bg-surface2 px-3 py-2 text-xs font-mono text-text placeholder:text-faint/80 focus:border-accent/60 outline-none "
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
                        : 'border-line bg-surface2 text-muted hover:text-text'
                    )}
                  >
                    {d.serial}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-medium text-muted block">Reboot Modes</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {rebootCommands.map((cmd) => (
                <button
                  key={cmd.label}
                  type="button"
                  onClick={() => {
                    setTarget(cmd.target);
                    void run(() => api.fastbootReboot(effectiveSerial, cmd.target));
                  }}
                  disabled={!effectiveSerial}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-sm border border-line bg-surface2 text-xs text-muted transition-all hover:bg-surface3 hover:text-text hover:border-accent/40 active:scale-[0.98]',
                    !effectiveSerial && 'opacity-50 pointer-events-none'
                  )}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted block">Manual Flashing & Boot Image</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                placeholder="Partition (system, boot, vbmeta…)"
                value={partition}
                onChange={(e) => setPartition(e.target.value)}
                className="rounded-sm border border-line bg-surface2 px-3 py-2 text-xs font-mono text-text placeholder:text-faint/80 focus:border-accent/60 outline-none "
              />
              <input
                placeholder="Path to firmware (.img)"
                value={imagePath}
                onChange={(e) => setImagePath(e.target.value)}
                className="rounded-sm border border-line bg-surface2 px-3 py-2 text-xs font-mono text-text placeholder:text-faint/80 focus:border-accent/60 outline-none "
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Btn
                onClick={() => void run(() => api.fastbootFlash(effectiveSerial, partition, imagePath))}
                label="Flash Image"
                variant="accent"
                size="sm"
                disabled={!effectiveSerial || !partition || !imagePath}
              />
              <Btn
                onClick={() => void run(() => api.fastbootBoot(effectiveSerial, imagePath))}
                label="Boot Image"
                variant="glass"
                size="sm"
                disabled={!effectiveSerial || !imagePath}
              />
              <Btn
                onClick={() => void run(() => api.fastbootErase(effectiveSerial, partition))}
                label="Erase Part"
                variant="danger"
                size="sm"
                disabled={!effectiveSerial || !partition}
              />
              <Btn
                onClick={() => void run(() => api.fastbootGetVar(effectiveSerial))}
                label="Get Variables"
                variant="glass"
                size="sm"
                disabled={!effectiveSerial}
              />
            </div>
          </div>

          <div className="rounded-sm bg-surface2 border border-white/5 p-3 flex items-start gap-2">
            <Info size={14} className="mt-0.5 text-info shrink-0" />
            <span className="text-xs text-muted leading-relaxed">
              Fastboot mode allows direct low-level flashing of firmware binaries to device partitions.
              Ensure the bootloader is unlocked before issuing flash commands.
            </span>
          </div>
        </div>
      </InfoCard>

      <InfoCard
        title="Custom ROM (ZIP)"
        icon={<FileCode size={16} />}
        actions={
          zipAnalysis ? (
            <Badge tone="success" dot>
              {zipAnalysis.kind} detected
            </Badge>
          ) : null
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-sm border border-line bg-surface2 px-3 py-2 text-xs font-mono text-text placeholder:text-faint/80 focus:border-accent/60 outline-none"
              placeholder="Select a Custom ROM archive (.zip, .tgz, .tar)"
              value={zipPath}
              readOnly
            />
            <Btn
              onClick={() => void pickZip()}
              label="Pick ZIP"
              icon={<FolderArchive size={13} />}
              variant="default"
              size="sm"
              disabled={zipBusy}
            />
          </div>

          {zipAnalysis ? (
            <div className="rounded-sm border border-line bg-surface2 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] gap-2">
                <span className="font-medium text-muted">Format</span>
                <span className="font-mono text-text">
                  {zipAnalysis.format?.toUpperCase() || '—'}
                </span>
              </div>
              {zipAnalysis.codename ? (
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="font-medium text-muted">Codename</span>
                  <span className="font-mono text-text">{zipAnalysis.codename}</span>
                </div>
              ) : null}
              {zipAnalysis.notes?.length ? (
                <p className="text-[10px] text-muted leading-relaxed">
                  {zipAnalysis.notes.join(' · ')}
                </p>
              ) : null}
              {zipAnalysis.kind !== 'recovery' ? (
                <p className="text-[10px] text-muted leading-relaxed">
                  Fastboot ZIP detected — use the manual flashing tools above after
                  extracting the archive ({zipAnalysis.files?.length ?? 0} file(s)).
                </p>
              ) : null}
            </div>
          ) : null}

          {zipAnalysis?.kind === 'recovery' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Btn
                onClick={() => void run(() => api.adbReboot(effectiveSerial, 'recovery'))}
                label="Reboot ke Recovery"
                variant="default"
                size="sm"
                disabled={!effectiveSerial || zipBusy}
              />
              <Btn
                onClick={() => void sideloadZip()}
                label="Sideload ZIP"
                variant="accent"
                size="sm"
                disabled={!effectiveSerial || zipBusy}
              />
            </div>
          ) : null}

          <div className="rounded-sm bg-surface2 border border-white/5 p-3 flex items-start gap-2">
            <Info size={14} className="mt-0.5 text-info shrink-0" />
            <span className="text-xs text-muted leading-relaxed">
              Pick a Custom ROM archive to inspect it. Recovery-based ROMs are flashed
              via ADB Sideload; fastboot-based ROMs are flashed through the manual flash
              tools above. Bootloader must be unlocked before flashing.
            </span>
          </div>
        </div>
      </InfoCard>

      {result ? (
        <InfoCard
          title="Console Output"
          actions={
            <Badge tone={result === 'done' ? 'success' : 'info'} dot={result === 'running…'}>
              {result === 'done' ? 'Completed' : 'Running'}
            </Badge>
          }
        >
          <div className="font-mono text-[11px] text-text/90 overflow-x-auto whitespace-pre-wrap">
            {result}
          </div>
        </InfoCard>
      ) : null}
    </div>
  );
}
