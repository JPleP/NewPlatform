// ─── Device & Topology Types ─────────────────────────────────────────────────

export type DeviceType = 'controller' | 'switch' | 'host'

export type DeviceStatus = 'online' | 'offline' | 'warning'

export interface Device {
  id: string
  type: DeviceType
  label: string
  status: DeviceStatus
  /** IP address of the management interface */
  ipAddress: string
  /** MAC address (hosts and switches) */
  macAddress?: string
  /** ONOS device ID e.g. "of:0000000000000001" */
  onosId?: string
  /** OVS bridge name e.g. "br0" */
  bridgeName?: string
  /** Number of ports */
  portCount?: number
  /** OpenFlow version e.g. "OF_13" */
  ofVersion?: string
  /** Raspberry Pi model / controller version */
  model?: string
  /** Last heartbeat timestamp (ISO 8601) */
  lastSeen: string
  /** Arbitrary extra metadata */
  metadata?: Record<string, string>
}

export interface Port {
  portId: string
  deviceId: string
  portNumber: number
  isEnabled: boolean
  speedMbps: number
  macAddress?: string
}

export interface Link {
  id: string
  sourceDeviceId: string
  sourcePort: number
  targetDeviceId: string
  targetPort: number
  /** Current utilization 0–100 */
  utilizationPct: number
  /** Bandwidth capacity in Mbps */
  capacityMbps: number
  /** Current throughput in Mbps */
  throughputMbps: number
  latencyMs: number
  packetLossPct: number
  isUp: boolean
}

export interface Topology {
  devices: Device[]
  links: Link[]
  /** ISO 8601 timestamp of last topology refresh */
  lastUpdated: string
}

// ─── Metrics Types ────────────────────────────────────────────────────────────

export interface MetricPoint {
  /** Unix timestamp (ms) */
  timestamp: number
  value: number
}

export interface LinkMetrics {
  linkId: string
  bandwidth: MetricPoint[]   // Mbps
  latency: MetricPoint[]     // ms
  packetLoss: MetricPoint[]  // %
  rxBytes: MetricPoint[]
  txBytes: MetricPoint[]
}

export interface DeviceMetrics {
  deviceId: string
  cpuPct: MetricPoint[]
  memoryPct: MetricPoint[]
  portStats: PortStats[]
}

export interface PortStats {
  portNumber: number
  rxPackets: number
  txPackets: number
  rxBytes: number
  txBytes: number
  rxDropped: number
  txDropped: number
  rxErrors: number
  txErrors: number
}

// ─── Flow Rule Types ──────────────────────────────────────────────────────────

export type FlowState = 'ADDED' | 'PENDING_ADD' | 'PENDING_REMOVE' | 'REMOVED' | 'FAILED'

export interface FlowMatch {
  inPort?: number
  ethSrc?: string
  ethDst?: string
  ethType?: string    // hex e.g. "0x0800"
  ipSrc?: string      // CIDR
  ipDst?: string      // CIDR
  ipProto?: number
  tcpSrc?: number
  tcpDst?: number
  udpSrc?: number
  udpDst?: number
  vlanId?: number
}

export interface FlowAction {
  type: 'OUTPUT' | 'DROP' | 'SET_VLAN_ID' | 'SET_ETH_SRC' | 'SET_ETH_DST' | 'SET_IP_SRC' | 'SET_IP_DST' | 'METER' | 'GROUP'
  port?: number
  vlanId?: number
  macAddress?: string
  ipAddress?: string
  meterId?: number
  groupId?: number
}

export interface FlowRule {
  id: string
  deviceId: string
  tableId: number
  priority: number
  timeout: number       // idle timeout in seconds (0 = permanent)
  hardTimeout: number   // hard timeout in seconds (0 = permanent)
  isPermanent: boolean
  state: FlowState
  match: FlowMatch
  actions: FlowAction[]
  bytes: number
  packets: number
  /** ISO 8601 */
  createdAt: string
  /** Application/experiment that installed this rule */
  appId?: string
}

// ─── Slice / Network Slice Types ──────────────────────────────────────────────

