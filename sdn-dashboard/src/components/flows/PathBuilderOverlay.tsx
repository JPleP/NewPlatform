import { useState, useCallback, useMemo } from 'react'
import { Zap, Eye, X, GripVertical } from 'lucide-react'
import { clsx } from 'clsx'
import { NetworkTopologyGraph } from '@/components/topology/NetworkTopologyGraph'
import { BuildPath } from '@/components/flows/BuildPath'
// Assuming these are available in your project structure
import { useSliceStore } from '@/stores/sliceStore' 

interface PathBuilderOverlayProps { 
  isOpen: boolean
  onClose: () => void
  onConfirm: (path: any) => void
  // Optional: allow pre-selecting a slice context if needed
  defaultSliceId?: string | null
}

export const PathBuilderOverlay = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  defaultSliceId = null
}: PathBuilderOverlayProps) => {
  
  // State for path building logic
  const [pathSrc, setPathSrc] = useState<string | null>(null)
  const [pathDst, setPathDst] = useState<string | null>(null)
  const [requiredHops, setRequiredHops] = useState<string[]>([])
  // Keep track of slice context for graph styling if needed
  const [localSliceId, setLocalSliceId] = useState<string | null>(defaultSliceId)

  // Get slice store for context if needed by BuildPath or Graph
  const { getSliceForFlow } = useSliceStore(); // Example usage

  // Call the hook to get the path object based on selections
  const path = BuildPath({
    srcId: pathSrc,
    dstId: pathDst,
    requiredHops,
  })

  // --- Interaction Handlers (Copied and adapted from original) ---

  const handlePathNodeClick = useCallback(
    (id: string, deviceType: string) => {
      // Source must be first host
      if (!pathSrc) {
        if (deviceType !== 'host') return
        setPathSrc(id)
        return
      }

      // Destination must be second host
      if (!pathDst) {
        if (deviceType !== 'host' || id === pathSrc) return
        setPathDst(id)
        return
      }

      // Prevent selecting src/dst as required hops
      if (id === pathSrc || id === pathDst) return

      // Add to required hops if not already present
      setRequiredHops(prev => {
        if (prev.includes(id)) return prev
        return [...prev, id]
      })
    },
    [pathSrc, pathDst]
  )

  const resetPath = () => {
    setPathSrc(null)
    setPathDst(null)
    setRequiredHops([])
  }

const moveRequiredHop = (index: number, direction: 'up' | 'down') => {
  setRequiredHops(prev => {
    // 1. Create a shallow copy so we don't mutate the original
    const next = [...prev];
    
    // 2. Calculate target index
    const target = direction === 'up' ? index - 1 : index + 1;
    
    // 3. Boundary checks
    if (target < 0 || target >= next.length) return prev;
    
    // 4. Swap using destructuring assignment
    [next[index], next[target]] = [next[target], next[index]];
    
    // 5. Return the new array to trigger a re-render
    return next;
  });
};

  // --- Computed Data for Graph ---

  const highlightDeviceIds = useMemo(() => [
    ...(pathSrc ? [pathSrc] : []),
    ...requiredHops,
    ...(pathDst ? [pathDst] : []),
  ], [pathSrc, pathDst, requiredHops])

  const highlightLinkIds = useMemo(() => path?.links ?? [], [path])

  // --- Render Helpers (Adapted from original) ---

  const renderPathDetails = () => {
    if (!path) {
      return (
        <div className="text-xs text-slate-500 p-4 italic">
          Select source host, switches (optional), and destination host on the map.
        </div>
      )
    }

    return (
      <div className="space-y-4 p-4">
        {/* Header and State */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">Path Details</span>
          <span className={clsx(
            'text-xs px-2 py-0.5 rounded font-medium uppercase',
            path.state === 'ACTIVE' ? 'bg-green-950 text-green-300' : 'bg-slate-800 text-slate-400'
          )}>
            {path.state}
          </span>
        </div>

        {/* Path Name/ID */}
        <div className="rounded bg-slate-900 border border-slate-700 p-3 space-y-1">
          <div className="text-xs text-slate-400">Name</div>
          <div className="text-sm text-slate-100 font-mono">{path.name ?? path.id ?? 'Unnamed Path'}</div>
        </div>

        {/* Calculated Route (Hops) */}
        <div className="space-y-2">
          <div className="text-xs text-slate-400">Calculated Route ({path.hops.length} hops)</div>
          <div className="flex flex-col gap-1.5 text-xs text-slate-200 max-h-[250px] overflow-y-auto pr-2">
            {path.hops.map((hopNode, index) => (
              <div
                key={`${hopNode}-${index}`}
                className="flex items-center gap-2 rounded bg-slate-900 border border-slate-800 px-3 py-2 shadow-inner"
              >
                <span className="w-6 text-center font-mono text-slate-500 border-r border-slate-700 pr-2">
                  {index + 1}
                </span>
                <span className="font-mono text-sky-300 flex-1 truncate" title={hopNode}>
                  {hopNode}
                </span>
                {index === 0 && <span className="text-[10px] text-green-400 font-medium uppercase tracking-wider">Src</span>}
                {index === path.hops.length - 1 && <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">Dst</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Required Hops (Waypoints) and Reordering */}
        {requiredHops.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs text-slate-400">Ordered Waypoints ({requiredHops.length})</div>
                <div className="flex flex-col gap-1.5">
                {requiredHops.map((hop, index) => (
                    /* IMPORTANT: Use 'hop' as the key, not 'index' */
                    <div
                    key={hop} 
                    className="group flex items-center gap-2 rounded bg-slate-800 px-3 py-1.5"
                    >
                    <GripVertical className="w-4 h-4 text-slate-600" />
                    <span className="font-mono text-slate-300 flex-1 text-[13px] truncate" title={hop}>
                        {hop}
                    </span>
                    <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            moveRequiredHop(index, "up");
                        }}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-20 text-slate-400"
                        title="Move up"
                        >
                        ▲
                        </button>
                        <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            moveRequiredHop(index, "down");
                        }}
                        disabled={index === requiredHops.length - 1}
                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-20 text-slate-400"
                        title="Move down"
                        >
                        ▼
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            </div>
            )}

        {/* Confirm Button */}
        <div className="pt-4 mt-auto border-t border-slate-800">
          <button 
            onClick={() => onConfirm(path)}
            className="w-full bg-sdn-600 hover:bg-sdn-500 text-white py-3 rounded-md text-sm font-semibold shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            <Zap size={16}/>
            Use Selected Path
          </button>
        </div>
      </div>
    )
  }

  // --- Main Render ---

  if (!isOpen) return null

  return (
    // Use a high z-index portal/fixed overlay
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-950 w-[95vw] h-[95vh] max-w-[1800px] max-h-[950px] rounded-xl border border-slate-700/50 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
             <Zap className="w-5 h-5 text-sdn-400" />
            <h2 className="text-lg font-bold text-slate-100">SDN Path Builder</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded ml-2">
              {localSliceId ? `Slice Context: ${localSliceId}` : 'Global View'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Status Message in Header */}
             <span className="text-xs text-sdn-400 animate-pulse font-medium">
              {!pathSrc
                ? 'Step 1: Click source host on map…'
                : !pathDst
                  ? 'Step 2: Click optional switches, then destination host…'
                  : 'Path calculation complete.'}
            </span>
            <button
              onClick={resetPath}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reset Selections
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors" title="Close Overlay">
              <X size={22}/>
            </button>
          </div>
        </div>

        {/* Main Content Area: Topology (Left) + Control Panel (Right) */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          
          {/* LEFT: Topology Graph */}
          <div className="w-[65%] lg:w-[70%] xl:w-[75%] border-r border-slate-700 relative bg-slate-950/50">
            <NetworkTopologyGraph
              highlightDeviceIds={highlightDeviceIds}
              highlightLinkIds={highlightLinkIds}
              pathBuilderMode={true}
              onPathNodeClick={handlePathNodeClick}
              // Pass sliceId if needed by the graph component for styling/filtering
              sliceId={localSliceId} 
            />
            
            {/* Legend/Instructions overlayed on graph */}
            <div className="absolute bottom-4 left-4 bg-slate-900/80 p-3 rounded border border-slate-700 shadow-lg backdrop-blur-sm text-xs text-slate-300 space-y-1.5 pointer-events-none">
                <div className='font-semibold text-slate-100'>Path Building Legend</div>
                <div className='flex items-center gap-2'><div className='w-3 h-3 rounded-full bg-green-500 border-2 border-white'></div> Source Host (First click)</div>
                <div className='flex items-center gap-2'><div className='w-3 h-3 rounded-full bg-amber-500 border-2 border-white'></div> Destination Host (Second click)</div>
                <div className='flex items-center gap-2'><div className='w-3 h-3 rounded-full bg-sky-400 border-2 border-white'></div> Required Waypoint (Intermediate clicks)</div>
                <div className='flex items-center gap-2'><div className='w-3 h-6 border-2 border-sky-500 bg-transparent'></div> Selected Path Link</div>
            </div>
          </div>

          {/* RIGHT: Control Panel & Path Details */}
          <div className="w-[35%] lg:w-[30%] xl:w-[25%] flex flex-col bg-slate-950 overflow-hidden">
            {renderPathDetails()}
          </div>

        </div>
      </div>
    </div>
  )
}

// Add this basic fade-in animation to your global CSS or Tailwind config
// @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
// .animate-fade-in { animation: fade-in 0.2s ease-out; }