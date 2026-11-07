import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InfoCard, Btn } from '@/components/Primitives';
import { Sparkles, FolderOpen, Check, Heart, Send, UserRound, ExternalLink } from 'lucide-react';
import type { Settings } from '@shared/types';

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const s = await api.getSettings();
        setSettings(s);
      } catch {
        // ignore
      }
    })();
  }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.updateSettings(patch);
      setSettings(updated);
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 2000);
    } catch {
      setSettings((prev) => (prev ? { ...prev, ...patch } : null));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-muted">
        <Sparkles className="mr-2 animate-spin text-accent" size={16} /> Loading preferences…
      </div>
    );
  }

  const theme = settings.theme ?? 'dark';

  return (
    <div className="space-y-6 pb-10">
      <InfoCard title="Appearance">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted">Color Theme</span>
            <select
              value={theme}
              onChange={(e) => void save({ theme: e.target.value as Settings['theme'] })}
              className="w-full rounded-sm border-2 border-line bg-surface px-3 py-2 text-xs text-text outline-none focus:border-accent"
            >
              <option value="dark">Dark (Cyber OLED Black)</option>
              <option value="light">Light (Clean Frost Light)</option>
              <option value="system">Follow System</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted">Language</span>
            <div className="flex w-full items-center justify-between rounded-sm border-2 border-line bg-surface2 px-3 py-2 text-xs text-text">
              <span>English (US)</span>
              <span className="font-mono text-[10px] text-faint">Default</span>
            </div>
          </div>
        </div>
      </InfoCard>

      <InfoCard title="Tools & System Paths">
        <div className="space-y-4">
          {[
            { key: 'adbPath', label: 'Android Debug Bridge (ADB) Binary', placeholder: 'Auto-detected / path to adb.exe' },
            { key: 'fastbootPath', label: 'Fastboot Binary', placeholder: 'Auto-detected / path to fastboot.exe' },
            { key: 'tempDir', label: 'Temporary ROM Extraction Directory', placeholder: 'Path to temp cache' },
            { key: 'logDir', label: 'Application Logs Storage', placeholder: 'Path to log storage folder' },
          ].map((item) => (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted">{item.label}</span>
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-sm border-2 border-line bg-surface2 px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
                  value={(settings as any)[item.key] ?? ''}
                  placeholder={item.placeholder}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.browsePath(
                        item.key === 'adbPath' ? 'adb' : item.key === 'fastbootPath' ? 'fastboot' : 'temp'
                      );
                      if (res?.path) {
                        setSettings({ ...settings, [item.key]: res.path });
                        void save({ [item.key]: res.path } as Partial<Settings>);
                      }
                    } catch {
                      // ignore
                    }
                  }}
                  className="font-display flex min-h-[40px] items-center gap-1.5 rounded-sm border-2 border-line bg-surface2 px-3 py-2 text-[11px] uppercase tracking-wider text-muted transition-all hover:border-lineStrong hover:text-text"
                >
                  <FolderOpen size={14} />
                  <span>Browse</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </InfoCard>

      <InfoCard
        title="About the Developer"
        icon={<Heart size={16} />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void api.openExternal('https://t.me/yuyuarumi')}
              className="flex items-center gap-2 rounded-sm border-2 border-line bg-surface2 px-3 py-2 transition-all hover:border-lineStrong"
              aria-label="Open Telegram channel"
            >
              <Send size={14} className="text-accent" />
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-semibold text-text">Telegram Channel</span>
                <span className="font-mono text-[9px] text-faint">@yuyuarumi</span>
              </div>
              <ExternalLink size={12} className="text-muted" />
            </button>
            <button
              type="button"
              onClick={() => void api.openExternal('https://t.me/wannesyht')}
              className="flex items-center gap-2 rounded-sm border-2 border-line bg-surface2 px-3 py-2 transition-all hover:border-lineStrong"
              aria-label="Open Telegram account"
            >
              <UserRound size={14} className="text-accent" />
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-semibold text-text">Telegram Account</span>
                <span className="font-mono text-[9px] text-faint">@wannesyht</span>
              </div>
              <ExternalLink size={12} className="text-muted" />
            </button>
          </div>
        }
      >
        <p className="text-xs text-muted leading-relaxed">
          Built and maintained by <span className="font-bold text-text">yuyuarumi</span>. Join the
          Telegram channel for updates, or reach out directly for support. Thank you for using
          Sakura Flasher!
        </p>
      </InfoCard>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          {savedBadge ? (
            <span className="flex items-center gap-1 font-medium text-success">
              <Check size={14} /> Settings saved successfully
            </span>
          ) : saving ? (
            <span>Saving configuration…</span>
          ) : (
            <span>All preferences are saved automatically.</span>
          )}
        </div>
        <Btn
          onClick={() => void save({ ...settings })}
          label={saving ? 'Saving…' : 'Save Changes'}
          variant="accent"
          size="lg"
          disabled={saving}
        />
      </div>
    </div>
  );
}
