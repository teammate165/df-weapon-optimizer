"""Reproducible descriptive statistics and exportable figures for browser trials.

Requires numpy and matplotlib. Each complete portfolio run is one observation;
progress messages and individual workers are never treated as replicates.
"""
import argparse
import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np


def interval(values, seed=20261117):
    values = np.asarray(values, dtype=float)
    if not len(values):
        return [None, None, None]
    rng = np.random.default_rng(seed)
    boot = np.median(rng.choice(values, (10000, len(values)), replace=True), axis=1)
    lo, hi = np.quantile(boot, [.025, .975])
    return [float(np.median(values)), float(lo), float(hi)]


def dot_interval(ax, workers, observations, ylabel, title):
    for i, worker in enumerate(workers):
        ys = observations[worker]
        jitter = np.linspace(-.12, .12, len(ys))
        ax.scatter(np.full(len(ys), i) + jitter, ys, alpha=.65, s=28, color='#267e9e', zorder=3)
        center, lo, hi = interval(ys)
        ax.errorbar(i, center, yerr=[[center-lo], [hi-center]], fmt='D', color='#b94b26', capsize=6, markersize=6, zorder=4)
    ax.set(xticks=range(len(workers)), xticklabels=workers, xlabel='Browser workers', ylabel=ylabel, title=title)
    ax.grid(axis='y', alpha=.22)


