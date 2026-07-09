# SDN Dashboard — Extension Task Menu

The Dashboard is a working but intentionally incomplete platform. Your task is to extend it by implementing at least one new feature that connects to and demonstrates a real SDN capability on the physical testbed.

> **These tasks are reference suggestions, not a fixed list.** You may combine ideas, scope them differently, or propose something new — as long as it involves real interaction with the ONOS controller, OVS switches, or Raspberry Pi hosts. Purely cosmetic or UI-only changes do not count.
>
> **AI tools are allowed and encouraged.** Use Claude, ChatGPT, Copilot, or any other tool to help you understand APIs, write boilerplate, or debug TypeScript. What matters is that you can explain what your feature does and what SDN concept it demonstrates.

**Tech stack:** React · TypeScript · Zustand · Cytoscape.js · Vite
**Key files to read first:** `src/services/onosApi.ts` · `src/hooks/useOnosPolling.ts`

---

## Getting Started

```bash
cd sdn-dashboard
npm install
npm run dev        # http://localhost:3000 — Demo mode (simulated data)
```

Build and test your feature in Demo mode first.
Then switch to real hardware: set `VITE_DEMO_MODE=false` in `.env.local` and point `VITE_ONOS_HOST` to your ONOS controller (see `docs/ONBOARDING.md`).

---

## What "Connected to Real Hardware" Means for Each Task

Every task below requires at least one of the following to work end-to-end:

| Evidence | Example |
|----------|---------|
| ONOS REST API responds with real data | `curl -u onos:rocks http://<IP>:8181/onos/v1/...` shows real switch info |
| OVS switch reflects the change | `sudo ovs-ofctl dump-flows br0` shows the rule you deployed |
| RPi host behaviour changes | `ping` succeeds or fails based on your flow rule |
| Physical traffic is visible | `iperf3` output matches what the Dashboard shows |

---

## Difficulty Guide

| Rating | Meaning |
|--------|---------|
| ⭐ | Small, focused change — a few dozen lines across 1–2 files |
| ⭐⭐ | Requires understanding the data path between files; may need a small server-side component on the RPi |

---

## Area A — Real-Time Metric Collection

> The Dashboard currently shows **average** bandwidth computed from port uptime, and has no latency or packet loss data. These tasks make the metrics page reflect what is actually happening on the physical links.

---

### A1 — Instantaneous Throughput (Byte-Delta Method)
**Difficulty:** ⭐⭐ · **File:** `src/hooks/useOnosPolling.ts`

**The problem:**
The current formula is `throughput = totalBytes × 8 ÷ portUptimeSeconds`. This gives a long-running average that barely moves even when you start a 200 Mbps `iperf3` test.

**What to build:**
Between each poll, remember the previous byte count and compute the delta:

```
throughput (Mbps) = (bytes_now − bytes_prev) × 8 ÷ 1_000_000 ÷ poll_interval_sec
```

Store the previous snapshot in a `useRef` map so it persists between renders without causing re-renders.

```typescript
// In useOnosPolling.ts — add this ref near the top of the hook:
const prevBytesRef = useRef<Map<string, number>>(new Map())

// In pollMetrics(), locate the links.forEach() loop.
// srcStats is the port stat entry for the link's source port.
// Replace the existing tputMbps line with the delta calculation:
const key      = `${link.sourceDeviceId}:${link.sourcePort}`
const prevBytes = prevBytesRef.current.get(key) ?? srcStats.txBytes
const deltaBytes = Math.max(0, srcStats.txBytes - prevBytes)  // guard against counter reset
const tputMbps  = (deltaBytes * 8) / 1e6 / (METRICS_MS / 1000)
prevBytesRef.current.set(key, srcStats.txBytes)
```

**How to verify on real hardware:**
1. Run `iperf3 -c 10.0.0.2 -b 80M -t 60` between two RPi hosts
2. The Dashboard link between those switches should show ≈ 80 Mbps within 2–3 poll cycles
3. When `iperf3` stops, the value drops back to near zero within one poll cycle

---

### A2 — Packet Loss and Port Error Rate
**Difficulty:** ⭐ · **Files:** `src/services/onosApi.ts` · `src/components/topology/DeviceInfoPanel.tsx`

**The problem:**
ONOS `/statistics/ports` returns `rxDropped`, `txDropped`, `rxErrors`, and `txErrors` fields. The Dashboard ignores them — the link panel always shows 0% packet loss.

