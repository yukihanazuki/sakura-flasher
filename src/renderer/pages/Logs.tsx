import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InfoCard, Btn, Badge } from '@/components/Primitives';
import { ScrollText, Trash2, Download, FolderOpen, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [clearing, setClearing] = useState(false);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const l = await api.getLogs();
        setLogs(l);
      } catch {}
    };
    void load();
    const t = setInterval(() => {
      void (async () => {
        try {
          const l = await api.getLogs();
          setLogs(l);
        } catch {}
      })();
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const clearLogs = async () => {
    setClearing(true);
    try {
      await api.clearLogs();
      setLogs([]);
    } catch {} finally {
      setClearing(false);
    }
  };

  const exportLogs = async () => {
    const path = prompt('Enter path to save log file:');
    if (path) {
      try {
        await api.exportLogs(path);
        alert('Export successful.');
      } catch (e) {
        alert('Export failed: ' + (e as Error).message);
      }
    }
  };

  const levelDot = (level?: string) => {
    if (level === 'success') return 'bg-success shadow-[0_0_6px_rgba(61,220,151,0.8)]';
    if (level === 'error') return 'bg-danger shadow-[0_0_6px_rgba(229,72,77,0.8)]';
    if (level === 'warn') return 'bg-warning shadow-[0_0_6px_rgba(232,163,61,0.8)]';
    if (level === 'command') return 'bg-info shadow-[0_0_6px_rgba(96,165,250,0.8)]';
    return 'bg-faint';
  };

  const filtered = logs.filter((e) => {
    const matchesQuery =
      !query ||
      String(e.message ?? '').toLowerCase().includes(query.toLowerCase()) ||
      String(e.source ?? '').toLowerCase().includes(query.toLowerCase());
    const matchesLevel = levelFilter === 'all' || e.level === levelFilter;
    return matchesQuery && matchesLevel;
  });

  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <div className="space-y-6 pb-8">
      <InfoCard
        title="System Log Console"
        icon={<ScrollText size={16} />}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={errorCount > 0 ? 'danger' : 'success'} dot>
              {logs.length} entries
            </Badge>
            {errorCount > 0 && <Badge tone="danger">{errorCount} errors</Badge>}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search log messages…"
                className="w-full rounded-sm border border-line bg-surface2 pl-9 pr-3 py-2 text-xs text-text placeholder:text-faint/80 focus:border-accent/60 outline-none "
              />
            </div>
            <div className="flex gap-1 rounded-sm border border-line bg-surface2 p-1">
              {['all', 'info', 'warn', 'error', 'success'].map((lv) => (
                <button
                  key={lv}
                  onClick={() => setLevelFilter(lv)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-mono text-[10px] uppercase transition-colors',
                    levelFilter === lv
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : 'text-faint hover:text-text'
                  )}
                >
                  {lv}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-sm border border-line bg-surface/50 overflow-hidden ">
            <div className="max-h-[440px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-6 py-12 text-center text-xs text-faint italic">
                  No matching log entries found.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {filtered.map((e: any, i: number) => (
                    <div
                      key={e.id ?? i}
                      className="flex items-start gap-3 px-4 py-2 font-mono text-[10.5px] transition-colors hover:bg-surface2"
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', levelDot(e.level))} />
                      <span className="shrink-0 text-faint/70">
                        {e.ts ? new Date(e.ts).toLocaleTimeString() : '—'}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 uppercase text-[9px] font-semibold tracking-wider',
                          e.level === 'error'
                            ? 'text-danger'
                            : e.level === 'warn'
                            ? 'text-warning'
                            : e.level === 'success'
                            ? 'text-success'
                            : 'text-info'
                        )}
                      >
                        {e.level}
                      </span>
                      <span className="text-text/85 break-all">{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn
              onClick={clearLogs}
              disabled={clearing}
              label="Clear Logs"
              icon={<Trash2 size={13} />}
              variant="danger"
              size="sm"
            />
            <Btn onClick={exportLogs} label="Export Log…" icon={<Download size={13} />} variant="glass" size="sm" />
            <Btn
              label="Open Folder"
              icon={<FolderOpen size={13} />}
              variant="glass"
              size="sm"
              onClick={() => void api.openLogsFolder()}
            />
            <span className="ml-auto text-[10px] text-faint">
              Log directory is configurable in Settings → Tools & paths.
            </span>
          </div>
        </div>
      </InfoCard>
    </div>
  );
}
