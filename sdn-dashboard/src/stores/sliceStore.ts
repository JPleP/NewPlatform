import { create } from 'zustand'
import type { Slice, SliceColor } from '@/types'

const SLICE_COLORS: SliceColor[] = ['blue', 'purple', 'amber', 'green', 'red', 'pink', 'cyan']

const colorHex: Record<SliceColor, string> = {
  blue:   '#3b82f6',
  purple: '#a855f7',
  amber:  '#f59e0b',
  green:  '#22c55e',
  red:    '#ef4444',
  pink:   '#ec4899',
  cyan:   '#06b6d4',
}

interface SliceState {
  slices: Slice[]
  selectedSliceId: string | null

  addSlice: (slice: Omit<Slice, 'id' | 'flowIds'>) => string
  updateSlice: (slice: Slice) => void
  removeSlice: (id: string) => void
  assignFlowToSlice: (flowId: string, sliceId: string | null) => void
  setSelectedSlice: (id: string | null) => void
  getSliceForFlow: (flowId: string) => Slice | undefined
  getColorHex: (color: SliceColor) => string
  getNextColor: () => SliceColor
}

let sliceCounter = 0

export const useSliceStore = create<SliceState>()((set, get) => ({
  slices: [
    { id: 'slice-default', name: 'Default', color: 'blue', maxBandwidthMbps: 0, priority: 10000, flowIds: ['flow-001', 'flow-002', 'flow-003', 'flow-005'], description: 'Default forwarding slice' },
    { id: 'slice-qos',     name: 'QoS Priority', color: 'amber', maxBandwidthMbps: 100, priority: 45000, flowIds: ['flow-004'], description: 'High-priority QoS traffic' },
  ],
  selectedSliceId: null,

  addSlice: (data) => {
    const id = `slice-${Date.now()}-${++sliceCounter}`
    set((s) => ({ slices: [...s.slices, { ...data, id, flowIds: [] }] }))
    return id
  },

  updateSlice: (slice) =>
    set((s) => ({ slices: s.slices.map((sl) => sl.id === slice.id ? slice : sl) })),

  removeSlice: (id) =>
    set((s) => ({ slices: s.slices.filter((sl) => sl.id !== id), selectedSliceId: s.selectedSliceId === id ? null : s.selectedSliceId })),

  assignFlowToSlice: (flowId, sliceId) =>
    set((s) => ({
      slices: s.slices.map((sl) => {
        const hasFlow = sl.flowIds.includes(flowId)
        if (sl.id === sliceId && !hasFlow) return { ...sl, flowIds: [...sl.flowIds, flowId] }
        if (sl.id !== sliceId && hasFlow) return { ...sl, flowIds: sl.flowIds.filter((f) => f !== flowId) }
        return sl
      }),
    })),

  setSelectedSlice: (id) => set({ selectedSliceId: id }),

  getSliceForFlow: (flowId) => get().slices.find((sl) => sl.flowIds.includes(flowId)),

  getColorHex: (color) => colorHex[color],

  getNextColor: () => {
    const used = get().slices.map((s) => s.color)
    return SLICE_COLORS.find((c) => !used.includes(c)) ?? SLICE_COLORS[get().slices.length % SLICE_COLORS.length]
  },
}))

export const SLICE_COLOR_HEX = colorHex
