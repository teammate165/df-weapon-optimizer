"""Read-only CPU/private-memory sampling for the owned 16-worker Node study."""
import json
from pathlib import Path
import time
import psutil

directory = Path('data/optimizer_validation/m4a1_merged_ranked_20261118')
matches = []
for process in psutil.process_iter(['pid', 'name', 'cmdline']):
    if (process.info['name'] or '').lower() in ('node', 'node.exe') and any(
            str(arg).endswith('run_merged_screening_study.mjs') for arg in process.info['cmdline'] or []):
        matches.append(process)
if len(matches) != 1:
    raise SystemExit(f'Expected one owned study process; found {len(matches)}')
process = matches[0]
while process.is_running():
    try:
        cpu = process.cpu_times()
        memory = process.memory_info()
        latest = json.loads((directory / 'latest.json').read_text(encoding='utf-8'))
        sample = {'unix_seconds': time.time(), 'pid': process.pid,
                  'cpu_seconds': cpu.user + cpu.system,
                  'rss_bytes': memory.rss, 'private_bytes': getattr(memory, 'private', None),
                  'system_available_bytes': psutil.virtual_memory().available,
                  'phase': latest['phase'], 'completed_jobs': latest['completed']}
        with (directory / 'cpu-monitor.ndjson').open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(sample) + '\n')
        if (directory / 'final.json').exists() or (directory / 'failure.json').exists():
            break
    except psutil.NoSuchProcess:
        break
    time.sleep(5)
