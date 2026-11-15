"""Rank 20-shot horizontal travel speed from the retained source trajectories."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def travel_speed(points):
    duration = (points[-1]['time_ms'] - points[0]['time_ms']) / 1000
    assert duration > 0
    assert all(b['time_ms'] > a['time_ms'] for a, b in zip(points, points[1:]))
    travel = sum(abs(b['x'] - a['x']) for a, b in zip(points, points[1:]))
    speed = travel / duration
    assert math.isfinite(speed)
    return dict(horizontal_travel=travel, duration_seconds=duration,
                horizontal_travel_speed=speed)


def main():
    # Reversals must contribute even when the final point returns to the start.
    assert travel_speed([dict(x=0, time_ms=0), dict(x=2, time_ms=1000),
                         dict(x=0, time_ms=2000)])['horizontal_travel_speed'] == 2
    source = json.loads((ROOT / 'data/horizontal_recoil.json').read_text('utf-8'))
    rows = []
    for row in source['rows']:
        window = row['windows']['20']
        metrics = None
        if window['status'] == 'modeled':
            assert len(window['points']) == 20
            metrics = travel_speed(window['points'])
        rows.append(dict(weapon_id=row['weapon_id'], name=row['name'], mode=row['mode'],
                         automatic=row['automatic'], status=window['status'],
                         reason=window['reason'], metrics=metrics))
    for row in rows:
        base = next(r for r in rows if r['weapon_id'] == row['weapon_id'] and r['mode'] == 'bd')
        assert row['metrics'] == base['metrics'] and row['status'] == base['status']
    ranked = sorted((r for r in rows if r['mode'] == 'bd' and r['automatic'] and r['metrics']),
                    key=lambda r: (-r['metrics']['horizontal_travel_speed'], r['weapon_id']))
    lines = ['# Horizontal recoil travel speed: 20 bullets', '',
             'Historical candidate retained as a jitter diagnostic: mean absolute horizontal travel speed, lower is better. '
             'The selected research metric is now [fastest 200 ms speed](horizontal_window_speed_trial.md). '
             'Rank 1 has the greatest speed. Base configuration, automatic ADS, no user tuning.', '',
             '`speed = sum(abs(x[i] - x[i-1]), i=2..20) / ((t[20] - t[1]) / 1000)`', '',
             'Times are source firing timestamps in milliseconds. The window covers 19 inter-shot intervals '
             'between the first and twentieth post-shot points. The first-shot displacement is excluded: '
             'the source impulse has no measured duration, so assigning it a speed would require an extra assumption. '
             'Direction reversals count toward travel; signed net drift and maximum distance from origin are different metrics.', '',
             f"Source snapshot: `{source['data_version']}`. Units: source-model units/second. "
             'This is a discrete trajectory travel-rate estimate, not measured instantaneous camera/aim velocity. '
             'It does not model between-shot recovery, rendering or random motion. Angular calibration and client validation remain open.', '',
             f'{len(ranked)} automatic weapons ranked. All three modes have identical metrics and availability. '
             'Only the 20-bullet window is used; no shorter-window substitutes. '
             'No numerical speed cutoff has been chosen. The old distance cutoff of 1.5 has different units and cannot be reused directly. '
             'Production scoring is unchanged.', '',
             'Refresh source trajectories and all reports: `python tools/calculate_horizontal_recoil.py`. '
             'Recalculate speed alone: `python tools/calculate_horizontal_speed.py`.', '',
             '[Origin-distance report](horizontal_recoil.md) | [All-mode speed data](../data/horizontal_recoil_speed.json) | '
             '[100/200/300 ms P90 trial](horizontal_window_speed_trial.md)', '',
             '| Rank | Weapon | Weapon ID | Horizontal speed | Total travel | Duration (s) |',
             '| ---: | --- | --- | ---: | ---: | ---: |']
    for rank, row in enumerate(ranked, 1):
        m = row['metrics']
        lines.append(f"| {rank} | {row['name']} | `{row['weapon_id']}` | {m['horizontal_travel_speed']:.4f} | {m['horizontal_travel']:.4f} | {m['duration_seconds']:.4f} |")
    lines += ['', '## Unavailable automatic weapons', '']
    for row in rows:
        if row['mode'] == 'bd' and row['automatic'] and not row['metrics']:
            lines.append(f"- {row['name']} (`{row['weapon_id']}`): {row['reason']}.")
    lines += ['', 'Validation: 20 points per available path, strictly increasing source timestamps, finite speeds, '
              'cross-mode equality, and a reversal example whose net drift is zero but travel speed is positive.', '']
    (ROOT / 'docs/horizontal_recoil_speed.md').write_text('\n'.join(lines), encoding='utf-8')
    (ROOT / 'data/horizontal_recoil_speed.json').write_text(json.dumps(dict(
        data_version=source['data_version'], shot_count=20,
        definition='sum(abs(delta_x)) / first-to-last shot seconds; first impulse excluded',
        units='source-model units/second', global_verified=False, threshold=None, rows=rows), indent=2) + '\n', encoding='utf-8')
    for row in ranked[:10]:
        print(f"{row['name']}: {row['metrics']['horizontal_travel_speed']:.4f}")


if __name__ == '__main__':
    main()
