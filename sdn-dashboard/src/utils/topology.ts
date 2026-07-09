import type { Device, Link } from '@/types'
import type { ElementDefinition } from 'cytoscape'

// ── Color helpers ─────────────────────────────────────────────────────────────

export const utilizationColor = (pct: number): string => {
  if (pct < 50) {
    // Green → Amber
    const t = pct / 50
    const r = Math.round(34 + (245 - 34) * t)
    const g = Math.round(197 + (158 - 197) * t)
    const b = Math.round(94 + (11 - 94) * t)
    return `rgb(${r},${g},${b})`
  } else {
    // Amber → Red
    const t = (pct - 50) / 50
    const r = Math.round(245 + (239 - 245) * t)
    const g = Math.round(158 + (68 - 158) * t)
    const b = Math.round(11 + (68 - 11) * t)
    return `rgb(${r},${g},${b})`
  }
}

export const deviceColor = (type: Device['type']): string => {
  switch (type) {
    case 'controller': return '#8b5cf6'
    case 'switch':     return '#0ea5e9'
    case 'host':       return '#22c55e'
    default:           return '#94a3b8'
  }
}

export const deviceShape = (type: Device['type']): string => {
  switch (type) {
    case 'controller': return 'diamond'
    case 'switch':     return 'rectangle'
    case 'host':       return 'ellipse'
    default:           return 'ellipse'
  }
}

// ── Cytoscape element builders ────────────────────────────────────────────────

export const devicesToCyNodes = (devices: Device[]): ElementDefinition[] =>
  devices.map((d) => ({
    data: {
      id: d.id,
      label: d.label,
      deviceType: d.type,
      status: d.status,
      ipAddress: d.ipAddress,
      color: deviceColor(d.type),
      shape: deviceShape(d.type),
      // Store full device for hover panel
      device: d,
    },
    classes: [d.type, d.status].join(' '),
  }))

export const linksToCyEdges = (links: Link[]): ElementDefinition[] =>
  links.map((l) => ({
    data: {
      id: l.id,
      source: l.sourceDeviceId,
      target: l.targetDeviceId,
      utilizationPct: l.utilizationPct,
      throughputMbps: l.throughputMbps,
      capacityMbps: l.capacityMbps,
      latencyMs: l.latencyMs,
      isUp: l.isUp,
      color: l.isUp ? utilizationColor(l.utilizationPct) : '#475569',
      width: Math.max(1, Math.min(8, 1 + (l.utilizationPct / 100) * 7)),
      link: l,
    },
    classes: l.isUp ? 'link-up' : 'link-down',
  }))

// ── Cytoscape stylesheet ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cyStylesheet: any[] = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'label': 'data(label)',
      'color': '#e2e8f0',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 6,
      'font-size': 11,
      'font-family': 'Inter, sans-serif',
      'width': 40,
      'height': 40,
      'shape': 'data(shape)',
      'border-width': 2,
      'border-color': '#1e293b',
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'node.controller',
    style: {
      'width': 52,
      'height': 52,
      'border-width': 3,
      'border-color': '#7c3aed',
      'font-weight': 'bold',
    },
  },
  {
    selector: 'node.offline',
    style: {
      'opacity': 0.4,
      'border-color': '#ef4444',
    },
  },
  {
    selector: 'node.warning',
    style: {
      'border-color': '#f59e0b',
      'border-width': 3,
    },
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#38bdf8',
      'border-width': 3,
      'overlay-color': '#38bdf8',
      'overlay-padding': 6,
      'overlay-opacity': 0.15,
    },
  },
  {
    selector: 'edge',
    style: {
      'width': 'data(width)',
      'line-color': 'data(color)',
      'target-arrow-shape': 'none',
      'curve-style': 'bezier',
      'opacity': 0.85,
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'edge.link-down',
    style: {
      'line-style': 'dashed',
      'line-dash-pattern': [6, 4],
      'opacity': 0.35,
    },
  },
  {
    selector: 'edge:selected',
    style: {
      'overlay-color': '#38bdf8',
      'overlay-padding': 4,
      'overlay-opacity': 0.2,
    },
  },
]

// ── Layered position calculator ───────────────────────────────────────────────
// Assigns fixed (x, y) positions by device type so nodes never drift.
// Returns a map of deviceId → {x, y} that callers apply after adding elements.

export const computeLayeredPositions = (
  devices: Device[],
  canvasWidth: number,
  canvasHeight: number,
): Record<string, { x: number; y: number }> => {
  const controllers = devices.filter((d) => d.type === 'controller')
  const switches    = devices.filter((d) => d.type === 'switch')
  const hosts       = devices.filter((d) => d.type === 'host')

  const pad = 80
  const w   = canvasWidth  - pad * 2
  const positions: Record<string, { x: number; y: number }> = {}

  const spread = (items: Device[], y: number) => {
    const n = items.length
    items.forEach((d, i) => {
      const x = n === 1
        ? pad + w / 2
        : pad + (w / (n - 1)) * i
      positions[d.id] = { x, y }
    })
  }

  // Three fixed rows
  const rowCtrl   = canvasHeight * 0.15
  const rowSwitch = canvasHeight * 0.50
  const rowHost   = canvasHeight * 0.85

  spread(controllers, rowCtrl)
  spread(switches,    rowSwitch)
  spread(hosts,       rowHost)

  return positions
}

// ── Layout configs (force + grid – kept for toolbar; default is layered) ─────

export const LAYOUTS = {
  force: {
    name: 'cose',
    animate: false,
    nodeRepulsion: () => 8000,
    idealEdgeLength: () => 120,
    edgeElasticity: () => 100,
    gravity: 80,
    numIter: 1000,
    fit: true,
    padding: 40,
    randomize: false,
  },
  hierarchical: {
    name: 'breadthfirst',
    animate: false,
    fit: true,
    padding: 40,
    directed: true,
  },
  grid: {
    name: 'grid',
    animate: false,
    fit: true,
    padding: 40,
    cols: undefined as number | undefined,
    rows: undefined as number | undefined,
  },
}
