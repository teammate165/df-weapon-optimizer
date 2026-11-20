"""Read-only process-tree resource sampling for the dedicated study browser."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import time
import psutil

parser = argparse.ArgumentParser(__doc__)
parser.add_argument('pid', type=int)
parser.add_argument('--output', type=Path, default=Path('data/optimizer_validation/m4a1_exhaustive_screening_20261117'))
parser.add_argument('--runner', choices=['run_exhaustive_screening_browser.cjs', 'run-m4-chart-contexts-browser.cjs'],
                    default='run_exhaustive_screening_browser.cjs')
parser.add_argument('--interval', type=float, default=10)
args = parser.parse_args()
if args.interval <= 0:
    parser.error('--interval must be positive')
root = psutil.Process(args.pid)
if not any(args.runner in part for part in root.cmdline()):
    raise SystemExit('PID does not belong to the intended browser runner')
while root.is_running():
    totals = {'utc': datetime.now(timezone.utc).isoformat(), 'private_bytes': 0, 'working_set_bytes': 0, 'cpu_seconds': 0, 'chrome_processes': 0, 'process_ids': [], 'logical_cpus': psutil.cpu_count()}
    for process in root.children(recursive=True):
        try:
            if process.name().lower() != 'chrome.exe':
                continue
            memory = process.memory_info()
            cpu = process.cpu_times()
            totals['private_bytes'] += memory.private
            totals['working_set_bytes'] += memory.rss
            totals['cpu_seconds'] += cpu.user + cpu.system
            totals['chrome_processes'] += 1
            totals['process_ids'].append(process.pid)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    with (args.output / 'resources.ndjson').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(totals) + '\n')
    if (args.output / 'final.json').exists():
        break
    time.sleep(args.interval)
