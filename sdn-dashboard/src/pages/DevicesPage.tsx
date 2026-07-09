import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { DeviceCard } from '@/components/devices/DeviceCard'
import { MetricsPanel } from '@/components/metrics/MetricsPanel'
import { FlowTable } from '@/components/flows/FlowTable'
import { useNetworkStore } from '@/stores/networkStore'
import type { Device } from '@/types'

type TabId = 'metrics' | 'flows' | 'ports'

export const DevicesPage = () => {
  const devices = useNetworkStore((s) => s.devices)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('metrics')
  const [typeFilter, setTypeFilter] = useState<Device['type'] | 'all'>('all')

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId)

  const filtered = typeFilter === 'all'
    ? devices
    : devices.filter((d) => d.type === typeFilter)

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'metrics', label: 'Metrics' },
    { id: 'flows',   label: 'Flow Rules' },
    { id: 'ports',   label: 'Port Stats' },
  ]

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        title="Device Management"
        subtitle={`${devices.filter((d) => d.status === 'online').length}/${devices.length} online`}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Device list */}
        <div className="w-80 border-r border-slate-700/50 flex flex-col overflow-hidden">
          {/* Type filter */}
          <div className="p-3 border-b border-slate-700/40">
            <div className="flex gap-1">
              {(['all', 'controller', 'switch', 'host'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`flex-1 py-1.5 text-xs rounded-md capitalize transition-colors ${
                    typeFilter === t
                      ? 'bg-sdn-600/30 text-sdn-300 border border-sdn-600/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onSelect={setSelectedDeviceId}
              />
            ))}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedDevice ? (
            <>
              {/* Device header */}
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{selectedDevice.label}</h2>
                  <p className="text-sm text-slate-400">{selectedDevice.ipAddress}</p>
                </div>
                <div className={`badge ml-auto ${
                  selectedDevice.status === 'online'  ? 'badge-green' :
                  selectedDevice.status === 'warning' ? 'badge-amber' : 'badge-red'
                }`}>
                  {selectedDevice.status}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4 border-b border-slate-700/50 pb-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? 'text-sdn-400 border-sdn-500'
                        : 'text-slate-400 border-transparent hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'metrics' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <MetricsPanel deviceId={selectedDeviceId ?? undefined} />
                </div>
              )}
              {activeTab === 'flows' && (
                <FlowTable filterDeviceId={selectedDeviceId ?? undefined} />
              )}
              {activeTab === 'ports' && (
                <div className="glass-card p-6 text-center text-slate-500 text-sm">
                  <p>Port statistics require a live ONOS connection.</p>
                  <p className="text-xs mt-1">Configure backend in Settings.</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
              <p className="text-sm">Select a device from the list to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