**What to build:**
1. Extend `PortStatSnapshot` in `onosApi.ts` to include the drop/error fields
2. Compute a drop rate: `(rxDropped + txDropped) / max(rxPackets + txPackets, 1) × 100`
3. Display a **Drop Rate** badge in the Device Info Panel (the right panel when you click a switch or a link)
4. Color it: grey = 0%, amber = 0.1–1%, red = > 1%

```typescript
// Extend the interface:
export interface PortStatSnapshot {
  // existing fields...
  rxDropped:  number
  txDropped:  number
  rxErrors:   number
  txErrors:   number
}
```

**How to verify on real hardware:**
```bash
# Ensure iproute2 is installed on the RPi:
sudo apt install -y iproute2

# Introduce 5% artificial packet loss on the data interface:
sudo tc qdisc add dev eth0 root netem loss 5%

# The Dashboard should now show ~5% drop rate on that host's access link.
# Note: OVS switches themselves almost never drop packets, so this metric
# is only meaningful on host access links (RPi eth0 → switch port).
# Remove the loss emulation afterwards:
sudo tc qdisc del dev eth0 root
```

---

### A3 — RTT Latency Probe via RPi Agent
**Difficulty:** ⭐⭐ · **Files:** New `src/services/pingAgent.ts` · `src/components/topology/DeviceInfoPanel.tsx`

**The problem:**
The ONOS REST API does not expose measured link latency. The only reliable way to get RTT is to measure it at the endpoints.

**What to build:**
Deploy a small HTTP agent on one RPi (≈ 15 lines of Python). The Dashboard polls it and displays measured RTT in the link detail panel.

**Step 1 — Agent on the RPi** (`/home/pi/ping_agent.py`):

```python
from flask import Flask, jsonify
import subprocess, re

app = Flask(__name__)

@app.route('/ping/<target>')
def ping(target):
    out = subprocess.run(
        ['ping', '-c', '5', '-W', '1', target],
        capture_output=True, text=True
    ).stdout
    m = re.search(r'rtt min/avg/max.*?= [\d.]+/([\d.]+)/', out)
    return jsonify({'rtt_ms': float(m.group(1)) if m else None, 'target': target})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

```bash
# Install and run on RPi (use port 5001 to avoid conflict with B1 agent on 5000):
pip3 install flask
python3 ping_agent.py &   # starts on port 5001 — change app.run() below
```

> **Port note:** If you also implement B1, run the ping agent on **port 5001** and the traffic agent on **port 5000** to avoid conflicts. Change `app.run(host='0.0.0.0', port=5001)` in `ping_agent.py`.

**Step 2 — Poll from the Dashboard** (`src/services/pingAgent.ts`):

```typescript
export const fetchRtt = async (agentIp: string, targetIp: string): Promise<number | null> => {
  try {
    const res  = await fetch(`http://${agentIp}:5001/ping/${targetIp}`)
    const data = await res.json()
    return data.rtt_ms
  } catch {
    return null
  }
}
```

**Step 3 — Wire it into the Dashboard:**

Store agent IPs by host ID in `settingsStore`. Add a `rpiAgents` field:
```typescript
// In settingsStore.ts, extend the settings state:
rpiAgents: Record<string, string>  // { hostDeviceId → agentIp }
```
Then in a new `useEffect` inside `useOnosPolling`, poll RTT for each configured agent pair every 5 s and write the result into `metricsStore` (or directly into the link via `updateLink` on `networkStore`). Display the RTT value in `DeviceInfoPanel` when a host-access link is selected.

**How to verify:**
- Dashboard shows "RTT: 0.4 ms" for the H1–H2 link
- Value matches `ping 10.0.0.2` output run manually on H1
- Artificially limit bandwidth with `tc` — RTT should increase and Dashboard should reflect it

---

## Area B — Traffic Generation from the Dashboard

> The goal of this area is to enrich the platform so that traffic can be generated directly from the Dashboard — without SSH-ing into individual machines. This makes the platform self-contained for experiments and demos.

---

### B1 — Traffic Generator Panel
**Difficulty:** ⭐⭐
**Files:** `src/services/rpiAgent.ts` (new) · `src/stores/trafficStore.ts` (new) · `src/pages/ExperimentsPage.tsx`

**What to build:**

A control panel on the Experiments page that lets you select source/destination hosts, choose a traffic type, set parameters including L4 ports, and start real traffic generation on the physical RPi hosts. The panel shows live results while the test is running.

**UI layout:**

```
┌─ Traffic Generator ─────────────────────────────────────────┐
│  Source         Destination      Traffic Type               │
│  [Pi H1 ▼] →→  [Pi H2   ▼]      [● TCP Bulk             ] │
│  10.0.0.1       10.0.0.2         [  UDP Constant (CBR)   ] │
│                                  [  UDP Burst             ] │
│  Src Port       Dst Port         [  ICMP Ping             ] │
│  [random]       [5201  ]                                    │
│                                                             │
│  Bandwidth      Duration         Parallel Streams           │
│  [100   ] Mbps  [30   ] s        [1      ]                  │
│                                                             │
│  [▶ Start]                                                  │
└─────────────────────────────────────────────────────────────┘

