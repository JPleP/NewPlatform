# SDN Testbed Onboarding Guide

> **Goal of this document:** Take you from a fresh copy of the project to seeing real physical hardware appear in the Dashboard — step by step, with clear success checkpoints at each stage.

---

## What Is This Project?

This is an SDN (Software-Defined Networking) research and teaching platform built around:

| Component | Role |
|-----------|------|
| **ONOS Controller** (Docker) | The SDN "brain" — sees the whole network, installs flow rules |
| **OVS Switch PCs** | Physical machines running Open vSwitch — act as programmable switches |
| **Raspberry Pi hosts** | End hosts generating and receiving traffic |
| **Dashboard** (this project) | Web UI that visualises the network, monitors performance, and controls flows |

The Dashboard talks to ONOS over its REST API. Once you connect real hardware to ONOS, the Dashboard automatically shows it.

```
[RPi Host] ─── [OVS Switch PC] ─── [OVS Switch PC] ─── [RPi Host]
                      │                     │
                      └──────── ONOS ────────┘   ← controls everything
                                  │
                              Dashboard           ← visualises everything
```

---

## Recommended Lab IP Plan

Use this addressing scheme throughout the guide. Adjust if your lab uses different subnets.

```
Control network: 192.168.1.0/24   (management — all machines can reach each other)
Data network:    10.0.0.0/24      (experiment traffic — RPi hosts only)

ONOS PC         192.168.1.1
OVS Switch 1    192.168.1.11
OVS Switch 2    192.168.1.12
OVS Switch 3    192.168.1.13

RPi Host 1      10.0.0.1   (connected to Switch 1)
RPi Host 2      10.0.0.2   (connected to Switch 1 or 2)
RPi Host 3      10.0.0.3   (connected to Switch 2)
```

---

## Milestone Overview

Work through each milestone in order. Each one has a clear "you know it worked" success check.

| Milestone | What you do | Success check |
|-----------|-------------|---------------|
| **M0** | Run Dashboard in Demo mode | See animated mock topology in browser |
| **M1** | Start ONOS in Docker | `curl` to REST API returns `{"devices":[]}` |
| **M2** | Connect first OVS switch | `is_connected: true` in `ovs-vsctl show` |
| **M3** | Switch appears in Dashboard | Real switch node visible in Topology page |
| **M4** | Add more switches + hosts | Full physical topology rendered live |
| **M5** | Watch live metrics | Throughput bars change as you run `iperf3` |
| **M6** | Deploy a flow rule | Flow appears in Dashboard, `ovs-ofctl` confirms it |

---

## M0 — Run the Dashboard in Demo Mode

Before touching any hardware, get the Dashboard running with simulated data so you know what to expect.

**Prerequisites:** Node.js 18+ installed on your laptop/PC.

```bash
# Clone or unzip the project, then:
cd sdn-dashboard
npm install          # first time only, installs dependencies
npm run dev          # starts the dev server
```

Open `http://localhost:3000` in your browser.

**What you should see:**

- **Dashboard page** — six summary cards (Devices Online, Active Links, Flow Rules, etc.) and an animated network topology with 3 switches and 5 hosts
- **Topology page** — interactive graph, click any node/link to see details
- **Flow Rules page** — a table of simulated flow rules; try the search bar
- **Service Chains page** — three SFC chains with live hop metrics
- **Alerts panel** — simulated warning events scrolling in

Everything is simulated. The number in the top bar says **LIVE** (green) — in demo mode this just means the simulation is running.

> **Note on Demo Mode:** The project ships with `VITE_DEMO_MODE=true`. All pages are fully functional with mock data. The exact same UI and interactions work with real hardware — you just switch the env variable.

---

## M1 — Start ONOS Controller

**Machine:** ONOS PC (`192.168.1.1`)
**OS:** Ubuntu 20.04 or 22.04
**Requirements:** Docker installed

### 1.1 — Start ONOS in Docker

```bash
docker run -d \
  --name onos \
  --restart unless-stopped \
  -p 6653:6653 \
  -p 8181:8181 \
  -p 8101:8101 \
  onosproject/onos:2.7-latest
```

Wait **30–60 seconds** for ONOS to fully boot (it runs on a Java application server internally).

```bash
# Check that the container is running
docker ps | grep onos
```

