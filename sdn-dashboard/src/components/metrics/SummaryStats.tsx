/**
 * Top-of-dashboard summary stat cards.
 * Shows aggregate counts and averages across the whole topology.
 */

import { Server, Network, GitBranch, AlertTriangle, Wifi, TrendingUp } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import { formatBandwidth } from '@/utils/format'
import { clsx } from 'clsx'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  iconColor?: string
  trend?: 'up' | 'down' | 'neutral'
  alert?: boolean
}

const StatCard = ({ label, value, sub, icon, iconColor = 'text-sdn-400', alert = false }: StatCardProps) => (
  <div className={clsx(
    'glass-card p-4 flex items-start gap-3',
    alert && 'border-red-500/30 bg-red-900/10',
  )}>
    <div className={clsx(
      'p-2 rounded-lg flex-shrink-0',
      alert ? 'bg-red-500/15' : 'bg-sdn-500/10',
    )}>
      <span className={clsx('w-5 h-5', alert ? 'text-red-400' : iconColor)}>
        {icon}
      </span>
    </div>
    <div className="min-w-0">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
)

export const SummaryStats = () => {
  const devices = useNetworkStore((s) => s.devices)
  const links   = useNetworkStore((s) => s.links)
  const alerts  = useNetworkStore((s) => s.unacknowledgedCount)
  const flows   = useFlowStore((s) => s.flows)

  const onlineDevices = devices.filter((d) => d.status === 'online').length
  const activeLinks   = links.filter((l) => l.isUp).length
  const activeFlows   = flows.filter((f) => f.state === 'ADDED').length

  const totalThroughput = links
    .filter((l) => l.isUp)
    .reduce((sum, l) => sum + l.throughputMbps, 0)

  const avgLatency = links.length
    ? links.filter((l) => l.isUp).reduce((s, l) => s + l.latencyMs, 0) /
      Math.max(1, links.filter((l) => l.isUp).length)
    : 0

  const avgUtil = links.length
    ? links.filter((l) => l.isUp).reduce((s, l) => s + l.utilizationPct, 0) /
      Math.max(1, links.filter((l) => l.isUp).length)
    : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard
        label="Devices Online"
        value={`${onlineDevices}/${devices.length}`}
        icon={<Server className="w-5 h-5" />}
        iconColor="text-sdn-400"
        alert={onlineDevices < devices.length}
        sub={onlineDevices < devices.length ? `${devices.length - onlineDevices} offline` : 'All healthy'}
      />
      <StatCard
        label="Active Links"
        value={`${activeLinks}/${links.length}`}
        icon={<Network className="w-5 h-5" />}
        iconColor="text-sky-400"
        alert={activeLinks < links.length}
        sub={activeLinks < links.length ? `${links.length - activeLinks} down` : 'All up'}
      />
      <StatCard
        label="Flow Rules"
        value={activeFlows}
        sub={`${flows.length} total`}
        icon={<GitBranch className="w-5 h-5" />}
        iconColor="text-violet-400"
      />
      <StatCard
        label="Total Throughput"
        value={formatBandwidth(totalThroughput)}
        icon={<TrendingUp className="w-5 h-5" />}
        iconColor="text-emerald-400"
        sub="across all links"
      />
      <StatCard
        label="Avg Latency"
        value={`${avgLatency.toFixed(1)} ms`}
        icon={<Wifi className="w-5 h-5" />}
        iconColor="text-purple-400"
        sub={`${avgUtil.toFixed(0)}% avg util`}
      />
      <StatCard
        label="Alerts"
        value={alerts}
        icon={<AlertTriangle className="w-5 h-5" />}
        alert={alerts > 0}
        sub={alerts > 0 ? 'Unacknowledged' : 'All clear'}
      />
    </div>
  )
}
