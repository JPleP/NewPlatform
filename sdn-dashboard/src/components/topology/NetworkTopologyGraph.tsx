/**
 * NetworkTopologyGraph
 *
 * Interactive force-directed topology graph using Cytoscape.js.
 *
 * Features:
 *   - Nodes: ONOS controller (diamond), OVS switches (rectangle), Pi hosts (circle)
 *   - Edges: color-coded by utilization (green → amber → red), dashed when down
 *   - Click node/edge → fires onSelect callback + shows info overlay
 *   - Hover tooltip with device/link details
 *   - Toolbar: fit, zoom in/out, layout switch, toggle labels
 *   - Live updates: utilization changes re-style edges without full re-render
 */

import { useEffect, useRef, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import type Cytoscape from 'cytoscape'
import {
  ZoomIn, ZoomOut, Maximize2, LayoutGrid, Workflow,
  AlignCenter, Eye, EyeOff,
} from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import {
  devicesToCyNodes, linksToCyEdges, cyStylesheet, LAYOUTS,
  utilizationColor, computeLayeredPositions,
} from '@/utils/topology'
import {
  formatBandwidth, formatLatency, formatPercent, deviceTypeLabel,
} from '@/utils/format'
import type { Device, Link, SelectedElement } from '@/types'
import { clsx } from 'clsx'

// ── Tooltip overlay ───────────────────────────────────────────────────────────

interface TooltipData {
  x: number
  y: number
  content: React.ReactNode
}

const DeviceTooltip = ({ device }: { device: Device }) => (
  <div className="space-y-1 min-w-48">
    <div className="flex items-center gap-2 mb-2">
      <span className={clsx(
        'status-dot',
        device.status === 'online' ? 'online' : device.status === 'offline' ? 'offline' : 'warning',
      )} />
      <span className="font-semibold text-slate-100">{device.label}</span>
    </div>
    <p className="text-xs text-slate-400">{deviceTypeLabel(device.type)}</p>
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-1">
      <span className="text-slate-500">IP</span>
      <span className="text-slate-300 font-mono">{device.ipAddress}</span>
      {device.onosId && <>
        <span className="text-slate-500">ONOS ID</span>
        <span className="text-slate-300 font-mono text-[10px]">{device.onosId}</span>
      </>}
      {device.portCount !== undefined && <>
        <span className="text-slate-500">Ports</span>
        <span className="text-slate-300">{device.portCount}</span>
      </>}
      {device.ofVersion && <>
        <span className="text-slate-500">OpenFlow</span>
        <span className="text-slate-300">{device.ofVersion}</span>
      </>}
      {device.model && <>
        <span className="text-slate-500">Model</span>
        <span className="text-slate-300">{device.model}</span>
      </>}
    </div>
  </div>
)

const LinkTooltip = ({ link }: { link: Link }) => (
  <div className="space-y-1 min-w-44">
    <p className="font-semibold text-slate-100 mb-2">{link.id}</p>
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
      <span className="text-slate-500">Throughput</span>
      <span className={clsx(
        'font-mono',
        link.utilizationPct < 50 ? 'text-green-400' :
        link.utilizationPct < 75 ? 'text-amber-400' : 'text-red-400',
      )}>
        {formatBandwidth(link.throughputMbps)}
      </span>
      <span className="text-slate-500">Utilization</span>
      <span className="text-slate-300 font-mono">{formatPercent(link.utilizationPct)}</span>
      <span className="text-slate-500">Capacity</span>
      <span className="text-slate-300 font-mono">{formatBandwidth(link.capacityMbps)}</span>
      <span className="text-slate-500">Latency</span>
      <span className="text-slate-300 font-mono">{formatLatency(link.latencyMs)}</span>
      <span className="text-slate-500">Packet loss</span>
      <span className="text-slate-300 font-mono">{formatPercent(link.packetLossPct, 3)}</span>
      <span className="text-slate-500">Status</span>
      <span className={link.isUp ? 'text-green-400' : 'text-red-400'}>
        {link.isUp ? 'Up' : 'Down'}
      </span>
    </div>
  </div>
)

// ── Toolbar ───────────────────────────────────────────────────────────────────

type LayoutKey = 'force' | 'hierarchical' | 'grid'

interface ToolbarProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onLayout: (key: LayoutKey) => void
  onToggleLabels: () => void
  showLabels: boolean
  currentLayout: LayoutKey
}

