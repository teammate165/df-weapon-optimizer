"""Descriptive plots for one fixed-work exhaustive screening traversal.

No confidence bands: progress samples are serially dependent and this is one run.
Requires NumPy/Matplotlib; psutil is needed only by the optional resource monitor.
"""
from datetime import datetime
import json
from pathlib import Path
import csv
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

directory = Path('data/optimizer_validation/m4a1_exhaustive_screening_20261117')
state = json.loads((directory / ('final.json' if (directory / 'final.json').exists() else 'latest.json')).read_text('utf-8'))
raw = [json.loads(line) for line in (directory / 'progress.ndjson').read_text('utf-8').splitlines() if line.strip()]
# Collapse identical wall times (e.g. forced final reports).
samples = list({row['wall_seconds']: row for row in raw}.values())
samples.sort(key=lambda row: row['wall_seconds'])
total = int(state['count']['total']) if state.get('count') else None
elapsed = np.array([row['wall_seconds'] for row in samples])
scored = np.array([row['scored'] for row in samples])
done = state['status'] == 'completed'
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 140})
fig, axes = plt.subplots(2, 2, figsize=(12, 8.8))
axes[0, 0].plot(elapsed/60, scored/1e6, color='#267e9e', label='Source-scored layouts')
if total:
    axes[0, 0].axhline(total/1e6, color='#b94b26', linestyle='--', label=f'Exact domain: {total:,}')
axes[0, 0].set(xlabel='Wall minutes', ylabel='Layouts screened (millions)', title='A  Fixed-work exhaustive progress')
axes[0, 0].legend(fontsize=8)
dt = np.diff(elapsed)
valid = dt > 1
axes[0, 1].plot(elapsed[1:][valid]/60, np.diff(scored)[valid]/dt[valid]/1000, color='#267e9e', alpha=.65, label='Between saved observations')
axes[0, 1].plot(elapsed[1:]/60, scored[1:]/elapsed[1:]/1000, color='#b94b26', label='Cumulative average')
axes[0, 1].set(xlabel='Wall minutes', ylabel='Layouts / second (thousands)', title='B  Actual screening throughput')
axes[0, 1].legend(fontsize=8)
projections = [s for s in samples if s.get('projected_remaining_seconds') is not None and s['wall_seconds'] >= 5]
axes[1, 0].plot([s['wall_seconds']/60 for s in projections], [(s['wall_seconds']+s['projected_remaining_seconds'])/60 for s in projections], color='#267e9e', label='Cumulative-rate finish projection')
if done:
    axes[1, 0].axhline(elapsed[-1]/60, linestyle='--', color='#b94b26', label=f'Observed finish: {elapsed[-1]/60:.2f} min')
axes[1, 0].set(xlabel='Observation wall minutes', ylabel='Projected total minutes', title='C  How the completion estimate changed')
axes[1, 0].legend(fontsize=8)
resources_path = directory / 'resources.ndjson'
resources = [json.loads(line) for line in resources_path.read_text('utf-8-sig').splitlines() if line.strip()] if resources_path.exists() else []
cpu_equivalents = []
if resources:
    start = datetime.fromisoformat(state['started_at'].replace('Z', '+00:00'))
    rt = np.array([(datetime.fromisoformat(r['utc'])-start).total_seconds() for r in resources])
    memory = np.array([r['private_bytes']/2**30 for r in resources])
    axes[1, 1].plot(rt/60, memory, color='#267e9e', label='Browser-tree private memory')
    axes[1, 1].set(xlabel='Wall minutes', ylabel='Private memory (GiB)', title='D  Dedicated browser resource use')
    other = axes[1, 1].twinx()
    for i in range(1, len(resources)):
        delta = resources[i]['cpu_seconds']-resources[i-1]['cpu_seconds']
        seconds = rt[i]-rt[i-1]
        if seconds>0 and delta>=0 and set(resources[i]['process_ids']) == set(resources[i-1]['process_ids']):
            cpu_equivalents.append((rt[i], delta/seconds))
    if cpu_equivalents:
        other.plot([p[0]/60 for p in cpu_equivalents], [p[1] for p in cpu_equivalents], color='#b94b26', alpha=.7)
    other.set_ylabel('Average logical CPU equivalents', color='#b94b26')
    axes[1, 1].legend(fontsize=8, loc='upper left')
else:
    axes[1, 1].text(.1, .5, 'No resource monitor samples available', transform=axes[1, 1].transAxes)
for ax in axes.flat:
    ax.grid(alpha=.2)
fig.suptitle(f'M4A1 / Insight 3/7 / 800 points / {state["workers"]} disjoint workers / {state["status"]}', fontsize=15)
fig.text(.5, .025, 'One uninterrupted ordinary/default-calibration scan. No score pruning, timed rounds, calibration search or percentile survivor retention.\nDescriptive serial time series; no inferential confidence bands. Resource monitoring starts partway through the run.', ha='center', fontsize=9)
fig.tight_layout(rect=[0, .075, 1, .95])
for extension in ['png', 'svg']:
    fig.savefig(directory / f'exhaustive_progress.{extension}')
plt.close(fig)
fields=['wall_seconds','scored','nodes','exact_total','fraction','rate','projected_remaining_seconds','completed_partitions']
with (directory/'progress.csv').open('w', newline='', encoding='utf-8') as stream:
    writer=csv.DictWriter(stream, fieldnames=fields, extrasaction='ignore');writer.writeheader();writer.writerows(samples)
summary={'status':state['status'],'experimental_units':1,'workers':state['workers'],'exact_total':total,'scored':int(scored[-1]),'wall_seconds':float(elapsed[-1]),'average_screened_per_second':float(scored[-1]/elapsed[-1]),'tree_nodes':samples[-1]['nodes'],'complete_count_reconciliation':done and int(scored[-1])==total,'completed_partitions':len(state['partition_results']),'total_partitions':len(state['plan']['partitions']),'gate_fraction':state['count'].get('gate_fraction', .05),'survivor_rows':state['count'].get('survivor_rows',state['count'].get('top_five_percent_rows')),'peak_sampled_browser_private_gib':max((r['private_bytes']/2**30 for r in resources),default=None),'median_logical_cpu_equivalents':float(np.median([p[1] for p in cpu_equivalents])) if cpu_equivalents else None,'resource_samples':len(resources),'count_wall_seconds':state['count']['elapsed_ms']/1000,'notes':['Only ordinary/default-calibration grouped layouts are covered.','The percentile survivor set is not retained by this instrumented sweep.','Tactical completion search, all calibration positions, raw equivalent layouts, excluded accessories and other weapons are outside the domain.','Resource figures include the entire dedicated browser process tree; CPU deltas use only intervals with unchanged process sets.','No confidence interval from serial progress samples; this is one full-work invocation.']}
if state['partition_results']:
    n=sum(r['serialization_samples'] for r in state['partition_results'])
    size=sum(r['serialization_bytes'] for r in state['partition_results'])
    summary['preview_row_prefix_sample_count']=n
    summary['mean_preview_row_json_bytes']=size/n if n else None
    summary['survivor_preview_json_gib_scenario']=(size/n)*int(summary['survivor_rows'])/2**30 if n else None
(directory/'statistics.json').write_text(json.dumps(summary,indent=2),'utf-8')
print(json.dumps(summary,indent=2))
