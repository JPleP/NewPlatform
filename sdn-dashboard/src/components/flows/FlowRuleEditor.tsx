/**
 * FlowRuleEditor
 *
 * Modal form to create or edit an OpenFlow flow rule.
 * Supports:
 *   - Match fields: inPort, ethSrc/Dst, ethType, ipSrc/Dst, tcpSrc/Dst, vlanId
 *   - Actions: OUTPUT port, DROP, SET_VLAN_ID, SET_ETH_SRC/DST
 *   - Priority, timeout, permanent flag
 *
 * On submit calls onosApi.addFlow() and updates the flow store.
 */

import { useState, type FormEvent } from 'react'
import { Plus, Trash2, Save, X } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import { addFlow } from '@/services/onosApi'
import type { FlowMatch, FlowAction, FlowRule } from '@/types'
import { clsx } from 'clsx'

// ── Form input primitives ─────────────────────────────────────────────────────

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-xs font-medium text-slate-400 mb-1 block">{children}</label>
)

const Input = ({
  value, onChange, placeholder, className, type = 'text',
}: {
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  type?: string
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={clsx(
      'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100',
      'placeholder:text-slate-600 focus:outline-none focus:border-sdn-500 focus:ring-1 focus:ring-sdn-500/50',
      'font-mono',
      className,
    )}
  />
)

const Select = ({
  value, onChange, options, className,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  className?: string
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={clsx(
      'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100',
      'focus:outline-none focus:border-sdn-500',
      className,
    )}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
)

// ── Action row ────────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  { value: 'OUTPUT',      label: 'OUTPUT (forward to port)' },
  { value: 'DROP',        label: 'DROP' },
  { value: 'SET_VLAN_ID', label: 'SET_VLAN_ID' },
  { value: 'SET_ETH_SRC', label: 'SET_ETH_SRC' },
  { value: 'SET_ETH_DST', label: 'SET_ETH_DST' },
]

const ActionRow = ({
  action,
  onChange,
  onRemove,
}: {
  action: FlowAction
  onChange: (a: FlowAction) => void
  onRemove: () => void
}) => (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700/40">
    <div className="flex-1 grid grid-cols-2 gap-2">
      <div>
        <Label>Type</Label>
        <Select
          value={action.type}
          onChange={(v) => onChange({ type: v as FlowAction['type'] })}
          options={ACTION_TYPES}
        />
      </div>

      {action.type === 'OUTPUT' && (
        <div>
          <Label>Port</Label>
          <Input
            type="number"
            value={action.port ?? ''}
            onChange={(v) => onChange({ ...action, port: parseInt(v) || 0 })}
            placeholder="e.g. 1"
          />
        </div>
      )}

      {action.type === 'SET_VLAN_ID' && (
        <div>
          <Label>VLAN ID</Label>
          <Input
            type="number"
            value={action.vlanId ?? ''}
            onChange={(v) => onChange({ ...action, vlanId: parseInt(v) || 0 })}
            placeholder="1–4094"
          />
        </div>
      )}

      {(action.type === 'SET_ETH_SRC' || action.type === 'SET_ETH_DST') && (
        <div>
          <Label>MAC Address</Label>
          <Input
            value={action.macAddress ?? ''}
            onChange={(v) => onChange({ ...action, macAddress: v })}
            placeholder="aa:bb:cc:dd:ee:ff"
          />
        </div>
      )}
    </div>

    <button
      type="button"
      onClick={onRemove}
      className="p-1.5 mt-5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
)

// ── Main editor ───────────────────────────────────────────────────────────────

interface FlowRuleEditorProps {
  initialFlow?: Partial<FlowRule>
  onClose: () => void
  onSaved?: (flow: FlowRule) => void
}

export const FlowRuleEditor = ({ initialFlow, onClose, onSaved }: FlowRuleEditorProps) => {
  const devices = useNetworkStore((s) => s.devices.filter((d) => d.type === 'switch'))
  const addFlowToStore = useFlowStore((s) => s.addFlow)

  const [deviceId, setDeviceId] = useState(initialFlow?.deviceId ?? (devices[0]?.id ?? ''))
  const [priority, setPriority] = useState(String(initialFlow?.priority ?? 40000))
  const [timeout, setTimeout] = useState(String(initialFlow?.timeout ?? 0))
  const [isPermanent, setIsPermanent] = useState(initialFlow?.isPermanent ?? true)

  const [match, setMatch] = useState<FlowMatch>(initialFlow?.match ?? {})
  const [actions, setActions] = useState<FlowAction[]>(initialFlow?.actions ?? [{ type: 'OUTPUT', port: 1 }])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateMatch = (partial: Partial<FlowMatch>) =>
    setMatch((m) => ({ ...m, ...partial }))

  const updateAction = (idx: number, action: FlowAction) =>
    setActions((prev) => prev.map((a, i) => (i === idx ? action : a)))

  const removeAction = (idx: number) =>
    setActions((prev) => prev.filter((_, i) => i !== idx))

  const addAction = () =>
    setActions((prev) => [...prev, { type: 'OUTPUT', port: 1 }])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!deviceId) { setError('Select a device'); return }
    if (!actions.length) { setError('Add at least one action'); return }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await addFlow(
        deviceId,
        parseInt(priority) || 40000,
        match,
        actions,
        isPermanent,
        parseInt(timeout) || 0,
      )
      const newFlow: FlowRule = {
        id: result.flowId,
        deviceId: result.deviceId,
        tableId: 0,
        priority: parseInt(priority),
        timeout: parseInt(timeout),
        hardTimeout: 0,
        isPermanent,
        state: 'PENDING_ADD',
        match,
        actions,
        bytes: 0,
        packets: 0,
        createdAt: new Date().toISOString(),
        appId: 'org.onosproject.rest',
      }
      addFlowToStore(newFlow)
      onSaved?.(newFlow)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install flow rule')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deviceOptions = devices.map((d) => ({ value: d.id, label: `${d.label} (${d.ipAddress})` }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 m-4 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-100">
            {initialFlow?.id ? 'Edit Flow Rule' : 'Add Flow Rule'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Basic fields */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="col-span-2">
            <Label>Device</Label>
            <Select
              value={deviceId}
              onChange={setDeviceId}
              options={deviceOptions.length ? deviceOptions : [{ value: '', label: 'No switches available' }]}
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Input
              type="number"
              value={priority}
              onChange={setPriority}
              placeholder="40000"
            />
          </div>
          <div>
            <Label>Idle Timeout (s, 0 = permanent)</Label>
            <Input
              type="number"
              value={timeout}
              onChange={setTimeout}
              placeholder="0"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isPermanent"
              checked={isPermanent}
              onChange={(e) => setIsPermanent(e.target.checked)}
              className="rounded accent-sdn-500"
            />
            <label htmlFor="isPermanent" className="text-sm text-slate-300 cursor-pointer">
              Permanent (overrides timeout)
            </label>
          </div>
        </div>

        {/* Match fields */}
        <div className="mb-5">
          <p className="text-sm font-semibold text-slate-300 mb-3">Match Fields</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>In Port</Label>
              <Input
                type="number"
                value={match.inPort ?? ''}
                onChange={(v) => updateMatch({ inPort: v ? parseInt(v) : undefined })}
                placeholder="any"
              />
            </div>
            <div>
              <Label>Eth Type</Label>
              <Input
                value={match.ethType ?? ''}
                onChange={(v) => updateMatch({ ethType: v || undefined })}
                placeholder="0x0800 (IPv4)"
              />
            </div>
            <div>
              <Label>Eth Src</Label>
              <Input
                value={match.ethSrc ?? ''}
                onChange={(v) => updateMatch({ ethSrc: v || undefined })}
                placeholder="aa:bb:cc:dd:ee:ff"
              />
            </div>
            <div>
              <Label>Eth Dst</Label>
              <Input
                value={match.ethDst ?? ''}
                onChange={(v) => updateMatch({ ethDst: v || undefined })}
                placeholder="aa:bb:cc:dd:ee:ff"
              />
            </div>
            <div>
              <Label>IP Src (CIDR)</Label>
              <Input
                value={match.ipSrc ?? ''}
                onChange={(v) => updateMatch({ ipSrc: v || undefined })}
                placeholder="10.0.0.1/32"
              />
            </div>
            <div>
              <Label>IP Dst (CIDR)</Label>
              <Input
                value={match.ipDst ?? ''}
                onChange={(v) => updateMatch({ ipDst: v || undefined })}
                placeholder="10.0.0.2/32"
              />
            </div>
            <div>
              <Label>TCP Src Port</Label>
              <Input
                type="number"
                value={match.tcpSrc ?? ''}
                onChange={(v) => updateMatch({ tcpSrc: v ? parseInt(v) : undefined })}
                placeholder="any"
              />
            </div>
            <div>
              <Label>TCP Dst Port</Label>
              <Input
                type="number"
                value={match.tcpDst ?? ''}
                onChange={(v) => updateMatch({ tcpDst: v ? parseInt(v) : undefined })}
                placeholder="any"
              />
            </div>
            <div>
              <Label>VLAN ID</Label>
              <Input
                type="number"
                value={match.vlanId ?? ''}
                onChange={(v) => updateMatch({ vlanId: v ? parseInt(v) : undefined })}
                placeholder="any"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-300">Actions</p>
            <button
              type="button"
              onClick={addAction}
              className="flex items-center gap-1 text-xs text-sdn-400 hover:text-sdn-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add action
            </button>
          </div>
          <div className="space-y-2">
            {actions.map((action, idx) => (
              <ActionRow
                key={idx}
                action={action}
                onChange={(a) => updateAction(idx, a)}
                onRemove={() => removeAction(idx)}
              />
            ))}
            {actions.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-3">
                No actions — flow will drop all matching packets
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-700/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-sdn-600 text-white hover:bg-sdn-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Installing…' : 'Install Flow'}
          </button>
        </div>
      </form>
    </div>
  )
}
