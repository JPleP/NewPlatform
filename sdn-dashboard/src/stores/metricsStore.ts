import { create } from 'zustand'
import type { LinkMetrics, DeviceMetrics, MetricPoint } from '@/types'

const MAX_POINTS = 120  // 2 minutes of per-second data

/** Append a new point and trim to window size */
const appendPoint = (series: MetricPoint[], point: MetricPoint): MetricPoint[] => {
  const updated = [...series, point]
  return updated.length > MAX_POINTS ? updated.slice(updated.length - MAX_POINTS) : updated
}

interface MetricsState {
  linkMetrics: Record<string, LinkMetrics>
  deviceMetrics: Record<string, DeviceMetrics>
  windowSec: number

  // Actions
  updateLinkMetrics: (
    linkId: string,
    data: {
      bandwidth?: number
      latency?: number
      packetLoss?: number
      rxBytes?: number
      txBytes?: number
    },
    timestamp?: number,
  ) => void
  updateDeviceMetrics: (
    deviceId: string,
    data: { cpuPct?: number; memoryPct?: number },
    timestamp?: number,
  ) => void
  setWindowSec: (sec: number) => void
  clearMetrics: () => void
  getLinkMetrics: (linkId: string) => LinkMetrics | undefined
  getDeviceMetrics: (deviceId: string) => DeviceMetrics | undefined
}

const emptyLinkMetrics = (linkId: string): LinkMetrics => ({
  linkId,
  bandwidth: [],
  latency: [],
  packetLoss: [],
  rxBytes: [],
  txBytes: [],
})

const emptyDeviceMetrics = (deviceId: string): DeviceMetrics => ({
  deviceId,
  cpuPct: [],
  memoryPct: [],
  portStats: [],
})

export const useMetricsStore = create<MetricsState>()((set, get) => ({
  linkMetrics: {},
  deviceMetrics: {},
  windowSec: 60,

  updateLinkMetrics: (linkId, data, timestamp) => {
    const ts = timestamp ?? Date.now()
    set((state) => {
      const existing = state.linkMetrics[linkId] ?? emptyLinkMetrics(linkId)
      const updated: LinkMetrics = {
        ...existing,
        ...(data.bandwidth !== undefined && {
          bandwidth: appendPoint(existing.bandwidth, { timestamp: ts, value: data.bandwidth }),
        }),
        ...(data.latency !== undefined && {
          latency: appendPoint(existing.latency, { timestamp: ts, value: data.latency }),
        }),
        ...(data.packetLoss !== undefined && {
          packetLoss: appendPoint(existing.packetLoss, { timestamp: ts, value: data.packetLoss }),
        }),
        ...(data.rxBytes !== undefined && {
          rxBytes: appendPoint(existing.rxBytes, { timestamp: ts, value: data.rxBytes }),
        }),
        ...(data.txBytes !== undefined && {
          txBytes: appendPoint(existing.txBytes, { timestamp: ts, value: data.txBytes }),
        }),
      }
      return { linkMetrics: { ...state.linkMetrics, [linkId]: updated } }
    })
  },

  updateDeviceMetrics: (deviceId, data, timestamp) => {
    const ts = timestamp ?? Date.now()
    set((state) => {
      const existing = state.deviceMetrics[deviceId] ?? emptyDeviceMetrics(deviceId)
      const updated: DeviceMetrics = {
        ...existing,
        ...(data.cpuPct !== undefined && {
          cpuPct: appendPoint(existing.cpuPct, { timestamp: ts, value: data.cpuPct }),
        }),
        ...(data.memoryPct !== undefined && {
          memoryPct: appendPoint(existing.memoryPct, { timestamp: ts, value: data.memoryPct }),
        }),
      }
      return { deviceMetrics: { ...state.deviceMetrics, [deviceId]: updated } }
    })
  },

  setWindowSec: (sec) => set({ windowSec: sec }),

  clearMetrics: () => set({ linkMetrics: {}, deviceMetrics: {} }),

  getLinkMetrics: (linkId) => get().linkMetrics[linkId],
  getDeviceMetrics: (deviceId) => get().deviceMetrics[deviceId],
}))
