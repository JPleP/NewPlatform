import { useState, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { FlowRuleEditor } from '@/components/flows/FlowRuleEditor'
import { NetworkTopologyGraph } from '@/components/topology/NetworkTopologyGraph'
import { SliceBar } from '@/components/flows/SliceBar'
import { PathBuilder } from '@/components/flows/PathBuilder'
import { useFlowStore } from '@/stores/flowStore'
import { useSliceStore, SLICE_COLOR_HEX } from '@/stores/sliceStore'
import { useNetworkStore } from '@/stores/networkStore'
import { colorClasses } from '@/components/flows/SliceBar'
import type { SliceColor } from '@/types'
import { Zap, Eye, Table, Search, X } from 'lucide-react'
import { clsx } from 'clsx'

export const FlowsPage = () => {
  const flows = useFlowStore(s => s.flows)
  const selectedFlowId = useFlowStore(s => s.selectedFlowId)
  const setSelectedFlow = useFlowStore(s => s.setSelectedFlow)
  const devices = useNetworkStore(s => s.devices)

  const { slices, selectedSliceId, setSelectedSlice, getSliceForFlow } = useSliceStore()

  const [showEditor, setShowEditor] = useState(false)
  const [pathBuilderMode, setPathBuilderMode] = useState(false)
  const [pathSrc, setPathSrc] = useState<string | null>(null)
  const [pathDst, setPathDst] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const activeFlows = flows.filter(f => f.state === 'ADDED').length

  // Compute which devices to highlight in topology:
  // - If path builder is active: highlight selected src/dst nodes
  // - If a flow is selected: highlight the device the flow is on
  // - If a slice is selected: highlight all devices referenced by slice's flows
  const highlightDeviceIds: string[] = (() => {
    if (pathBuilderMode) return [pathSrc, pathDst].filter(Boolean) as string[]
    if (selectedFlowId) {
      const flow = flows.find(f => f.id === selectedFlowId)
      if (flow) return [flow.deviceId]
    }
    if (selectedSliceId) {
      const slice = slices.find(s => s.id === selectedSliceId)
      if (slice) {
        return [...new Set(
          slice.flowIds
            .map(fid => flows.find(f => f.id === fid)?.deviceId)
            .filter(Boolean) as string[],
        )]
      }
    }
    return []
  })()

  const handlePathNodeClick = useCallback((id: string, _deviceType: string) => {
    if (!pathBuilderMode) return
    if (!pathSrc) { setPathSrc(id); return }
    if (id === pathSrc) return
    setPathDst(id)
  }, [pathBuilderMode, pathSrc])

  const handleFlowRowClick = (flowId: string) => {
    setSelectedFlow(flowId === selectedFlowId ? null : flowId)
    setPathBuilderMode(false)
  }

  const filteredBySlice = selectedSliceId
    ? flows.filter(f => slices.find(s => s.id === selectedSliceId)?.flowIds.includes(f.id))
    : flows

  // Search filter — case-insensitive, searches deviceId, appId, and all match fields
  const q = searchQuery.trim().toLowerCase()
  const filteredFlows = q
    ? filteredBySlice.filter(f =>
        f.deviceId.toLowerCase().includes(q) ||
        (f.appId ?? '').toLowerCase().includes(q) ||
        JSON.stringify(f.match).toLowerCase().includes(q) ||
        (devices.find(d => d.id === f.deviceId)?.label ?? '').toLowerCase().includes(q),
      )
    : filteredBySlice

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        title="Flow Rules"
        subtitle={`${activeFlows} active · ${flows.length} total · ${slices.length} slices`}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── LEFT: Topology ─────────────────────────────────────────── */}
        <div className="w-[55%] flex flex-col border-r border-slate-700/40">
          {/* Topology header bar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700/40 flex-shrink-0 bg-slate-900/50">
            <Eye className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Topology</span>
            {highlightDeviceIds.length > 0 && !pathBuilderMode && (
              <span className="text-xs text-slate-500">
                Highlighting {highlightDeviceIds.length} device{highlightDeviceIds.length > 1 ? 's' : ''}
              </span>
            )}
            {pathBuilderMode && (
              <span className="text-xs text-sdn-400 animate-pulse">
                {!pathSrc ? 'Click source node…' : !pathDst ? 'Click destination node…' : 'Path selected'}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => {
                  setPathBuilderMode(v => !v)
                  setPathSrc(null)
                  setPathDst(null)
                }}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all',
                  pathBuilderMode
                    ? 'bg-sdn-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200',
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                {pathBuilderMode ? 'Building Path…' : 'Build Path'}
              </button>
            </div>
          </div>

          {/* Topology canvas */}
          <div className="flex-1 relative min-h-0">
            <NetworkTopologyGraph
              highlightDeviceIds={highlightDeviceIds}
              pathBuilderMode={pathBuilderMode}
              onPathNodeClick={handlePathNodeClick}
            />
          </div>

          {/* Path Builder panel at bottom of left column */}
          {pathBuilderMode && (
            <div className="p-3 border-t border-slate-700/40 flex-shrink-0">
              <PathBuilder
                srcId={pathSrc}
                dstId={pathDst}
                onReset={() => { setPathSrc(null); setPathDst(null) }}
                onCancel={() => { setPathBuilderMode(false); setPathSrc(null); setPathDst(null) }}
                selectedSliceId={selectedSliceId}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: Slices + Flow Table ─────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          {/* Slice bar */}
          <SliceBar selectedSliceId={selectedSliceId} onSelectSlice={setSelectedSlice} />

          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700/40 flex-shrink-0 bg-slate-900/30">
            <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by device, IP, app, match field…"
              className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none min-w-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Flow table header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/40 flex-shrink-0">
            <Table className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">
              {selectedSliceId
                ? `Slice: ${slices.find(s => s.id === selectedSliceId)?.name ?? ''}`
                : 'All Flows'}
            </span>
            <span className="text-xs text-slate-500 ml-1">
              ({filteredFlows.length}{q && filteredFlows.length !== filteredBySlice.length ? ` of ${filteredBySlice.length}` : ''})
            </span>
            <button
              onClick={() => setShowEditor(true)}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-sdn-600 hover:bg-sdn-500 text-white transition-colors"
            >
              + Add Flow
            </button>
          </div>

          {/* Flow table with slice color stripe */}
          <div className="flex-1 overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 sticky top-0 z-10">
                  <tr>
                    <th className="w-1.5" />
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Device</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Pri</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Match</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">State</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlows.map(flow => {
                    const slice = getSliceForFlow(flow.id)
                    const isSelected = flow.id === selectedFlowId
                    const device = devices.find(d => d.id === flow.deviceId)
                    const matchParts = Object.entries(flow.match)
                      .filter(([, v]) => v !== undefined)
                      .map(([k, v]) => `${k}=${v}`)
                    const actionParts = flow.actions.map(a =>
                      a.type === 'OUTPUT' ? `→ port ${a.port}` : a.type,
                    )

                    return (
                      <tr
                        key={flow.id}
                        onClick={() => handleFlowRowClick(flow.id)}
                        className={clsx(
                          'cursor-pointer hover:bg-slate-800/50 transition-colors border-b border-slate-800/60',
                          isSelected && 'bg-sdn-600/10',
                        )}
                      >
                        {/* Slice color stripe */}
                        <td className="p-0">
                          <div
                            className="w-1 min-h-[36px] rounded-r"
                            style={{
                              background: slice ? SLICE_COLOR_HEX[slice.color] : 'transparent',
                            }}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-xs text-slate-200">
                            {device?.label ?? flow.deviceId.slice(0, 8)}
                          </div>
                          {slice && (
                            <div
                              className="text-[10px]"
                              style={{ color: SLICE_COLOR_HEX[slice.color] }}
                            >
                              {slice.name}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-300 tabular-nums">
                          {flow.priority}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-500 max-w-[140px] truncate">
                          {matchParts.length
                            ? matchParts.join(', ')
                            : <span className="italic text-slate-600">any</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-400 max-w-[100px] truncate">
                          {actionParts.join(', ')}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={clsx(
                            'badge text-[10px]',
                            flow.state === 'ADDED' ? 'badge-green' :
                            flow.state === 'PENDING_ADD' ? 'badge-amber' : 'badge-red',
                          )}>
                            {flow.state.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500 tabular-nums">
                          {flow.bytes > 1e6
                            ? (flow.bytes / 1e6).toFixed(1) + 'M'
                            : flow.bytes > 1e3
                            ? (flow.bytes / 1e3).toFixed(0) + 'K'
                            : flow.bytes + 'B'}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredFlows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-slate-500 text-sm">
                        {q
                          ? <><span className="text-slate-400">No flows match </span><span className="font-mono text-slate-300">"{searchQuery}"</span></>
                          : 'No flows in this slice.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showEditor && <FlowRuleEditor onClose={() => setShowEditor(false)} />}
    </div>
  )
}
