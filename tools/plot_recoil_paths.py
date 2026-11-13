"""Export a standalone timed recoil comparison: uv run --no-project --with matplotlib tools/plot_recoil_paths.py RESULT.json --output STEM"""
import argparse
import json
from pathlib import Path


def plot(result, output):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    paths = [('Default', result['baseline_recoil_path'])]
    paths += [(row['label'].capitalize(), row['recoil_path']) for row in result['results'] if 'recoil_path' in row]
    available = [(name, value) for name, value in paths if value['status'] == 'modeled']
    if not available:
        raise ValueError('No modeled paths to plot: ' + '; '.join(p['reason'] for _, p in paths))
    figure, axes = plt.subplots(2, 2, figsize=(13, 10), constrained_layout=True)
    for name, value in available:
        points = value['points']
        times = [p['time_ms']/1000 for p in points]
        x, up = [p['x'] for p in points], [-p['y'] for p in points]
        label = f"{name} ({value['metrics']['climb_model_units_per_second']:.3f} units/s)"
        line, = axes[0, 0].plot(times, up, marker='.', label=label)
        color = line.get_color()
        axes[0, 1].plot(times, x, marker='.', color=color, label=name)
        axes[1, 0].plot([0, *x], [0, *up], marker='.', color=color, label=name)
        opening = points[:min(4, len(points))]
        px = [p['pre_shot_aim_proxy']['x'] for p in opening]
        py = [-p['pre_shot_aim_proxy']['y'] for p in opening]
        axes[1, 1].plot(px, py, marker='o', color=color, label=name)
        for p, horizontal, vertical in zip(opening, px, py):
            axes[1, 1].annotate(str(p['shot']), (horizontal, vertical), xytext=(4, 3), textcoords='offset points', fontsize=8, color=color)
    axes[0, 0].set(title='Post-shot climb over time', xlabel='Time since first shot (s)', ylabel='Upward displacement (model units)')
    axes[0, 1].set(title='Horizontal movement over time', xlabel='Time since first shot (s)', ylabel='Horizontal displacement (model units)')
    axes[1, 0].set(title='Source ADS recoil chart path', xlabel='Horizontal (model units)', ylabel='Upward (model units)')
    axes[1, 1].set(title='Opening pre-shot aim proxy: shots 1–4\nInstantaneous kicks; no smoothing, spread or recovery', xlabel='Horizontal (model units)', ylabel='Upward (model units)')
    for axis in axes.flat:
        axis.grid(alpha=.25)
        axis.legend(fontsize=8)
    for axis in axes[1]:
        axis.set_aspect('equal', adjustable='datalim')
    mode = {'bd': 'Detonation', 'sol': 'Operations', 'mp': 'Warfare'}[result['mode']]
    figure.suptitle(f"Weapon {result['weapon_id']} | {mode} | Uncompensated source model\n{result['provenance']['data_version']} · units uncalibrated · lines connect shot samples, not continuous dynamics", fontsize=11)
    output.parent.mkdir(parents=True, exist_ok=True)
    for suffix in ('.svg', '.png'):
        figure.savefig(output.with_suffix(suffix), dpi=160)
    plt.close(figure)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('result', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    plot(json.loads(args.result.read_text('utf-8')), args.output)
