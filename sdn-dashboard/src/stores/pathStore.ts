import { create } from 'zustand'

export type PathState =
  | 'draft'
  | 'computed'
  | 'installed'
  | 'failed'
  | 'removed'

export interface PathBuilderData {
  id: string

  srcId: string
  dstId: string

  selectedSliceId: string | null

  // Ordered devices in the path
  hops: string[]

  // Nodes that must appear in the resolved path
  requiredHops: string[]


  // Optional ONOS topology link identifiers
  links?: string[]

  // Path metadata
  name?: string
  state: PathState

  // ONOS references
  flowIds?: string[]

  createdAt: number
  updatedAt: number
}

interface PathStateStore {
  paths: PathBuilderProps[]

  isLoading: boolean
  error: string | null

  selectedPathId: string | null

  // CRUD Actions
  setPaths: (paths: PathBuilderProps[]) => void
  addPath: (path: PathBuilderProps) => void
  updatePath: (path: PathBuilderProps) => void
  removePath: (id: string) => void

  // Selection
  setSelectedPath: (id: string | null) => void

  // Status
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Selectors
  getSelectedPath: () => PathBuilderProps | undefined
  getPathsBetween: (
    srcId: string,
    dstId: string,
  ) => PathBuilderProps[]
  getPathsForSlice: (
    sliceId: string,
  ) => PathBuilderProps[]
}

export const usePathStore = create<PathStateStore>()((set, get) => ({
  paths: [],

  isLoading: false,
  error: null,

  selectedPathId: null,

  setPaths: (paths) => set({ paths }),

  addPath: (path) =>
    set((state) => ({
      paths: [path, ...state.paths],
    })),

  updatePath: (path) =>
    set((state) => ({
      paths: state.paths.map((p) =>
        p.id === path.id ? path : p,
      ),
    })),

  removePath: (id) =>
    set((state) => ({
      paths: state.paths.filter((p) => p.id !== id),
      selectedPathId:
        state.selectedPathId === id
          ? null
          : state.selectedPathId,
    })),

  setSelectedPath: (id) =>
    set({ selectedPathId: id }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setError: (error) =>
    set({ error }),

  getSelectedPath: () => {
    const id = get().selectedPathId

    return id
      ? get().paths.find((p) => p.id === id)
      : undefined
  },

  getPathsBetween: (srcId, dstId) =>
    get().paths.filter(
      (p) =>
        p.srcId === srcId &&
        p.dstId === dstId,
    ),

  getPathsForSlice: (sliceId) =>
    get().paths.filter(
      (p) =>
        p.selectedSliceId === sliceId,
    ),
}))