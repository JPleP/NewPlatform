/**
 * ONOS REST API client.
 *
 * ONOS exposes a northbound REST API at http://<host>:8181/onos/v1/
 * This module wraps the endpoints used by the dashboard with typed responses.
 *
 * Auth: HTTP Basic (onos / rocks by default – overridden by settings store)
 */

import axios, { type AxiosInstance } from 'axios'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Device, Link, Topology, FlowRule, FlowMatch, FlowAction } from '@/types'

// ── ONOS API response shapes (raw) ───────────────────────────────────────────

interface OnosDevice {
  id: string
  type: string
  available: boolean
  role: string
  mfr: string
  hw: string
  sw: string
  serial: string
  driver: string
  annotations: Record<string, string>
  chassisId: string
  lastUpdate: string
  humanReadableLastUpdate: string
  ports: OnosPort[]
}

interface OnosPort {
  element: string
  port: string
  isEnabled: boolean
  type: string
  portSpeed: number
  annotations: Record<string, string>
}

interface OnosHost {
  id: string
  mac: string
  vlan: string
  ipAddresses: string[]
  location: { elementId: string; port: string }
  configured: boolean
}

interface OnosLink {
  src: { device: string; port: string }
  dst: { device: string; port: string }
  type: string
  state: string
  annotations: Record<string, string>
}

interface OnosFlow {
  id: string
  state: string
  bytes: number
  packets: number
  duration: number
  priority: number
  timeout: number
  isPermanent: boolean
  deviceId: string
  tableId: number
  appId: string
  selector: { criteria: Array<{ type: string; [k: string]: unknown }> }
  treatment: { instructions: Array<{ type: string; [k: string]: unknown }>; deferred: unknown[] }
}

interface OnosStatEntry {
  id: string
  elements: Array<{
    type: string
    src?: { deviceId: string; port: string }
    dst?: { deviceId: string; port: string }
    bytes: number
    packets: number
    durationSec: number
  }>
}

// ── Client factory ────────────────────────────────────────────────────────────

