import { useState } from 'react'
import { Play, Pause, Square, Plus, FlaskConical, Clock, CheckCircle, XCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { useNetworkStore } from '@/stores/networkStore'
import type { Experiment, TrafficProfile, ExperimentStatus } from '@/types'
import { clsx } from 'clsx'

// ── Mock experiment store (inline for simplicity) ─────────────────────────────

const DEMO_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-001',
    name: 'Shortest Path Routing Baseline',
    description: 'Measure baseline latency and throughput with default ONOS shortest-path routing between H1 and H3.',
    status: 'completed',
    topology: 'current',
    trafficProfiles: [
      { type: 'cbr', rateMbps: 10, durationSec: 60, protocol: 'UDP', srcHost: 'h-1', dstHost: 'h-3' },
    ],
    routingAlgorithm: 'shortest-path',
    startedAt: new Date(Date.now() - 3_600_000).toISOString(),
    completedAt: new Date(Date.now() - 3_540_000).toISOString(),
    results: { avgLatencyMs: 3.2, p95LatencyMs: 5.1, avgThroughputMbps: 9.8, packetLossPct: 0.02, flowCount: 6, notes: 'Clean baseline result. RTT stable.' },
  },
  {
    id: 'exp-002',
    name: 'Load Balancing Experiment',
    description: 'Compare ECMP load balancing vs. shortest path under heavy traffic between all hosts.',
    status: 'running',
    topology: 'current',
    trafficProfiles: [
      { type: 'burst', rateMbps: 50, burstSizeKb: 1024, durationSec: 120, protocol: 'TCP', srcHost: 'h-1', dstHost: 'h-3' },
      { type: 'cbr',   rateMbps: 20, durationSec: 120, protocol: 'UDP', srcHost: 'h-2', dstHost: 'h-3' },
    ],
    routingAlgorithm: 'load-balanced',
    startedAt: new Date(Date.now() - 45_000).toISOString(),
  },
  {
    id: 'exp-003',
    name: 'Link Failure Recovery',
    description: 'Test ONOS fast failover: drop link S1-S2 during active flows and measure recovery time.',
    status: 'idle',
    topology: 'current',
    trafficProfiles: [
      { type: 'constant', rateMbps: 5, durationSec: 180, protocol: 'ICMP', srcHost: 'h-1', dstHost: 'h-3' },
    ],
    routingAlgorithm: 'shortest-path',
  },
]

// ── Status badge ──────────────────────────────────────────────────────────────

const statusConfig: Record<ExperimentStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  idle: {
    label: 'Idle',
    icon: <Clock className="w-3.5 h-3.5" />,
    badge: 'badge badge-blue',
  },
  running: {
    label: 'Running',
    icon: <Play className="w-3.5 h-3.5" />,
    badge: 'badge badge-green',
  },
  paused: {
    label: 'Paused',
    icon: <Pause className="w-3.5 h-3.5" />,
    badge: 'badge badge-amber',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    badge: 'badge badge-green',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="w-3.5 h-3.5" />,
    badge: 'badge badge-red',
  },
}

// ── Experiment card ───────────────────────────────────────────────────────────

