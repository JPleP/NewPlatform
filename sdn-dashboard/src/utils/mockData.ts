/**
 * Mock data generator for development / demo mode.
 * Simulates a realistic ONOS + OVS + Raspberry Pi lab topology.
 *
 * Topology:
 *   - 1 ONOS Controller (192.168.1.1)
 *   - 3 OVS Switches (s1, s2, s3)  – linear chain + mesh link s1↔s3
 *   - 4 Raspberry Pi Hosts (h1–h4) – h1,h2 on s1; h3 on s2; h4 on s3
 */

import type { Device, Link, Topology, FlowRule, Alert } from '@/types'
import { useNetworkStore } from '@/stores/networkStore'
import { useMetricsStore } from '@/stores/metricsStore'
import { useFlowStore } from '@/stores/flowStore'
import { useSFCStore } from '@/stores/sfcStore'

// ── Static topology ───────────────────────────────────────────────────────────

export const MOCK_DEVICES: Device[] = [
  {
    id: 'ctrl-1',
    type: 'controller',
    label: 'ONOS Controller',
    status: 'online',
    ipAddress: '192.168.1.1',
    model: 'ONOS 2.7.0',
    lastSeen: new Date().toISOString(),
    metadata: { version: '2.7.0', javaVersion: '17', karafVersion: '4.4.3' },
  },
  {
    id: 'sw-1',
    type: 'switch',
    label: 'Switch S1',
    status: 'online',
    ipAddress: '192.168.1.11',
    macAddress: '00:00:00:00:00:01',
    onosId: 'of:0000000000000001',
    bridgeName: 'br0',
    portCount: 4,
    ofVersion: 'OF_13',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'sw-2',
    type: 'switch',
    label: 'Switch S2',
    status: 'online',
    ipAddress: '192.168.1.12',
    macAddress: '00:00:00:00:00:02',
    onosId: 'of:0000000000000002',
    bridgeName: 'br0',
    portCount: 4,
    ofVersion: 'OF_13',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'sw-3',
    type: 'switch',
    label: 'Switch S3',
    status: 'warning',
    ipAddress: '192.168.1.13',
    macAddress: '00:00:00:00:00:03',
    onosId: 'of:0000000000000003',
    bridgeName: 'br0',
    portCount: 3,
    ofVersion: 'OF_13',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'h-1',
    type: 'host',
    label: 'Pi H1',
    status: 'online',
    ipAddress: '10.0.0.1',
    macAddress: 'aa:bb:cc:dd:00:01',
    model: 'Raspberry Pi 4B',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'h-2',
    type: 'host',
    label: 'Pi H2',
    status: 'online',
    ipAddress: '10.0.0.2',
    macAddress: 'aa:bb:cc:dd:00:02',
    model: 'Raspberry Pi 4B',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'h-3',
    type: 'host',
    label: 'Pi H3',
    status: 'online',
    ipAddress: '10.0.0.3',
    macAddress: 'aa:bb:cc:dd:00:03',
    model: 'Raspberry Pi 3B+',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'h-4',
    type: 'host',
    label: 'Pi H4',
    status: 'offline',
    ipAddress: '10.0.0.4',
    macAddress: 'aa:bb:cc:dd:00:04',
    model: 'Raspberry Pi 3B+',
    lastSeen: new Date(Date.now() - 120_000).toISOString(),
  },
]

