import { useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { SummaryStats } from '@/components/metrics/SummaryStats'
import { NetworkTopologyGraph } from '@/components/topology/NetworkTopologyGraph'
import { DeviceInfoPanel } from '@/components/topology/DeviceInfoPanel'
import { MetricsPanel } from '@/components/metrics/MetricsPanel'
import { AlertsPanel } from '@/components/alerts/AlertsPanel'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import { clsx } from 'clsx'

// ── Network Health Score widget ───────────────────────────────────────────────

const GaugeArc = ({ score }: { score: number }) => {
  // SVG semicircular gauge — 180° arc from left to right
  const R = 40
  const cx = 55
  const cy = 52
  const sweep = (score / 100) * 180

  const toRad = (deg: number) => (deg * Math.PI) / 180
  // Track arc: from 180° to 0° (left → right across the top)
  const startAngle = 180
  const endAngle   = 180 - sweep

  const x1 = cx + R * Math.cos(toRad(startAngle))
  const y1 = cy + R * Math.sin(toRad(startAngle))
  const x2 = cx + R * Math.cos(toRad(endAngle))
  const y2 = cy + R * Math.sin(toRad(endAngle))
  const largeArc = sweep > 180 ? 1 : 0

  const color =
    score >= 80 ? '#22c55e' :
    score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <svg width="110" height="58" className="overflow-visible">
      {/* Background track */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"
      />
      {/* Value arc */}
      {score > 0 && (
        <path
          d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          style={{ transition: 'all 0.6s ease-out' }}
        />
      )}
      {/* Score label */}
      <text
        x={cx} y={cy + 2}
        textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif"
      >
        {Math.round(score)}
      </text>
      <text
        x={cx} y={cy + 16}
        textAnchor="middle" dominantBaseline="middle"
        fill="#64748b" fontSize="8" fontFamily="Inter, sans-serif"
      >
        / 100
      </text>
    </svg>
  )
}

const NetworkHealthWidget = () => {
  const devices = useNetworkStore(s => s.devices)
  const links   = useNetworkStore(s => s.links)
  const alerts  = useNetworkStore(s => s.alerts)
  const flows   = useFlowStore(s => s.flows)

  const { score, breakdown, issues } = useMemo(() => {
    // Exclude controller node from device health (it's always "online" in demo)
    const realDevices  = devices.filter(d => d.type !== 'controller')
    const onlineCount  = realDevices.filter(d => d.status === 'online').length
    const totalDevices = realDevices.length || 1

    const realLinks    = links.filter(l => l.isUp)
    const healthyLinks = links.filter(l => l.isUp && l.utilizationPct < 75).length
    const totalLinks   = links.length || 1

    const activeFlows  = flows.filter(f => f.state === 'ADDED').length
    const totalFlows   = flows.length || 1

    const criticalCount = alerts.filter(a => !a.acknowledged && (a.severity === 'critical' || a.severity === 'error')).length

    const deviceScore = (onlineCount  / totalDevices) * 40
    const linkScore   = (healthyLinks / totalLinks)   * 30
    const flowScore   = (activeFlows  / totalFlows)   * 20
    const alertScore  = criticalCount === 0 ? 10 : 0

    const total = deviceScore + linkScore + flowScore + alertScore

    const issues: string[] = []
    if (onlineCount < totalDevices) {
      issues.push(`${totalDevices - onlineCount} device${totalDevices - onlineCount > 1 ? 's' : ''} offline (-${(40 - deviceScore).toFixed(0)}pts)`)
    }
    if (healthyLinks < links.length) {
      const downOrHigh = links.filter(l => !l.isUp || l.utilizationPct >= 75).length
      issues.push(`${downOrHigh} link${downOrHigh > 1 ? 's' : ''} down or congested (-${(30 - linkScore).toFixed(0)}pts)`)
    }
    if (activeFlows < totalFlows) {
      issues.push(`${totalFlows - activeFlows} flow rule${totalFlows - activeFlows > 1 ? 's' : ''} not in ADDED state (-${(20 - flowScore).toFixed(0)}pts)`)
    }
    if (criticalCount > 0) {
      issues.push(`${criticalCount} unacknowledged alert${criticalCount > 1 ? 's' : ''} (-10pts)`)
    }

    return {
      score: total,
      breakdown: { deviceScore, linkScore, flowScore, alertScore },
      issues,
    }
  }, [devices, links, alerts, flows])

  const label =
    score >= 80 ? 'Healthy'    :
    score >= 50 ? 'Degraded'   : 'Critical'

  const labelColor =
    score >= 80 ? 'text-green-400' :
    score >= 50 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">Network Health</p>
          <p className={clsx('text-xs font-medium mt-0.5', labelColor)}>{label}</p>
        </div>
        <GaugeArc score={score} />
      </div>

      {/* Score breakdown bars */}
      <div className="space-y-1.5 mb-3">
        {([
          ['Devices',   breakdown.deviceScore, 40, 'bg-sky-500'],
          ['Links',     breakdown.linkScore,   30, 'bg-violet-500'],
          ['Flows',     breakdown.flowScore,   20, 'bg-teal-500'],
          ['No Alerts', breakdown.alertScore,  10, 'bg-green-500'],
        ] as [string, number, number, string][]).map(([label, val, max, cls]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-16 flex-shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-700', cls)}
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 w-10 text-right">
              {val.toFixed(0)}/{max}
            </span>
          </div>
        ))}
      </div>

      {/* Issues list */}
      {issues.length > 0 ? (
        <div className="space-y-1">
          {issues.map(issue => (
            <div key={issue} className="flex items-start gap-1.5 text-[10px] text-slate-400">
              <span className="text-amber-400 mt-0.5 flex-shrink-0">▲</span>
              {issue}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-green-400/80">✓ All systems operating normally</p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const selectedElement = useNetworkStore((s) => s.selectedElement)
  const lastUpdate = useNetworkStore((s) => s.lastTopologyUpdate)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        title="Dashboard"
        subtitle="SDN ONOS Research Platform"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary cards */}
        <SummaryStats />

        {/* Main split: topology + sidebar */}
        <div className="flex gap-4 h-[640px]">
          {/* Topology */}
          <div className="flex-1 glass-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/40 flex-shrink-0">
              <p className="text-sm font-semibold text-slate-200">Network Topology</p>
              {lastUpdate && (
                <p className="text-xs text-slate-500">
                  Updated {new Date(lastUpdate).toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex-1 relative min-h-0">
              <NetworkTopologyGraph />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4 w-72">
            {/* Network Health Score */}
            <NetworkHealthWidget />

            {/* Device/link info panel */}
            {selectedElement.type && (
              <DeviceInfoPanel />
            )}

            {/* Alerts */}
            <div className="flex-1 glass-card p-4 overflow-y-auto min-h-0">
              <AlertsPanel maxVisible={10} showActions />
            </div>
          </div>
        </div>

        {/* Metrics row */}
        {selectedElement.type && (
          <div className="glass-card p-4">
            <p className="text-sm font-semibold text-slate-200 mb-3">
              Real-time Metrics
              {selectedElement.id && (
                <span className="text-slate-500 font-normal ml-2">
                  — {selectedElement.type} {selectedElement.id}
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MetricsPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
