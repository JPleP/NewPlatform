import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage  } from '@/pages/DashboardPage'
import { TopologyPage   } from '@/pages/TopologyPage'
import { DevicesPage    } from '@/pages/DevicesPage'
import { FlowsPage      } from '@/pages/FlowsPage'
import { MetricsPage    } from '@/pages/MetricsPage'
import { ExperimentsPage} from '@/pages/ExperimentsPage'
import { SFCPage        } from '@/pages/SFCPage'
import { AlertsPage     } from '@/pages/AlertsPage'
import { SettingsPage   } from '@/pages/SettingsPage'
import { useWebSocketManager } from '@/hooks/useWebSocket'
import { useOnosPolling } from '@/hooks/useOnosPolling'
import { startMockSimulation } from '@/utils/mockData'

// Read from .env.local — defaults to demo mode so the project works out of the box
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false'

// ── Real-mode sub-component: mounts the polling hook inside the React tree ──
const RealModePolling = () => {
  useOnosPolling()
  return null
}

const App = () => {
  useWebSocketManager()

  useEffect(() => {
    if (DEMO_MODE) startMockSimulation()
  }, [])

  RealModePolling() //{!DEMO_MODE && <Route path="*" element={<RealModePolling />} />}
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Inject real-mode polling once, inside the router context */}
        

        <Route path="/"            element={<DashboardPage />} />
        <Route path="/topology"    element={<TopologyPage />} />
        <Route path="/devices"     element={<DevicesPage />} />
        <Route path="/flows"       element={<FlowsPage />} />
        <Route path="/metrics"     element={<MetricsPage />} />
        <Route path="/sfc"         element={<SFCPage />} />
        <Route path="/experiments" element={<ExperimentsPage />} />
        <Route path="/alerts"      element={<AlertsPage />} />
        <Route path="/settings"    element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