export const MOCK_LINKS: Link[] = [
  // Controller ↔ Switches (control plane)
  { id: 'ctrl-s1', sourceDeviceId: 'ctrl-1', sourcePort: 1, targetDeviceId: 'sw-1', targetPort: 1, utilizationPct: 12, capacityMbps: 1000, throughputMbps: 120, latencyMs: 0.8, packetLossPct: 0, isUp: true },
  { id: 'ctrl-s2', sourceDeviceId: 'ctrl-1', sourcePort: 2, targetDeviceId: 'sw-2', targetPort: 1, utilizationPct: 8,  capacityMbps: 1000, throughputMbps: 80,  latencyMs: 1.1, packetLossPct: 0, isUp: true },
  { id: 'ctrl-s3', sourceDeviceId: 'ctrl-1', sourcePort: 3, targetDeviceId: 'sw-3', targetPort: 1, utilizationPct: 15, capacityMbps: 1000, throughputMbps: 150, latencyMs: 1.5, packetLossPct: 0, isUp: true },
  // Switch mesh (data plane)
  { id: 's1-s2', sourceDeviceId: 'sw-1', sourcePort: 2, targetDeviceId: 'sw-2', targetPort: 2, utilizationPct: 55, capacityMbps: 100, throughputMbps: 55, latencyMs: 2.3, packetLossPct: 0.01, isUp: true },
  { id: 's2-s3', sourceDeviceId: 'sw-2', sourcePort: 3, targetDeviceId: 'sw-3', targetPort: 2, utilizationPct: 78, capacityMbps: 100, throughputMbps: 78, latencyMs: 3.1, packetLossPct: 0.05, isUp: true },
  { id: 's1-s3', sourceDeviceId: 'sw-1', sourcePort: 3, targetDeviceId: 'sw-3', targetPort: 3, utilizationPct: 22, capacityMbps: 100, throughputMbps: 22, latencyMs: 1.9, packetLossPct: 0, isUp: true },
  // Host access links
  { id: 's1-h1', sourceDeviceId: 'sw-1', sourcePort: 4, targetDeviceId: 'h-1', targetPort: 1, utilizationPct: 30, capacityMbps: 100, throughputMbps: 30, latencyMs: 0.5, packetLossPct: 0, isUp: true },
  { id: 's1-h2', sourceDeviceId: 'sw-1', sourcePort: 5, targetDeviceId: 'h-2', targetPort: 1, utilizationPct: 45, capacityMbps: 100, throughputMbps: 45, latencyMs: 0.6, packetLossPct: 0, isUp: true },
  { id: 's2-h3', sourceDeviceId: 'sw-2', sourcePort: 4, targetDeviceId: 'h-3', targetPort: 1, utilizationPct: 18, capacityMbps: 100, throughputMbps: 18, latencyMs: 0.7, packetLossPct: 0, isUp: true },
  { id: 's3-h4', sourceDeviceId: 'sw-3', sourcePort: 4, targetDeviceId: 'h-4', targetPort: 1, utilizationPct: 0,  capacityMbps: 100, throughputMbps: 0,  latencyMs: 0,   packetLossPct: 0, isUp: false },
]

export const MOCK_FLOWS: FlowRule[] = [
  {
    id: 'flow-001', deviceId: 'sw-1', tableId: 0, priority: 40000, timeout: 0, hardTimeout: 0,
    isPermanent: true, state: 'ADDED', bytes: 1_048_576, packets: 8192, createdAt: new Date().toISOString(),
    appId: 'org.onosproject.fwd',
    match: { inPort: 1, ethType: '0x0800', ipDst: '10.0.0.2/32' },
    actions: [{ type: 'OUTPUT', port: 4 }],
  },
  {
    id: 'flow-002', deviceId: 'sw-1', tableId: 0, priority: 40000, timeout: 0, hardTimeout: 0,
    isPermanent: true, state: 'ADDED', bytes: 524_288, packets: 4096, createdAt: new Date().toISOString(),
    appId: 'org.onosproject.fwd',
    match: { inPort: 4, ethType: '0x0800', ipDst: '10.0.0.3/32' },
    actions: [{ type: 'OUTPUT', port: 2 }],
  },
  {
    id: 'flow-003', deviceId: 'sw-2', tableId: 0, priority: 40000, timeout: 0, hardTimeout: 0,
    isPermanent: true, state: 'ADDED', bytes: 2_097_152, packets: 16384, createdAt: new Date().toISOString(),
    appId: 'org.onosproject.fwd',
    match: { inPort: 2, ethType: '0x0800', ipDst: '10.0.0.3/32' },
    actions: [{ type: 'OUTPUT', port: 3 }],
  },
  {
    id: 'flow-004', deviceId: 'sw-3', tableId: 0, priority: 10000, timeout: 300, hardTimeout: 0,
    isPermanent: false, state: 'PENDING_ADD', bytes: 0, packets: 0, createdAt: new Date().toISOString(),
    appId: 'org.onosproject.qos',
    match: { ethType: '0x0800', ipProto: 17, udpDst: 5001 },
    actions: [{ type: 'OUTPUT', port: 1 }],
  },
  {
    id: 'flow-005', deviceId: 'sw-1', tableId: 0, priority: 1, timeout: 0, hardTimeout: 0,
    isPermanent: true, state: 'ADDED', bytes: 10_240, packets: 80, createdAt: new Date().toISOString(),
    appId: 'org.onosproject.fwd',
    match: {},
    actions: [{ type: 'OUTPUT', port: 0xFFFFFFFD }],  // CONTROLLER
  },
]

