import { useState } from 'react';
import { api } from '@/lib/api';
import { InfoCard, Btn, Badge, Callout } from '@/components/Primitives';
import type { RomAnalysis, FlashMethod } from '@shared/types';
import {
  Rocket,
  FolderArchive,
  CheckCircle,
  FileCode,
  Lock,
  Unlock,
  AlertTriangle,
  Flame,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function RomFlasher() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RomAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [method, setMethod] = useState<FlashMethod>('clean-all');

  const pickRom = async () => {
    setBusy(true);
    try {
      const res = await api.romPick();
      if (res?.path) {
        setArchivePath(res.path);
        const a = await api.romAnalyze(res.path);
        setAnalysis(a);
      }
    } catch (e) {
      alert('Failed to pick/analyze ROM: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startFlash = async () => {
    if (!archivePath || !analysis) return;
    const newRunId = `run-${Date.now()}`;
    setRunId(newRunId);
    try {
      await api.flashStart({
        runId: newRunId,
        analysisId: archivePath,
        method,
        serial: 'unknown',
      });
    } catch (e) {
      alert('Flashing error: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <InfoCard
        title="Fastboot ROM Package"
        icon={<FolderArchive size={16} />}
        actions={
          analysis ? (
            <Badge tone="success" dot>
              {analysis.kind} verified
            </Badge>
          ) : null
        }
      >
        <div className="space-y-4">
          <div
            onClick={() => void pickRom()}
            className={cn(
              'group relative rounded-sm border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-300',
              archivePath
                ? 'border-accent/40 bg-accent/5'
                : 'border-line bg-surface2 hover:border-accent/40 hover:bg-surface2'
            )}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-surface3 border border-line text-accent group-hover:scale-105 transition-transform">
              <FolderArchive size={26} />
            </div>

            <div className="mt-3 text-sm font-semibold text-text">
              {archivePath ? 'ROM Archive Selected' : 'Select Official Xiaomi Fastboot ROM'}
            </div>
            <p className="mt-1 text-xs text-muted max-w-md mx-auto">
              Supports official Xiaomi fastboot ROM archives (<code>.tgz</code>, <code>.tar</code>, <code>.zip</code>) or pre-extracted fastboot script directories.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-sm bg-surface3 px-4 py-2 text-xs font-semibold text-text border border-line hover:bg-white/15 transition-colors">
              <FileCode size={14} className="text-accent" />
              <span>{busy ? 'Analyzing Archive…' : 'Browse & Inspect ROM File'}</span>
            </div>

            {archivePath && (
              <div className="mt-3 font-mono text-[11px] text-accent truncate max-w-lg mx-auto">
                {archivePath}
              </div>
            )}
          </div>

          {/* Analysis Results Display */}
          {analysis && (
            <div className="rounded-sm border border-line bg-surface2 p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="text-xs font-semibold text-text flex items-center gap-2">
                  <FileCheck size={15} className="text-success" />
                  <span>ROM Package Metadata</span>
                </div>
                <span className="font-mono text-[10px] text-faint">
                  Format: {analysis.format?.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-sm bg-surface2 border border-white/5">
                  <div className="text-[10px] text-faint uppercase font-mono">Codename</div>
                  <div className="text-xs font-mono font-bold text-text mt-0.5">
                    {analysis.codename ?? 'Universal'}
                  </div>
                </div>
                <div className="p-2.5 rounded-sm bg-surface2 border border-white/5">
                  <div className="text-[10px] text-faint uppercase font-mono">ROM Version</div>
                  <div className="text-xs font-mono font-bold text-accent mt-0.5">
                    {analysis.romVersion ?? '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded-sm bg-surface2 border border-white/5">
                  <div className="text-[10px] text-faint uppercase font-mono">Android</div>
                  <div className="text-xs font-mono font-bold text-text mt-0.5">
                    {analysis.androidVersion ? `Android ${analysis.androidVersion}` : '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded-sm bg-surface2 border border-white/5">
                  <div className="text-[10px] text-faint uppercase font-mono">Anti-Rollback</div>
                  <div className="text-xs font-mono font-bold text-text mt-0.5">
                    ARB v{analysis.antiVersion ?? 1}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </InfoCard>

      <InfoCard title="Flashing Method & Scripts" icon={<Flame size={16} />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'clean-all',
                title: 'Clean All (flash_all)',
                desc: 'Wipes userdata and all system partitions for a pristine factory installation.',
                badge: 'Recommended',
                icon: <Unlock size={16} className="text-warning" />,
                tone: 'border-line',
              },
              {
                id: 'save-data',
                title: 'Save User Data',
                desc: 'Preserves internal storage & user applications (system upgrade only).',
                badge: 'Keeps Data',
                icon: <CheckCircle size={16} className="text-success" />,
                tone: 'border-line',
              },
              {
                id: 'clean-all-lock',
                title: 'Clean All & Lock',
                desc: 'Full factory wipe and re-locks OEM bootloader state upon completion.',
                badge: 'OEM Lock',
                icon: <Lock size={16} className="text-danger" />,
                tone: 'border-danger/30',
              },
            ].map((m) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id as FlashMethod)}
                  className={cn(
                    'group relative rounded-sm p-3.5 text-left transition-all duration-200 border',
                    active
                      ? 'border-accent bg-accent/10 shadow-[0_0_20px_rgba(255,61,46,0.15)]'
                      : 'border-line bg-surface2 hover:bg-white/[0.05] hover:border-lineStrong'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {m.icon}
                      <span className="text-xs font-semibold text-text">{m.title}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{m.desc}</p>
                  <div className="mt-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-mono text-[9px] uppercase',
                        active ? 'bg-accent text-white' : 'bg-surface3 text-faint'
                      )}
                    >
                      {m.badge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {method === 'clean-all-lock' && (
            <Callout tone="danger" title="Bootloader Lock Warning">
              Never re-lock the bootloader if flashing a cross-region ROM (e.g., China hardware running Global ROM), as this will cause a permanent brick!
            </Callout>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="text-xs text-muted flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-warning" />
              <span>Ensure device battery level is above 50% before flashing.</span>
            </div>

            <div className="flex items-center gap-3">
              {runId ? <span className="font-mono text-xs text-accent">Session: {runId}</span> : null}
              <Btn
                onClick={() => void startFlash()}
                label="Start Flashing"
                icon={<Rocket size={15} />}
                variant="accent"
                size="lg"
                disabled={!archivePath || !analysis}
              />
            </div>
          </div>
        </div>
      </InfoCard>
    </div>
  );
}
