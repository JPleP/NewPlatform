import { formatDistanceToNow, format } from 'date-fns'

// ── Number formatting ─────────────────────────────────────────────────────────

export const formatBandwidth = (mbps: number): string => {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`
  if (mbps >= 1)    return `${mbps.toFixed(1)} Mbps`
  return `${(mbps * 1000).toFixed(0)} Kbps`
}

export const formatBytes = (bytes: number): string => {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`
  if (bytes >= 1e9)  return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6)  return `${(bytes / 1e6).toFixed(2)} MB`
  if (bytes >= 1e3)  return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

export const formatLatency = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${ms.toFixed(1)} ms`
}

export const formatPercent = (pct: number, decimals = 1): string =>
  `${pct.toFixed(decimals)}%`

export const formatPackets = (n: number): string => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

// ── Timestamp formatting ──────────────────────────────────────────────────────

export const formatTimestamp = (iso: string): string =>
  format(new Date(iso), 'HH:mm:ss')

export const formatDate = (iso: string): string =>
  format(new Date(iso), 'MMM d, yyyy HH:mm')

export const formatRelative = (iso: string): string =>
  formatDistanceToNow(new Date(iso), { addSuffix: true })

export const formatChartTime = (timestamp: number): string =>
  format(new Date(timestamp), 'HH:mm:ss')

// ── Color utilities ───────────────────────────────────────────────────────────

export const severityColor = (severity: string): string => {
  switch (severity) {
    case 'info':     return 'text-blue-400'
    case 'warning':  return 'text-amber-400'
    case 'error':    return 'text-red-400'
    case 'critical': return 'text-red-300'
    default:         return 'text-slate-400'
  }
}

export const severityBadgeClass = (severity: string): string => {
  switch (severity) {
    case 'info':     return 'badge-blue'
    case 'warning':  return 'badge-amber'
    case 'error':
    case 'critical': return 'badge-red'
    default:         return 'badge-blue'
  }
}

export const flowStateBadge = (state: string): string => {
  switch (state) {
    case 'ADDED':          return 'badge-green'
    case 'PENDING_ADD':    return 'badge-blue'
    case 'PENDING_REMOVE': return 'badge-amber'
    case 'FAILED':
    case 'REMOVED':        return 'badge-red'
    default:               return 'badge-blue'
  }
}

export const utilizationClass = (pct: number): string => {
  if (pct < 50) return 'util-low'
  if (pct < 75) return 'util-medium'
  return 'util-high'
}

// ── Device type label ─────────────────────────────────────────────────────────

export const deviceTypeLabel = (type: string): string => {
  switch (type) {
    case 'controller': return 'ONOS Controller'
    case 'switch':     return 'OVS Switch'
    case 'host':       return 'Raspberry Pi Host'
    default:           return type
  }
}
