import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load .env / .env.local so VITE_ONOS_HOST etc. are available at config time
  const env = loadEnv(mode, process.cwd(), '')

  const onosTarget = env.VITE_ONOS_HOST
    ? `http://${env.VITE_ONOS_HOST}:${env.VITE_ONOS_PORT ?? '8181'}`
    : 'http://localhost:8181'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        // Proxy all /onos/* calls → ONOS controller (avoids CORS in dev)
        // Path is kept as-is: /onos/v1/devices → http://<ONOS>:8181/onos/v1/devices
        '/onos': {
          target: onosTarget,
          changeOrigin: true,
          // No rewrite — ONOS REST API lives at /onos/v1/... on the controller
        },
        // Proxy WebSocket metrics backend (future: ONOS Northbound WS)
        '/ws': {
          target: onosTarget.replace('http', 'ws'),
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor:    ['react', 'react-dom', 'react-router-dom'],
            cytoscape: ['cytoscape', 'react-cytoscapejs'],
            charts:    ['recharts'],
            ui:        ['lucide-react', 'clsx', 'tailwind-merge'],
          },
        },
      },
    },
  }
})
