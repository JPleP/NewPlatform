import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ServiceFunctionChain, SFCHopMetrics } from '@/types'
import { SLICE_COLOR_HEX } from '@/stores/sliceStore'
import { useNetworkStore } from '@/stores/networkStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

const noise = (base: number, rangePct: number) =>
  Math.max(0, base + (Math.random() - 0.5) * 2 * base * rangePct)




export const subscribeToSFCLinkHealth = () => {
  return useNetworkStore.subscribe(
    (state) => state.links,
    (links) => {
      
      const { chains, updateChainState } = useSFCStore.getState()
      console.log("test")
      chains.forEach((chain) => {
        if (chain.state !== 'active') {
          return
        }
        console.log(chain)
        const failedLink = chain.linkPath.find((linkId) => {
          const link = links.find((l) => l.id === linkId)

          return !link || !link.isUp
        })
        console.log(failedLink)

        if (failedLink) {
          updateChainState(
            chain.id,
            'degraded'
          )

          useNetworkStore.getState().addAlert({
            severity: 'critical',
            title: 'SFC Chain Degraded',
            message: `"${chain.name}" — link ${failedLink.id} is down`,
          })
        }
      })
    }
  )
}


// ── Store ─────────────────────────────────────────────────────────────────────

interface SFCState {
  chains: ServiceFunctionChain[]
  selectedChainId: string | null

  setSelectedChain: (id: string | null) => void
  addChain: (chain: Omit<ServiceFunctionChain, 'id' | 'createdAt'>) => string
  removeChain: (id: string) => void
  updateChainState: (
    id: string,
    state: ServiceFunctionChain['state']
  ) => void

  updateChain: (
    id: string,
    updates: Partial<ServiceFunctionChain>
  ) => void

  tickHopMetrics: () => void
}


let chainCounter = 0


export const useSFCStore = create<SFCState>()(
  persist(
    (set, get) => ({
      chains: [],
      selectedChainId: null,

      setSelectedChain: (id) =>
        set({
          selectedChainId: id,
        }),

      addChain: (data) => {
        const id = `sfc-${Date.now()}-${++chainCounter}`

        set((s) => ({
          chains: [
            ...s.chains,
            {
              ...data,
              id,
              createdAt: new Date().toISOString(),
            },
          ],
        }))

        return id
      },

      removeChain: (id) =>
        set((s) => ({
          chains: s.chains.filter(
            (c) => c.id !== id
          ),

          selectedChainId:
            s.selectedChainId === id
              ? null
              : s.selectedChainId,
        })),

      updateChainState: (id, state) =>
        set((s) => ({
          chains: s.chains.map((c) =>
            c.id === id
              ? {
                  ...c,
                  state,
                }
              : c
          ),
        })),

      updateChain: (id, updates) =>
        set((s) => ({
          chains: s.chains.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...updates,
                }
              : c
          ),
        })),

      tickHopMetrics: () =>
        set((s) => ({
          chains: s.chains.map((chain) => ({
            ...chain,

            hops: chain.hops.map((hop) => {
              const newMetrics: SFCHopMetrics = {
                latencyMs: noise(
                  hop.metrics.latencyMs,
                  0.15
                ),

                throughputMbps: noise(
                  hop.metrics.throughputMbps,
                  0.1
                ),

                packetLossPct: noise(
                  hop.metrics.packetLossPct,
                  0.5
                ),

                packetsProcessed:
                  hop.metrics.packetsProcessed +
                  Math.floor(Math.random() * 120),
              }

              return {
                ...hop,
                metrics: newMetrics,
              }
            }),
          })),
        })),
    }),

    {
      name: 'sfc-store',

      // Optional: keep only actual data in localStorage
      // (functions are recreated when the store initializes)
      partialize: (state) => ({
        chains: state.chains,
        selectedChainId: state.selectedChainId,
      }),
    }
  )
)


// ── Color helpers ─────────────────────────────────────────────────────────────

export { SLICE_COLOR_HEX }


export const SF_META: Record<
  string,
  { icon: string; label: string }
> = {
  'rate-limiter': {
    icon: '⬇',
    label: 'Rate Limiter',
  },

  firewall: {
    icon: '🔥',
    label: 'Firewall',
  },

  nat: {
    icon: '🔄',
    label: 'NAT',
  },

  dpi: {
    icon: '🔍',
    label: 'DPI',
  },

  monitor: {
    icon: '📊',
    label: 'Monitor',
  },

  'priority-queue': {
    icon: '⏫',
    label: 'Priority Queue',
  },

  'load-balancer': {
    icon: '⚖',
    label: 'Load Balancer',
  },

  mirror: {
    icon: '🪞',
    label: 'Mirror',
  },
}