import { useState } from 'react'
import { Save, RefreshCw, Wifi, BarChart2, Database } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { useSettingsStore } from '@/stores/settingsStore'
import { useReconnect } from '@/hooks/useWebSocket'
import { useNetworkStore } from '@/stores/networkStore'
import { clsx } from 'clsx'

const SectionHeader = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className="p-2 rounded-lg bg-sdn-500/10 text-sdn-400 mt-0.5">{icon}</div>
    <div>
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  </div>
)

const Field = ({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-4 items-start py-3 border-b border-slate-800/60 last:border-0">
    <div>
      <p className="text-sm text-slate-300">{label}</p>
      {help && <p className="text-xs text-slate-500 mt-0.5">{help}</p>}
    </div>
    <div className="col-span-2">{children}</div>
  </div>
)

const Input = ({
  value, onChange, type = 'text', placeholder,
}: { value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sdn-500 font-mono"
  />
)

export const SettingsPage = () => {
  const settings = useSettingsStore()
  const wsConnectionState = useNetworkStore((s) => s.wsConnectionState)
  const reconnect = useReconnect()
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar title="Settings" subtitle="Backend connection & dashboard preferences" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl space-y-6">

          {/* ONOS Connection */}
          <div className="glass-card p-5">
            <SectionHeader
              icon={<Wifi className="w-4 h-4" />}
              title="ONOS REST API"
              description="Connection settings for the ONOS northbound REST interface"
            />
            <div className="space-y-0">
              <Field label="Host" help="ONOS controller IP or hostname">
                <Input
                  value={settings.connection.onosHost}
                  onChange={(v) => settings.updateConnection({ onosHost: v })}
                  placeholder="localhost"
                />
              </Field>
              <Field label="Port">
                <Input
                  type="number"
                  value={settings.connection.onosPort}
                  onChange={(v) => settings.updateConnection({ onosPort: parseInt(v) })}
                  placeholder="8181"
                />
              </Field>
              <Field label="Username">
                <Input
                  value={settings.connection.onosUser}
                  onChange={(v) => settings.updateConnection({ onosUser: v })}
                  placeholder="onos"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={settings.connection.onosPassword}
                  onChange={(v) => settings.updateConnection({ onosPassword: v })}
                />
              </Field>
              <Field label="Use SSL">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.connection.useSSL}
                    onChange={(e) => settings.updateConnection({ useSSL: e.target.checked })}
                    className="rounded accent-sdn-500"
                  />
                  <span className="text-sm text-slate-300">Enable HTTPS/WSS</span>
                </label>
              </Field>
            </div>
          </div>

          {/* WebSocket */}
          <div className="glass-card p-5">
            <SectionHeader
              icon={<Database className="w-4 h-4" />}
              title="Metrics WebSocket"
              description="Real-time metrics push server (Python asyncio backend)"
            />
            <div className="space-y-0">
              <Field label="Host">
                <Input
                  value={settings.connection.wsHost}
                  onChange={(v) => settings.updateConnection({ wsHost: v })}
                  placeholder="localhost"
                />
              </Field>
              <Field label="Port">
                <Input
                  type="number"
                  value={settings.connection.wsPort}
                  onChange={(v) => settings.updateConnection({ wsPort: parseInt(v) })}
                  placeholder="8765"
                />
              </Field>
              <Field label="Path">
                <Input
                  value={settings.connection.wsPath}
                  onChange={(v) => settings.updateConnection({ wsPath: v })}
                  placeholder="/ws/metrics"
                />
              </Field>
              <Field label="Status">
                <div className="flex items-center gap-3">
                  <span className={clsx(
                    'badge',
                    wsConnectionState === 'connected'    ? 'badge-green' :
                    wsConnectionState === 'connecting'   ? 'badge-amber' :
                    wsConnectionState === 'disconnected' ? 'badge-blue'  : 'badge-red',
                  )}>
                    {wsConnectionState}
                  </span>
                  <button
                    onClick={reconnect}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reconnect
                  </button>
                </div>
              </Field>
            </div>
          </div>

          {/* Dashboard settings */}
          <div className="glass-card p-5">
            <SectionHeader
              icon={<BarChart2 className="w-4 h-4" />}
              title="Dashboard Preferences"
              description="Chart windows, polling rates and display options"
            />
            <div className="space-y-0">
              <Field label="Metrics window" help="Seconds of history shown in charts">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={settings.dashboard.metricsWindowSec}
                    onChange={(v) => settings.updateDashboard({ metricsWindowSec: parseInt(v) })}
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">seconds</span>
                </div>
              </Field>
              <Field label="Metrics interval" help="How often metrics update (ms)">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={settings.dashboard.metricsIntervalMs}
                    onChange={(v) => settings.updateDashboard({ metricsIntervalMs: parseInt(v) })}
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">ms</span>
                </div>
              </Field>
              <Field label="Topology refresh">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={settings.dashboard.topologyRefreshSec}
                    onChange={(v) => settings.updateDashboard({ topologyRefreshSec: parseInt(v) })}
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">seconds</span>
                </div>
              </Field>
              <Field label="Default layout">
                <select
                  value={settings.dashboard.defaultLayout}
                  onChange={(e) => settings.updateDashboard({ defaultLayout: e.target.value as 'force' | 'hierarchical' | 'grid' })}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-sdn-500"
                >
                  <option value="force">Force-directed</option>
                  <option value="hierarchical">Hierarchical</option>
                  <option value="grid">Grid</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Save / Reset */}
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={settings.resetToDefaults}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              Reset to defaults
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sdn-600 hover:bg-sdn-500 text-white text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
