import { useState, useRef, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { NetworkTopologyGraph } from '@/components/topology/NetworkTopologyGraph'
import type { NetworkTopologyGraphHandle } from '@/components/topology/NetworkTopologyGraph'
import { DeviceInfoPanel } from '@/components/topology/DeviceInfoPanel'
import { MetricsPanel } from '@/components/metrics/MetricsPanel'
import { PacketTracer } from '@/components/topology/PacketTracer'
import { useNetworkStore } from '@/stores/networkStore'
import type { TraceConfig } from '@/components/topology/NetworkTopologyGraph'
import { Package, Download, Image, FileJson, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

// ── Export dropdown ───────────────────────────────────────────────────────────

interface ExportDropdownProps {
  onExportPng: () => void
  onExportJson: () => void
}

const ExportDropdown = ({ onExportPng, onExportJson }: ExportDropdownProps) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/90 border border-slate-600/50 text-slate-300 hover:text-white hover:border-slate-400 transition-all shadow"
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className={clsx('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Click-outside backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 glass-card py-1 w-40 shadow-xl">
            <button
              onClick={() => { onExportPng(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <Image className="w-3.5 h-3.5 text-sky-400" />
              Export as PNG
            </button>
            <button
              onClick={() => { onExportJson(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <FileJson className="w-3.5 h-3.5 text-violet-400" />
              Export as JSON
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const TopologyPage = () => {
  const selectedElement = useNetworkStore((s) => s.selectedElement)
  const devices = useNetworkStore((s) => s.devices)
  const links   = useNetworkStore((s) => s.links)

  const [tracerOpen, setTracerOpen]       = useState(false)
  const [traceConfig, setTraceConfig]     = useState<TraceConfig | null>(null)

  // Ref to the topology graph, used for PNG export
  const graphRef = useRef<NetworkTopologyGraphHandle>(null)

  const handleOpenTracer = () => {
    setTracerOpen(true)
    setTraceConfig(null)
  }

  const handleCloseTracer = () => {
    setTracerOpen(false)
    setTraceConfig(null)
  }

  const handleExportPng = useCallback(() => {
    const blob = graphRef.current?.exportPng()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `topology-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [])

  const handleExportJson = useCallback(() => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      deviceCount: devices.length,
      linkCount: links.length,
      devices: devices.map(d => ({
        id: d.id,
        label: d.label,
        type: d.type,
        status: d.status,
        ipAddress: d.ipAddress,
        onosId: d.onosId,
        portCount: d.portCount,
        ofVersion: d.ofVersion,
        lastSeen: d.lastSeen,
      })),
      links: links.map(l => ({
        id: l.id,
        source: l.sourceDeviceId,
        sourcePort: l.sourcePort,
        target: l.targetDeviceId,
        targetPort: l.targetPort,
        isUp: l.isUp,
        utilizationPct: l.utilizationPct,
        capacityMbps: l.capacityMbps,
        throughputMbps: l.throughputMbps,
        latencyMs: l.latencyMs,
        packetLossPct: l.packetLossPct,
      })),
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `topology-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [devices, links])

  // Right panel: tracer takes priority over device info when open
  const showRightPanel = tracerOpen || !!selectedElement.type

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        title="Network Topology"
        subtitle={`${devices.length} devices · ${links.length} links`}
      />

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Topology canvas */}
        <div className="flex-1 relative min-h-0">
          {/* Top-right: Export button */}
          <div className="absolute top-4 left-4 z-20">
            <ExportDropdown
              onExportPng={handleExportPng}
              onExportJson={handleExportJson}
            />
          </div>

          {/* Packet Tracer toggle button */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={tracerOpen ? handleCloseTracer : handleOpenTracer}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg border transition-all',
                tracerOpen
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/30'
                  : 'bg-slate-800/90 border-slate-600/50 text-slate-300 hover:text-white hover:border-slate-400',
              )}
            >
              <Package className="w-4 h-4" />
              {tracerOpen ? 'Close Tracer' : 'Packet Tracer'}
            </button>
          </div>

          <NetworkTopologyGraph
            ref={graphRef}
            traceConfig={traceConfig}
          />
        </div>

        {/* Right panel */}
        {showRightPanel && (
          <div className="w-80 bg-slate-900/90 border-l border-slate-700/50 flex flex-col overflow-hidden">
            {tracerOpen ? (
              <PacketTracer
                onTraceChange={setTraceConfig}
                onClose={handleCloseTracer}
              />
            ) : (
              <div className="overflow-y-auto flex-1">
                <div className="p-4">
                  <DeviceInfoPanel />
                </div>
                <div className="px-4 pb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Live Metrics
                  </p>
                  <MetricsPanel />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
