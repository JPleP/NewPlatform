import { ArrowRight, X, Zap, RotateCcw } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { useFlowStore } from '@/stores/flowStore'
import { useSliceStore } from '@/stores/sliceStore'
import { colorClasses } from './SliceBar'
import type { FlowRule, SliceColor } from '@/types'
import { clsx } from 'clsx'
import { addFlow as pushFlowToOnos } from '@/services/onosApi'
import { PathState, PathBuilderData } from '@/stores/pathStore'


// Function which either creates a path through the required Hops or returns null if impossible
interface BuildPathInput {
  srcId?: string
  dstId?: string
  requiredHops?: string[]
}

export const BuildPath = ({
  srcId,
  dstId,
  requiredHops,
}: BuildPathInput): PathBuilderData | null => {
  const devices = useNetworkStore(s => s.devices)
  const links = useNetworkStore(s => s.links)

  const findPath = (from: string, to: string): string[] | null => {
    const adj: Record<string, string[]> = {}

    links.forEach(link => {
      adj[link.sourceDeviceId] ??= []
      adj[link.targetDeviceId] ??= []

      adj[link.sourceDeviceId].push(link.targetDeviceId)
      adj[link.targetDeviceId].push(link.sourceDeviceId)
    })

    const queue: string[][] = [[from]]
    const visited = new Set([from])

    while (queue.length > 0) {
      const path = queue.shift()!
      const current = path[path.length - 1]

      if (current === to) {
        return path
      }

      for (const next of adj[current] ?? []) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push([...path, next])
        }
      }
    }

    return null
  }

  const resolvePath = (): string[] | null => {
    const checkpoints = [
      srcId,
      ...requiredHops,
      dstId,
    ]

    const resolved: string[] = []

    for (let i = 0; i < checkpoints.length - 1; i++) {
      const segment = findPath(
        checkpoints[i],
        checkpoints[i + 1]
      )

      if (!segment) {
        return null
      }

      resolved.push(
        ...(i === 0 ? segment : segment.slice(1))
      )
    }

    return resolved
  }

  const hops = resolvePath()

  if (!hops) {
    return null
  }

  const now = Date.now()

  const newPath: PathBuilderData = {
    id: crypto.randomUUID(),

    srcId,
    dstId,

    selectedSliceId: null,

    hops,
    requiredHops,

    links: hops
      .map((deviceId, index) => {
        const next = hops[index + 1]
        if (!next) return undefined

        return links.find(
          l =>
            (l.sourceDeviceId === deviceId &&
              l.targetDeviceId === next) ||
            (l.sourceDeviceId === next &&
              l.targetDeviceId === deviceId)
        )?.id
      })
      .filter((id): id is string => Boolean(id)),

    name: `Path ${srcId}-${dstId}`,

    state: "computed",

    flowIds: [],

    createdAt: now,
    updatedAt: now,
  }

  return newPath
}