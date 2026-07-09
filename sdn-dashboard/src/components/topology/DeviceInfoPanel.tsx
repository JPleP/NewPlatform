/**
 * Side panel that appears when a device/link node is selected in the topology.
 * Shows detailed info and links to metrics for the selected element.
 */

import { X, ExternalLink, Server, Network, Cpu } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useMetricsStore } from '@/stores/metricsStore'
import { formatBandwidth, formatLatency, formatPercent, formatRelative, deviceTypeLabel } from '@/utils/format'
import { clsx } from 'clsx'

const Row = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-800/60 last:border-0">
    <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
    <span className={clsx('text-xs text-right break-all', mono ? 'font-mono text-slate-300' : 'text-slate-200')}>
      {value}
    </span>
  </div>
)

export const DeviceInfoPanel = () => {
  const selectedElement = useNetworkStore((s) => s.selectedElement)
  const setSelectedElement = useNetworkStore((s) => s.setSelectedElement)
  const getDevice = useNetworkStore((s) => s.getDevice)
  const getLink = useNetworkStore((s) => s.getLink)

  if (!selectedElement.type || !selectedElement.id) return null

  const onClose = () => setSelectedElement({ type: null, id: null })

  if (selectedElement.type === 'device') {
    const device = getDevice(selectedElement.id)
    if (!device) return null

    return (
      <aside className="w-72 glass-card p-4 flex flex-col gap-3 animate-slide-in-right">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sdn-400" />
            <span className="font-semibold text-slate-100 text-sm">{device.label}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700/50 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={clsx('status-dot',
            device.status === 'online' ? 'online' : device.status === 'offline' ? 'offline' : 'warning',
          )} />
          <span className="text-xs text-slate-300 capitalize">{device.status}</span>
          <span className="text-xs text-slate-500 ml-auto">{deviceTypeLabel(device.type)}</span>
        </div>

        <div className="space-y-0">
          <Row label="IP Address" value={device.ipAddress} mono />
          {device.macAddress && <Row label="MAC" value={device.macAddress} mono />}
          {device.onosId    && <Row label="ONOS ID" value={device.onosId} mono />}
          {device.bridgeName && <Row label="Bridge" value={device.bridgeName} mono />}
          {device.portCount !== undefined && <Row label="Ports" value={device.portCount} />}
          {device.ofVersion  && <Row label="OpenFlow" value={device.ofVersion} />}
          {device.model      && <Row label="Model" value={device.model} />}
          <Row label="Last seen" value={formatRelative(device.lastSeen)} />
        </div>

        {device.metadata && Object.keys(device.metadata).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Metadata</p>
            <div className="space-y-0">
              {Object.entries(device.metadata).map(([k, v]) => (
                <Row key={k} label={k} value={v} mono />
              ))}
            </div>
          </div>
        )}
      </aside>
    )
  }

  if (selectedElement.type === 'link') {
    const link = getLink(selectedElement.id)
    if (!link) return null

    const utilClass = link.utilizationPct < 50 ? 'text-green-400' :
                      link.utilizationPct < 75 ? 'text-amber-400' : 'text-red-400'

    return (
      <aside className="w-72 glass-card p-4 flex flex-col gap-3 animate-slide-in-right">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-sdn-400" />
            <span className="font-semibold text-slate-100 text-sm">Link Details</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700/50 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={clsx('status-dot', link.isUp ? 'online' : 'offline')} />
          <span className="text-xs text-slate-300">{link.isUp ? 'Up' : 'Down'}</span>
          <span className="text-xs text-slate-500 font-mono ml-auto">{link.id}</span>
        </div>

        {/* Utilization bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Utilization</span>
            <span className={clsx('font-mono', utilClass)}>{formatPercent(link.utilizationPct)}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${link.utilizationPct}%`,
                background: link.utilizationPct < 50 ? '#22c55e' :
                             link.utilizationPct < 75 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>

        <div className="space-y-0">
          <Row label="Throughput" value={<span className={clsx('font-mono', utilClass)}>{formatBandwidth(link.throughputMbps)}</span>} />
          <Row label="Capacity" value={formatBandwidth(link.capacityMbps)} />
          <Row label="Latency" value={formatLatency(link.latencyMs)} mono />
          <Row label="Packet loss" value={formatPercent(link.packetLossPct, 3)} mono />
          <Row label="Src port" value={`${link.sourceDeviceId}:${link.sourcePort}`} mono />
          <Row label="Dst port" value={`${link.targetDeviceId}:${link.targetPort}`} mono />
        </div>
      </aside>
    )
  }

  return null
}
