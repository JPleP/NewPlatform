import { useState } from 'react'
import { Radio, Trash2, Plus } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNetworkStore } from '@/stores/networkStore'
import { formatLatency } from '@/utils/format'

export const RttAgentsWidget = () => {
  const rpiAgents = useSettingsStore((s) => s.agents)
  const setAgents = useSettingsStore((s) => s.setAgents)
  const removeAgent = useSettingsStore((s) => s.removeAgent)
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)

  const hosts = devices.filter((d) => d.type === 'host')

  const [newAgentHostId, setNewAgentHostId] = useState('')
  const [newTargetHostId, setNewTargetHostId] = useState('')

  const handleAdd = () => {
    const agentIp = hosts.find((h) => h.id === newAgentHostId)?.ipAddress
    if (!newAgentHostId || !agentIp || !newTargetHostId) return
    setAgents(newAgentHostId, { agentIp, targetHostId: newTargetHostId })
    setNewAgentHostId('')
    setNewTargetHostId('')
  }

  const rttFor = (hostId: string): number | null => {
    const link = links.find((l) => l.sourceDeviceId === hostId || l.targetDeviceId === hostId)
    return link ? link.latencyMs : null
  }

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-sdn-400" />
        <span className="text-sm font-semibold text-slate-200">RTT Agents</span>
        <span className="text-xs text-slate-500 ml-auto">{Object.keys(rpiAgents).length} active</span>
      </div>

      {Object.keys(rpiAgents).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(rpiAgents).map(([hostId, cfg]) => {
            const hostLabel = hosts.find((h) => h.id === hostId)?.label ?? hostId
            const targetLabel = hosts.find((h) => h.id === cfg.targetHostId)?.label ?? cfg.targetHostId
            const rtt = rttFor(hostId)
            return (
              <div key={hostId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 text-xs">
                <span className="text-slate-200 truncate">{hostLabel} → {targetLabel}</span>
                <span className={clsxRtt(rtt)}>
                  {rtt !== null ? formatLatency(rtt) : '—'}
                </span>
                <button
                  onClick={() => removeAgent(hostId)}
                  className="ml-auto p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-1.5 pt-1 border-t border-slate-700/40">
        <select
          value={newAgentHostId}
          onChange={(e) => setNewAgentHostId(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-sdn-500"
        >
          <option value="">Agent host…</option>
          {hosts.map((h) => <option key={h.id} value={h.id}>{h.label} ({h.ipAddress})</option>)}
        </select>
        <select
          value={newTargetHostId}
          onChange={(e) => setNewTargetHostId(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-sdn-500"
        >
          <option value="">Target host…</option>
          {hosts.filter((h) => h.id !== newAgentHostId).map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
        </select>
        <button
          onClick={handleAdd}
          disabled={!newAgentHostId || !newTargetHostId}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sdn-600 hover:bg-sdn-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Agent
        </button>
      </div>
    </div>
  )
}

const clsxRtt = (rtt: number | null) => {
  if (rtt === null) return 'font-mono text-slate-600'
  if (rtt < 5) return 'font-mono text-green-400'
  if (rtt < 20) return 'font-mono text-amber-400'
  return 'font-mono text-red-400'
}