Running: Pi H1 → Pi H2  UDP CBR  100 Mbps  ████████░░  18s/30s
Throughput: 97.3 Mbps    Jitter: 0.12 ms    Loss: 0.0%   [■ Stop]
```

**Why destination port matters:**
Flow rules in ONOS can match on L4 port (`tcp_dst`, `udp_dst`). By generating traffic to a specific port, students can verify whether a port-matching flow rule is installed correctly — e.g., generate traffic to port 80, install a rule matching `tcp_dst=80`, confirm the traffic is forwarded/dropped as intended.

**Traffic types and their use:**

| Type | Underlying command | Useful for |
|------|--------------------|------------|
| TCP Bulk | `iperf3 -c <dst> -p <port> -b <bw>M -t <dur>` | Verifying flow rules, measuring max throughput |
| UDP Constant (CBR) | `iperf3 -c -u -p <port> -b <bw>M -t <dur>` | Simulating video stream, testing QoS / METER rules |
| UDP Burst | Alternate high/idle `iperf3 -u` runs (implement as two back-to-back calls or a loop) | Testing buffer behaviour and bursty traffic handling |
| ICMP Ping | `ping -c <n> <dst>` | Quick connectivity check after installing flow rules |

**Source host dropdown** reads directly from `networkStore` — only hosts with a configured agent IP appear. Agent IPs are configured in the Settings page.

**Step 1 — RPi agent** (deploy on every RPi, `python3 agent.py`):

```python
from flask import Flask, jsonify, request
import subprocess, json

app = Flask(__name__)
current_proc = None

@app.route('/start', methods=['POST'])
def start():
    global current_proc
    d = request.json   # {target, dst_port, bw, duration, type, streams}
    if d['type'] == 'ping':
        cmd = ['ping', '-c', str(d['duration']), d['target']]
    else:
        cmd = ['iperf3', '-c', d['target'],
               '-p', str(d['dst_port']),
               '-b', f"{d['bw']}M",
               '-t', str(d['duration']),
               '-P', str(d.get('streams', 1)),
               '--json']
        if 'udp' in d['type']:
            cmd.append('-u')
    current_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    return jsonify({'status': 'started'})

@app.route('/stop', methods=['POST'])
def stop():
    if current_proc:
        current_proc.terminate()
    return jsonify({'status': 'stopped'})

@app.route('/result')
def result():
    if not current_proc or current_proc.poll() is None:
        return jsonify({'done': False})
    out, _ = current_proc.communicate()
    try:
        data = json.loads(out)
        end  = data['end']
        return jsonify({
            'done': True,
            'throughput_mbps': end['sum_received']['bits_per_second'] / 1e6,
            'retransmits':     end['sum_sent'].get('retransmits', 0),
            'jitter_ms':       end.get('sum', {}).get('jitter_ms', 0),
            'lost_pct':        end.get('sum', {}).get('lost_percent', 0),
        })
    except:
        return jsonify({'done': True, 'error': 'parse failed'})

app.run(host='0.0.0.0', port=5000)
```

```bash
# On each RPi:
pip3 install flask
python3 agent.py &
```

**Step 2 — Dashboard service** (`src/services/rpiAgent.ts`):

```typescript
const BASE = (ip: string) => `http://${ip}:5000`

