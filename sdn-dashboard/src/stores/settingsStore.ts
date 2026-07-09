import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, ConnectionSettings, DashboardSettings } from '@/types'

const DEFAULT_SETTINGS: AppSettings = {
  connection: {
    onosHost: '10.42.0.220',
    onosPort: 8181,
    onosUser: 'onos',
    onosPassword: 'rocks',
    wsHost: 'localhost',
    wsPort: 8765,
    wsPath: '/ws/metrics',
    useSSL: false,
  },
  dashboard: {
    metricsWindowSec: 60,
    metricsIntervalMs: 1000,
    topologyRefreshSec: 30,
    maxAlerts: 200,
    theme: 'dark',
    defaultLayout: 'force',
  },
}

interface SettingsState extends AppSettings {
  updateConnection: (partial: Partial<ConnectionSettings>) => void
  updateDashboard: (partial: Partial<DashboardSettings>) => void
  resetToDefaults: () => void
  getWsUrl: () => string
  getOnosBaseUrl: () => string
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      updateConnection: (partial) =>
        set((state) => ({ connection: { ...state.connection, ...partial } })),

      updateDashboard: (partial) =>
        set((state) => ({ dashboard: { ...state.dashboard, ...partial } })),

      resetToDefaults: () => set(DEFAULT_SETTINGS),

      getWsUrl: () => {
        const { connection } = get()
        const proto = connection.useSSL ? 'wss' : 'ws'
        return `${proto}://${connection.wsHost}:${connection.wsPort}${connection.wsPath}`
      },

      getOnosBaseUrl: () => {
        const { connection } = get()
        const proto = connection.useSSL ? 'https' : 'http'
        return `${proto}://${connection.onosHost}:${connection.onosPort}`
      },
    }),
    {
      name: 'sdn-dashboard-settings',
      partialize: (state) => ({
        connection: state.connection,
        dashboard: state.dashboard,
      }),
    },
  ),
)
