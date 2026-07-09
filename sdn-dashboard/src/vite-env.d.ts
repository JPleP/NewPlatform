/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE: string
  readonly VITE_ONOS_HOST: string
  readonly VITE_ONOS_PORT: string
  readonly VITE_ONOS_USER: string
  readonly VITE_ONOS_PASSWORD: string
  readonly VITE_TOPOLOGY_POLL_MS: string
  readonly VITE_FLOWS_POLL_MS: string
  readonly VITE_METRICS_POLL_MS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
