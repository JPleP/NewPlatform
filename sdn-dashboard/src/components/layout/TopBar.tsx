import { Bell, RefreshCw, Activity } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { formatRelative } from '@/utils/format'
import { clsx } from 'clsx'

interface TopBarProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

const MetaStat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <div className="flex flex-col items-end">
    <span className={clsx('text-sm font-semibold font-mono tabular-nums', color ?? 'text-slate-200')}>
      {value}
    </span>
    <span className="text-xs text-slate-500">{label}</span>
  </div>
)

export const TopBar = ({ title, subtitle, onRefresh, isRefreshing }: TopBarProps) => {
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const unacknowledgedCount = useNetworkStore((s) => s.unacknowledgedCount)
  const lastUpdate = useNetworkStore((s) => s.lastTopologyUpdate)

  const onlineDevices = devices.filter((d) => d.status === 'online').length
  const activeLinks = links.filter((l) => l.isUp).length

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-sm">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Quick stats */}
      <div className="hidden md:flex items-center gap-6">
        <MetaStat
          label="Devices online"
          value={`${onlineDevices}/${devices.length}`}
          color={onlineDevices === devices.length ? 'text-green-400' : 'text-amber-400'}
        />
        <MetaStat
          label="Active links"
          value={`${activeLinks}/${links.length}`}
          color={activeLinks === links.length ? 'text-green-400' : 'text-amber-400'}
        />
        {lastUpdate && (
          <MetaStat
            label="Last update"
            value={formatRelative(lastUpdate)}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={clsx('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>
        )}

        {/* Alerts bell */}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors">
          <Bell className="w-4 h-4" />
          {unacknowledgedCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400 ring-2 ring-slate-900" />
          )}
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
          <Activity className="w-3 h-3 text-green-400" />
          <span className="text-xs text-green-400 font-medium">LIVE</span>
        </div>
      </div>
    </header>
  )
}
