import { useEffect, useState, type ReactNode } from 'react';
import { AppProvider, useApp } from '@/lib/store';
import { Sidebar, TopBar, type PageId } from '@/components/Layout';
import { Banner } from '@/components/Banner';
import { FastbootTools } from '@/pages/FastbootTools';
import { RomFlasher } from '@/pages/RomFlasher';
import { PartitionTools } from '@/pages/PartitionTools';
import { Logs } from '@/pages/Logs';
import { SettingsPage } from '@/pages/Settings';

const PAGES: Record<PageId, ReactNode> = {
  fastboot: <FastbootTools />,
  rom: <RomFlasher />,
  partitions: <PartitionTools />,
  logs: <Logs />,
  settings: <SettingsPage />,
};

function Shell() {
  const [page, setPage] = useState<PageId>('rom');
  const { settings } = useApp();

  useEffect(() => {
    const apply = () => {
      const theme = settings?.theme ?? 'dark';
      const resolved =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark'
          : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings?.theme]);

  return (
    <div className="flex h-screen overflow-x-hidden bg-bg text-text antialiased">
      <Sidebar page={page} setPage={setPage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar page={page} />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1 md:px-6">
          <Banner page={page} />
          <div className="mx-auto max-w-6xl">{PAGES[page]}</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
