/**
 * useOnosPolling
 *
 * Polls the real ONOS REST API at configurable intervals and pushes
 * results into Zustand stores (networkStore, flowStore, metricsStore).
 *
 * Call once at the app root (App.tsx) when DEMO_MODE = false.
 */

import { useEffect, useRef, useCallback } from 'react'
import { fetchTopology, fetchPortStats } from '@/services/onosApi'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import { useMetricsStore } from '@/stores/metricsStore'

// Default polling intervals (ms)
const TOPOLOGY_MS = Number(import.meta.env.VITE_TOPOLOGY_POLL_MS ?? 5_000)
const METRICS_MS  = Number(import.meta.env.VITE_METRICS_POLL_MS ?? 2_000)

export const useOnosPolling = () => {
  const setTopology = useNetworkStore((s) => s.setTopology)
  const addAlert = useNetworkStore((s) => s.addAlert)
  const setWsState = useNetworkStore((s) => s.setWsConnectionState)

  const setFlows = useFlowStore((s) => s.setFlows)
  const updateLinkMetrics = useMetricsStore((s) => s.updateLinkMetrics)

  const prevDeviceIds = useRef<Set<string>>(new Set())

  const topoTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const metricsTimer = useRef<ReturnType<typeof setInterval> | null>(null)


  // ── Topology + flows poll ────────────────────────────────────────────────
  const pollTopology = useCallback(async () => {
    try {
      const { topology, flows } = await fetchTopology()

      setTopology(topology)
      setFlows(flows)
      setWsState('connected')

      const currentIds = new Set(topology.devices.map((d) => d.id))
      const previousIds = prevDeviceIds.current

      currentIds.forEach((id) => {
        if (!previousIds.has(id)) {
          const dev = topology.devices.find((d) => d.id === id)

          if (dev && dev.type !== 'controller') {
            addAlert({
              severity: 'info',
              title: 'New device discovered',
              message: `${dev.label} (${dev.ipAddress}) joined the network`,
              deviceId: id,
            })
          }
        }
      })

      previousIds.forEach((id) => {
        if (!currentIds.has(id)) {
          addAlert({
            severity: 'warning',
            title: 'Device lost',
            message: `Device ${id} is no longer reachable`,
            deviceId: id,
          })
        }
      })

      prevDeviceIds.current = currentIds

    } catch (err) {
      setWsState('error')
      console.warn('[OnosPolling] topology fetch failed:', err)
    }
  }, [
    setTopology,
    setFlows,
    setWsState,
    addAlert
  ])


  // ── Port statistics poll ────────────────────────────────────────────────
  const pollMetrics = useCallback(async () => {
    const devices = useNetworkStore.getState().devices

    const switchIds = devices
      .filter((d) => d.type === 'switch' && d.onosId)
      .map((d) => d.onosId!)

    if (switchIds.length === 0) {
      return
    }

    try {
      const stats = await fetchPortStats(switchIds)
      const ts = Date.now()

      const byDevice = new Map<string, typeof stats>()

      stats.forEach((s) => {
        if (!byDevice.has(s.deviceId)) {
          byDevice.set(s.deviceId, [])
        }

        byDevice.get(s.deviceId)!.push(s)
      })


      const links = useNetworkStore.getState().links

      links.forEach((link) => {
        if (!link.isUp) return

        const srcStats = byDevice
          .get(link.sourceDeviceId)
          ?.find((s) => s.port === link.sourcePort)


        if (srcStats) {
          const throughput =
            (srcStats.txBytes * 8) /
            1e6 /
            (srcStats.durationSec || 1)

          updateLinkMetrics(
            link.id,
            {
              bandwidth: throughput,
              latency: link.latencyMs,
              packetLoss: link.packetLossPct,
              rxBytes: srcStats.rxBytes,
              txBytes: srcStats.txBytes,
            },
            ts
          )
        }
      })

    } catch (err) {
      console.warn('[OnosPolling] metrics fetch failed:', err)
    }

  }, [updateLinkMetrics])


  // ── Start / stop polling ────────────────────────────────────────────────
  useEffect(() => {

    console.log('[OnosPolling] started')

    // Immediate fetch
    pollTopology()
    pollMetrics()

    topoTimer.current = setInterval(
      pollTopology,
      TOPOLOGY_MS
    )

    metricsTimer.current = setInterval(
      pollMetrics,
      METRICS_MS
    )


    return () => {
      console.log('[OnosPolling] stopped')

      if (topoTimer.current) {
        clearInterval(topoTimer.current)
        topoTimer.current = null
      }

      if (metricsTimer.current) {
        clearInterval(metricsTimer.current)
        metricsTimer.current = null
      }
    }

  }, [
    pollTopology,
    pollMetrics
  ])
}