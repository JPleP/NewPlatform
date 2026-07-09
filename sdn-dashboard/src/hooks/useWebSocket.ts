import { useEffect, useRef } from 'react'
import { wsService } from '@/services/websocket'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNetworkStore } from '@/stores/networkStore'

/**
 * Manages the WebSocket lifecycle within the React tree.
 * Call once at the app root level.
 */
export const useWebSocketManager = () => {
  const getWsUrl = useSettingsStore((s) => s.getWsUrl)
  const connectionState = useNetworkStore((s) => s.wsConnectionState)
  const connectedRef = useRef(false)

  useEffect(() => {
    const url = getWsUrl()
    if (!connectedRef.current) {
      connectedRef.current = true
      wsService.connect(url)
    }
    return () => {
      wsService.disconnect()
      connectedRef.current = false
    }
    // Only run on mount/unmount – settings changes require manual reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { connectionState, reconnect: () => wsService.connect(getWsUrl()) }
}

/**
 * Reconnect with a new URL (called from Settings page after config change).
 */
export const useReconnect = () => {
  const getWsUrl = useSettingsStore((s) => s.getWsUrl)
  return () => {
    wsService.disconnect()
    setTimeout(() => wsService.connect(getWsUrl()), 500)
  }
}