### 1.2 — Open Firewall Ports

```bash
sudo ufw allow 6653/tcp   # OpenFlow — switches connect here
sudo ufw allow 8181/tcp   # REST API — Dashboard connects here
sudo ufw allow 8101/tcp   # ONOS CLI (SSH)
sudo ufw reload
```

### 1.3 — Activate Required Apps

Connect to the ONOS command-line interface:

```bash
ssh -p 8101 karaf@localhost
# Password: karaf
```

Inside the ONOS shell, activate these four applications:

```
app activate org.onosproject.openflow
app activate org.onosproject.lldpprovider
app activate org.onosproject.hostprovider
app activate org.onosproject.fwd
```

Verify they are all active (marked with `*`):

```
apps -s -a
```

Type `logout` to exit the ONOS shell.

### ✅ M1 Success Check

```bash
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/devices
```

Expected response (no switches yet, that's fine):

```json
{"devices":[]}
```

If you get `{"devices":[]}` — ONOS is running and the REST API is reachable. Proceed to M2.

> **Troubleshooting M1:**
> - `curl: (7) Failed to connect` → Wait longer, or check `docker ps` to confirm container is up
> - `{"message":"Unauthorized"}` → Use `-u onos:rocks` in the curl command
> - Container keeps restarting → Run `docker logs onos` to see the error

---

## M2 — Connect Your First OVS Switch

**Machine:** OVS Switch PC 1 (`192.168.1.11`)
**OS:** Ubuntu 20.04 or 22.04
**Requirements:** Three network interfaces (one for control, two for data)

### 2.1 — Identify Your Network Interfaces

```bash
ip link show
```

You will see a list like this (exact names vary by machine):

```
1: lo
2: enp2s0    ← control interface (has IP 192.168.1.11)
3: enp3s0    ← data port 1 (connected to another switch or RPi)
4: enp4s0    ← data port 2 (connected to another switch or RPi)
```

Write down your interface names — you will use them in the next step.

> **Important:** `enp3s0` and `enp4s0` should have **no IP address** assigned. They carry raw Ethernet frames — OVS controls them, not the OS.

### 2.2 — Install Open vSwitch

```bash
sudo apt update
sudo apt install -y openvswitch-switch

# Verify installation
ovs-vsctl --version
```

### 2.3 — Create the OVS Bridge

Run these commands **in order** (replace interface names with yours from step 2.1):

```bash
# 1. Create the bridge
sudo ovs-vsctl add-br br0

# 2. Force OpenFlow 1.3 (ONOS requires this)
sudo ovs-vsctl set bridge br0 protocols=OpenFlow13

# 3. Set a unique Datapath ID for this switch
#    Switch 1 → ...001, Switch 2 → ...002, Switch 3 → ...003
sudo ovs-vsctl set bridge br0 other-config:datapath-id=0000000000000001

# 4. Add your data ports to the bridge
sudo ovs-vsctl add-port br0 enp3s0
sudo ovs-vsctl add-port br0 enp4s0

# 5. Secure mode: hold all traffic until ONOS installs rules
sudo ovs-vsctl set-fail-mode br0 secure

# 6. Connect to ONOS Controller
sudo ovs-vsctl set-controller br0 tcp:192.168.1.1:6653
```

### 2.4 — Verify the Connection

```bash
sudo ovs-vsctl show
```

Look for the line `is_connected: true`:

```
Bridge br0
    Controller "tcp:192.168.1.1:6653"
        is_connected: true         ←  this is the key line
    fail_mode: secure
    Port br0
        Interface br0
            type: internal
    Port enp3s0
        Interface enp3s0
    Port enp4s0
        Interface enp4s0
```

### ✅ M2 Success Check — two places to verify

**Check A: on the Switch PC**

```bash
sudo ovs-vsctl show | grep is_connected
# Must print: is_connected: true
```

**Check B: on the ONOS PC**

```bash
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/devices | python3 -m json.tool
```

You should now see your switch in the JSON output:

```json
{
  "devices": [
    {
      "id": "of:0000000000000001",
      "available": true,
      "type": "SWITCH",
      ...
    }
  ]
}
```

> **Troubleshooting M2:**
>
> `is_connected: false` after waiting 30 seconds:
> ```bash
> # Test network reachability from Switch PC to ONOS PC
> nc -zv 192.168.1.1 6653
> # Must print: Connection to 192.168.1.1 6653 port [tcp] succeeded!
>
> # If it fails, check the ONOS PC firewall:
> sudo ufw status   # must show 6653 ALLOW
>
> # Also check Docker port binding on ONOS PC:
> docker ps   # must show 0.0.0.0:6653->6653/tcp
> ```
>
> `No such device` when adding a port:
> ```bash
> ip link show   # confirm the interface name exists
> # Bring the interface up if it shows DOWN:
> sudo ip link set enp3s0 up
> ```

---

## M3 — See the Real Switch in the Dashboard

Now point the Dashboard at your real ONOS controller.

**Machine:** Your laptop or any machine that can reach `192.168.1.1`

### 3.1 — Create the Environment File

```bash
cd sdn-dashboard

# Copy the example file
cp .env.example .env.local

# Edit it
nano .env.local
```

Change these values:

```env
VITE_DEMO_MODE=false           # ← this is the key change

VITE_ONOS_HOST=192.168.1.1     # IP of your ONOS PC
VITE_ONOS_PORT=8181
VITE_ONOS_USER=onos
VITE_ONOS_PASSWORD=rocks
```

Leave the polling intervals at their defaults for now.

### 3.2 — Restart the Dashboard

```bash
# If the dev server is already running, stop it with Ctrl+C first
npm run dev
```

### ✅ M3 Success Check

Open `http://localhost:3000` and go to the **Topology** page.

**You should see:**
- One rectangle node labeled with your switch's ID (e.g., `of:0000000000000001`)
- A diamond node labeled "ONOS Controller" connected to it
- The top bar shows the correct device count

**What to check if the topology is empty:**

Open browser DevTools (F12) → **Network** tab → look for `/onos/v1/devices`.

| Response | Meaning |
|----------|---------|
| `200` with device data | Working — check the Topology page again |
| `401 Unauthorized` | Wrong credentials in `.env.local` |
| `CORS error` | You must access the Dashboard via `http://localhost:3000`, not via IP |
| `net::ERR_CONNECTION_REFUSED` | ONOS is not reachable — check firewall and Docker |

> The top-right corner of the Dashboard shows a connection indicator. In real mode it shows **LIVE** (green) when ONOS is reachable, or **Disconnected** (red) if the REST API fails.

---

## M4 — Add More Switches and RPi Hosts

### Add a Second (and Third) Switch

Repeat the M2 steps on each additional Switch PC, **changing the Datapath ID each time**:

| Switch PC | Control IP | Datapath ID |
|-----------|-----------|-------------|
| SW 1 | `192.168.1.11` | `0000000000000001` |
| SW 2 | `192.168.1.12` | `0000000000000002` |
| SW 3 | `192.168.1.13` | `0000000000000003` |

**Inter-switch links:** physically cable the data ports of one switch to the data ports of another. ONOS's `lldpprovider` app sends LLDP packets automatically — within **10–15 seconds** of the cable being plugged in, the link appears in ONOS and the Dashboard.

```bash
# Verify on ONOS PC after cabling:
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/links | python3 -m json.tool
# Should show a "links" array with src/dst port entries
```

### Connect Raspberry Pi Hosts

**Machine:** Raspberry Pi (any model with Ethernet)

#### Step 1 — Assign a Static IP on the Data Interface

```bash
sudo nano /etc/dhcpcd.conf
```

Add at the bottom:

```
interface eth0
static ip_address=10.0.0.1/24
```

```bash
sudo systemctl restart dhcpcd
ip addr show eth0   # confirm 10.0.0.1/24 is shown
```

Do not add a `static routers` line — SDN controls forwarding, not the OS.

#### Step 2 — Trigger Host Discovery

ONOS learns hosts when they send traffic (via ARP packets). Send any ping to trigger it:

```bash
ping -c 3 10.0.0.2   # destination does not need to be online yet
```

#### Step 3 — Verify in ONOS

```bash
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/hosts | python3 -m json.tool
```

You should see an entry like:

```json
{
  "hosts": [
    {
      "id": "AA:BB:CC:DD:00:01/None",
      "mac": "AA:BB:CC:DD:00:01",
      "ipAddresses": ["10.0.0.1"],
      "location": {
        "elementId": "of:0000000000000001",
        "port": "1"
      }
    }
  ]
}
```

### ✅ M4 Success Check

Go to the **Dashboard** or **Topology** page. You should see:

- All your OVS switch nodes (rectangles)
- Green circle nodes for each RPi host that has sent traffic
- Lines connecting switches to each other and to hosts
- The summary cards showing correct device and link counts

---

## M5 — Watch Live Metrics

With hardware connected, you can observe real network performance in the Dashboard.

### Generate Traffic with iperf3

Install `iperf3` on two RPi hosts:

```bash
# On both RPis:
sudo apt install -y iperf3
```

**On RPi H2 (receiver):**

```bash
iperf3 -s
```

**On RPi H1 (sender):**

```bash
iperf3 -c 10.0.0.2 -b 50M -t 60   # send at 50 Mbps for 60 seconds
```

> **Note:** The first `ping` after hosts come online may fail — the `fwd` app reactively installs flow rules on the first packet. After the initial "packet-in" event, subsequent traffic flows at line rate.

### What to Watch in the Dashboard

| Dashboard element | What changes |
|-------------------|-------------|
| **Link color** on Topology | Green → Amber → Red as utilization rises |
| **Utilization bar** in link detail panel | Percentage increases |
| **Device Info Panel** (click a switch) | Port statistics update |
| **Summary card** — Total Throughput | Shows current Mbps |
| **Metrics page** | Time-series graphs of bandwidth per link |

### ✅ M5 Success Check

Run `iperf3` at 50 Mbps between two hosts. In the Dashboard:
- The link between the two switches carrying that traffic should change color (green → amber)
- The throughput on that link should show approximately 50 Mbps in the detail panel

---

## M6 — Deploy a Flow Rule from the Dashboard

ONOS's `fwd` app installs rules automatically. But you can also install rules manually from the Dashboard — this is how SDN experiments work.

### Option A: Use the Flow Rule Editor (simple)

1. Go to **Flow Rules** page
2. Click **+ Add Flow**
3. Fill in:
   - Device: select your switch
   - Priority: `40000`
   - Match: `Ethernet Type = 0x0800` (IPv4)
   - Action: `OUTPUT → port 2`
4. Click **Deploy**

### Option B: Use Path Builder (visual)

1. Go to **Flow Rules** page
2. Click **Build Path** in the topology header
3. Click the **source switch**, then the **destination switch**
4. The Path Builder panel appears — review the generated flow rules
5. Click **Push to ONOS**

### Verify on the Switch

After deploying, SSH into the switch PC and check the flow table:

```bash
sudo ovs-ofctl -O OpenFlow13 dump-flows br0
```

You should see your new rule in the output alongside ONOS system rules:

```
cookie=0x..., priority=40000, ip actions=output:2
```

### ✅ M6 Success Check

- The Flow Rules page shows your new rule with state `ADDED`
- `ovs-ofctl dump-flows` shows the rule on the switch
- Traffic matching that rule is forwarded correctly (test with `ping` or `iperf3`)

---

## Troubleshooting Reference

### Quick Diagnostic Checklist

Run these commands in order when something isn't working:

```bash
# 1. Is ONOS running?
docker ps | grep onos                               # on ONOS PC

# 2. Is the REST API responding?
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/devices

# 3. Is the switch connected to ONOS?
sudo ovs-vsctl show | grep is_connected             # on Switch PC

# 4. Are the ONOS apps active?
ssh -p 8101 karaf@192.168.1.1 "apps -s -a | grep -E 'openflow|lldp|host|fwd'"

# 5. Are switches visible in ONOS?
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/devices

# 6. Are links visible in ONOS?
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/links

# 7. Are hosts visible in ONOS?
curl -u onos:rocks http://192.168.1.1:8181/onos/v1/hosts
```

### Common Problems

**Switch shows `is_connected: false` (most common)**

```bash
# On Switch PC — test if port 6653 is reachable:
nc -zv 192.168.1.1 6653

# If fails: check firewall on ONOS PC
sudo ufw allow 6653/tcp && sudo ufw reload

# If fails: check Docker port binding on ONOS PC
docker inspect onos | grep -A5 Ports

# If still fails: check there is a physical route between the machines
ping 192.168.1.1   # from Switch PC
```

**Inter-switch links not appearing**

```bash
# 1. Confirm lldpprovider is active
ssh -p 8101 karaf@192.168.1.1 "apps -s -a | grep lldp"

# 2. Confirm data ports are added to OVS bridge on BOTH switches
sudo ovs-vsctl show   # on each Switch PC — check Port list

# 3. Confirm the cable is plugged into the correct ports (data ports, not control)
ip link show          # data port should show state UP
```

**RPi host not appearing in ONOS**

```bash
# Host discovery is passive — the RPi must send a packet first
# Try:
ping -c 5 10.0.0.254   # trigger an ARP from the RPi

# Confirm hostprovider is active on ONOS:
ssh -p 8101 karaf@192.168.1.1 "apps -s -a | grep host"
```

**Dashboard shows empty topology / "Disconnected"**

```bash
# 1. Confirm .env.local exists with correct values
cat sdn-dashboard/.env.local   # should show VITE_DEMO_MODE=false

# 2. Restart the dev server after editing .env.local
# Ctrl+C, then: npm run dev

# 3. Open browser DevTools → Network tab
# Filter by "onos" — check HTTP status of /onos/v1/devices

# 4. Access the Dashboard only via http://localhost:3000
# Accessing via machine IP (e.g. http://192.168.1.50:3000) will cause CORS errors
```

**`ping` between RPi hosts fails even after both appear in ONOS**

```bash
# The fwd app installs rules reactively — first packet may be slow
# Wait 2-3 seconds and try again

# If still failing, check flows on the switch:
sudo ovs-ofctl -O OpenFlow13 dump-flows br0

# Check ONOS intents or fwd routing:
ssh -p 8101 karaf@192.168.1.1 "flows"
```

---

## Port and Service Reference

| Port | Protocol | Purpose | Open on |
|------|----------|---------|---------|
| `6653` | TCP | OpenFlow 1.3 — switch-to-controller | ONOS PC |
| `8181` | TCP | ONOS REST API + Web GUI | ONOS PC |
| `8101` | TCP | ONOS CLI (Karaf SSH) | ONOS PC |
| `3000` or `3001` | TCP | Dashboard dev server | Your laptop |

**Default ONOS credentials:**

| Field | Value |
|-------|-------|
| REST API user | `onos` |
| REST API password | `rocks` |
| Karaf SSH user | `karaf` |
| Karaf SSH password | `karaf` |

---

## What the Dashboard Pages Do

Once real hardware is connected, here is what each Dashboard page shows:

| Page | Data source | What you can do |
|------|------------|-----------------|
| **Dashboard** | Topology + metrics | Overview of the whole network; health score; alerts |
| **Topology** | ONOS `/devices` `/links` `/hosts` | Interactive graph; click nodes to inspect; export PNG/JSON; Packet Tracer |
| **Flow Rules** | ONOS `/flows` | See all active flows; filter/search; install new flows; build paths |
| **Devices** | ONOS `/devices` | Per-switch detail; port list |
| **Metrics** | ONOS `/statistics/ports` | Time-series bandwidth graphs per link |
| **Service Chains** | Dashboard-managed | Define multi-hop SFC paths; monitor per-hop latency/throughput |
| **Experiments** | Dashboard-managed | Configure and run traffic experiments |
| **Alerts** | ONOS event detection | Device join/leave events; link up/down |

---

## Next Steps

After completing M0–M6, you are running a working SDN testbed. Here is what you can explore next:

**SDN experiments:**
- Change routing paths manually and observe traffic shift in real time
- Install a priority flow rule that overrides the `fwd` app
- Use `iperf3` to show QoS differentiation between flow slices

**Dashboard extensions:**
- See `docs/STUDENT_EXTENSIONS.md` and `docs/STUDENT_EXTENSIONS_2.md` for 20 self-contained tasks that extend the Dashboard with new features

**ONOS exploration:**
- ONOS Web GUI at `http://192.168.1.1:8181/onos/ui` provides a complementary view
- Try `flows`, `intents`, `devices`, `links`, `hosts` in the ONOS CLI
- Install additional ONOS apps (e.g., `org.onosproject.routing`, `org.onosproject.tunnel`)
