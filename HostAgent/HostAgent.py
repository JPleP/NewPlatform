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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005)