import { ArrowRight, X, Zap, RotateCcw } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import { useSliceStore } from '@/stores/sliceStore'
import { colorClasses } from './SliceBar'
import type { FlowRule, SliceColor } from '@/types'
import { clsx } from 'clsx'

interface PathBuilderProps {
  srcId: string | null
  dstId: string | null
  onReset: () => void
  onCancel: () => void
  selectedSliceId: string | null
}

export const PathBuilder = ({ srcId, dstId, onReset, onCancel, selectedSliceId }: PathBuilderProps) => {
  const devices = useNetworkStore(s => s.devices)
  const links = useNetworkStore(s => s.links)
  const { addFlow } = useFlowStore()
  const { slices, assignFlowToSlice } = useSliceStore()

  const src = devices.find(d => d.id === srcId)
  const dst = devices.find(d => d.id === dstId)
  const slice = slices.find(s => s.id === selectedSliceId)

  // Find a path between src and dst through all devices (BFS)
  const findPath = (srcId: string, dstId: string): string[] => {
    if (!srcId || !dstId) return []
    const adj: Record<string, string[]> = {}
    links.forEach(l => {
      if (!adj[l.sourceDeviceId]) adj[l.sourceDeviceId] = []
      if (!adj[l.targetDeviceId]) adj[l.targetDeviceId] = []
      adj[l.sourceDeviceId].push(l.targetDeviceId)
      adj[l.targetDeviceId].push(l.sourceDeviceId)
    })
    const queue = [[srcId]]
    const visited = new Set([srcId])
    while (queue.length) {
      const path = queue.shift()!
      const node = path[path.length - 1]
      if (node === dstId) return path
      for (const next of (adj[node] ?? [])) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push([...path, next])
        }
      }
    }
    return []
  }

  const path = srcId && dstId ? findPath(srcId, dstId) : []

  const switchesOnPath = path.filter(id => devices.find(d => d.id === id)?.type === 'switch')

  const deployFlow = () => {
    if (!srcId || !dstId || path.length < 2) return

    const priority = slice?.priority ?? 40000
    const newFlowIds: string[] = []

    switchesOnPath.forEach((swId, idx) => {
      // Find the next hop link to determine output port
      const swIdx = path.indexOf(swId)
      const nextHopId = path[swIdx + 1]
      const link = nextHopId
        ? links.find(l =>
            (l.sourceDeviceId === swId && l.targetDeviceId === nextHopId) ||
            (l.targetDeviceId === swId && l.sourceDeviceId === nextHopId),
          )
        : undefined
      const outPort = link
        ? (link.sourceDeviceId === swId ? link.sourcePort : link.targetPort)
        : 1

      const flow: FlowRule = {
        id: `flow-${Date.now()}-${idx}`,
        deviceId: swId,
        tableId: 0,
        priority,
        timeout: 0,
        hardTimeout: 0,
        isPermanent: true,
        state: 'ADDED',
        bytes: 0,
        packets: 0,
        createdAt: new Date().toISOString(),
        appId: slice ? `slice:${slice.name}` : 'path-builder',
        match: {
          ethType: '0x0800',
          ...(src?.ipAddress && { ipSrc: src.ipAddress + '/32' }),
          ...(dst?.ipAddress && { ipDst: dst.ipAddress + '/32' }),
        },
        actions: [{ type: 'OUTPUT', port: outPort }],
      }
      addFlow(flow)
      newFlowIds.push(flow.id)
    })

    // Assign to slice if selected
    if (selectedSliceId) {
      newFlowIds.forEach(id => assignFlowToSlice(id, selectedSliceId))
    }

    onReset()
  }

  const NodeChip = ({ id, step }: { id: string | null; step: string }) => {
    const device = id ? devices.find(d => d.id === id) : null
    return (
      <div className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border min-w-32',
        device
          ? 'border-sdn-500/50 bg-sdn-500/10'
          : 'border-dashed border-slate-600 bg-slate-800/50',
      )}>
        {device ? (
          <>
            <span className={clsx(
              'w-2 h-2 rounded-full flex-shrink-0',
              device.type === 'host' ? 'bg-green-400' : 'bg-sky-400',
            )} />
            <div>
              <p className="text-xs font-medium text-slate-100">{device.label}</p>
              <p className="text-[10px] text-slate-500 font-mono">{device.ipAddress}</p>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 italic">{step}</p>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card p-4 space-y-3 border border-sdn-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sdn-400" />
          <span className="text-sm font-semibold text-slate-100">Path Builder</span>
          {slice && (
            <span className={clsx(
              'badge text-xs',
              colorClasses[slice.color as SliceColor]?.bg,
              colorClasses[slice.color as SliceColor]?.text,
            )}>
              {slice.name}
            </span>
          )}
        </div>
        <button onClick={onCancel} className="p-1 rounded hover:bg-slate-700/50">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <p className="text-xs text-slate-400">
        {!srcId
          ? '① Click a node on the topology as source'
          : !dstId
          ? '② Click another node as destination'
          : `Path found: ${path.length} hops · ${switchesOnPath.length} switch${switchesOnPath.length !== 1 ? 'es' : ''}`}
      </p>

      <div className="flex items-center gap-2">
        <NodeChip id={srcId} step="Select source…" />
        <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <NodeChip id={dstId} step="Select dest…" />
      </div>

      {path.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {path.map((id, i) => {
            const d = devices.find(dev => dev.id === id)
            return (
              <div key={id} className="flex items-center gap-1 flex-shrink-0">
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded font-mono',
                  d?.type === 'switch'
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-green-500/20 text-green-300',
                )}>
                  {d?.label ?? id.slice(0, 6)}
                </span>
                {i < path.length - 1 && <span className="text-slate-600 text-xs">→</span>}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <button
          onClick={deployFlow}
          disabled={!srcId || !dstId || path.length < 2}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-sdn-600 hover:bg-sdn-500 text-sm text-white disabled:opacity-40 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Deploy {switchesOnPath.length} Flow Rule{switchesOnPath.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
