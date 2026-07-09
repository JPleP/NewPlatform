# SDN Lab Setup Guide
## Single Switch — ONOS Controller Connection Test

---

## Environment

| Role | Machine | Control IP |
|------|---------|-----------|
| ONOS Controller PC | Runs Docker + ONOS container | 192.168.1.1 |
| Switch PC | Runs OVS, three NICs | 192.168.1.11 |

**NIC allocation (Switch PC):**
- `eth0` (or `eno1`, etc.) — control interface, has IP, connects to control network
- `eth1` / `eth2` — data interfaces, no IP, added to OVS bridge

---

## Step 1 — ONOS PC: Start ONOS Docker

```bash
docker run -d \
  --name onos \
  --restart unless-stopped \
  -p 6653:6653 \
  -p 8181:8181 \
  -p 8101:8101 \
  onosproject/onos:2.7-latest
```

Wait ~30 seconds, then verify:

```bash
curl -u onos:rocks http://localhost:8181/onos/v1/devices
```

Open firewall ports:

```bash
sudo ufw allow 6653/tcp
sudo ufw allow 8181/tcp
```

---

## Step 2 — ONOS PC: Activate Required Apps

```bash
# SSH into ONOS CLI
ssh -p 8101 karaf@localhost
# password: karaf

# Activate apps
app activate org.onosproject.openflow
app activate org.onosproject.fwd
app activate org.onosproject.lldpprovider
app activate org.onosproject.hostprovider

# Verify
apps -s -a
```

---

## Step 3 — Switch PC: Install OVS

```bash
sudo apt update && sudo apt install -y openvswitch-switch

# Verify version
ovs-vsctl --version
```

---

## Step 4 — Switch PC: Identify Interface Names

```bash
ip link show
```

Find:
- Control interface: the one with an IP address (e.g., `enp2s0`)
- Data interfaces: the other two (e.g., `enp3s0`, `enp4s0`)

---

## Step 5 — Switch PC: Configure the OVS Bridge

```bash
# Create bridge
sudo ovs-vsctl add-br br0

# Set OpenFlow 1.3
sudo ovs-vsctl set bridge br0 protocols=OpenFlow13

# Set a unique Datapath ID (16 hex digits, different for each switch)
sudo ovs-vsctl set bridge br0 other-config:datapath-id=0000000000000001

# Connect to ONOS (replace with your actual ONOS PC IP)
sudo ovs-vsctl set-controller br0 tcp:192.168.1.1:6653

# Fail-secure: drop unknown traffic when disconnected from controller
sudo ovs-vsctl set-fail-mode br0 secure
```

Add data interfaces to the bridge (cable connection not required for controller test):

```bash
sudo ovs-vsctl add-port br0 enp3s0
sudo ovs-vsctl add-port br0 enp4s0
```

---

## Step 6 — Verify Connection

**On the Switch PC:**

```bash
sudo ovs-vsctl show
```

Expected output:

```
Bridge br0
    Controller "tcp:192.168.1.1:6653"
        is_connected: true    ← this is the key indicator
    Port br0
        Interface br0
            type: internal
```

More detail:

```bash
sudo ovs-ofctl -O OpenFlow13 show br0
```

**On the ONOS PC — confirm device is registered:**

```bash
# REST API
curl -u onos:rocks http://localhost:8181/onos/v1/devices | python3 -m json.tool

# Or via ONOS CLI
ssh -p 8101 karaf@localhost
devices   # should show of:0000000000000001
```

**Web GUI:** open `http://192.168.1.1:8181/onos/ui`
Credentials: `onos` / `rocks`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `is_connected: false` | Firewall blocking port 6653 | `sudo ufw allow 6653/tcp` on ONOS PC |
| `is_connected: false` | Docker not bound to external IP | Confirm `docker ps` shows `0.0.0.0:6653` |
| ONOS CLI unreachable | Container still starting | Wait 30 s; check `docker logs onos` |
| `devices` list empty | OpenFlow app not activated | Re-run Step 2 |
| Interface not named `eth0` | systemd predictable naming | Use `ip link show` to find actual names |

---

## Next Step: Add More Switches

Repeat Steps 3–6 on each new Switch PC:
- **Datapath ID must be unique**: use `...002`, `...003`, etc.
- **Control IP must be unique**: `192.168.1.12`, `192.168.1.13`, etc.

---

## Full Architecture (Multi-Switch)

```
Control Network: 192.168.1.0/24
┌────────────────────────────────────────────────────┐
│                                                    │
│  [ONOS PC :1]  [SW PC1 :11]  [SW PC2 :12]  [SW PC3 :13]
│  Docker:ONOS    OVS br0       OVS br0       OVS br0
│  port 6653      eth0=ctrl     eth0=ctrl     eth0=ctrl
│                 eth1,2=data   eth1,2=data   eth1,2=data
│                      │             │             │
│                 [RPi hosts]  [RPi hosts]  [RPi hosts]
└────────────────────────────────────────────────────┘
```

---

## Port Reference

| Port | Protocol | Purpose |
|------|----------|---------|
| 6653 | TCP | OpenFlow 1.3 (OVS → ONOS) |
| 6633 | TCP | OpenFlow legacy (compatibility) |
| 8181 | TCP | ONOS REST API + Web GUI |
| 8101 | TCP | ONOS CLI (Karaf SSH) |
