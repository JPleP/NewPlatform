/**
 * PacketTracer
 *
 * Interactive step-by-step packet path visualiser.
 *
 * 1. User selects source + destination host
 * 2. BFS finds the path through the network
 * 3. For each switch on the path, the matched Flow Rule is shown
 * 4. Auto-play or manual step controls drive the topology animation
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw,
  ChevronRight, Package, Zap, AlertTriangle,
} from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import type { TraceConfig } from './NetworkTopologyGraph'
import type { Device, Link, FlowRule } from '@/types'
import { clsx } from 'clsx'

// ── BFS path finding ──────────────────────────────────────────────────────────

const bfsPath = (
  srcId: string,
  dstId: string,
  links: Link[],
): string[] => {
  if (srcId === dstId) return [srcId]
  const adj: Record<string, string[]> = {}
  links.forEach((l) => {
    ;(adj[l.sourceDeviceId] ??= []).push(l.targetDeviceId)
    ;(adj[l.targetDeviceId] ??= []).push(l.sourceDeviceId)
  })
  const queue = [[srcId]]
  const visited = new Set([srcId])
  while (queue.length) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    if (cur === dstId) return path
    for (const next of adj[cur] ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([...path, next])
      }
    }
  }
  return []
}

/** Find the link ID connecting two adjacent devices */
const linkBetween = (a: string, b: string, links: Link[]): string | undefined =>
  links.find(
    (l) =>
      (l.sourceDeviceId === a && l.targetDeviceId === b) ||
      (l.targetDeviceId === a && l.sourceDeviceId === b),
  )?.id

// ── Flow rule matching ────────────────────────────────────────────────────────

const findMatchedRule = (
  switchId: string,
  srcIp: string,
  dstIp: string,
  flows: FlowRule[],
): FlowRule | undefined => {
  const candidates = flows
    .filter((f) => f.deviceId === switchId && f.state === 'ADDED')
    .sort((a, b) => b.priority - a.priority)

  return candidates.find((f) => {
    const m = f.match
    if (m.ipSrc && !srcIp.startsWith(m.ipSrc.replace(/\/\d+$/, ''))) return false
    if (m.ipDst && !dstIp.startsWith(m.ipDst.replace(/\/\d+$/, ''))) return false
    return true
  })
}

// ── Trace step log entry ──────────────────────────────────────────────────────

