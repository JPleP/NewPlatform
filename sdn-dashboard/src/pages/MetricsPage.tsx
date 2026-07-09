import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { TopBar } from '@/components/layout/TopBar'
import { MetricsPanel } from '@/components/metrics/MetricsPanel'
import { useNetworkStore } from '@/stores/networkStore'
import { useMetricsStore } from '@/stores/metricsStore'
import { formatBandwidth, formatLatency, formatChartTime, formatPercent } from '@/utils/format'
import { clsx } from 'clsx'

// ── Link utilization heatmap row ──────────────────────────────────────────────

const LinkHeatRow = ({ linkId }: { linkId: string }) => {
  const link = useNetworkStore((s) => s.getLink(linkId))
  const metrics = useMetricsStore((s) => s.linkMetrics[linkId])
  if (!link) return null

  const util = link.utilizationPct
  const utilColor = util < 50 ? 'bg-green-500' : util < 75 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
      <div className="w-28 truncate text-xs text-slate-400 font-mono flex-shrink-0">{linkId}</div>
      <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
        <div
          className={clsx('h-full rounded transition-all duration-500', utilColor)}
          style={{ width: `${util}%` }}
        />
      </div>
      <div className={clsx('w-12 text-right text-xs font-mono',
        util < 50 ? 'text-green-400' : util < 75 ? 'text-amber-400' : 'text-red-400',
      )}>
        {formatPercent(util, 0)}
      </div>
      <div className="w-20 text-right text-xs font-mono text-slate-400">
        {formatBandwidth(link.throughputMbps)}
      </div>
      <div className="w-16 text-right text-xs font-mono text-slate-400">
        {formatLatency(link.latencyMs)}
      </div>
    </div>
  )
}

// ── Aggregate throughput chart ────────────────────────────────────────────────

const AggregateThroughput = () => {
  const linkMetrics = useMetricsStore((s) => s.linkMetrics)
  const links = useNetworkStore((s) => s.links.filter((l) => l.isUp))

  // Build combined time series (sum across all links)
  const allTimestamps = new Set<number>()
  Object.values(linkMetrics).forEach((lm) =>
    lm.bandwidth.forEach((p) => allTimestamps.add(p.timestamp)),
  )
  const sortedTs = [...allTimestamps].sort()

  const data = sortedTs.slice(-60).map((ts) => {
    let total = 0
    Object.values(linkMetrics).forEach((lm) => {
      const pt = lm.bandwidth.find((p) => p.timestamp === ts)
      if (pt) total += pt.value
    })
    return { timestamp: ts, value: total }
  })

  return (
    <div className="glass-card p-4">
      <p className="text-sm font-semibold text-slate-200 mb-3">
        Aggregate Throughput (all links)
      </p>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="agg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2f83fc" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2f83fc" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
            <YAxis tickFormatter={formatBandwidth} width={64} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => [formatBandwidth(v), 'Total throughput']}
              labelFormatter={(l: number) => formatChartTime(l)}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <Area type="monotone" dataKey="value" stroke="#2f83fc" strokeWidth={2} fill="url(#agg-grad)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Per-link bar chart ────────────────────────────────────────────────────────

const LinkUtilizationBars = () => {
  const links = useNetworkStore((s) => s.links)
  const data = links.map((l) => ({
    name: l.id,
    util: l.utilizationPct,
    throughput: l.throughputMbps,
    capacity: l.capacityMbps,
  }))

  return (
    <div className="glass-card p-4">
      <p className="text-sm font-semibold text-slate-200 mb-3">Link Utilization (%)</p>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 30 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              angle={-35}
              textAnchor="end"
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'Utilization']}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="util" fill="#2f83fc" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const MetricsPage = () => {
  const links = useNetworkStore((s) => s.links)
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar title="Metrics & Analytics" subtitle="Real-time network performance data" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Overview charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AggregateThroughput />
          <LinkUtilizationBars />
        </div>

        {/* Per-link heatmap table */}
        <div className="glass-card p-4">
          <p className="text-sm font-semibold text-slate-200 mb-3">Link Status</p>
          <div className="flex items-center gap-3 pb-2 border-b border-slate-800 mb-1 text-xs text-slate-500 uppercase tracking-wider">
            <span className="w-28">Link</span>
            <span className="flex-1">Utilization</span>
            <span className="w-12 text-right">Util %</span>
            <span className="w-20 text-right">Throughput</span>
            <span className="w-16 text-right">Latency</span>
          </div>
          {links.map((l) => (
            <div
              key={l.id}
              onClick={() => setSelectedLinkId(l.id === selectedLinkId ? null : l.id)}
              className="cursor-pointer hover:bg-slate-800/30 rounded transition-colors"
            >
              <LinkHeatRow linkId={l.id} />
            </div>
          ))}
        </div>

        {/* Detail charts for selected link */}
        {selectedLinkId && (
          <div className="glass-card p-4">
            <p className="text-sm font-semibold text-slate-200 mb-3">
              Link Detail: <span className="font-mono text-sdn-400">{selectedLinkId}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MetricsPanel linkId={selectedLinkId} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
