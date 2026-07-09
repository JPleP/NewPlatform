/**
 * Sortable, filterable table of flow rules.
 * Displays match/action columns, bytes/packets counters, state badge.
 */

import { useState, useMemo } from 'react'
import { Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { useFlowStore } from '@/stores/flowStore'
import { useNetworkStore } from '@/stores/networkStore'
import { deleteFlow } from '@/services/onosApi'
import { formatBytes, formatPackets, flowStateBadge, formatRelative } from '@/utils/format'
import type { FlowRule } from '@/types'
import { clsx } from 'clsx'

type SortKey = 'priority' | 'deviceId' | 'state' | 'bytes' | 'packets' | 'createdAt'
type SortDir = 'asc' | 'desc'

const SortIcon = ({ field, sortKey, sortDir }: { field: SortKey; sortKey: SortKey; sortDir: SortDir }) => {
  if (field !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3.5 h-3.5 text-sdn-400" />
    : <ChevronDown className="w-3.5 h-3.5 text-sdn-400" />
}

const MatchSummary = ({ match }: { match: FlowRule['match'] }) => {
  const parts: string[] = []
  if (match.inPort  !== undefined)  parts.push(`port=${match.inPort}`)
  if (match.ethType !== undefined)  parts.push(`ethertype=${match.ethType}`)
  if (match.ipSrc   !== undefined)  parts.push(`ip_src=${match.ipSrc}`)
  if (match.ipDst   !== undefined)  parts.push(`ip_dst=${match.ipDst}`)
  if (match.tcpSrc  !== undefined)  parts.push(`tcp_src=${match.tcpSrc}`)
  if (match.tcpDst  !== undefined)  parts.push(`tcp_dst=${match.tcpDst}`)
  if (match.vlanId  !== undefined)  parts.push(`vlan=${match.vlanId}`)
  if (match.ethSrc  !== undefined)  parts.push(`eth_src=${match.ethSrc}`)
  if (match.ethDst  !== undefined)  parts.push(`eth_dst=${match.ethDst}`)
  return <span>{parts.length ? parts.join(', ') : <span className="text-slate-500 italic">any</span>}</span>
}

const ActionSummary = ({ actions }: { actions: FlowRule['actions'] }) => {
  const parts = actions.map((a) => {
    switch (a.type) {
      case 'OUTPUT':      return `OUTPUT:${a.port}`
      case 'DROP':        return 'DROP'
      case 'SET_VLAN_ID': return `SET_VLAN:${a.vlanId}`
      case 'SET_ETH_SRC': return `ETH_SRC:${a.macAddress}`
      case 'SET_ETH_DST': return `ETH_DST:${a.macAddress}`
      default:            return a.type
    }
  })
  return <span>{parts.join(', ') || <span className="text-slate-500 italic">drop</span>}</span>
}

interface FlowTableProps {
  filterDeviceId?: string
  onAddFlow?: () => void
}

export const FlowTable = ({ filterDeviceId, onAddFlow }: FlowTableProps) => {
  const flows = useFlowStore((s) => s.flows)
  const selectedFlowId = useFlowStore((s) => s.selectedFlowId)
  const setSelectedFlow = useFlowStore((s) => s.setSelectedFlow)
  const removeFlow = useFlowStore((s) => s.removeFlow)
  const devices = useNetworkStore((s) => s.devices)

  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterText, setFilterText] = useState('')
  const [filterState, setFilterState] = useState<string>('ALL')

  const deviceLabel = (id: string) =>
    devices.find((d) => d.id === id)?.label ?? id.slice(0, 8)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc') }
    else { setSortKey(key); setSortDir('desc') }
  }

  const handleDelete = async (flow: FlowRule, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteFlow(flow.deviceId, flow.id)
      removeFlow(flow.id)
    } catch {
      removeFlow(flow.id) // optimistic remove in demo mode
    }
  }

  const filtered = useMemo(() => {
    let result = filterDeviceId
      ? flows.filter((f) => f.deviceId === filterDeviceId)
      : flows

    if (filterState !== 'ALL') result = result.filter((f) => f.state === filterState)

    if (filterText) {
      const q = filterText.toLowerCase()
      result = result.filter(
        (f) =>
          f.id.toLowerCase().includes(q) ||
          f.deviceId.toLowerCase().includes(q) ||
          (f.appId?.toLowerCase().includes(q) ?? false) ||
          JSON.stringify(f.match).toLowerCase().includes(q),
      )
    }

    return [...result].sort((a, b) => {
      let av: number | string = a[sortKey] as number | string
      let bv: number | string = b[sortKey] as number | string
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      const dir = sortDir === 'asc' ? 1 : -1
      return av < bv ? -dir : av > bv ? dir : 0
    })
  }, [flows, filterDeviceId, filterState, filterText, sortKey, sortDir])

  const Th = ({ field, label }: { field: SortKey; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon field={field} sortKey={sortKey} sortDir={sortDir} />
      </div>
    </th>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter flows…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sdn-500"
          />
        </div>
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-sdn-500"
        >
          {['ALL', 'ADDED', 'PENDING_ADD', 'PENDING_REMOVE', 'FAILED', 'REMOVED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {onAddFlow && (
          <button
            onClick={onAddFlow}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sdn-600 hover:bg-sdn-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Flow
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">{filtered.length} rule{filtered.length !== 1 ? 's' : ''}</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700/50">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 sticky top-0">
            <tr>
              <Th field="deviceId" label="Device" />
              <Th field="priority" label="Priority" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Match</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              <Th field="state"   label="State" />
              <Th field="bytes"   label="Bytes" />
              <Th field="packets" label="Pkts" />
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((flow) => (
              <tr
                key={flow.id}
                onClick={() => setSelectedFlow(flow.id === selectedFlowId ? null : flow.id)}
                className={clsx(
                  'flow-row',
                  flow.id === selectedFlowId && 'bg-sdn-600/10 border-l-2 border-l-sdn-500',
                )}
              >
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                  {deviceLabel(flow.deviceId)}
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-200 tabular-nums">
                  {flow.priority}
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-slate-400 max-w-xs truncate">
                  <MatchSummary match={flow.match} />
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-slate-400 max-w-xs truncate">
                  <ActionSummary actions={flow.actions} />
                </td>
                <td className="px-3 py-2.5">
                  <span className={clsx('badge', flowStateBadge(flow.state))}>
                    {flow.state.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-400 tabular-nums text-xs">
                  {formatBytes(flow.bytes)}
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-400 tabular-nums text-xs">
                  {formatPackets(flow.packets)}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={(e) => handleDelete(flow, e)}
                    className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete flow"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500 text-sm">
                  No flow rules match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
