import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Network, Server, GitBranch,
  BarChart2, FlaskConical, Settings, Wifi, WifiOff,
  AlertTriangle, Zap, Link2,
} from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { clsx } from 'clsx'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  badge?: number
}

const NavItemLink = ({ to, icon, label, badge }: NavItem) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx('nav-item', isActive && 'active')
    }
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="flex-1">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="badge badge-red text-xs">{badge > 99 ? '99+' : badge}</span>
    )}
  </NavLink>
)

const ConnectionIndicator = () => {
  const state = useNetworkStore((s) => s.wsConnectionState)
  const icons: Record<typeof state, React.ReactNode> = {
    connected:    <Wifi className="w-3.5 h-3.5 text-green-400" />,
    connecting:   <Wifi className="w-3.5 h-3.5 text-amber-400 animate-pulse" />,
    disconnected: <WifiOff className="w-3.5 h-3.5 text-slate-500" />,
    error:        <WifiOff className="w-3.5 h-3.5 text-red-400" />,
  }
  const labels: Record<typeof state, string> = {
    connected:    'Connected',
    connecting:   'Connecting…',
    disconnected: 'Disconnected',
    error:        'Error',
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/40">
      {icons[state]}
      <span className="text-xs text-slate-400">{labels[state]}</span>
    </div>
  )
}

export const Sidebar = () => {
  const unacknowledgedCount = useNetworkStore((s) => s.unacknowledgedCount)
  const devices = useNetworkStore((s) => s.devices)
  const offlineCount = devices.filter((d) => d.status === 'offline').length

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-slate-900/80 border-r border-slate-700/50 p-3 gap-1">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 py-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-sdn-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100 leading-none">SDN Lab</p>
          <p className="text-xs text-slate-500 mt-0.5">ONOS Research Platform</p>
        </div>
      </div>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">
        Overview
      </p>

      <NavItemLink
        to="/"
        icon={<LayoutDashboard className="w-4 h-4" />}
        label="Dashboard"
      />
      <NavItemLink
        to="/topology"
        icon={<Network className="w-4 h-4" />}
        label="Topology"
      />

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mt-3 mb-1">
        Network
      </p>

      <NavItemLink
        to="/devices"
        icon={<Server className="w-4 h-4" />}
        label="Devices"
        badge={offlineCount}
      />
      <NavItemLink
        to="/flows"
        icon={<GitBranch className="w-4 h-4" />}
        label="Flow Rules"
      />
      <NavItemLink
        to="/metrics"
        icon={<BarChart2 className="w-4 h-4" />}
        label="Metrics"
      />
      <NavItemLink
        to="/sfc"
        icon={<Link2 className="w-4 h-4" />}
        label="Service Chains"
      />

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mt-3 mb-1">
        Research
      </p>

      <NavItemLink
        to="/experiments"
        icon={<FlaskConical className="w-4 h-4" />}
        label="Experiments"
      />

      <div className="flex-1" />

      {/* Alerts quick link */}
      {unacknowledgedCount > 0 && (
        <NavLink
          to="/alerts"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
        >
          <AlertTriangle className="w-4 h-4" />
          <span className="flex-1">{unacknowledgedCount} Alert{unacknowledgedCount !== 1 ? 's' : ''}</span>
        </NavLink>
      )}

      <NavItemLink
        to="/settings"
        icon={<Settings className="w-4 h-4" />}
        label="Settings"
      />

      <div className="mt-2 pt-2 border-t border-slate-700/40">
        <ConnectionIndicator />
      </div>
    </aside>
  )
}