export interface Slice {
  id: string
  name: string
  /** Tailwind color class stem e.g. "blue", "purple", "amber", "green", "red", "pink" */
  color: SliceColor
  /** Max bandwidth in Mbps (0 = unlimited) */
  maxBandwidthMbps: number
  /** OpenFlow priority for this slice's flows */
  priority: number
  /** Flow IDs that belong to this slice */
  flowIds: string[]
  /** Description */
  description: string
}

export type SliceColor = 'blue' | 'purple' | 'amber' | 'green' | 'red' | 'pink' | 'cyan'

// ─── Service Function Chain Types ────────────────────────────────────────────

export type SFType =
  | 'rate-limiter'
  | 'firewall'
  | 'nat'
  | 'dpi'
  | 'monitor'
  | 'priority-queue'
  | 'load-balancer'
  | 'mirror'

export interface SFCHopMetrics {
  latencyMs: number
  throughputMbps: number
  packetLossPct: number
  packetsProcessed: number
}

export interface SFCHop {
  /** Switch device ID */
  deviceId: string
  /** Human-readable service function name */
  serviceFunction: string
  sfType: SFType
  /** Flow rule IDs implementing this hop */
  flowIds: string[]
  /** Live per-hop performance metrics */
  metrics: SFCHopMetrics
}

export type ChainState = 'active' | 'standby' | 'degraded' | 'failed' | 'configuring'

export interface ServiceFunctionChain {
  id: string
  name: string
  description: string
  color: SliceColor
  srcHostId: string
  dstHostId: string
  /** Ordered intermediate switch hops (not including src/dst hosts) */
  hops: SFCHop[]
  state: ChainState
  /** Ordered link IDs that form the data-plane path */
  linkPath: string[]
  createdAt: string
}

// ─── Alert / Event Types ──────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  deviceId?: string
  linkId?: string
  /** ISO 8601 */
  timestamp: string
  acknowledged: boolean
}

// ─── Experiment / Scenario Types ─────────────────────────────────────────────

export type ExperimentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed'

export interface TrafficProfile {
  type: 'constant' | 'cbr' | 'burst' | 'poisson' | 'custom'
  rateMbps: number
  burstSizeKb?: number
  durationSec: number
  protocol: 'TCP' | 'UDP' | 'ICMP'
  srcHost: string
  dstHost: string
}

export interface Experiment {
  id: string
  name: string
  description: string
  status: ExperimentStatus
  topology: string    // topology snapshot id or "current"
  trafficProfiles: TrafficProfile[]
  routingAlgorithm: 'shortest-path' | 'load-balanced' | 'custom'
  /** ISO 8601 */
  startedAt?: string
  /** ISO 8601 */
  completedAt?: string
  results?: ExperimentResult
}

export interface ExperimentResult {
  avgLatencyMs: number
  p95LatencyMs: number
  avgThroughputMbps: number
  packetLossPct: number
  flowCount: number
  notes: string
}

// ─── WebSocket Message Types ──────────────────────────────────────────────────

export type WsMessageType =
  | 'topology_update'
  | 'metrics_update'
  | 'flow_update'
  | 'alert'
  | 'device_status'
  | 'link_status'
  | 'experiment_update'
  | 'ping'
  | 'pong'

export interface WsMessage<T = unknown> {
  type: WsMessageType
  payload: T
  timestamp: number
}

// ─── Settings Types ───────────────────────────────────────────────────────────

export interface ConnectionSettings {
  onosHost: string
  onosPort: number
  onosUser: string
  onosPassword: string
  wsHost: string
  wsPort: number
  wsPath: string
  useSSL: boolean
}

export interface DashboardSettings {
  metricsWindowSec: number       // rolling window for charts (default 60)
  metricsIntervalMs: number      // polling/push interval (default 1000)
  topologyRefreshSec: number     // topology full refresh (default 30)
  maxAlerts: number              // max alerts to keep in memory (default 200)
  theme: 'dark' | 'light'
  defaultLayout: 'force' | 'hierarchical' | 'grid'
}

export interface AppSettings {
  connection: ConnectionSettings
  dashboard: DashboardSettings
}

// ─── UI State Types ───────────────────────────────────────────────────────────

export interface SelectedElement {
  type: 'device' | 'link' | null
  id: string | null
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'
