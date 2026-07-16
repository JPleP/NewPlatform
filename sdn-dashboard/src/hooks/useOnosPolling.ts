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
import { LinkMetrics } from '@/types'
import { fetchRtt } from '@/services/agentInteraction'
import { useSettingsStore } from '@/stores/settingsStore'

// Default polling intervals (ms)
const TOPOLOGY_MS = Number(import.meta.env.VITE_TOPOLOGY_POLL_MS ?? 5_000)
const METRICS_MS  = Number(import.meta.env.VITE_METRICS_POLL_MS ?? 2_000)
const RTT_MS      = Number(import.meta.env.VITE_RTT_POLL_MS      ?? 10_000)

export const useOnosPolling = () => {
  const setTopology = useNetworkStore((s) => s.setTopology)
  const addAlert = useNetworkStore((s) => s.addAlert)
  const setWsState = useNetworkStore((s) => s.setWsConnectionState)

  const setFlows = useFlowStore((s) => s.setFlows)
  const updateLinkMetrics = useMetricsStore((s) => s.updateLinkMetrics)
  //To update the links with the latest metrics
  const getLinkMetrics = useMetricsStore((s) => s.getLinkMetrics)

  const prevDeviceIds = useRef<Set<string>>(new Set())

  const topoTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const metricsTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const rttTimer       = useRef<ReturnType<typeof setInterval> | null>(null)


  // Save a reference to the previous quantity of bytes per link
  const prevBytesRef = useRef<Map<string, number>>(new Map())


  // ── Topology + flows poll ────────────────────────────────────────────────
  const pollTopology = useCallback(async () => {
    try {
      const { topology, flows } = await fetchTopology()
      
      // Since we are separate from the metrics fetching, get the current latest metrics.
      const storedMetrics = useMetricsStore.getState().linkMetrics

      // Function to get the latest metric value
      const latest = <K extends keyof LinkMetrics>(
        arr: LinkMetrics[K],
      ): number | undefined =>
        Array.isArray(arr) && arr.length
          ? (arr[arr.length - 1] as { value: number }).value
          : undefined

      // Update all links with the latest stored data
      topology.links = topology.links.map((link) => {
        const metrics = storedMetrics[link.id]

        if (!metrics) {
          return link
        }

        const throughput = latest(metrics.bandwidth)
        const packetLoss = latest(metrics.packetLoss)

        return {
          ...link,
          throughputMbps: throughput ?? link.throughputMbps,
          utilizationPct:
            throughput !== undefined
              ? Math.min(
                  100,
                  (throughput / Math.max(link.capacityMbps, 1)) * 100,
                )
              : link.utilizationPct,
          packetLossPct: packetLoss ?? link.packetLossPct,
        }
      })

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
          // const throughput =
          //   (srcStats.txBytes * 8) /
          //   1e6 /
          //   (srcStats.durationSec || 1)

          // Calculate the current throughput of the link
          const key      = `${link.sourceDeviceId}:${link.sourcePort}`
          const prevBytes = prevBytesRef.current.get(key) ?? srcStats.txBytes
          const deltaBytes = Math.max(0, srcStats.txBytes - prevBytes)  // guard against counter reset
          const tputMbps  = (deltaBytes * 8) / 1e6 / (METRICS_MS / 1000)
          prevBytesRef.current.set(key, srcStats.txBytes)

          //Calculate the total packet loss
          const dropRate = (srcStats.rxDropped + srcStats.txDropped) / Math.max(srcStats.rxPackets + srcStats.txPackets, 1) * 100
          updateLinkMetrics(
            link.id,
            {
              bandwidth: tputMbps,
              latency: link.latencyMs,
              packetLoss: dropRate,
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

  // RTT probe poll: each configured host agent pings its target host,
  // result is written onto that host's access link as latencyMs
  const pollRtt = useCallback(async () => {
    const entries = Object.entries(useSettingsStore.getState().agents)
    if (entries.length === 0) return

    const devices    = useNetworkStore.getState().devices
    const links      = useNetworkStore.getState().links
    const updateLink = useNetworkStore.getState().updateLink

    await Promise.all(entries.map(async ([hostId, { agentIp, targetHostId }]) => {
      const targetIp = devices.find((d) => d.id === targetHostId)?.ipAddress
      if (!targetIp) return

      const rtt = await fetchRtt(agentIp, targetIp)
      if (rtt === null) return

      const link = links.find((l) => l.sourceDeviceId === hostId || l.targetDeviceId === hostId)
      if (link) {
        updateLink({ ...link, latencyMs: rtt })
      }
    }))
  }, [])


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

    rttTimer.current      = setInterval(pollRtt,      RTT_MS)


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

      if (rttTimer.current) {
        clearInterval(rttTimer.current)
        rttTimer.current = null
      }
    }

  }, [
    pollTopology,
    pollMetrics,
    pollRtt
  ])
}