export const MOCK_ALERTS: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>[] = [
  { severity: 'warning', title: 'High link utilization', message: 'Link s2-s3 utilization at 78% — approaching capacity', linkId: 's2-s3' },
  { severity: 'error', title: 'Host offline', message: 'Pi H4 (10.0.0.4) has not responded for > 2 minutes', deviceId: 'h-4' },
  { severity: 'info', title: 'Flow rule installed', message: 'QoS flow rule installed on Switch S3 by org.onosproject.qos', deviceId: 'sw-3' },
  { severity: 'warning', title: 'Switch S3 CPU elevated', message: 'Switch S3 CPU at 72% — check for packet-in storm', deviceId: 'sw-3' },
  { severity: 'info', title: 'Topology loaded', message: 'Network topology refreshed: 4 switches, 4 hosts, 10 links discovered' },
]

// ── Runtime simulation ────────────────────────────────────────────────────────

let simInterval: ReturnType<typeof setInterval> | null = null

const noise = (base: number, range: number) =>
  Math.max(0, base + (Math.random() - 0.5) * 2 * range)

// New device that "joins" the network 15 seconds after simulation starts
const NEW_DEVICE: Device = {
  id: 'h-5',
  type: 'host',
  label: 'Pi H5',
  status: 'online',
  ipAddress: '10.0.0.5',
  macAddress: 'aa:bb:cc:dd:00:05',
  model: 'Raspberry Pi 5',
  lastSeen: new Date().toISOString(),
}
const NEW_LINK: Link = {
  id: 's2-h5',
  sourceDeviceId: 'sw-2',
  sourcePort: 5,
  targetDeviceId: 'h-5',
  targetPort: 1,
  utilizationPct: 0,
  capacityMbps: 100,
  throughputMbps: 0,
  latencyMs: 0.4,
  packetLossPct: 0,
  isUp: true,
}

export const startMockSimulation = (): void => {
  if (simInterval) return

  // Seed static data
  const { setTopology, addAlert } = useNetworkStore.getState()
  setTopology({ devices: MOCK_DEVICES, links: MOCK_LINKS, lastUpdated: new Date().toISOString() })
  useFlowStore.getState().setFlows(MOCK_FLOWS)
  MOCK_ALERTS.forEach((a) => addAlert(a))

  // Simulate a new device joining after 15 s
  setTimeout(() => {
    const { addDevice, addLink, addAlert: alert } = useNetworkStore.getState()
    addDevice({ ...NEW_DEVICE, lastSeen: new Date().toISOString() })
    addLink(NEW_LINK)
    alert({ severity: 'info', title: 'New host discovered', message: 'Pi H5 (10.0.0.5) connected to Switch S2 port 5', deviceId: 'h-5' })
  }, 15_000)

  // Simulate metrics
  simInterval = setInterval(() => {
    // SFC hop metrics tick
    useSFCStore.getState().tickHopMetrics()

    const ms = useMetricsStore.getState()
    const ts = Date.now()
    const currentLinks = useNetworkStore.getState().links
    currentLinks.forEach((l) => {
      if (!l.isUp) return
      // find the base link for noise parameters
      const base = [...MOCK_LINKS, NEW_LINK].find((b) => b.id === l.id) ?? l
      ms.updateLinkMetrics(l.id, {
        bandwidth:  noise(base.throughputMbps, base.throughputMbps * 0.15),
        latency:    noise(base.latencyMs, base.latencyMs * 0.2),
        packetLoss: noise(base.packetLossPct, 0.02),
        rxBytes:    noise(base.throughputMbps * 1e6 / 8, 1e4),
        txBytes:    noise(base.throughputMbps * 1e6 / 8, 1e4),
      }, ts)
    })

    // Occasionally fluctuate link utilization
    if (Math.random() < 0.1) {
      const { links, updateLink } = useNetworkStore.getState()
      const upLinks = links.filter((l) => l.isUp)
      if (upLinks.length) {
        const l = upLinks[Math.floor(Math.random() * upLinks.length)]
        updateLink({ ...l, utilizationPct: Math.min(100, Math.max(0, noise(l.utilizationPct, 10))) })
      }
    }
  }, 1_000)
}

export const stopMockSimulation = (): void => {
  if (simInterval) { clearInterval(simInterval); simInterval = null }
}
