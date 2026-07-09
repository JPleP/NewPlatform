import { useState } from 'react'
import { Plus, X, Settings2 } from 'lucide-react'
import { useSliceStore, SLICE_COLOR_HEX } from '@/stores/sliceStore'
import { useFlowStore } from '@/stores/flowStore'
import type { SliceColor, Slice } from '@/types'
import { clsx } from 'clsx'

const COLORS: SliceColor[] = ['blue', 'purple', 'amber', 'green', 'red', 'pink', 'cyan']

const colorClasses: Record<SliceColor, { bg: string; border: string; text: string; ring: string }> = {
  blue:   { bg: 'bg-blue-500/15',   border: 'border-blue-500/40',   text: 'text-blue-300',   ring: 'ring-blue-500' },
  purple: { bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-300', ring: 'ring-purple-500' },
  amber:  { bg: 'bg-amber-500/15',  border: 'border-amber-500/40',  text: 'text-amber-300',  ring: 'ring-amber-500' },
  green:  { bg: 'bg-green-500/15',  border: 'border-green-500/40',  text: 'text-green-300',  ring: 'ring-green-500' },
  red:    { bg: 'bg-red-500/15',    border: 'border-red-500/40',    text: 'text-red-300',    ring: 'ring-red-500' },
  pink:   { bg: 'bg-pink-500/15',   border: 'border-pink-500/40',   text: 'text-pink-300',   ring: 'ring-pink-500' },
  cyan:   { bg: 'bg-cyan-500/15',   border: 'border-cyan-500/40',   text: 'text-cyan-300',   ring: 'ring-cyan-500' },
}
export { colorClasses }

// ── Slice edit modal ──────────────────────────────────────────────────────────
const SliceEditModal = ({ slice, onClose }: { slice?: Slice; onClose: () => void }) => {
  const { addSlice, updateSlice, getNextColor } = useSliceStore()
  const [name, setName] = useState(slice?.name ?? '')
  const [color, setColor] = useState<SliceColor>(slice?.color ?? getNextColor())
  const [bw, setBw] = useState(String(slice?.maxBandwidthMbps ?? 0))
  const [pri, setPri] = useState(String(slice?.priority ?? 40000))
  const [desc, setDesc] = useState(slice?.description ?? '')

  const save = () => {
    if (!name.trim()) return
    if (slice) {
      updateSlice({ ...slice, name: name.trim(), color, maxBandwidthMbps: Number(bw), priority: Number(pri), description: desc })
    } else {
      addSlice({ name: name.trim(), color, maxBandwidthMbps: Number(bw), priority: Number(pri), description: desc })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-5 w-80 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 text-sm">{slice ? 'Edit Slice' : 'New Slice'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700/50"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-sdn-500"
              placeholder="Slice name…"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={clsx(
                    'w-6 h-6 rounded-full border-2 transition-all',
                    color === c ? 'border-white scale-125' : 'border-transparent',
                  )}
                  style={{ background: SLICE_COLOR_HEX[c] }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Max BW (Mbps)</label>
              <input
                value={bw}
                onChange={e => setBw(e.target.value)}
                type="number"
                min="0"
                className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-sdn-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Priority</label>
              <input
                value={pri}
                onChange={e => setPri(e.target.value)}
                type="number"
                min="0"
                max="65535"
                className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-sdn-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Description</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-sdn-500"
              placeholder="Optional…"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm rounded bg-sdn-600 hover:bg-sdn-500 text-white disabled:opacity-40 transition-colors"
          >
            {slice ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main SliceBar ─────────────────────────────────────────────────────────────
export const SliceBar = ({
  selectedSliceId,
  onSelectSlice,
}: {
  selectedSliceId: string | null
  onSelectSlice: (id: string | null) => void
}) => {
  const { slices, removeSlice } = useSliceStore()
  const { flows } = useFlowStore()
  // undefined = modal closed, null = new slice modal, Slice = edit existing
  const [editSlice, setEditSlice] = useState<Slice | null | undefined>(undefined)

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/40 bg-slate-900/50 overflow-x-auto flex-shrink-0">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap mr-1">
          Slices
        </span>
        {slices.map(slice => {
          const cc = colorClasses[slice.color]
          const flowCount = slice.flowIds.filter(id => flows.some(f => f.id === id)).length
          const totalBytes = slice.flowIds.reduce(
            (sum, fid) => sum + (flows.find(f => f.id === fid)?.bytes ?? 0),
            0,
          )
          const bwUsed = slice.maxBandwidthMbps > 0
            ? Math.min(100, (totalBytes / 1e6 / slice.maxBandwidthMbps) * 100)
            : 0
          const isSelected = selectedSliceId === slice.id

          return (
            <div
              key={slice.id}
              onClick={() => onSelectSlice(isSelected ? null : slice.id)}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all select-none flex-shrink-0 group',
                cc.bg, cc.border,
                isSelected && 'ring-2 ring-offset-1 ring-offset-slate-900 ' + cc.ring,
              )}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: SLICE_COLOR_HEX[slice.color] }}
              />
              <span className={clsx('text-xs font-medium', cc.text)}>{slice.name}</span>
              <span className="text-xs text-slate-500">{flowCount}f</span>
              {slice.maxBandwidthMbps > 0 && (
                <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${bwUsed}%`, background: SLICE_COLOR_HEX[slice.color] }}
                  />
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); setEditSlice(slice) }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700/60 transition-all"
              >
                <Settings2 className="w-3 h-3 text-slate-400" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); removeSlice(slice.id) }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
              >
                <X className="w-3 h-3 text-slate-400 hover:text-red-400" />
              </button>
            </div>
          )
        })}
        <button
          onClick={() => setEditSlice(null)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-xs flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New Slice
        </button>
      </div>

      {editSlice !== undefined && (
        <SliceEditModal
          slice={editSlice ?? undefined}
          onClose={() => setEditSlice(undefined)}
        />
      )}
    </>
  )
}
