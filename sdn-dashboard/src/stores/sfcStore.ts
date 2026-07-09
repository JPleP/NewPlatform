import { create } from 'zustand'
import type { ServiceFunctionChain, SFCHopMetrics } from '@/types'
import { SLICE_COLOR_HEX } from '@/stores/sliceStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

const noise = (base: number, rangePct: number) =>
  Math.max(0, base + (Math.random() - 0.5) * 2 * base * rangePct)

// ── Seed chains ───────────────────────────────────────────────────────────────

const SEED_CHAINS: ServiceFunctionChain[] = [
  {
    id: 'sfc-1',
    name: 'Video Streaming QoS',
    description: 'Rate-limit ingress video traffic and apply priority queuing before delivery',
    color: 'blue',
    srcHostId: 'h-1',
    dstHostId: 'h-3',
    state: 'active',
    linkPath: ['s1-h1', 's1-s2', 's2-h3'],
    hops: [
      {
        deviceId: 'sw-1',
        serviceFunction: 'Rate Limiter',
        sfType: 'rate-limiter',
        flowIds: ['sfc1-sw1-f1', 'sfc1-sw1-f2'],
        metrics: { latencyMs: 0.5, throughputMbps: 45, packetLossPct: 0, packetsProcessed: 124000 },
      },
      {
        deviceId: 'sw-2',
        serviceFunction: 'Priority Queue',
        sfType: 'priority-queue',
        flowIds: ['sfc1-sw2-f1'],
        metrics: { latencyMs: 0.8, throughputMbps: 44, packetLossPct: 0, packetsProcessed: 123600 },
      },
    ],
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: 'sfc-2',
    name: 'Firewall + NAT',
    description: 'ACL-based firewall filtering followed by network address translation',
    color: 'amber',
    srcHostId: 'h-2',
    dstHostId: 'h-4',
    state: 'degraded',   // h-4 is offline
    linkPath: ['s1-h2', 's1-s3', 's3-h4'],
    hops: [
      {
        deviceId: 'sw-1',
        serviceFunction: 'ACL Firewall',
        sfType: 'firewall',
        flowIds: ['sfc2-sw1-f1'],
        metrics: { latencyMs: 1.2, throughputMbps: 18, packetLossPct: 0.02, packetsProcessed: 52000 },
      },
      {
        deviceId: 'sw-3',
        serviceFunction: 'NAT Gateway',
        sfType: 'nat',
        flowIds: ['sfc2-sw3-f1'],
        metrics: { latencyMs: 2.1, throughputMbps: 0, packetLossPct: 100, packetsProcessed: 0 },
      },
    ],
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
  {
    id: 'sfc-3',
    name: 'Deep Packet Inspection',
    description: 'Mirror traffic, run DPI analysis, and log to audit trail across three switches',
    color: 'purple',
    srcHostId: 'h-1',
    dstHostId: 'h-3',
    state: 'active',
    linkPath: ['s1-h1', 's1-s2', 's2-s3', 's2-h3'],
    hops: [
      {
        deviceId: 'sw-1',
        serviceFunction: 'Traffic Mirror',
        sfType: 'mirror',
        flowIds: ['sfc3-sw1-f1'],
        metrics: { latencyMs: 0.3, throughputMbps: 30, packetLossPct: 0, packetsProcessed: 88000 },
      },
      {
        deviceId: 'sw-2',
        serviceFunction: 'DPI Engine',
        sfType: 'dpi',
        flowIds: ['sfc3-sw2-f1', 'sfc3-sw2-f2'],
        metrics: { latencyMs: 3.5, throughputMbps: 28, packetLossPct: 0.01, packetsProcessed: 87500 },
      },
      {
        deviceId: 'sw-3',
        serviceFunction: 'Audit Logger',
        sfType: 'monitor',
        flowIds: ['sfc3-sw3-f1'],
        metrics: { latencyMs: 1.0, throughputMbps: 27, packetLossPct: 0, packetsProcessed: 87200 },
      },
    ],
    createdAt: new Date(Date.now() - 1_800_000).toISOString(),
  },
]

// ── Store ─────────────────────────────────────────────────────────────────────

interface SFCState {
  chains: ServiceFunctionChain[]
  selectedChainId: string | null

  setSelectedChain: (id: string | null) => void
  addChain: (chain: Omit<ServiceFunctionChain, 'id' | 'createdAt'>) => string
  removeChain: (id: string) => void
  updateChainState: (id: string, state: ServiceFunctionChain['state']) => void
  /** Called by simulation tick to update per-hop live metrics */
  tickHopMetrics: () => void
}

let chainCounter = 0

export const useSFCStore = create<SFCState>()((set, get) => ({
  chains: SEED_CHAINS,
  selectedChainId: null,

  setSelectedChain: (id) => set({ selectedChainId: id }),

  addChain: (data) => {
    const id = `sfc-${Date.now()}-${++chainCounter}`
    set((s) => ({
      chains: [...s.chains, { ...data, id, createdAt: new Date().toISOString() }],
    }))
    return id
  },

  removeChain: (id) =>
    set((s) => ({
      chains: s.chains.filter((c) => c.id !== id),
      selectedChainId: s.selectedChainId === id ? null : s.selectedChainId,
    })),

  updateChainState: (id, state) =>
    set((s) => ({
      chains: s.chains.map((c) => c.id === id ? { ...c, state } : c),
    })),

  tickHopMetrics: () =>
    set((s) => ({
      chains: s.chains.map((chain) => ({
        ...chain,
        hops: chain.hops.map((hop, i) => {
          const seed = SEED_CHAINS.find((c) => c.id === chain.id)?.hops[i]?.metrics
          if (!seed || chain.state === 'failed') return hop
          // Degraded chains: last hop sees near-zero throughput
          const isDegradedLastHop = chain.state === 'degraded' && i === chain.hops.length - 1
          const newMetrics: SFCHopMetrics = isDegradedLastHop
            ? { latencyMs: 0, throughputMbps: 0, packetLossPct: 100, packetsProcessed: hop.metrics.packetsProcessed }
            : {
                latencyMs:         noise(seed.latencyMs, 0.15),
                throughputMbps:    noise(seed.throughputMbps, 0.1),
                packetLossPct:     noise(seed.packetLossPct, 0.5),
                packetsProcessed:  hop.metrics.packetsProcessed + Math.floor(Math.random() * 120),
              }
          return { ...hop, metrics: newMetrics }
        }),
      })),
    })),
}))

// ── Color helpers (re-exported for consumers) ─────────────────────────────────

export { SLICE_COLOR_HEX }

/** Icon / label per SF type */
export const SF_META: Record<string, { icon: string; label: string }> = {
  'rate-limiter':   { icon: '⬇', label: 'Rate Limiter' },
  'firewall':       { icon: '🔥', label: 'Firewall' },
  'nat':            { icon: '🔄', label: 'NAT' },
  'dpi':            { icon: '🔍', label: 'DPI' },
  'monitor':        { icon: '📊', label: 'Monitor' },
  'priority-queue': { icon: '⏫', label: 'Priority Queue' },
  'load-balancer':  { icon: '⚖', label: 'Load Balancer' },
  'mirror':         { icon: '🪞', label: 'Mirror' },
}
