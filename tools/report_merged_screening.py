"""Descriptive figures for one 16-worker control/merged screening pair."""
import json
import hashlib
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'data/optimizer_validation/m4a1_merged_ranked_20261118')
result = json.loads((directory / 'final.json').read_text(encoding='utf-8'))
resources = json.loads((directory / 'resources.json').read_text(encoding='utf-8'))
control, merged = result['control'], result['merged']
merged_jobs = json.loads((directory / 'merged.json').read_text(encoding='utf-8'))['results']
summary = {
    'passed': result['passed'], 'experimental_units': 1,
    'design': 'one control-then-merged pair; same input, population, 16-worker pool and global K',
    'represented_layouts': int(result['exact_total']),
    'retained_layouts': result['selected'],
    'control_scored_states': control['classes'], 'merged_scored_states': merged['classes'],
    'state_reduction_percent': 100 * (1 - merged['classes'] / control['classes']),
    'below_one_million_scored_states': merged['classes'] < 1_000_000,
    'control_seconds': control['wall_ms'] / 1000,
    'merged_seconds': merged['wall_ms'] / 1000,
    'observed_time_ratio_control_over_merged': control['wall_ms'] / merged['wall_ms'],
    'peak_sampled_process_rss_gib': result['peak_sampled_process_rss_bytes'] / 2**30,
    'ranked_population_manifests_equal': result['per_job_score_identity_manifests_match'],
    'exact_survivor_identities_and_order_equal': result['survivor_identities_and_order_match'],
    'native_survivor_replays': result['native_survivor_replays'],
    'dag_layout_paths': sum(r['paths'] for r in merged_jobs if r['kind'] == 'dag'),
    'exhaustive_fallback_layout_paths': sum(r['paths'] for r in merged_jobs if r['kind'] != 'dag'),
    'native_state_guard_fallback_jobs': merged['guard_fallback_jobs'],
    'notes': [
        'Complete census of the declared ordinary population, not a sampled estimate.',
        'Single execution pair: no inferential confidence interval or causal speedup claim.',
        'Control runs first; warm caches, contention and memory pressure can affect timings.',
        'Resource points are correlated time-series samples, not independent replicates.',
        'Ranks count layout paths; represented/scored states do not replace the denominator.',
        'Node worker threads; browser runtime and tactical/calibration costs remain unmeasured.',
    ],
}
cpu_path = directory / 'cpu-monitor.ndjson'
if cpu_path.exists():
    cpu = [json.loads(line) for line in cpu_path.read_text(encoding='utf-8').splitlines() if line.strip()]
    if len(cpu) > 1:
        seconds = cpu[-1]['unix_seconds'] - cpu[0]['unix_seconds']
        used = cpu[-1]['cpu_seconds'] - cpu[0]['cpu_seconds']
        summary['partial_cpu_monitor'] = {'sample_count': len(cpu), 'wall_seconds': seconds,
            'cpu_seconds': used, 'average_logical_cpu_equivalents': used/seconds,
            'minimum_available_system_memory_gib': min(s['system_available_bytes'] for s in cpu)/2**30,
            'scope': 'monitor started partway through control; partial window only, not whole-phase CPU efficiency'}
(directory / 'statistics.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
source_paths = ['tools/merged_screening.mjs', 'tools/ranked_screening_heap.mjs',
                'tools/run_merged_screening_study.mjs', 'tools/screening_rank.mjs',
                'tools/exhaustive_attachment_gate.mjs', 'tools/mount_search.mjs',
                'tools/choice_groups.mjs', 'tools/dominance_reduction.mjs',
                'tools/optimizer_presets.mjs', 'tools/shared_stats.mjs',
                '.scratch/calibration-check/kernel.mjs', '.scratch/calibration-check/curves.mjs',
                '.scratch/calibration-check/attributes.mjs',
                '.scratch/github-pages-site/data/weapons/18010000001.json',
                '.scratch/github-pages-site/data/catalog.json']
(directory / 'source-sha256.json').write_text(json.dumps({name: hashlib.sha256(Path(name).read_bytes()).hexdigest() for name in source_paths}, indent=2), encoding='utf-8')
fig, axes = plt.subplots(1, 3, figsize=(14, 4.6))
colors = ['#64778c', '#16816b']
values = [control['classes'], merged['classes']]
axes[0].bar(['Control', 'Merged'], values, color=colors)
axes[0].axhline(1_000_000, color='#ac5924', linestyle='--', label='Target <1 million')
axes[0].set_ylabel('Scored states (same weighted layout population)')
axes[0].ticklabel_format(axis='y', style='sci', scilimits=(6, 6))
for index, value in enumerate(values):
    axes[0].text(index, value, f'{value:,}', ha='center', va='bottom')
axes[0].set_ylim(0, max(values) * 1.18)
axes[0].legend(fontsize=8)
times = [control['wall_ms']/1000, merged['wall_ms']/1000]
axes[1].bar(['Control', 'Merged'], times, color=colors)
axes[1].set_ylabel('Wall seconds, including ranking and manifests')
for index, value in enumerate(times):
    axes[1].text(index, value, f'{value:.2f} s', ha='center', va='bottom')
axes[1].set_ylim(0, max(times) * 1.18)
for phase, color in [('setup', '#aaaaaa'), ('control', colors[0]), ('merged', colors[1]), ('validation', '#ac5924')]:
    points = [s for s in resources if s['phase'] == phase]
    if points:
        axes[2].plot([s['elapsed_ms']/1000 for s in points], [s['rss_bytes']/2**30 for s in points], label=phase, color=color)
axes[2].set_xlabel('Seconds since pool startup')
axes[2].set_ylabel('Sampled process RSS (GiB), all 16 threads')
axes[2].legend(fontsize=8)
for ax in axes:
    ax.grid(axis='y', alpha=.2)
fig.suptitle(f'M4A1 / Detonation / Insight 3/7 / {result["request"]["budget"]} points / 16 workers')
fig.text(.5, .015, f'{int(result["exact_total"]):,} weighted layouts; exactly {result["selected"]:,} top-0.5% identities retained. '
         'One complete census pair; descriptive timings, no confidence bands.', ha='center', fontsize=9)
fig.tight_layout(rect=[0, .07, 1, .94])
for extension in ['png', 'svg']:
    fig.savefig(directory / f'merging_ranking_comparison.{extension}', dpi=160)
plt.close(fig)
print(json.dumps(summary, indent=2))