interface StepEntry {
  index: number      // position in interleaved sequence
  kind: 'host' | 'switch' | 'link'
  label: string
  sublabel?: string
  matchedRule?: FlowRule
  action?: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SpeedButton = ({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={clsx(
      'px-2 py-0.5 rounded text-xs font-mono transition-colors',
      active ? 'bg-sdn-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200',
    )}
  >
    {label}
  </button>
)

const RuleChip = ({ rule }: { rule: FlowRule }) => {
  const match = Object.entries(rule.match)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ') || 'any'
  const action = rule.actions
    .map((a) => (a.type === 'OUTPUT' ? `→ port ${a.port}` : a.type))
    .join(', ')

  return (
    <div className="mt-1.5 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-green-400 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">
          Matched Flow Rule
        </span>
        <span className="ml-auto text-[10px] font-mono text-slate-500">
          pri {rule.priority}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
        <span className="text-slate-500">Match</span>
        <span className="font-mono text-slate-300 truncate">{match}</span>
        <span className="text-slate-500">Action</span>
        <span className="font-mono text-slate-300">{action}</span>
        {rule.appId && <>
          <span className="text-slate-500">App</span>
          <span className="font-mono text-slate-400 truncate">{rule.appId}</span>
        </>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface PacketTracerProps {
  onTraceChange: (config: TraceConfig | null) => void
  onClose: () => void
}

export const PacketTracer = ({ onTraceChange, onClose }: PacketTracerProps) => {
  const devices = useNetworkStore((s) => s.devices)
  const links   = useNetworkStore((s) => s.links)
  const flows   = useFlowStore((s) => s.flows)

  const hosts     = devices.filter((d) => d.type === 'host' && d.status !== 'offline')
  const switches  = devices.filter((d) => d.type === 'switch')

  const [srcId, setSrcId]   = useState<string>(hosts[0]?.id ?? '')
  const [dstId, setDstId]   = useState<string>(hosts[1]?.id ?? '')
  const [speed, setSpeed]   = useState<number>(1000)   // ms per step
  const [step, setStep]     = useState<number>(-2)      // -2 = not started
  const [playing, setPlaying] = useState(false)

  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Derive path ─────────────────────────────────────────────────────────────
  const nodePath: string[] = srcId && dstId && srcId !== dstId
    ? bfsPath(srcId, dstId, links)
    : []

  const edgePath: string[] = nodePath.length > 1
    ? nodePath.slice(0, -1).map((id, i) => linkBetween(id, nodePath[i + 1], links) ?? '')
    : []

  // Interleaved length: nodes + edges
  const seqLen = nodePath.length + edgePath.length   // == 2*nodes - 1

  // ── Build step log ──────────────────────────────────────────────────────────
  const stepLog: StepEntry[] = []
  if (nodePath.length) {
    const srcDevice = devices.find((d) => d.id === srcId)
    const dstDevice = devices.find((d) => d.id === dstId)

    nodePath.forEach((nid, ni) => {
      const dev = devices.find((d) => d.id === nid)
      const seqIdx = ni * 2  // position in interleaved sequence

      if (dev?.type === 'host') {
        stepLog.push({
          index: seqIdx,
          kind: 'host',
          label: dev.label,
          sublabel: dev.ipAddress,
        })
      } else if (dev?.type === 'switch') {
        const rule = findMatchedRule(
          nid,
          srcDevice?.ipAddress ?? '',
          dstDevice?.ipAddress ?? '',
          flows,
        )
        stepLog.push({
          index: seqIdx,
          kind: 'switch',
          label: dev?.label ?? nid,
          sublabel: dev?.ipAddress,
          matchedRule: rule,
          action: rule
            ? rule.actions.map((a) => a.type === 'OUTPUT' ? `Forward out port ${a.port}` : a.type).join(', ')
            : 'No matching rule — packet sent to controller',
        })
      }

      // Link step after each node except last
      if (edgePath[ni]) {
        stepLog.push({
          index: seqIdx + 1,
          kind: 'link',
          label: `Link`,
          sublabel: edgePath[ni],
        })
      }
    })
  }

  // ── Sync TraceConfig to parent ──────────────────────────────────────────────
  useEffect(() => {
    if (step === -2 || nodePath.length === 0) {
      onTraceChange(null)
      return
    }
    onTraceChange({ nodePath, edgePath, step })
  }, [step, srcId, dstId, links.length])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Playback controls ───────────────────────────────────────────────────────
  const stopPlay = useCallback(() => {
    if (playTimer.current) { clearInterval(playTimer.current); playTimer.current = null }
    setPlaying(false)
  }, [])

  const startPlay = useCallback(() => {
    if (nodePath.length < 2) return
    setPlaying(true)
    setStep((prev) => (prev >= seqLen - 1 ? 0 : prev < 0 ? 0 : prev))

    playTimer.current = setInterval(() => {
      setStep((prev) => {
        const next = prev + 1
        if (next >= seqLen) {
          stopPlay()
          return prev
        }
        return next
      })
    }, speed)
  }, [nodePath.length, seqLen, speed, stopPlay])

  // Restart play when speed changes mid-play
  useEffect(() => {
    if (playing) { stopPlay(); startPlay() }
  }, [speed])   // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => stopPlay(), [stopPlay])

  const handleTrace = () => {
    stopPlay()
    setStep(-1)   // show full path
  }

  const handlePlay = () => (playing ? stopPlay() : startPlay())

  const handleReset = () => {
    stopPlay()
    setStep(-2)
    onTraceChange(null)
  }

  const stepBackward = () => {
    stopPlay()
    setStep((s) => Math.max(0, s <= 0 ? 0 : s - 1))
  }

  const stepForward = () => {
    stopPlay()
    setStep((s) => Math.min(seqLen - 1, s < 0 ? 0 : s + 1))
  }

  const pathReady = nodePath.length >= 2
  const started   = step >= -1

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/40 flex-shrink-0">
        <Package className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-bold text-slate-100">Packet Tracer</span>
        <button
          onClick={() => { handleReset(); onClose() }}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Source / Destination selectors */}
      <div className="px-4 py-3 border-b border-slate-700/40 flex-shrink-0 space-y-2">
        {(['src', 'dst'] as const).map((which) => (
          <div key={which} className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase w-6">
              {which === 'src' ? 'SRC' : 'DST'}
            </span>
            <select
              value={which === 'src' ? srcId : dstId}
              onChange={(e) => {
                handleReset()
                which === 'src' ? setSrcId(e.target.value) : setDstId(e.target.value)
              }}
              className="flex-1 px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-sdn-500"
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label} ({h.ipAddress})
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* No path warning */}
        {srcId && dstId && srcId !== dstId && nodePath.length === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            No path found between these hosts
          </div>
        )}

        {/* Trace button */}
        <button
          onClick={handleTrace}
          disabled={!pathReady}
          className="w-full py-1.5 rounded text-xs font-semibold bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Trace Path ({nodePath.length} hops)
        </button>
      </div>

      {/* Playback controls */}
      {started && (
        <div className="px-4 py-2 border-b border-slate-700/40 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <button onClick={handleReset}    className="p-1.5 rounded hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
            <button onClick={stepBackward}   disabled={step <= 0}             className="p-1.5 rounded hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"><SkipBack    className="w-3.5 h-3.5" /></button>
            <button onClick={handlePlay}     disabled={!pathReady}            className="p-1.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 disabled:opacity-30 transition-colors">
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button onClick={stepForward}    disabled={step >= seqLen - 1}   className="p-1.5 rounded hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"><SkipForward className="w-3.5 h-3.5" /></button>

            <span className="ml-auto text-[10px] font-mono text-slate-500">
              {step === -1 ? 'overview' : `${step + 1} / ${seqLen}`}
            </span>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Speed</span>
            {([2000, 1000, 500, 200] as const).map((ms) => (
              <SpeedButton
                key={ms}
                label={ms >= 1000 ? `${ms / 1000}×` : `${1000 / ms}×`}
                active={speed === ms}
                onClick={() => setSpeed(ms)}
              />
            ))}
          </div>

          {/* Progress bar */}
          {step >= 0 && (
            <div className="mt-2 h-1 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                style={{ width: `${((step + 1) / seqLen) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Step log */}
      {started && stepLog.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Path Log
          </p>

          {stepLog.map((entry) => {
            const isCurrent = step === entry.index
            const isVisited = step === -1 || step > entry.index
            const isPending = step !== -1 && step < entry.index

            if (entry.kind === 'link') {
              return (
                <div
                  key={entry.index}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1',
                    isPending && 'opacity-25',
                  )}
                >
                  <ChevronRight className={clsx(
                    'w-3 h-3 flex-shrink-0',
                    isCurrent ? 'text-yellow-400' : isVisited ? 'text-green-500' : 'text-slate-600',
                  )} />
                  <span className="text-[10px] font-mono text-slate-600 truncate">{entry.sublabel}</span>
                </div>
              )
            }

            return (
              <div
                key={entry.index}
                className={clsx(
                  'rounded-lg border px-3 py-2 transition-all',
                  isCurrent
                    ? 'border-yellow-400/50 bg-yellow-400/10'
                    : isVisited
                    ? entry.kind === 'host'
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-slate-600/40 bg-slate-800/40'
                    : 'border-slate-700/30 bg-transparent opacity-30',
                )}
              >
                {/* Node header */}
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                    isCurrent ? 'bg-yellow-400/20 text-yellow-300' :
                    isVisited && entry.kind === 'host' ? 'bg-green-500/20 text-green-400' :
                    'bg-slate-700 text-slate-400',
                  )}>
                    {entry.kind === 'host' ? '🖥' : '⬛'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate">{entry.label}</p>
                    {entry.sublabel && (
                      <p className="text-[10px] font-mono text-slate-500">{entry.sublabel}</p>
                    )}
                  </div>
                  {isCurrent && (
                    <span className="ml-auto text-[10px] font-semibold text-yellow-400 animate-pulse flex-shrink-0">
                      ● HERE
                    </span>
                  )}
                  {isVisited && !isCurrent && entry.kind === 'host' && (
                    <span className="ml-auto text-[10px] text-green-400 flex-shrink-0">✓</span>
                  )}
                </div>

                {/* Switch detail */}
                {entry.kind === 'switch' && (isVisited || isCurrent) && (
                  <>
                    {entry.matchedRule ? (
                      <RuleChip rule={entry.matchedRule} />
                    ) : (
                      <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className="text-[10px] text-amber-300">
                            No matching rule — packet-in to controller
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* Delivery confirmation */}
          {(step === seqLen - 1 || step === -1) && nodePath.length >= 2 && (
            <div className="mt-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-center">
              <p className="text-xs font-semibold text-green-400">
                ✓ Packet delivered to {devices.find((d) => d.id === dstId)?.label}
              </p>
            </div>
          )}
        </div>
      )}

      {!started && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600 px-4">
          <Package className="w-8 h-8 opacity-30" />
          <p className="text-xs text-center">Select source and destination,<br />then click Trace Path</p>
        </div>
      )}
    </div>
  )
}
