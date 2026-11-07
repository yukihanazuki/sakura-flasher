import type { PageId } from '@/components/Layout';

const BANNER: Record<string, { title: string; kana: string; status: string }> = {
  fastboot: {
    title: 'Custom ROM',
    kana: 'カスタムロム',
    status: 'RECOVERY / SIDELOAD',
  },
  rom: {
    title: 'Fastboot Tools',
    kana: 'ファストツール',
    status: 'MODE: FASTBOOT',
  },
  partitions: {
    title: 'Backup Kernel',
    kana: 'バックアップ',
    status: 'SLOT: A / B',
  },
  logs: {
    title: 'Log',
    kana: 'ログ',
    status: 'MONITOR',
  },
  settings: {
    title: 'Settings',
    kana: 'せってい',
    status: 'KONFIGURASI',
  },
};

/* Deterministic petal layout so React re-renders never reshuffle the field. */
const PETALS = [
  { left: '8%', delay: '0s', duration: '7.5s', scale: 0.9 },
  { left: '17%', delay: '2.2s', duration: '6.4s', scale: 0.7 },
  { left: '27%', delay: '4.1s', duration: '8.2s', scale: 1 },
  { left: '38%', delay: '1.1s', duration: '7s', scale: 0.8 },
  { left: '49%', delay: '3.4s', duration: '6.8s', scale: 1.1 },
  { left: '61%', delay: '0.6s', duration: '7.8s', scale: 0.75 },
  { left: '72%', delay: '2.8s', duration: '6.2s', scale: 0.95 },
  { left: '83%', delay: '4.6s', duration: '8.6s', scale: 0.85 },
  { left: '91%', delay: '1.7s', duration: '7.2s', scale: 1 },
  { left: '56%', delay: '5.2s', duration: '6.6s', scale: 0.7 },
];

export function Banner({ page }: { page: PageId }) {
  const cfg = BANNER[page] ?? BANNER.settings;

  return (
    <header className="banner mb-5" aria-label={`${cfg.title} banner`}>
      <div className="banner-sky" />
      <div className="banner-halftone" />
      <div className="banner-sun" />
      <div className="banner-torii" />
      <div className="banner-fuji" />
      <div className="banner-city" />
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `scale(${p.scale})`,
          }}
        />
      ))}
      <div className="banner-scrim" />

      <div className="relative z-10 flex h-full items-center justify-between px-6">
        <div className="flex flex-col gap-1">
          <span className="kana text-[10px] uppercase text-sakura">{cfg.kana}</span>
          <h1 className="font-display text-[22px] leading-tight tracking-wide text-text">
            {cfg.title}
          </h1>
        </div>
        <span className="font-display border-2 border-line bg-surface2 px-3 py-1 text-[10px] tracking-widest text-muted">
          {cfg.status}
        </span>
      </div>
    </header>
  );
}