const createClient = (): AxiosInstance => {
  const { connection } = useSettingsStore.getState()
  const proto = connection.useSSL ? 'https' : 'http'
  //const baseURL = `${proto}://${connection.onosHost}:${connection.onosPort}/onos/v1`
  
  const baseURL = '/onos/v1'
  const token = btoa(`${connection.onosUser}:${connection.onosPassword}`)

  return axios.create({
    baseURL,
    timeout: 8_000,
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
}

// Re-create client on each request to pick up settings changes
const api = (): AxiosInstance => createClient()

// ── Device endpoints ──────────────────────────────────────────────────────────

export const getDevices = async (): Promise<OnosDevice[]> => {
  const { data } = await api().get<{ devices: OnosDevice[] }>('/devices')
  return data.devices
}

export const getDevice = async (deviceId: string): Promise<OnosDevice> => {
  const { data } = await api().get<OnosDevice>(`/devices/${encodeURIComponent(deviceId)}`)
  return data
}

export const getDevicePorts = async (deviceId: string): Promise<OnosPort[]> => {
  const { data } = await api().get<{ ports: OnosPort[] }>(`/devices/${encodeURIComponent(deviceId)}/ports`)
  return data.ports
}

// ── Host endpoints ────────────────────────────────────────────────────────────

export const getHosts = async (): Promise<OnosHost[]> => {
  const { data } = await api().get<{ hosts: OnosHost[] }>('/hosts')
  return data.hosts
}

// ── Link endpoints ────────────────────────────────────────────────────────────

export const getLinks = async (): Promise<OnosLink[]> => {
  const { data } = await api().get<{ links: OnosLink[] }>('/links')
  return data.links
}

// ── Flow rule endpoints ───────────────────────────────────────────────────────

export const getAllFlows = async (): Promise<OnosFlow[]> => {
  const { data } = await api().get<{ flows: OnosFlow[] }>('/flows')
  return data.flows
}

export const getFlowsForDevice = async (deviceId: string): Promise<OnosFlow[]> => {
  const { data } = await api().get<{ flows: OnosFlow[] }>(`/flows/${encodeURIComponent(deviceId)}`)
  return data.flows
}

export const addFlow = async (
  deviceId: string,
  priority: number,
  match: FlowMatch,
  actions: FlowAction[],
  isPermanent = true,
  timeout = 0,
  appId = 'org.onosproject.rest',
): Promise<{ flowId: string; deviceId: string }> => {
  const body = buildOnosFlowBody(deviceId, priority, match, actions, isPermanent, timeout, appId)
  const { data } = await api().post<{ flows: Array<{ flowId: string; deviceId: string }> }>(
    '/flows',
    body,
  )
  return data.flows[0]
}

export const deleteFlow = async (deviceId: string, flowId: string): Promise<void> => {
  await api().delete(`/flows/${encodeURIComponent(deviceId)}/${encodeURIComponent(flowId)}`)
}

// ── Statistics ────────────────────────────────────────────────────────────────

export const getFlowStats = async (): Promise<OnosStatEntry[]> => {
  const { data } = await api().get<{ statistics: OnosStatEntry[] }>('/statistics/flows/link')
  return data.statistics
}

export const getPortStats = async (deviceId: string) => {
  const { data } = await api().get(`/statistics/ports/${encodeURIComponent(deviceId)}`)
  return data
}

// ── Path/routing ──────────────────────────────────────────────────────────────

export const getPaths = async (srcHostId: string, dstHostId: string) => {
  const { data } = await api().get(
    `/paths/${encodeURIComponent(srcHostId)}/${encodeURIComponent(dstHostId)}`,
  )
  return data
}

// ── ONOS application management ───────────────────────────────────────────────

export const getApps = async () => {
  const { data } = await api().get('/applications')
  return data
}

// ── Helper: build ONOS-formatted flow body from our FlowRule types ────────────

const buildOnosFlowBody = (
  deviceId: string,
  priority: number,
  match: FlowMatch,
  actions: FlowAction[],
  isPermanent: boolean,
  timeout: number,
  appId: string,
) => {
  const criteria: unknown[] = []
  if (match.inPort !== undefined) criteria.push({ type: 'IN_PORT', port: match.inPort })
  if (match.ethSrc)  criteria.push({ type: 'ETH_SRC', mac: match.ethSrc })
  if (match.ethDst)  criteria.push({ type: 'ETH_DST', mac: match.ethDst })
  if (match.ethType) criteria.push({ type: 'ETH_TYPE', ethType: match.ethType })
  if (match.ipSrc)   criteria.push({ type: 'IPV4_SRC', ip: match.ipSrc })
  if (match.ipDst)   criteria.push({ type: 'IPV4_DST', ip: match.ipDst })
  if (match.vlanId !== undefined) criteria.push({ type: 'VLAN_VID', vlanId: match.vlanId })
  if (match.tcpSrc !== undefined) criteria.push({ type: 'TCP_SRC', tcpPort: match.tcpSrc })
  if (match.tcpDst !== undefined) criteria.push({ type: 'TCP_DST', tcpPort: match.tcpDst })

  const instructions: unknown[] = actions.map((a) => {
    switch (a.type) {
      case 'OUTPUT': return { type: 'OUTPUT', port: a.port }
      case 'DROP':   return { type: 'DROP' }
      case 'SET_VLAN_ID': return { type: 'L2MODIFICATION', subtype: 'VLAN_ID', vlanId: a.vlanId }
      case 'SET_ETH_SRC': return { type: 'L2MODIFICATION', subtype: 'ETH_SRC', mac: a.macAddress }
      case 'SET_ETH_DST': return { type: 'L2MODIFICATION', subtype: 'ETH_DST', mac: a.macAddress }
      default: return { type: a.type }
    }
  })

  return {
    flows: [{
      priority,
      timeout,
      isPermanent,
      deviceId,
      appId,
      selector: { criteria },
      treatment: { instructions },
    }],
  }
}

// ── Type transformers (ONOS → our types) ─────────────────────────────────────

export const transformOnosFlow = (f: OnosFlow): FlowRule => ({
  id: f.id,
  deviceId: f.deviceId,
  tableId: f.tableId,
  priority: f.priority,
  timeout: f.timeout,
  hardTimeout: 0,
  isPermanent: f.isPermanent,
  state: f.state as FlowRule['state'],
  match: parseCriteria(f.selector.criteria),
  actions: parseInstructions(f.treatment.instructions),
  bytes: f.bytes,
  packets: f.packets,
  createdAt: new Date().toISOString(),
  appId: f.appId,
})

const parseCriteria = (criteria: Array<{ type: string; [k: string]: unknown }>): FlowMatch => {
  const match: FlowMatch = {}
  for (const c of criteria) {
    switch (c.type) {
      case 'IN_PORT':  match.inPort = c.port as number; break
      case 'ETH_SRC':  match.ethSrc = c.mac as string; break
      case 'ETH_DST':  match.ethDst = c.mac as string; break
      case 'ETH_TYPE': match.ethType = String(c.ethType); break
      case 'IPV4_SRC': match.ipSrc = c.ip as string; break
      case 'IPV4_DST': match.ipDst = c.ip as string; break
      case 'VLAN_VID': match.vlanId = c.vlanId as number; break
      case 'TCP_SRC':  match.tcpSrc = c.tcpPort as number; break
      case 'TCP_DST':  match.tcpDst = c.tcpPort as number; break
      case 'UDP_SRC':  match.udpSrc = c.udpPort as number; break
      case 'UDP_DST':  match.udpDst = c.udpPort as number; break
    }
  }
  return match
}

const parseInstructions = (
  instructions: Array<{ type: string; [k: string]: unknown }>,
): FlowAction[] =>
  instructions.map((i) => {
    if (i.type === 'OUTPUT') return { type: 'OUTPUT', port: i.port as number }
    if (i.type === 'DROP')   return { type: 'DROP' }
    if (i.type === 'L2MODIFICATION') {
      if (i.subtype === 'VLAN_ID')  return { type: 'SET_VLAN_ID', vlanId: i.vlanId as number }
      if (i.subtype === 'ETH_SRC')  return { type: 'SET_ETH_SRC', macAddress: i.mac as string }
      if (i.subtype === 'ETH_DST')  return { type: 'SET_ETH_DST', macAddress: i.mac as string }
    }
    return { type: 'OUTPUT' } // fallback
  })

// ── Device / Host / Link transformers ────────────────────────────────────────

export const transformOnosDevice = (d: OnosDevice): Device => ({
  id: d.id,
  type: 'switch',
  label: d.annotations?.name ?? d.annotations?.channelId ?? d.id,
  status: d.available ? 'online' : 'offline',
  ipAddress: d.annotations?.managementAddress ?? d.annotations?.channelId?.split(':')[0] ?? '',
  macAddress: undefined,
  onosId: d.id,
  bridgeName: 'br0',
  portCount: d.ports?.length,
  ofVersion: d.sw ? 'OF_13' : undefined,
  model: `${d.mfr ?? ''} ${d.hw ?? ''}`.trim() || undefined,
  lastSeen: d.lastUpdate ? new Date(Number(d.lastUpdate)).toISOString() : new Date().toISOString(),
  metadata: d.annotations,
})

export const transformOnosHost = (h: OnosHost): Device => ({
  id: h.id,
  type: 'host',
  label: h.id.slice(0, 17),           // MAC as label until resolved
  status: 'online',
  ipAddress: h.ipAddresses?.[0] ?? '',
  macAddress: h.mac,
  lastSeen: new Date().toISOString(),
})

let linkSerial = 0
export const transformOnosLink = (l: OnosLink): Link => ({
  id: `${l.src.device}:${l.src.port}-${l.dst.device}:${l.dst.port}`,
  sourceDeviceId: l.src.device,
  sourcePort: Number(l.src.port),
  targetDeviceId: l.dst.device,
  targetPort: Number(l.dst.port),
  utilizationPct: 0,
  capacityMbps: 1000,
  throughputMbps: 0,
  latencyMs: 0,
  packetLossPct: 0,
  isUp: l.state === 'ACTIVE',
})

// ── Unified topology fetch ────────────────────────────────────────────────────

/**
 * Fetch devices + hosts + links in one shot and return a Topology object.
 * Also returns raw flows so the caller can update flowStore.
 */
export const fetchTopology = async (): Promise<{
  topology: Topology
  flows: FlowRule[]
}> => {
  const [rawDevices, rawHosts, rawLinks, rawFlows] = await Promise.all([
    getDevices(),
    getHosts(),
    getLinks(),
    getAllFlows(),
  ])

  // ONOS controller node (synthetic — not returned by /devices)
  const { connection } = useSettingsStore.getState()
  const controller: Device = {
    id: 'ctrl-1',
    type: 'controller',
    label: 'ONOS Controller',
    status: 'online',
    ipAddress: connection.onosHost,
    model: 'ONOS',
    lastSeen: new Date().toISOString(),
  }

  const switches: Device[] = rawDevices.map(transformOnosDevice)
  const hosts: Device[]    = rawHosts.map(transformOnosHost)

  // ONOS /links returns each link twice (A→B and B→A). Deduplicate by sorted ID pair.
  const seen = new Set<string>()
  const links: Link[] = rawLinks
    .filter((l) => {
      const key = [l.src.device + l.src.port, l.dst.device + l.dst.port].sort().join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(transformOnosLink)

  // Add host-access links from host location info
  rawHosts.forEach((h) => {
    //if (!h.location?.elementId) return
    //const id = `${h.location.elementId}:${h.location.port}-${h.id}`
    if (!h.locations[0]?.elementId) return
    const location = h.locations[0]
    const id = `${location.elementId}:${location.port}-${h.id}`
    links.push({
      id,
      //sourceDeviceId: h.location.elementId,
      //sourcePort: Number(h.location.port),
      sourceDeviceId: location.elementId,
      sourcePort: Number(location.port),
      targetDeviceId: h.id,
      targetPort: 1,
      utilizationPct: 0,
      capacityMbps: 100,
      throughputMbps: 0,
      latencyMs: 0,
      packetLossPct: 0,
      isUp: true,
    })
  })

  return {
    topology: {
      devices: [controller, ...switches, ...hosts],
      links,
      lastUpdated: new Date().toISOString(),
    },
    flows: rawFlows.map(transformOnosFlow),
  }
}

// ── Port statistics → link metrics ───────────────────────────────────────────

export interface PortStatSnapshot {
  deviceId: string
  port: number
  rxBytes: number
  txBytes: number
  rxPackets: number
  txPackets: number
  durationSec: number
}

export const fetchPortStats = async (deviceIds: string[]): Promise<PortStatSnapshot[]> => {
  const results: PortStatSnapshot[] = []
  await Promise.all(
    deviceIds.map(async (id) => {
      try {
        const raw = await getPortStats(id)
        const entries: Array<{ port: string; statistics: any }> = raw.statistics ?? []
        entries.forEach((e) => {
          results.push({
            deviceId: id,
            port: Number(e.port),
            rxBytes:   e.statistics?.bytesReceived   ?? 0,
            txBytes:   e.statistics?.bytesSent       ?? 0,
            rxPackets: e.statistics?.packetsReceived ?? 0,
            txPackets: e.statistics?.packetsSent     ?? 0,
            durationSec: e.statistics?.durationSec  ?? 0,
          })
        })
      } catch { /* device might not have stats API */ }
    }),
  )
  return results
}
