import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { InfoCard, Btn, Badge, Callout } from '@/components/Primitives';
import { HardDrive, Search } from 'lucide-react';
import { useApp } from '@/lib/store';

const BACKUP_PARTITIONS = [
  { key: 'boot', label: 'Boot', size: '64 MB' },
  { key: 'vendor_boot', label: 'Vendor Boot', size: '32 MB' },
  { key: 'dtbo', label: 'DTBO', size: '16 MB' },
  { key: 'vbmeta', label: 'VBMeta', size: '8 MB' },
];

export function PartitionTools() {
  const { devices } = useApp();
  const device = devices[0];
  const processedSerialRef = useRef<string | null>(null);

  const [data, setData] = useState<Record<string, string> | null>(null);
  const [selected, setSelected] = useState<string[]>(['boot', 'dtbo']);
  const [targetDir, setTargetDir] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const fetchPartitions = async (sn: string) => {
    if (processedSerialRef.current === sn) return;
    processedSerialRef.current = sn;
    try {
      const res = await api.partitionListFastboot(sn);
      setData(res);
    } catch (e) {
      alert('Failed to fetch partitions: ' + (e as Error).message);
    }
  };

  useEffect(() => {
    if (device?.serial) {
      void fetchPartitions(device.serial);
    }
  }, [device?.serial]);

  const entries = data ? Object.entries(data) : [];

  const toggle = (k: string) =>
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const outFileFor = (partition: string) => {
    const dir = targetDir.replace(/\\/g, '/');
    const base = dir.endsWith('/') ? dir : dir + '/';
    return base + partition + '.img';
  };

  const backupNow = async () => {
    if (!device?.serial || selected.length === 0 || !targetDir) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    const errors: string[] = [];
    for (const partition of selected) {
      try {
        const outFile = outFileFor(partition);
        await api.partitionBackup(device.serial, partition, outFile);
        ok += 1;
      } catch (e) {
        fail += 1;
        errors.push(`${partition}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    if (fail === 0) {
      setLastResult(`Backup complete: ${ok} partition(s) saved to ${targetDir}`);
    } else {
      setLastResult(`Backup complete (${ok} succeeded, ${fail} failed): ${errors.join('; ')}`);
    }
  };

  const hasDevice = Boolean(device?.serial);
  const hasTarget = Boolean(targetDir);

  return (
    <div className="space-y-6 pb-8">
      <InfoCard
        title="Backup Kernel"
        icon={<HardDrive size={16} />}
        badge={
          hasDevice && data ? (
            <Badge tone="success" dot>
              {entries.length} partition(s)
            </Badge>
          ) : null
        }
      >
        {hasDevice ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-2 border-line bg-surface2 px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Device</span>
              <span className="font-mono text-[11px] text-text">
                {device?.model ?? 'Unknown'} · {device?.codename ?? 'unknown'} · {device?.serial}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BACKUP_PARTITIONS.map((p) => (
                <label
                  key={p.key}
                  className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-sm border-2 border-line bg-surface2 px-3 py-2 transition-colors hover:border-lineStrong"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent"
                    checked={selected.includes(p.key)}
                    onChange={() => toggle(p.key)}
                  />
                  <span className="flex-1 font-mono text-[11px] text-text">{p.label}</span>
                  <span className="font-mono text-[10px] text-faint">{p.size}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-sm border-2 border-line bg-surface2 px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
                placeholder="Select backup destination folder"
                value={targetDir}
                readOnly
              />
              <Btn
                onClick={() => void api.pickDirectory().then((r) => r?.path && setTargetDir(r.path))}
                label="Select folder"
                icon={<Search size={13} />}
                variant="default"
              />
            </div>

            <Btn
              onClick={() => void backupNow()}
              label={busy ? 'Backing up…' : `Backup Now (${selected.length})`}
              icon={<HardDrive size={13} />}
              variant="accent"
              disabled={busy || selected.length === 0 || !hasTarget}
              size="lg"
            />

            {!hasTarget ? (
              <p className="font-mono text-[10px] text-faint">
                Select a destination folder first.
              </p>
            ) : null}

            {lastResult ? (
              <Callout tone={lastResult.includes('failed') ? 'warning' : 'success'} title={lastResult}>
                Files saved as <code>{selected.join(', ')}</code>. Restore via the Restore .img panel and always confirm and verify SHA-256 before writing partitions.
              </Callout>
            ) : null}

            {data ? (
              <div className="rounded-sm border border-line overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-[11px] font-mono">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                        <th className="px-3 py-2.5 font-medium">#</th>
                        <th className="px-3 py-2.5 font-medium">Partition</th>
                        <th className="px-3 py-2.5 font-medium">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40">
                      {entries.map(([k, v], i) => (
                        <tr key={k} className="transition-colors hover:bg-surface2">
                          <td className="px-3 py-2 text-faint">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-3 py-2 text-text font-medium flex items-center gap-2">
                            <HardDrive size={12} className="text-accent/80" />
                            {k}
                          </td>
                          <td className="px-3 py-2 text-muted">{v || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="glass rounded-sm p-8 text-center space-y-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-sm bg-surface3 border border-line text-faint">
              <HardDrive size={20} />
            </div>
            <div className="text-xs text-muted">
              No device detected. Connect a Xiaomi/Redmi/POCO device via USB to list its partitions.
            </div>
          </div>
        )}
      </InfoCard>

      <InfoCard title="Backup History">
        <div className="rounded-sm border border-line overflow-hidden">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Partition</th>
                <th className="px-3 py-2.5 font-medium">Slot</th>
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-3 py-2.5 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {[
                { t: '2024-01-15 08:30', part: 'boot', slot: 'A', size: '64 MB', hash: 'a1b2c3…' },
                { t: '2024-01-14 20:15', part: 'vendor_boot', slot: 'A', size: '32 MB', hash: 'd4e5f6…' },
              ].map((r, i) => (
                <tr key={i} className="transition-colors hover:bg-surface2">
                  <td className="px-3 py-2 text-muted">{r.t}</td>
                  <td className="px-3 py-2 text-text">{r.part}</td>
                  <td className="px-3 py-2 text-muted">{r.slot}</td>
                  <td className="px-3 py-2 text-muted">{r.size}</td>
                  <td className="px-3 py-2 text-muted">{r.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[10px] text-faint">
          Sample data: the history above is illustrative only and not a real device backup log.
        </p>
        <Callout tone="warning" title="Restore">
          Use the <b>Restore .img</b> button in the top panel and always confirm and verify SHA-256 before writing partitions.
        </Callout>
      </InfoCard>
    </div>
  );
}
