/**
 * WebSocket service with automatic reconnection, heartbeat, and message routing.
 *
 * Architecture:
 *   - Single persistent connection to the metrics/events backend
 *   - Exponential back-off reconnect (max 30 s)
 *   - Heartbeat ping/pong every 15 s to detect stale connections
 *   - Message handlers dispatched by WsMessageType
 *   - Integrates with Zustand stores directly (no Redux middleware needed)
 */

import type { WsMessage, WsMessageType, Topology, LinkMetrics, FlowRule, Alert } from '@/types'
import { useNetworkStore, emitAlert } from '@/stores/networkStore'
import { useMetricsStore } from '@/stores/metricsStore'
import { useFlowStore } from '@/stores/flowStore'

// ── Reconnection config ───────────────────────────────────────────────────────
const INITIAL_RECONNECT_DELAY_MS = 1_000
const MAX_RECONNECT_DELAY_MS = 30_000
const BACKOFF_FACTOR = 2
const HEARTBEAT_INTERVAL_MS = 15_000
const HEARTBEAT_TIMEOUT_MS = 5_000

type MessageHandler<T = unknown> = (payload: T, timestamp: number) => void

class SDNWebSocketService {
  private ws: WebSocket | null = null
  private url = ''
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = false
  private handlers = new Map<WsMessageType, MessageHandler<unknown>>()

  constructor() {
    this.registerDefaultHandlers()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  connect(url: string): void {
    this.url = url
    this.shouldReconnect = true
    this.openConnection()
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.clearTimers()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    useNetworkStore.getState().setWsConnectionState('disconnected')
  }

  send<T>(type: WsMessageType, payload: T): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg: WsMessage<T> = { type, payload, timestamp: Date.now() }
      this.ws.send(JSON.stringify(msg))
    }
  }

  on<T>(type: WsMessageType, handler: MessageHandler<T>): () => void {
    this.handlers.set(type, handler as MessageHandler<unknown>)
    return () => this.handlers.delete(type)
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // ── Connection lifecycle ────────────────────────────────────────────────────

  private openConnection(): void {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) return

    useNetworkStore.getState().setWsConnectionState('connecting')

    try {
      this.ws = new WebSocket(this.url)
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      console.info('[WS] Connected to', this.url)
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS
      useNetworkStore.getState().setWsConnectionState('connected')
      emitAlert('info', 'WebSocket connected', `Successfully connected to ${this.url}`)
      this.startHeartbeat()
    }

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(event.data)
    }

    this.ws.onerror = (event) => {
      console.error('[WS] Error:', event)
      useNetworkStore.getState().setWsConnectionState('error')
    }

    this.ws.onclose = (event) => {
      console.warn('[WS] Closed. Code:', event.code, 'Reason:', event.reason)
      this.clearHeartbeat()
      if (this.shouldReconnect && event.code !== 1000) {
        useNetworkStore.getState().setWsConnectionState('disconnected')
        emitAlert(
          'warning',
          'WebSocket disconnected',
          `Connection lost (code ${event.code}). Reconnecting in ${Math.round(this.reconnectDelay / 1000)}s…`,
        )
        this.scheduleReconnect()
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.shouldReconnect) {
        console.info('[WS] Attempting reconnect…')
        this.openConnection()
      }
    }, this.reconnectDelay)
    // Exponential back-off with jitter
    this.reconnectDelay = Math.min(
      this.reconnectDelay * BACKOFF_FACTOR + Math.random() * 500,
      MAX_RECONNECT_DELAY_MS,
    )
  }

  // ── Heartbeat ───────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.clearHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', { ts: Date.now() })
        // Set a timeout; if pong is not received the connection is stale
        this.heartbeatTimeoutTimer = setTimeout(() => {
          console.warn('[WS] Heartbeat timeout – closing stale connection')
          this.ws?.close()
        }, HEARTBEAT_TIMEOUT_MS)
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null }
    if (this.heartbeatTimeoutTimer) { clearTimeout(this.heartbeatTimeoutTimer); this.heartbeatTimeoutTimer = null }
  }

  private clearTimers(): void {
    this.clearHeartbeat()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
  }

  // ── Message handling ────────────────────────────────────────────────────────

  private handleMessage(raw: string): void {
    let msg: WsMessage
    try {
      msg = JSON.parse(raw) as WsMessage
    } catch {
      console.warn('[WS] Unparseable message:', raw.slice(0, 120))
      return
    }

    if (msg.type === 'pong') {
      if (this.heartbeatTimeoutTimer) {
        clearTimeout(this.heartbeatTimeoutTimer)
        this.heartbeatTimeoutTimer = null
      }
      return
    }

    const handler = this.handlers.get(msg.type)
    if (handler) {
      try {
        handler(msg.payload, msg.timestamp)
      } catch (err) {
        console.error('[WS] Handler error for', msg.type, err)
      }
    } else {
      console.debug('[WS] No handler for message type:', msg.type)
    }
  }

  // ── Default store-wired handlers ────────────────────────────────────────────

  private registerDefaultHandlers(): void {
    // Full topology snapshot
    this.on<Topology>('topology_update', (payload) => {
      useNetworkStore.getState().setTopology(payload)
    })

    // Incremental metrics push
    this.on<LinkMetrics & { linkId: string }>('metrics_update', (payload) => {
      const ms = useMetricsStore.getState()
      const ts = Date.now()
      // payload may carry arrays (batch) or latest scalars
      const latest = <K extends keyof LinkMetrics>(
        arr: LinkMetrics[K],
      ): number | undefined =>
        Array.isArray(arr) && arr.length ? (arr[arr.length - 1] as { value: number }).value : undefined

      ms.updateLinkMetrics(payload.linkId, {
        bandwidth:  latest(payload.bandwidth),
        latency:    latest(payload.latency),
        packetLoss: latest(payload.packetLoss),
        rxBytes:    latest(payload.rxBytes),
        txBytes:    latest(payload.txBytes),
      }, ts)
    })

    // Flow rule update
    this.on<FlowRule>('flow_update', (flow) => {
      const { flows, updateFlow, addFlow } = useFlowStore.getState()
      if (flows.find((f) => f.id === flow.id)) {
        updateFlow(flow)
      } else {
        addFlow(flow)
      }
    })

    // Server-pushed alert
    this.on<Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>>('alert', (alert) => {
      useNetworkStore.getState().addAlert(alert)
    })

    // Device status change
    this.on<{ deviceId: string; status: string }>('device_status', (payload) => {
      const { getDevice, updateDevice, addAlert } = useNetworkStore.getState()
      const device = getDevice(payload.deviceId)
      if (device) {
        updateDevice({ ...device, status: payload.status as 'online' | 'offline' | 'warning', lastSeen: new Date().toISOString() })
        if (payload.status === 'offline') {
          addAlert({ severity: 'error', title: 'Device offline', message: `${device.label} (${device.ipAddress}) went offline`, deviceId: device.id })
        }
      }
    })

    // Link status change
    this.on<{ linkId: string; isUp: boolean }>('link_status', (payload) => {
      const { getLink, updateLink, addAlert } = useNetworkStore.getState()
      const link = getLink(payload.linkId)
      if (link) {
        updateLink({ ...link, isUp: payload.isUp })
        if (!payload.isUp) {
          addAlert({ severity: 'error', title: 'Link down', message: `Link ${link.id} is down`, linkId: link.id })
        }
      }
    })
  }
}

// Singleton instance
export const wsService = new SDNWebSocketService()
