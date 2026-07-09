/**
 * MetricsPanel
 *
 * Real-time Recharts time-series charts for a selected link or device.
 * Shows the last N seconds of:
 *   - Bandwidth (Mbps)
 *   - Latency (ms)
 *   - Packet loss (%)
 *
 * Uses a rolling window of MetricPoint[] from metricsStore.
 * Charts update automatically via store subscription.
 */

import {
  ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine,
} from 'recharts'
import { useMetricsStore } from '@/stores/metricsStore'
import { useNetworkStore } from '@/stores/networkStore'
import { formatChartTime, formatBandwidth, formatLatency, formatPercent } from '@/utils/format'
import type { MetricPoint } from '@/types'
import { clsx } from 'clsx'
import { Activity, Clock, Wifi } from 'lucide-react'

// ── Shared chart config ───────────────────────────────────────────────────────

const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 }

const sharedAxisProps = {
  tick: { fill: '#64748b', fontSize: 10 },
  tickLine: false,
  axisLine: false,
}

const sharedGridProps = {
  stroke: '#1e293b',
  strokeDasharray: '3 3',
}

const CustomTooltipContent = ({
  active, payload, label, formatter,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
  formatter: (v: number) => string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label ? formatChartTime(label) : ''}</p>
      <p className="font-mono text-slate-100">{formatter(payload[0].value)}</p>
    </div>
  )
}

// ── Single metric chart card ──────────────────────────────────────────────────

interface MetricChartProps {
  title: string
  icon: React.ReactNode
  data: MetricPoint[]
  color: string
  formatter: (v: number) => string
  domain?: [number | 'auto', number | 'auto']
  referenceValue?: number
  referenceLabel?: string
  areaGradient?: boolean
  type?: 'area' | 'line'
}

const MetricChart = ({
  title, icon, data, color, formatter, domain,
  referenceValue, referenceLabel,
  areaGradient = true, type = 'area',
}: MetricChartProps) => {
  const latest = data.length ? data[data.length - 1].value : null

  const gradientId = `grad-${title.replace(/\s/g, '-')}`

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
        <span className={clsx('metric-value text-lg', latest === null && 'text-slate-600')}>
          {latest !== null ? formatter(latest) : '—'}
        </span>
      </div>

      <div style={{ height: 90 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'area' ? (
            <AreaChart data={data} margin={CHART_MARGIN}>
              <defs>
                {areaGradient && (
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid {...sharedGridProps} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatChartTime}
                interval="preserveStartEnd"
                minTickGap={60}
                {...sharedAxisProps}
              />
              <YAxis
                domain={domain}
                tickFormatter={(v) => formatter(v)}
                width={52}
                {...sharedAxisProps}
              />
              <Tooltip content={<CustomTooltipContent formatter={formatter} />} />
              {referenceValue !== undefined && (
                <ReferenceLine
                  y={referenceValue}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  label={{ value: referenceLabel, fill: '#ef4444', fontSize: 10 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={areaGradient ? `url(#${gradientId})` : 'none'}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid {...sharedGridProps} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatChartTime}
                interval="preserveStartEnd"
                minTickGap={60}
                {...sharedAxisProps}
              />
              <YAxis
                domain={domain}
                tickFormatter={(v) => formatter(v)}
                width={52}
                {...sharedAxisProps}
              />
              <Tooltip content={<CustomTooltipContent formatter={formatter} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface MetricsPanelProps {
  /** ID of the link to show metrics for */
  linkId?: string
  /** ID of the device to show metrics for */
  deviceId?: string
  className?: string
}

export const MetricsPanel = ({ linkId, deviceId, className }: MetricsPanelProps) => {
  const linkMetrics = useMetricsStore((s) => linkId ? s.linkMetrics[linkId] : undefined)
  const deviceMetrics = useMetricsStore((s) => deviceId ? s.deviceMetrics[deviceId] : undefined)
  const selectedElement = useNetworkStore((s) => s.selectedElement)

  // Resolve from selectedElement if no explicit id provided
  const resolvedLinkId   = linkId   ?? (selectedElement.type === 'link'   ? selectedElement.id ?? undefined : undefined)
  const resolvedDeviceId = deviceId ?? (selectedElement.type === 'device' ? selectedElement.id ?? undefined : undefined)

  const resolvedLink   = useMetricsStore((s) => resolvedLinkId   ? s.linkMetrics[resolvedLinkId]   : undefined)
  const resolvedDevice = useMetricsStore((s) => resolvedDeviceId ? s.deviceMetrics[resolvedDeviceId] : undefined)

  const activeLink   = linkMetrics   ?? resolvedLink
  const activeDevice = deviceMetrics ?? resolvedDevice

  const hasData = !!activeLink || !!activeDevice

  if (!hasData) {
    return (
      <div className={clsx('flex flex-col items-center justify-center gap-3 text-slate-500 py-12', className)}>
        <Activity className="w-8 h-8 opacity-40" />
        <p className="text-sm">Select a link or device in the topology to view metrics</p>
      </div>
    )
  }

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      {activeLink && (
        <>
          <MetricChart
            title="Bandwidth"
            icon={<Wifi className="w-4 h-4" />}
            data={activeLink.bandwidth}
            color="#2f83fc"
            formatter={formatBandwidth}
            domain={[0, 'auto']}
            areaGradient
          />
          <MetricChart
            title="Latency"
            icon={<Clock className="w-4 h-4" />}
            data={activeLink.latency}
            color="#a78bfa"
            formatter={formatLatency}
            domain={[0, 'auto']}
            referenceValue={10}
            referenceLabel="10ms"
            areaGradient
          />
          <MetricChart
            title="Packet Loss"
            icon={<Activity className="w-4 h-4" />}
            data={activeLink.packetLoss}
            color="#f59e0b"
            formatter={(v) => formatPercent(v, 3)}
            domain={[0, 'auto']}
            referenceValue={1}
            referenceLabel="1%"
            type="line"
            areaGradient={false}
          />
        </>
      )}

      {activeDevice && (
        <>
          <MetricChart
            title="CPU Usage"
            icon={<Activity className="w-4 h-4" />}
            data={activeDevice.cpuPct}
            color="#22c55e"
            formatter={(v) => formatPercent(v)}
            domain={[0, 100]}
            referenceValue={80}
            referenceLabel="80%"
            areaGradient
          />
          <MetricChart
            title="Memory Usage"
            icon={<Activity className="w-4 h-4" />}
            data={activeDevice.memoryPct}
            color="#0ea5e9"
            formatter={(v) => formatPercent(v)}
            domain={[0, 100]}
            referenceValue={90}
            referenceLabel="90%"
            areaGradient
          />
        </>
      )}
    </div>
  )
}