def main(directory):
    benchmark = json.loads((directory / 'benchmark.json').read_text('utf-8'))
    trials = benchmark['trials']
    workers = sorted({t['workers'] for t in trials})
    by_worker = {w: [t for t in trials if t['workers'] == w] for w in workers}
    base = {t['block']: t for t in by_worker[1]}
    plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 140})
    summary = {'bootstrap': {'resamples': 10000, 'confidence': .95, 'seed': 20261117, 'method': 'percentile bootstrap of median; resample whole paired blocks for ratios'}, 'workers': []}
    for w in workers:
        rows = by_worker[w]
        paired = [t['throughput'] / base[t['block']]['throughput'] for t in rows]
        summary['workers'].append({'workers': w, 'n': len(rows), 'throughput': interval([t['throughput'] for t in rows]), 'wall_ms': interval([t['wall_ms'] for t in rows]), 'paired_rate_ratio': interval(paired), 'paired_rate_ratio_per_worker': interval(np.array(paired) / w), 'best_loss': interval([t['best_loss'] for t in rows]), 'evaluated': interval([t['evaluated'] for t in rows]), 'cache_hit_fraction': interval([t['cache_hits'] / max(1, t['evaluation_attempts']) for t in rows]), 'rejected_fraction': interval([t['invalid'] / max(1, t['evaluation_attempts']) for t in rows]), 'calibration_fraction_of_scores': interval([t['calibration_evaluations'] / max(1, t['evaluated']) for t in rows])})
    summary['selected_workers'] = benchmark.get('selected_workers')
    (directory / 'statistics.json').write_text(json.dumps(summary, indent=2), 'utf-8')
    fields = ['block', 'order', 'workers', 'seconds', 'wall_ms', 'evaluated', 'throughput', 'compute_throughput', 'best_loss', 'first_feasible_observed_ms', 'evaluation_attempts', 'cache_hits', 'invalid', 'source_errors', 'tree_nodes', 'pruned_branches', 'calibration_evaluations']
    with (directory / 'trials.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(trials)

    fig, axes = plt.subplots(2, 2, figsize=(12, 8.7))
    dot_interval(axes[0, 0], workers, {w: [r['throughput'] / 1000 for r in by_worker[w]] for w in workers}, 'Scored evaluations / second (thousands)', 'A  Gross end-to-end throughput')
    ratios = {w: [r['throughput'] / base[r['block']]['throughput'] for r in by_worker[w]] for w in workers}
    dot_interval(axes[0, 1], workers, ratios, 'Rate ratio versus one worker', 'B  Paired throughput ratio')
    axes[0, 1].plot(range(len(workers)), workers, '--', color='gray', label='Linear rate reference')
    axes[0, 1].legend(fontsize=8)
    dot_interval(axes[1, 0], workers, {w: [x/w for x in ratios[w]] for w in workers}, 'Rate ratio / worker count', 'C  Gross parallel efficiency proxy')
    axes[1, 0].axhline(1, color='gray', linestyle='--')
    dot_interval(axes[1, 1], workers, {w: [r['wall_ms'] / 1000 for r in by_worker[w]] for w in workers}, 'Wall seconds (loading + compute + merge)', 'D  Processing time for 5-second allowance')
    fig.suptitle('M4A1 / Detonation / Lowest Recoil / Insight 3/7 locked', fontsize=15)
    fig.text(.5, .025, '7 randomized blocks; dots = individual complete runs; diamonds = medians; bars = exploratory 95% percentile-bootstrap CIs.\nDifferent search orders and workload mix: rate ratios are not fixed-work speedups or measured CPU utilization. Overlap included.', ha='center', fontsize=9)
    fig.tight_layout(rect=[0, .075, 1, .95])
    for extension in ['png', 'svg']:
        fig.savefig(directory / f'worker_scaling.{extension}')
    plt.close(fig)

    fig, axes = plt.subplots(2, 2, figsize=(12, 8.7))
    dot_interval(axes[0, 0], workers, {w: [r['best_loss'] for r in by_worker[w]] for w in workers}, 'Source-verified Max loss (lower is better)', 'A  Final solution quality at 5 seconds')
    dot_interval(axes[0, 1], workers, {w: [r['first_feasible_observed_ms'] / 1000 for r in by_worker[w] if r['first_feasible_observed_ms'] is not None] for w in workers}, 'Observed wall seconds', 'B  Time to first feasible retained pool')
    labels = ['prepare_ms', 'compute_wall_ms', 'merge_ms']
    bottom = np.zeros(len(workers))
    for field, label, color in zip(labels, ['Prepare', 'Compute', 'Merge'], ['#8ab8c7', '#267e9e', '#e7a35c']):
        values = [np.median([r['result']['solver']['parallel'][field] for r in by_worker[w]]) / 1000 for w in workers]
        axes[1, 0].bar(range(len(workers)), values, bottom=bottom, label=label, color=color)
        bottom += values
    axes[1, 0].set(xticks=range(len(workers)), xticklabels=workers, xlabel='Browser workers', ylabel='Median component seconds', title='C  Loading, computation and merge')
    axes[1, 0].legend(fontsize=8)
    for w in workers:
        rows = by_worker[w]
        axes[1, 1].plot([r['block'] for r in rows], [r['throughput'] / 1000 for r in rows], 'o-', label=f'{w} workers', alpha=.8)
    axes[1, 1].set(xlabel='Randomized block (time order)', ylabel='Scored evaluations / second (thousands)', title='D  Throughput drift by block')
    axes[1, 1].legend(fontsize=8, ncol=2)
    fig.suptitle('Quality, latency, overhead and temporal variation', fontsize=15)
    fig.text(.5, .025, 'First-feasible times are progress-observation times, not exact discovery times. Component medians need not sum to median wall time.\nBootstrap intervals describe this machine/session only; 7 runs per pool size are exploratory. No hypothesis-test or optimality claim.', ha='center', fontsize=9)
    fig.tight_layout(rect=[0, .075, 1, .95])
    for extension in ['png', 'svg']:
        fig.savefig(directory / f'quality_latency.{extension}')
    plt.close(fig)

    continuous_path = directory / 'continuous_snapshot.json'
    if not continuous_path.exists():
        continuous_path = directory / 'continuous.json'
    if continuous_path.exists():
        study = json.loads(continuous_path.read_text('utf-8'))
        samples, rounds = study['samples'], study['rounds']
        if not rounds:
            return
        fig, axes = plt.subplots(2, 2, figsize=(12, 8.7))
        t = np.array([s['wall_seconds'] for s in samples])
        scored = np.array([s['evaluated'] for s in samples])
        axes[0, 0].plot(t, scored / 1000, color='#267e9e')
        axes[0, 0].set(xlabel='Wall seconds', ylabel='Scored evaluations (thousands)', title='A  Cumulative work (overlap included)')
        dt = np.diff(t)
        good = dt > 0
        axes[0, 1].plot(t[1:][good], np.diff(scored)[good] / dt[good] / 1000, color='#267e9e', alpha=.75)
        axes[0, 1].set(xlabel='Wall seconds', ylabel='Scored evaluations / second (thousands)', title='B  Between-observation gross throughput')
        observed, best = [], np.inf
        for s in samples:
            loss = s['progress'].get('best_loss')
            if loss is not None:
                best = min(best, loss)
                observed.append((s['wall_seconds'], best))
        if observed:
            axes[1, 0].step(*np.array(observed).T, where='post', color='#b94b26', label='Best observed complete-pool loss')
        axes[1, 0].scatter([r['wall_seconds'] for r in rounds], [r['best_saved_loss'] for r in rounds], color='black', marker='D', label='Replayed checkpoint')
        axes[1, 0].set(xlabel='Wall seconds', ylabel='Loss (lower is better)', title='C  Observed solution-quality trajectory')
        axes[1, 0].legend(fontsize=8)
        phase_times = {}
        for r in rounds:
            for worker in r['result']['solver']['parallel']['worker_reports']:
                for budget in worker:
                    for phase in budget['phases']:
                        phase_times[phase['phase']] = phase_times.get(phase['phase'], 0) + phase['elapsed_ms'] / 1000
        axes[1, 1].barh(list(phase_times), list(phase_times.values()), color='#267e9e')
        axes[1, 1].set(xlabel='Summed worker-phase wall seconds (not CPU seconds)', title='D  Completed-round phase allocation')
        for ax in axes.flat:
            ax.grid(alpha=.2)
        fig.suptitle(f'Continuous local run / {study["workers"]} browser workers / {len(rounds)} completed round(s)', fontsize=15)
        fig.text(.5, .025, 'One ongoing run: descriptive time series, no confidence bands. Samples are serially dependent.\nFinite rounds allow calibration/checkpoints; there is no overall deadline. No search-space coverage or global-optimality estimate.', ha='center', fontsize=9)
        fig.tight_layout(rect=[0, .075, 1, .95])
        for extension in ['png', 'svg']:
            fig.savefig(directory / f'continuous_run.{extension}')
        plt.close(fig)
        summary['continuous_snapshot'] = {'completed_rounds': len(rounds), 'workers': study['workers'], 'wall_seconds': rounds[-1]['wall_seconds'], 'evaluated': rounds[-1]['cumulative_evaluated'], 'best_loss': study['best']['loss'], 'status_at_snapshot': study['status'], 'snapshot_started_at': study['started_at']}
        (directory / 'statistics.json').write_text(json.dumps(summary, indent=2), 'utf-8')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('directory', type=Path, nargs='?', default=Path('data/optimizer_validation/m4a1_worker_study_20261117'))
    main(parser.parse_args().directory)
