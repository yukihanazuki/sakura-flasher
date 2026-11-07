import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
  useRef,
} from 'react';
import { api } from './api';
import type {
  Device,
  DeviceSnapshot,
  LogEntry,
  ToolInfo,
  Settings,
} from '@shared/types';
import type { ReactNode } from 'react';

interface AppState {
  snapshot: DeviceSnapshot | null;
  logs: LogEntry[];
  settings: Settings | null;
  tools: { adb: ToolInfo; fastboot: ToolInfo } | null;
}

type Action =
  | { type: 'snapshot'; snapshot: DeviceSnapshot }
  | { type: 'logs'; logs: LogEntry[] }
  | { type: 'log:entry'; entry: LogEntry }
  | { type: 'settings'; settings: Settings }
  | { type: 'tools'; tools: { adb: ToolInfo; fastboot: ToolInfo } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'snapshot':
      return { ...state, snapshot: action.snapshot };
    case 'logs':
      return { ...state, logs: action.logs };
    case 'log:entry':
      return { ...state, logs: [...state.logs, action.entry].slice(-400) };
    case 'settings':
      return { ...state, settings: action.settings };
    case 'tools':
      return { ...state, tools: action.tools };
    default:
      return state;
  }
}

const initialState: AppState = {
  snapshot: null,
  logs: [],
  settings: null,
  tools: null,
};

interface AppContextValue extends AppState {
  devices: Device[];
  logs: LogEntry[];
  settings: Settings | null;
  refreshDevices: () => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
  ...initialState,
  devices: [],
  logs: [],
  settings: null,
  refreshDevices: async () => {},
  saveSettings: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // initial loads
    void (async () => {
      try {
        const [snapshot, logs, settings, tools] = await Promise.all([
          api.getDevices().catch(() => null),
          api.getLogs().catch(() => []),
          api.getSettings().catch(() => null),
          api.toolsCheck().catch(() => null),
        ]);
        if (!mounted.current) return;
        if (snapshot) dispatch({ type: 'snapshot', snapshot });
        if (Array.isArray(logs)) dispatch({ type: 'logs', logs });
        if (settings) dispatch({ type: 'settings', settings });
        if (tools) dispatch({ type: 'tools', tools });
      } catch {
        // ignore
      }
    })();

    const unsubs = [
      api.onEvent<DeviceSnapshot>('devices:changed', (snapshot) => dispatch({ type: 'snapshot', snapshot })),
      api.onEvent<LogEntry>('log:entry', (entry) => dispatch({ type: 'log:entry', entry })),
      api.onEvent<Settings>('settings:changed', (settings) => dispatch({ type: 'settings', settings })),
    ];

    const pollTimer = setInterval(() => {
      // The monitor is the source of truth; poll only as a fallback to catch missed events
      void api.getDevices().then((snapshot) => dispatch({ type: 'snapshot', snapshot })).catch(() => {});
    }, 10_000);

    return () => {
      mounted.current = false;
      unsubs.forEach((u) => u());
      clearInterval(pollTimer);
    };
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const snapshot = await api.refreshDevices();
      dispatch({ type: 'snapshot', snapshot });
    } catch {
      // ignore
    }
  }, []);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    try {
      const settings = await api.updateSettings(patch);
      dispatch({ type: 'settings', settings });
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => {
    const devices: Device[] = state.snapshot?.devices ?? [];
    return {
      ...state,
      devices,
      logs: state.logs,
      settings: state.settings,
      refreshDevices,
      saveSettings,
    };
  }, [state, refreshDevices, saveSettings]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
