import { create } from 'zustand'
import type { FlowRule, FlowMatch, FlowAction } from '@/types'

interface FlowState {
  flows: FlowRule[]
  isLoading: boolean
  error: string | null
  selectedFlowId: string | null

  // CRUD Actions
  setFlows: (flows: FlowRule[]) => void
  addFlow: (flow: FlowRule) => void
  updateFlow: (flow: FlowRule) => void
  removeFlow: (id: string) => void
  setSelectedFlow: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Selectors
  getFlowsForDevice: (deviceId: string) => FlowRule[]
  getSelectedFlow: () => FlowRule | undefined
}

export const useFlowStore = create<FlowState>()((set, get) => ({
  flows: [],
  isLoading: false,
  error: null,
  selectedFlowId: null,

  setFlows: (flows) => set({ flows }),

  addFlow: (flow) =>
    set((state) => ({ flows: [flow, ...state.flows] })),

  updateFlow: (flow) =>
    set((state) => ({
      flows: state.flows.map((f) => (f.id === flow.id ? flow : f)),
    })),

  removeFlow: (id) =>
    set((state) => ({
      flows: state.flows.filter((f) => f.id !== id),
      selectedFlowId: state.selectedFlowId === id ? null : state.selectedFlowId,
    })),

  setSelectedFlow: (id) => set({ selectedFlowId: id }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  getFlowsForDevice: (deviceId) =>
    get().flows.filter((f) => f.deviceId === deviceId),

  getSelectedFlow: () => {
    const id = get().selectedFlowId
    return id ? get().flows.find((f) => f.id === id) : undefined
  },
}))

// ── Flow builder helper ───────────────────────────────────────────────────────
export const buildFlowRule = (
  deviceId: string,
  priority: number,
  match: FlowMatch,
  actions: FlowAction[],
  opts: Partial<Pick<FlowRule, 'tableId' | 'timeout' | 'hardTimeout' | 'isPermanent' | 'appId'>> = {},
): Omit<FlowRule, 'id' | 'state' | 'bytes' | 'packets' | 'createdAt'> => ({
  deviceId,
  priority,
  match,
  actions,
  tableId: opts.tableId ?? 0,
  timeout: opts.timeout ?? 0,
  hardTimeout: opts.hardTimeout ?? 0,
  isPermanent: opts.isPermanent ?? true,
  appId: opts.appId,
})