const ExperimentCard = ({
  experiment,
  isSelected,
  onSelect,
  onStart,
  onStop,
}: {
  experiment: Experiment
  isSelected: boolean
  onSelect: () => void
  onStart: () => void
  onStop: () => void
}) => {
  const cfg = statusConfig[experiment.status]
  const isRunning = experiment.status === 'running'

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'glass-card p-4 cursor-pointer hover:bg-slate-800/40 transition-colors',
        isSelected && 'border-sdn-500/40 bg-sdn-500/5',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-sdn-400 flex-shrink-0" />
          <p className="font-semibold text-slate-100 text-sm">{experiment.name}</p>
        </div>
        <span className={cfg.badge}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed">{experiment.description}</p>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <span>{experiment.trafficProfiles.length} traffic profile{experiment.trafficProfiles.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{experiment.routingAlgorithm}</span>
        {experiment.startedAt && (
          <>
            <span>·</span>
            <span>Started {new Date(experiment.startedAt).toLocaleTimeString()}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {experiment.status === 'idle' && (
          <button
            onClick={(e) => { e.stopPropagation(); onStart() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/20 text-xs font-medium transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
        )}
        {isRunning && (
          <button
            onClick={(e) => { e.stopPropagation(); onStop() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/20 text-xs font-medium transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        )}
      </div>
    </div>
  )
}

// ── Result panel ──────────────────────────────────────────────────────────────

const ResultPanel = ({ experiment }: { experiment: Experiment }) => {
  const r = experiment.results
  if (!r) return null

  return (
    <div className="glass-card p-4 mt-4">
      <p className="text-sm font-semibold text-slate-200 mb-3">Experiment Results</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Avg Latency',     value: `${r.avgLatencyMs} ms` },
          { label: 'P95 Latency',     value: `${r.p95LatencyMs} ms` },
          { label: 'Avg Throughput',  value: `${r.avgThroughputMbps} Mbps` },
          { label: 'Packet Loss',     value: `${r.packetLossPct}%` },
          { label: 'Flow Count',      value: String(r.flowCount) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-800/60 rounded-lg p-3">
            <p className="metric-label">{label}</p>
            <p className="metric-value text-xl">{value}</p>
          </div>
        ))}
      </div>
      {r.notes && (
        <div className="mt-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
          <p className="text-xs font-semibold text-slate-400 mb-1">Notes</p>
          <p className="text-sm text-slate-300">{r.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const ExperimentsPage = () => {
  const [experiments, setExperiments] = useState(DEMO_EXPERIMENTS)
  const [selectedId, setSelectedId] = useState<string | null>('exp-001')

  const selected = experiments.find((e) => e.id === selectedId)

  const handleStart = (id: string) => {
    setExperiments((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: 'running', startedAt: new Date().toISOString() } : e),
    )
  }

  const handleStop = (id: string) => {
    setExperiments((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: 'completed', completedAt: new Date().toISOString() } : e),
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        title="Experiments"
        subtitle="Configure and run SDN research scenarios"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Experiment list */}
        <div className="w-96 border-r border-slate-700/50 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-700/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">{experiments.length} experiments</span>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sdn-600/20 text-sdn-400 hover:bg-sdn-600/30 text-xs font-medium transition-colors border border-sdn-600/20">
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {experiments.map((exp) => (
              <ExperimentCard
                key={exp.id}
                experiment={exp}
                isSelected={exp.id === selectedId}
                onSelect={() => setSelectedId(exp.id)}
                onStart={() => handleStart(exp.id)}
                onStop={() => handleStop(exp.id)}
              />
            ))}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto p-4">
          {selected ? (
            <>
              <div className="glass-card p-4 mb-4">
                <h2 className="text-base font-semibold text-slate-100 mb-1">{selected.name}</h2>
                <p className="text-sm text-slate-400 leading-relaxed">{selected.description}</p>
              </div>

              {/* Traffic profiles */}
              <div className="glass-card p-4 mb-4">
                <p className="text-sm font-semibold text-slate-200 mb-3">Traffic Profiles</p>
                <div className="space-y-2">
                  {selected.trafficProfiles.map((profile, i) => (
                    <div key={i} className="bg-slate-800/60 rounded-lg p-3 text-xs font-mono">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Type</span>
                        <span className="col-span-2 text-slate-300">{profile.type}</span>
                        <span className="text-slate-500">Rate</span>
                        <span className="col-span-2 text-slate-300">{profile.rateMbps} Mbps ({profile.protocol})</span>
                        <span className="text-slate-500">Route</span>
                        <span className="col-span-2 text-slate-300">{profile.srcHost} → {profile.dstHost}</span>
                        <span className="text-slate-500">Duration</span>
                        <span className="col-span-2 text-slate-300">{profile.durationSec}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              {selected.results && <ResultPanel experiment={selected} />}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Select an experiment to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
