import { Server, Cpu, GitBranch, ExternalLink } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import { formatRelative, formatBandwidth, deviceTypeLabel, utilizationClass } from '@/utils/format'
import type { Device } from '@/types'
import { clsx } from 'clsx'

const deviceBorderColor: Record<Device['type'], string> = {
  controller: 'border-l-violet-500',
  switch:     'border-l-sky-500',
  host:       'border-l-emerald-500',
}

const deviceIconColor: Record<Device['type'], string> = {
  controller: 'text-violet-400 bg-violet-500/10',
  switch:     'text-sky-400 bg-sky-500/10',
  host:       'text-emerald-400 bg-emerald-500/10',
}

interface DeviceCardProps {
  device: Device
  onSelect?: (id: string) => void
}

export const DeviceCard = ({ device, onSelect }: DeviceCardProps) => {
  const getLinksForDevice = useNetworkStore((s) => s.getLinksForDevice)
  const getFlowsForDevice = useFlowStore((s) => s.getFlowsForDevice)

  const links = getLinksForDevice(device.id)
  const flows = getFlowsForDevice(device.id)
  const activeLinks = links.filter((l) => l.isUp).length
  const totalThroughput = links.filter((l) => l.isUp).reduce((s, l) => s + l.throughputMbps, 0)
  const maxUtil = links.length ? Math.max(...links.map((l) => l.utilizationPct)) : 0

  return (
    <div
      onClick={() => onSelect?.(device.id)}
      className={clsx(
        'glass-card p-4 border-l-4 cursor-pointer hover:bg-slate-800/40 transition-colors',
        deviceBorderColor[device.type],
        device.status === 'offline' && 'opacity-60',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={clsx('p-2 rounded-lg', deviceIconColor[device.type])}>
            <Server className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm leading-tight">{device.label}</p>
            <p className="text-xs text-slate-500">{deviceTypeLabel(device.type)}</p>
          </div>
        </div>
        <div className={clsx(
          'badge flex-shrink-0',
          device.status === 'online'  ? 'badge-green' :
          device.status === 'warning' ? 'badge-amber' : 'badge-red',
        )}>
          <span className={clsx(
            'status-dot w-1.5 h-1.5',
            device.status === 'online'  ? 'online' :
            device.status === 'warning' ? 'warning' : 'offline',
          )} />
          {device.status}
        </div>
      </div>

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
        <div>
          <p className="metric-label">IP</p>
          <p className="text-xs font-mono text-slate-300">{device.ipAddress}</p>
        </div>
        {device.onosId && (
          <div>
            <p className="metric-label">ONOS ID</p>
            <p className="text-xs font-mono text-slate-300 truncate">{device.onosId.slice(-8)}</p>
          </div>
        )}
        {device.portCount !== undefined && (
          <div>
            <p className="metric-label">Ports</p>
            <p className="text-xs text-slate-300">{device.portCount}</p>
          </div>
        )}
        {device.ofVersion && (
          <div>
            <p className="metric-label">OpenFlow</p>
            <p className="text-xs text-slate-300">{device.ofVersion}</p>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
        <span>
          <span className="font-semibold text-slate-200">{activeLinks}</span>/{links.length} links
        </span>
        <span>
          <span className="font-semibold text-slate-200">{flows.length}</span> flows
        </span>
        {totalThroughput > 0 && (
          <span className={clsx('ml-auto font-mono', utilizationClass(maxUtil))}>
            {formatBandwidth(totalThroughput)}
          </span>
        )}
      </div>

      {device.status !== 'offline' && (
        <p className="text-xs text-slate-600 mt-1">
          Last seen {formatRelative(device.lastSeen)}
        </p>
      )}
    </div>
  )
}