export const startTraffic = (agentIp: string, params: TrafficParams) =>
  fetch(`${BASE(agentIp)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

export const stopTraffic  = (agentIp: string) =>
  fetch(`${BASE(agentIp)}/stop`, { method: 'POST' })

export const pollResult   = (agentIp: string) =>
  fetch(`${BASE(agentIp)}/result`).then(r => r.json())
```

**Step 3 — Store** (`src/stores/trafficStore.ts`): Create a Zustand store that tracks the active job (source host IP, params, start time, latest result) and a `results` history array. In the UI component, use `setInterval` to call `pollResult(agentIp)` every 2 s while the job is running (`done === false`), update the store with the latest metrics, and clear the interval when `done === true` or the user clicks Stop.

> **Agent IPs:** Add a `rpiAgents: Record<string, string>` field to `settingsStore` (host device ID → agent IP). The source-host dropdown in the UI filters `networkStore.devices` to those that have a configured agent IP, so you can start a test on the right RPi with one click.

**How to verify on real hardware:**

Run the following three tests in order. Each one verifies a different SDN concept using the traffic generator as the measurement tool.

**Test 1 — Baseline connectivity (ICMP Ping)**
1. Select H1 → H2, type = ICMP Ping
2. Click Start → panel shows RTT and 0% loss
3. Go to Flow Rules page, delete the forwarding rule for H1→H2
4. Run Ping again → 100% loss (traffic dropped because no matching rule)
5. Re-install the rule → Ping recovers
> Verifies: flow rule presence directly controls reachability

**Test 2 — Bandwidth limiting with a METER rule (UDP CBR)**
1. Select H1 → H2, type = UDP CBR, bandwidth = 200 Mbps, dst port = 5201
2. Click Start → panel shows ≈ 200 Mbps, Topology link turns red
3. In the Flow Rule Editor, install a METER rule on the same device matching `udp_dst=5201`, limit to 50 Mbps
4. Run the same test again → panel shows ≈ 50 Mbps, link turns green
> Verifies: METER rules enforce bandwidth limits; port-specific matching works

**Test 3 — Path steering (TCP Bulk)**
1. Run TCP Bulk H1 → H3 → observe which links light up on the Topology page (default path via SW1→SW2)
2. Use PathBuilder to install flow rules that route H1→H3 via a different switch (SW1→SW3→SW2)
3. Run the same test again → a different set of links lights up, the original transit link goes dark
> Verifies: PathBuilder flow rules actually redirect traffic at the data plane

---

## Area C — Flow Rule Control

> The Dashboard can read flow rules from ONOS. These tasks close the loop — letting you also create and delete rules that take effect on the real switches.

---

### C1 — Delete a Flow Rule from the Dashboard
**Difficulty:** ⭐ · **File:** `src/pages/FlowsPage.tsx`

**What to build:**
Add a delete (trash) icon to each row in the Flow Rules table. Show a confirmation dialog, then call the existing `deleteFlow()` function and remove the row from the store.

```typescript
import { deleteFlow } from '@/services/onosApi'

const handleDelete = async (flow: FlowRule) => {
  if (!confirm(`Delete rule ${flow.id}?`)) return
  await deleteFlow(flow.deviceId, flow.id)
  useFlowStore.getState().removeFlow(flow.id)
}
```

**How to verify on real hardware:**
```bash
# Before: confirm the rule exists
sudo ovs-ofctl -O OpenFlow13 dump-flows br0 | grep <priority>

# Click Delete in the Dashboard, then:
sudo ovs-ofctl -O OpenFlow13 dump-flows br0 | grep <priority>
# Rule should be gone
```

---

### C2 — Push PathBuilder Flows to ONOS
**Difficulty:** ⭐⭐ · **File:** `src/components/flows/PathBuilder.tsx`

**What to build:**
The PathBuilder's `deployFlow()` function builds one `FlowRule` per switch hop inside a `switchesOnPath.forEach()` loop and saves each to the local store. Connect it to the real ONOS API so rules are also installed on the switches.

> **Naming conflict:** `PathBuilder.tsx` already imports `addFlow` from `useFlowStore`. Use an alias for the API import to avoid a collision:

```typescript
// Add at the top of PathBuilder.tsx (use alias to avoid name conflict):
import { addFlow as pushFlowToOnos } from '@/services/onosApi'
```

Then make `deployFlow` async and call the API after the store update inside the `forEach`:

```typescript
const deployFlow = async () => {               // ← add async
  // ...existing path/slice logic...
  for (const swId of switchesOnPath) {
    // ...existing code that builds `flow` and calls addFlow(flow)...
    addFlow(flow)                               // keep — updates local store
    await pushFlowToOnos(                       // new — pushes to ONOS
      flow.deviceId, flow.priority,
      flow.match, flow.actions,
      true, 0, 'org.onosproject.rest'
    )
    newFlowIds.push(flow.id)
  }
  // ...rest of existing logic...
}
```

**How to verify on real hardware:**
1. Use PathBuilder to select Host H1 → Host H3 (spanning two switches)
2. Click Deploy
3. On each switch in the path: `sudo ovs-ofctl -O OpenFlow13 dump-flows br0` shows the new rules
4. `ping 10.0.0.3` from H1 now succeeds using your rules, not the `fwd` app

---

## Area D — SFC Deployment and Monitoring

> Service Function Chaining is currently visualised but not deployed. These tasks make the SFC page control the real data plane.

---

### D1 — Deploy a Real SFC Chain (VLAN-based)
**Difficulty:** ⭐⭐ · **File:** `src/pages/SFCPage.tsx` · `src/services/onosApi.ts`

**What to build:**
Add a **Deploy** button to the SFC chain detail panel. For each hop in the chain, install flow rules with VLAN tagging so traffic is steered through the correct sequence of switches:

```
Ingress switch:  match {srcIP, dstIP}  →  SET_VLAN_ID(100), OUTPUT ingress_port
Transit switch:  match {VLAN_ID=100}   →  OUTPUT transit_port
Egress switch:   match {VLAN_ID=100}   →  strip VLAN, OUTPUT to host
```

```typescript
// ServiceFunctionChain has srcHostId / dstHostId (not srcIp / dstIp).
// Look up the host devices to get their IP addresses:
const devices = useNetworkStore.getState().devices
const srcIp   = devices.find(d => d.id === chain.srcHostId)?.ipAddress
const dstIp   = devices.find(d => d.id === chain.dstHostId)?.ipAddress
if (!srcIp || !dstIp) return

// Ingress rule — tag traffic with VLAN 100 and forward into the chain
await addFlow(ingressSwitch, 45000,
  { ipSrc: srcIp + '/32', ipDst: dstIp + '/32', ethType: '0x0800' },
  [{ type: 'SET_VLAN_ID', vlanId: 100 }, { type: 'OUTPUT', port: ingressPort }]
)
// Transit rule — forward tagged traffic hop-by-hop
await addFlow(transitSwitch, 45000,
  { vlanId: 100 },
  [{ type: 'OUTPUT', port: nextHopPort }]
)
// Egress rule — strip VLAN tag before delivering to destination host
await addFlow(egressSwitch, 45000,
  { vlanId: 100 },
  [{ type: 'SET_VLAN_ID', vlanId: 0 }, { type: 'OUTPUT', port: hostPort }]
)
```

**How to verify on real hardware:**
```bash
# Confirm VLAN-tagged rules installed on each switch:
sudo ovs-ofctl -O OpenFlow13 dump-flows br0 | grep vlan

# Confirm 802.1Q tags are present on the transit link:
sudo tcpdump -i enp3s0 -e -n vlan
```

---

### D2 — SFC Chain Health: React to Real Link Failures
**Difficulty:** ⭐⭐ · **File:** `src/stores/sfcStore.ts`

**What to build:**
Subscribe to `networkStore` link state. When a link that is part of an active chain goes down (detected by the polling loop), automatically mark that chain as `degraded` and emit a critical alert.

```typescript
useEffect(() => {
  return useNetworkStore.subscribe(
    s => s.links,
    (links) => {
      useSFCStore.getState().chains.forEach(chain => {
        const failedLink = links.find(
          l => !l.isUp && chain.linkPath.includes(l.id)
        )
        if (failedLink && chain.state === 'active') {
          useSFCStore.getState().updateChainState(chain.id, 'degraded')  // ← updateChainState, not setChainState
          useNetworkStore.getState().addAlert({
            severity: 'critical',
            title: 'SFC Chain Degraded',
            message: `"${chain.name}" — link ${failedLink.id} is down`,
          })
        }
      })
    }
  )
}, [])
```

> **linkPath IDs must match real ONOS link IDs.** The demo chains use short placeholder IDs like `'s1-s2'`. Real ONOS link IDs look like `of:0000000000000001:2-of:0000000000000002:1`. This task only works correctly if the chain was created (via D1 or the UI) with real link IDs from `curl -u onos:rocks http://<IP>:8181/onos/v1/links`.

**How to verify on real hardware:**
1. Deploy a chain (Task D1) so it is active and `linkPath` contains real ONOS link IDs
2. Unplug the cable on the transit link
3. Within one poll cycle (≤ 5 s) the chain card on the SFC page turns amber/red
4. A critical alert appears in the Alerts panel

---

## Submission Checklist

For each task you complete, include the following in your submission:

- [ ] **Screenshot or screen recording** of the feature working in the Dashboard
- [ ] **Terminal output as evidence** that the change reached the real hardware:
  - `ovs-ofctl dump-flows br0` for flow-related tasks
  - `curl` output from ONOS REST API for topology/stats tasks
  - `iperf3` or `ping` output for traffic/latency tasks
- [ ] **Code diff or the modified files** (zip or `git diff`)
- [ ] **Short write-up (≤ 300 words):** what you built, what files you changed, and what SDN concept the feature demonstrates

If you implement something not on this list, describe your idea to the instructor first to confirm it qualifies.
