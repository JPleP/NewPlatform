
/**
 * Flask RTT agent client.
 *
 * The browser can't reach host PCs' data-plane IPs directly (they live on
 * an internal subnet the client machine has no route to). The ONOS PC does
 * have a route there, so requests go through a small relay running
 * alongside ONOS (see relay_agent.py) instead of hitting the agent host
 * directly — no changes to shared routing/forwarding required.
 */

import { useSettingsStore } from '@/stores/settingsStore'

const AGENT_PORT = 5005
const RELAY_PORT = 5010

export const fetchRtt = async (agentIp: string, targetIp: string): Promise<number | null> => {
  try {
    const relayHost = useSettingsStore.getState().connection.onosHost
    const res = await fetch(`http://${relayHost}:${RELAY_PORT}/relay/${agentIp}/${AGENT_PORT}/ping/${targetIp}`)
    const data = await res.json()
    return typeof data.rtt_ms === 'number' ? data.rtt_ms : null
  } catch {
    return null
  }
}