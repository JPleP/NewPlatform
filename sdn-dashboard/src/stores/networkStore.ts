import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  Device, Link, Topology, Alert, AlertSeverity, SelectedElement, ConnectionState,
} from '@/types'

interface NetworkState {
  // ── Topology ──────────────────────────────────────────────────────────────
  devices: Device[]
  links: Link[]
  lastTopologyUpdate: string | null

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedElement: SelectedElement

  // ── Alerts ────────────────────────────────────────────────────────────────
  alerts: Alert[]
  unacknowledgedCount: number

  // ── Connection ────────────────────────────────────────────────────────────
  wsConnectionState: ConnectionState

  // ── Actions ───────────────────────────────────────────────────────────────
  setTopology: (topology: Topology) => void
  addDevice: (device: Device) => void
  removeDevice: (id: string) => void
  addLink: (link: Link) => void
  removeLink: (id: string) => void
  updateDevice: (device: Device) => void
  updateLink: (link: Link) => void
  setSelectedElement: (element: SelectedElement) => void
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void
  acknowledgeAlert: (id: string) => void
  acknowledgeAllAlerts: () => void
  clearAlerts: () => void
  setWsConnectionState: (state: ConnectionState) => void

  // ── Derived Selectors (called as actions) ─────────────────────────────────
  getDevice: (id: string) => Device | undefined
  getLink: (id: string) => Link | undefined
  getLinksForDevice: (deviceId: string) => Link[]
}

let alertIdCounter = 0
const nextAlertId = () => `alert-${Date.now()}-${++alertIdCounter}`

export const useNetworkStore = create<NetworkState>()(
  subscribeWithSelector((set, get) => ({
    // ── Initial State ────────────────────────────────────────────────────────
    devices: [],
    links: [],
    lastTopologyUpdate: null,
    selectedElement: { type: null, id: null },
    alerts: [],
    unacknowledgedCount: 0,
    wsConnectionState: 'disconnected',

    // ── Topology Actions ─────────────────────────────────────────────────────
    setTopology: (topology) =>
      set({
        devices: topology.devices,
        links: topology.links,
        lastTopologyUpdate: topology.lastUpdated,
      }),

    addDevice: (device) =>
      set((state) => ({
        devices: state.devices.find((d) => d.id === device.id)
          ? state.devices
          : [...state.devices, device],
      })),

    removeDevice: (id) =>
      set((state) => ({
        devices: state.devices.filter((d) => d.id !== id),
        links: state.links.filter((l) => l.sourceDeviceId !== id && l.targetDeviceId !== id),
      })),

    addLink: (link) =>
      set((state) => ({
        links: state.links.find((l) => l.id === link.id)
          ? state.links
          : [...state.links, link],
      })),

    removeLink: (id) =>
      set((state) => ({
        links: state.links.filter((l) => l.id !== id),
      })),

    updateDevice: (device) =>
      set((state) => ({
        devices: state.devices.map((d) => (d.id === device.id ? device : d)),
      })),

    updateLink: (link) =>
      set((state) => ({
        links: state.links.map((l) => (l.id === link.id ? link : l)),
      })),

    // ── Selection ─────────────────────────────────────────────────────────────
    setSelectedElement: (element) => set({ selectedElement: element }),

    // ── Alert Actions ─────────────────────────────────────────────────────────
    addAlert: (alertData) =>
      set((state) => {
        const MAX_ALERTS = 200
        const newAlert: Alert = {
          ...alertData,
          id: nextAlertId(),
          timestamp: new Date().toISOString(),
          acknowledged: false,
        }
        const updated = [newAlert, ...state.alerts].slice(0, MAX_ALERTS)
        return {
          alerts: updated,
          unacknowledgedCount: updated.filter((a) => !a.acknowledged).length,
        }
      }),

    acknowledgeAlert: (id) =>
      set((state) => {
        const updated = state.alerts.map((a) =>
          a.id === id ? { ...a, acknowledged: true } : a,
        )
        return {
          alerts: updated,
          unacknowledgedCount: updated.filter((a) => !a.acknowledged).length,
        }
      }),

    acknowledgeAllAlerts: () =>
      set((state) => ({
        alerts: state.alerts.map((a) => ({ ...a, acknowledged: true })),
        unacknowledgedCount: 0,
      })),

    clearAlerts: () => set({ alerts: [], unacknowledgedCount: 0 }),

    // ── Connection ────────────────────────────────────────────────────────────
    setWsConnectionState: (wsConnectionState) => set({ wsConnectionState }),

    // ── Selectors ─────────────────────────────────────────────────────────────
    getDevice: (id) => get().devices.find((d) => d.id === id),
    getLink: (id) => get().links.find((l) => l.id === id),
    getLinksForDevice: (deviceId) =>
      get().links.filter(
        (l) => l.sourceDeviceId === deviceId || l.targetDeviceId === deviceId,
      ),
  })),
)

// ── Convenience typed severity helper ────────────────────────────────────────
export const emitAlert = (
  severity: AlertSeverity,
  title: string,
  message: string,
  deviceId?: string,
  linkId?: string,
) =>
  useNetworkStore.getState().addAlert({ severity, title, message, deviceId, linkId })
