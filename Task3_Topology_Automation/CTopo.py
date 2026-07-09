from mininet.net import Mininet
from mininet.topo import Topo
from mininet.cli import CLI
from mininet.node import RemoteController,OVSSwitch
import subprocess

# Generic topology class that supports multiple topology types:
class CTopo (Topo):
    "A General Topology class, that allows to use multiple different topologies"

    # Main topology dispatcher called automatically by Mininet.
    # Based on the selected topology type, validates parameters
    # and invokes the corresponding topology builder.
    def build(self, parent=None):
        hosts = []
        switches = []
        for i in range(1,5):
            hosts.append(self.addHost('h%d' % i))
            switches.append(self.addSwitch('s%d' % i, cls=OVSSwitch, protocols='OpenFlow13'))
        self.addLink(switches[0], hosts[0])
        self.addLink(switches[0], hosts[1])
        self.addLink(switches[3], hosts[2])
        self.addLink(switches[3], hosts[3])

        self.addLink(switches[0], switches[1])
        self.addLink(switches[1], switches[3])
        self.addLink(switches[0], switches[2])
        self.addLink(switches[2], switches[3])


# Mount and execute a Mininet topology.
def MountMininet(net):
    
    # Retrieve the IP address of the local ONOS controller
    # running inside a Docker container.
    # 1. Get the ID using the robust grep/awk pipeline
    # We run this command and capture the result
    find_id_cmd = "docker ps --format '{{.ID}} {{.Image}}' | grep 'onos' | awk '{print $1}' | head -n 1"
    container_id = subprocess.check_output(find_id_cmd, shell=True, text=True).strip()

    if not container_id:
        print("Error: Could not find any ONOS container.")
    else:
        # 2. Now use that ID in the inspect command
        # We use f-strings to inject the ID into the command
        inspect_cmd = f"docker inspect -f '{{{{range .NetworkSettings.Networks}}}}{{{{ .IPAddress }}}}{{{{end}}}}' {container_id}"
        
        onos_ip = subprocess.check_output(inspect_cmd, shell=True, text=True).strip()
        print(f"ONOS IP is: {onos_ip}")

    # Register the remote controller with Mininet.
    net.addController(
        name='c0',
        controller=RemoteController,
        ip=f'{onos_ip}',
        port=6653
    )

    # Start all network elements.
    net.start()

    # Open the Mininet interactive command-line interface.
    CLI(net)

    # Stop the network after exiting the CLI.
    net.stop()


# Import modules required for command-line argument parsing
# and external process execution.
import argparse
import subprocess

# Main entry point.
if __name__ == "__main__":

    # Configure command-line arguments.
    parser = argparse.ArgumentParser(
        description="Script that automatically generates a topology and mounts it"
    )

    parser.add_argument("--noclean", action="store_true"); 

    # Parse command-line arguments.
    args = parser.parse_args()

    if not args.noclean:
        subprocess.run("mn -c 2>/dev/null", shell=True, check=False)
        
    
    # Create the selected topology and initialize Mininet
    # without a default controller.
    net = Mininet(
        topo=CTopo(),
        controller=None
    )

    # Launch the topology.
    MountMininet(net)