const Toolbar = ({ onZoomIn, onZoomOut, onFit, onLayout, onToggleLabels, showLabels, currentLayout }: ToolbarProps) => {
  const btn = 'p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors'
  const activebtn = 'p-2 rounded-lg text-sdn-400 bg-sdn-500/10 border border-sdn-500/20'

  return (
    <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
      <div className="glass-card p-1 flex flex-col gap-0.5">
        <button className={btn} onClick={onZoomIn}  title="Zoom in">  <ZoomIn  className="w-4 h-4" /></button>
        <button className={btn} onClick={onZoomOut} title="Zoom out"> <ZoomOut className="w-4 h-4" /></button>
        <button className={btn} onClick={onFit}     title="Fit view"> <Maximize2 className="w-4 h-4" /></button>
      </div>
      <div className="glass-card p-1 flex flex-col gap-0.5">
        <button
          className={currentLayout === 'force' ? activebtn : btn}
          onClick={() => onLayout('force')}
          title="Force layout"
        ><Workflow className="w-4 h-4" /></button>
        <button
          className={currentLayout === 'hierarchical' ? activebtn : btn}
          onClick={() => onLayout('hierarchical')}
          title="Hierarchical layout"
        ><AlignCenter className="w-4 h-4" /></button>
        <button
          className={currentLayout === 'grid' ? activebtn : btn}
          onClick={() => onLayout('grid')}
          title="Grid layout"
        ><LayoutGrid className="w-4 h-4" /></button>
      </div>
      <div className="glass-card p-1">
        <button
          className={showLabels ? activebtn : btn}
          onClick={onToggleLabels}
          title={showLabels ? 'Hide labels' : 'Show labels'}
        >{showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
      </div>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

// Legend is rendered top-left, same vertical band as the controller node
const Legend = () => (
  <div className="absolute top-3 left-3 glass-card px-3 py-2 z-10">
    <p className="text-xs font-semibold text-slate-400 mb-1.5">Legend</p>
    <div className="flex flex-col gap-1">
      {([
        ['diamond', '#8b5cf6', 'ONOS Controller'],
        ['square',  '#0ea5e9', 'OVS Switch'],
        ['circle',  '#22c55e', 'Pi Host'],
      ] as const).map(([shape, color, label]) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className="w-3 h-3 flex-shrink-0"
            style={{
              background: color,
              borderRadius: shape === 'circle' ? '50%' : '2px',
              transform: shape === 'diamond' ? 'rotate(45deg)' : 'none',
            }}
          />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
      ))}
      <div className="mt-1 pt-1 border-t border-slate-700/40 space-y-0.5">
        {[
          ['#22c55e', 'Low (<50%)'],
          ['#f59e0b', 'Medium (50–75%)'],
          ['#ef4444', 'High (>75%)'],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-5 h-0.5 flex-shrink-0 rounded" style={{ background: color }} />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
)

// Dashed separator line rendered between the switch row and host row
const SeparatorLines = ({ containerH }: { containerH: number }) => {
  if (containerH === 0) return null
  // Match computeLayeredPositions row ratios: switch=50%, host=85%
  // Place separator at the midpoint between the two rows
  const switchRowY = containerH * 0.50
  const hostRowY   = containerH * 0.85
  const sepY       = (switchRowY + hostRowY) / 2

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      width="100%"
      height="100%"
      style={{ overflow: 'visible' }}
    >
      {/* Switch / Host separator */}
      <line
        x1="5%" y1={sepY} x2="95%" y2={sepY}
        stroke="#334155"
        strokeWidth="1"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      <text x="5%" y={sepY - 5} fill="#475569" fontSize="10" fontFamily="Inter,sans-serif">
        Hosts
      </text>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** Packet Tracer animation config */
export interface TraceConfig {
  /** All node IDs in path order: [srcHost, sw1, sw2, dstHost] */
  nodePath: string[]
  /** All edge IDs in path order: [src-sw1, sw1-sw2, sw2-dst] */
  edgePath: string[]
  /**
   * Current animation step index into the interleaved sequence:
   * [node0, edge0, node1, edge1, …]
   * -1 = show full path (no step-by-step)
   */
  step: number
}

interface NetworkTopologyGraphProps {
  onSelect?: (element: SelectedElement) => void
  className?: string
  highlightDeviceIds?: string[]
  /** Link IDs to highlight (e.g., SFC path links) */
  highlightLinkIds?: string[]
  /** Accent color hex used for highlighted nodes/edges (e.g., chain color) */
  highlightColor?: string
  pathBuilderMode?: boolean
  onPathNodeClick?: (id: string, deviceType: string) => void
  /** Packet Tracer animation — drives step-by-step path animation */
  traceConfig?: TraceConfig | null
}

/** Methods exposed via ref for external callers (e.g. export) */
export interface NetworkTopologyGraphHandle {
  /** Export the current canvas as a PNG Blob */
  exportPng: () => Blob | null
}

export const NetworkTopologyGraph = forwardRef<NetworkTopologyGraphHandle, NetworkTopologyGraphProps>((
  {
    onSelect,
    className,
    highlightDeviceIds,
    highlightLinkIds,
    highlightColor = '#38bdf8',
    pathBuilderMode,
    onPathNodeClick,
    traceConfig,
  },
  ref,
) => {
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const setSelectedElement = useNetworkStore((s) => s.setSelectedElement)

  const cyRef = useRef<Cytoscape.Core | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [currentLayout, setCurrentLayout] = useState<LayoutKey>('hierarchical')
  const [containerH, setContainerH] = useState(0)

  // ── Expose exportPng to parent via ref ─────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const cy = cyRef.current
      if (!cy) return null
      return cy.png({ output: 'blob', bg: '#0f172a', full: true }) as unknown as Blob
    },
  }))

  // Structural keys: only IDs + up/down state – NOT utilization values.
  // This prevents re-building elements (and re-running cy.json) on every metrics tick.
  const deviceKey = devices.map((d) => `${d.id}:${d.status}`).join('|')
  const linkKey   = links.map((l) => `${l.id}:${l.isUp ? 1 : 0}`).join('|')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const elements = useMemo(() => [
    ...devicesToCyNodes(devices),
    ...linksToCyEdges(links),
  ], [deviceKey, linkKey])

  // Keep a ref to devices so layout callbacks are stable across renders.
  const devicesRef = useRef(devices)
  useEffect(() => { devicesRef.current = devices }, [devices])

  // Track which node IDs the user has manually dragged – skip those in layout.
  const draggedNodesRef = useRef<Set<string>>(new Set())

  // ── Apply layered positions ─────────────────────────────────────────────────
  // skipDragged=true  → only position nodes not yet dragged by the user (default)
  // skipDragged=false → full reset (only on explicit toolbar layout change)
  const applyLayeredPositions = useCallback((skipDragged = true) => {
    const cy = cyRef.current
    const container = containerRef.current
    if (!cy || !container) return
    const { width, height } = container.getBoundingClientRect()
    if (width === 0 || height === 0) return
    cy.resize()
    const positions = computeLayeredPositions(devicesRef.current, width, height)
    cy.nodes().forEach((node) => {
      const id = node.id()
      // Never reposition a node the user has manually placed (unless full reset)
      if (skipDragged && draggedNodesRef.current.has(id)) return
      const pos = positions[id]
      if (pos) {
        node.unlock()
        node.position(pos)
        if (node.data('deviceType') === 'controller') node.lock()
      }
    })
    cy.fit(undefined, 40)
  }, [])  // stable – reads via refs

  // Run layout after mount via ResizeObserver (fires when container is sized)
  const layoutDoneRef = useRef(false)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const tryLayout = () => {
      const { width, height } = container.getBoundingClientRect()
      // Always keep containerH in sync for SVG overlay
      if (height > 0) setContainerH(height)
      if (width === 0 || height === 0 || !cyRef.current) return
      if (layoutDoneRef.current) return
      layoutDoneRef.current = true
      applyLayeredPositions()
    }
    const ro = new ResizeObserver(tryLayout)
    ro.observe(container)
    tryLayout()
    return () => ro.disconnect()
  }, [applyLayeredPositions])

  // When a new device joins: position ONLY the new node, leave others untouched.
  const prevDeviceIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!layoutDoneRef.current) return
    const currentIds = new Set(devices.map((d) => d.id))
    const newIds = [...currentIds].filter((id) => !prevDeviceIdsRef.current.has(id))
    prevDeviceIdsRef.current = currentIds
    if (newIds.length === 0) return

    // Small delay so CytoscapeComponent adds the element first
    setTimeout(() => {
      const cy = cyRef.current
      const container = containerRef.current
      if (!cy || !container) return
      const { width, height } = container.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const positions = computeLayeredPositions(devicesRef.current, width, height)
      newIds.forEach((id) => {
        const node = cy.getElementById(id)
        const pos = positions[id]
        if (node.length && pos) {
          node.unlock()
          node.position(pos)
        }
      })
    }, 60)
  }, [devices])

  // ── Packet Tracer animation ────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    if (!traceConfig) {
      // Restore normal styles when tracer is closed
      cy.nodes().style({ opacity: 1, 'border-width': 2, 'border-color': '#1e293b' })
      cy.nodes('.controller').style({ 'border-color': '#7c3aed', 'border-width': 3 })
      cy.edges().style({ opacity: 0.85, 'line-color': undefined, width: undefined })
      return
    }

    const { nodePath, edgePath, step } = traceConfig

    // Build interleaved sequence: [node0, edge0, node1, edge1, …, nodeN]
    const sequence: Array<{ type: 'node' | 'edge'; id: string }> = []
    nodePath.forEach((nid, i) => {
      sequence.push({ type: 'node', id: nid })
      if (edgePath[i]) sequence.push({ type: 'edge', id: edgePath[i] })
    })

    const allPathNodeIds = new Set(nodePath)
    const allPathEdgeIds = new Set(edgePath)

    // Dim everything off-path
    cy.nodes().forEach((n) => {
      if (!allPathNodeIds.has(n.id())) n.style({ opacity: 0.08, 'border-width': 1, 'border-color': '#1e293b' })
    })
    cy.edges().forEach((e) => {
      if (!allPathEdgeIds.has(e.id())) e.style({ opacity: 0.06, 'line-color': '#475569', width: 1 })
    })

    // Colour each item depending on visit state
    sequence.forEach((item, idx) => {
      const isCurrent = step === -1 || idx === step
      const isVisited = step === -1 || idx < step
      const isPending = step !== -1 && idx > step

      if (item.type === 'node') {
        const node = cy.getElementById(item.id)
        if (!node.length) return
        node.style({
          opacity:        isPending ? 0.3 : 1,
          'border-width': isCurrent ? 5 : isVisited ? 3 : 2,
          'border-color': isCurrent ? '#facc15' : isVisited ? '#22c55e' : '#64748b',
        })
      } else {
        const edge = cy.getElementById(item.id)
        if (!edge.length) return
        edge.style({
          opacity:     isPending ? 0.15 : 1,
          'line-color': isCurrent ? '#facc15' : isVisited ? '#22c55e' : '#64748b',
          width:        isCurrent ? 6 : isVisited ? 4 : 2,
        })
      }
    })
  }, [traceConfig])

  // ── Toolbar handlers ────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25)
  }, [])

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8)
  }, [])

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 40)
  }, [])

  const handleLayout = useCallback((key: LayoutKey) => {
    setCurrentLayout(key)
    const cy = cyRef.current
    if (!cy) return
    // Full layout reset always clears the dragged-nodes record
    draggedNodesRef.current = new Set()
    if (key === 'hierarchical') {
      applyLayeredPositions(false)
    } else {
      cy.nodes().unlock()
      const layout = cy.layout(LAYOUTS[key])
      layout.on('layoutstop', () => {
        cy.nodes('[deviceType = "controller"]').lock()
        cy.fit(undefined, 40)
      })
      layout.run()
    }
  }, [applyLayeredPositions])

  const handleToggleLabels = useCallback(() => {
    setShowLabels((prev) => {
      const next = !prev
      cyRef.current?.style()
        .selector('node')
        .style('label', next ? 'data(label)' : '')
        .update()
      return next
    })
  }, [])

  // ── Live edge re-styling when link utilization changes ─────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    links.forEach((link) => {
      const edge = cy.getElementById(link.id)
      if (edge.length) {
        edge.style({
          'line-color': link.isUp ? utilizationColor(link.utilizationPct) : '#475569',
          'width': Math.max(1, Math.min(8, 1 + (link.utilizationPct / 100) * 7)),
          'line-style': link.isUp ? 'solid' : 'dashed',
          'opacity': link.isUp ? 0.85 : 0.35,
        })
      }
    })
  }, [links])

  // ── Highlight nodes + links for selected flow / slice / SFC chain ──────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const hasNodeHL = highlightDeviceIds && highlightDeviceIds.length > 0
    const hasLinkHL = highlightLinkIds && highlightLinkIds.length > 0

    if (!hasNodeHL && !hasLinkHL) {
      cy.nodes().style({ 'opacity': 1, 'border-width': 2, 'border-color': '#1e293b' })
      cy.nodes('.controller').style({ 'border-color': '#7c3aed', 'border-width': 3 })
      cy.edges().style({ 'opacity': 0.85, 'line-color': undefined })
      return
    }

    // Nodes
    cy.nodes().forEach((node) => {
      const isHL = hasNodeHL && highlightDeviceIds!.includes(node.id())
      node.style({
        'opacity': isHL ? 1 : 0.15,
        'border-width': isHL ? 4 : 2,
        'border-color': isHL ? highlightColor : '#1e293b',
      })
    })

    // Edges
    cy.edges().forEach((edge) => {
      const isHL = hasLinkHL && highlightLinkIds!.includes(edge.id())
      edge.style({
        'opacity': isHL ? 1 : 0.08,
        'line-color': isHL ? highlightColor : '#475569',
        'width': isHL ? 5 : 1,
      })
    })
  }, [highlightDeviceIds, highlightLinkIds, highlightColor])

  // ── Cytoscape event wiring ──────────────────────────────────────────────────
  const handleCyReady = useCallback((cy: Cytoscape.Core) => {
    cyRef.current = cy
    // Each time Cytoscape mounts (or re-mounts), reset the layout gate
    // so the ResizeObserver can fire the layout once the container is sized.
    layoutDoneRef.current = false
    // Attempt layout immediately if container already has dimensions
    const container = containerRef.current
    if (container) {
      const { width, height } = container.getBoundingClientRect()
      if (height > 0) setContainerH(height)
      if (width > 0 && height > 0) {
        layoutDoneRef.current = true
        applyLayeredPositions()
      }
    }

    // Node click → select + tooltip; also fires path builder callback
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const device: Device = node.data('device')
      if (pathBuilderMode) {
        onPathNodeClick?.(node.id(), node.data('deviceType'))
      }
      const sel: SelectedElement = { type: 'device', id: device.id }
      setSelectedElement(sel)
      onSelect?.(sel)
    })

    // Edge click
    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target
      const link: Link = edge.data('link')
      const sel: SelectedElement = { type: 'link', id: link.id }
      setSelectedElement(sel)
      onSelect?.(sel)
    })

    // Background click → deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedElement({ type: null, id: null })
        onSelect?.({ type: null, id: null })
        setTooltip(null)
      }
    })

    // Hover tooltip + path builder cursor
    cy.on('mouseover', 'node', (evt) => {
      if (pathBuilderMode) {
        evt.target.style({ 'cursor': 'crosshair' })
      }
      const node = evt.target
      const device: Device = node.data('device')
      const pos = node.renderedPosition()
      setTooltip({
        x: pos.x + 20,
        y: pos.y - 10,
        content: <DeviceTooltip device={device} />,
      })
    })

    cy.on('mouseover', 'edge', (evt) => {
      const edge = evt.target
      const link: Link = edge.data('link')
      const mp = evt.renderedPosition
      setTooltip({
        x: mp.x + 10,
        y: mp.y - 10,
        content: <LinkTooltip link={link} />,
      })
    })

    cy.on('mouseout', 'node, edge', () => setTooltip(null))
    cy.on('drag', 'node', () => setTooltip(null))
    // Record manually-dragged nodes so applyLayeredPositions skips them
    cy.on('dragfree', 'node', (evt) => {
      draggedNodesRef.current.add(evt.target.id())
    })
    cy.on('zoom pan', () => setTooltip(null))
  }, [setSelectedElement, onSelect, pathBuilderMode, onPathNodeClick])

  return (
    <div
      ref={containerRef}
      className={clsx('absolute inset-0 topology-canvas', className)}
    >
      <CytoscapeComponent
        elements={elements}
        stylesheet={cyStylesheet}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        cy={handleCyReady}
        // Disable automatic re-layout on every elements change –
        // we manage layout explicitly to avoid jarring redraws
        autoungrabify={false}
        userZoomingEnabled={true}
        userPanningEnabled={true}
        boxSelectionEnabled={false}
        autounselectify={false}
      />

      <Toolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onLayout={handleLayout}
        onToggleLabels={handleToggleLabels}
        showLabels={showLabels}
        currentLayout={currentLayout}
      />

      <Legend />

      <SeparatorLines containerH={containerH} />

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 glass-card p-3 shadow-xl pointer-events-none animate-fade-in"
          style={{ left: tooltip.x, top: tooltip.y, maxWidth: 260 }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
})

NetworkTopologyGraph.displayName = 'NetworkTopologyGraph'
