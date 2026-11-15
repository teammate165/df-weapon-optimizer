"""Rank fastest 200 ms horizontal speed; retain P90 sensitivity diagnostics."""
import bisect
import json
import math
from pathlib import Path
from calculate_horizontal_speed import travel_speed

ROOT = Path(__file__).resolve().parents[1]
WINDOWS = (100, 200, 300)
SELECTED_WINDOW_MS = 200


def percentile(values, fraction=.9):
    values = sorted(values)
    index = (len(values) - 1) * fraction
    low = int(index)
    return values[low] + (values[min(low + 1, len(values) - 1)] - values[low]) * (index - low)


def window_speed(points, window_ms, step_ms=1):
    times = [p['time_ms'] for p in points]
    assert window_ms > 0 and step_ms > 0
    assert all(b > a for a, b in zip(times, times[1:]))
    end = times[-1] - window_ms
    if end < times[0]:
        return None

    def position(t):
        i = min(max(0, bisect.bisect_right(times, t) - 1), len(times) - 2)
        fraction = (t - times[i]) / (times[i + 1] - times[i])
        return points[i]['x'] + fraction * (points[i + 1]['x'] - points[i]['x'])

    count = math.floor((end - times[0]) / step_ms + 1e-9) + 1
    values = [abs(position(times[0] + i * step_ms + window_ms) -
                  position(times[0] + i * step_ms)) / (window_ms / 1000)
              for i in range(count)]
    assert all(math.isfinite(v) for v in values)
    # The window displacement is piecewise linear in its start time. Its
    # absolute maximum occurs at an endpoint or a knot of x(t) / x(t+window).
    candidates = sorted({times[0], end} | {t for t in times if times[0] <= t <= end}
                        | {t - window_ms for t in times if times[0] <= t - window_ms <= end})
    start = max(candidates, key=lambda t: abs(position(t + window_ms) - position(t)))
    delta = position(start + window_ms) - position(start)
    return dict(p90_speed=percentile(values), sample_count=count,
                fastest_speed=abs(delta) / (window_ms / 1000),
                fastest_start_ms=start, fastest_end_ms=start + window_ms,
                fastest_displacement=delta)


def validate():
    linear = [dict(time_ms=i * 100, x=i * .2) for i in range(20)]
    assert all(abs(window_speed(linear, w)['p90_speed'] - 2) < 1e-10 for w in WINDOWS)
    mirrored = [dict(time_ms=p['time_ms'], x=-p['x']) for p in linear]
    assert abs(window_speed(mirrored, 200)['p90_speed'] - 2) < 1e-10
    alternating = [dict(time_ms=i * 100, x=i % 2) for i in range(20)]
    assert travel_speed(alternating)['horizontal_travel_speed'] == 10
    assert window_speed(alternating, 200)['p90_speed'] < 1e-10
    assert window_speed(linear[:2], 200) is None
    assert abs(window_speed([dict(time_ms=p['time_ms'], x=p['x'] + 30) for p in linear], 200)['p90_speed'] - 2) < 1e-10
    assert abs(window_speed(linear, 200)['fastest_speed'] - 2) < 1e-10
    # Maximum falls at a non-grid knot; a grid-only maximum would miss it.
    pulse = [dict(time_ms=0, x=0), dict(time_ms=200.25, x=0),
             dict(time_ms=400.25, x=2), dict(time_ms=600.5, x=2)]
    peak = window_speed(pulse, 200)
    assert peak['fastest_speed'] == 10 and peak['fastest_start_ms'] == 200.25
    assert window_speed(alternating, 200)['fastest_speed'] < 1e-10


def main():
    validate()
    source = json.loads((ROOT / 'data/horizontal_recoil.json').read_text('utf-8'))
    rows = []
    max_grid_difference = 0
    for r in source['rows']:
        path = r['windows']['20']
        metrics = None
        if path['status'] == 'modeled':
            points = path['points']
            assert len(points) == 20
            metrics = dict(raw_speed=travel_speed(points)['horizontal_travel_speed'], windows={})
            for w in WINDOWS:
                coarse = window_speed(points, w)
                fine = window_speed(points, w, .5)
                assert coarse is not None and fine is not None
                assert coarse['fastest_speed'] == fine['fastest_speed']
                assert coarse['fastest_speed'] + 1e-10 >= coarse['p90_speed']
                difference = abs(coarse['p90_speed'] - fine['p90_speed'])
                max_grid_difference = max(max_grid_difference, difference)
                metrics['windows'][str(w)] = dict(**coarse, half_ms_p90=fine['p90_speed'])
        rows.append(dict(weapon_id=r['weapon_id'], name=r['name'], mode=r['mode'], automatic=r['automatic'],
                         status=path['status'], reason=path['reason'], metrics=metrics))
    for r in rows:
        base = next(b for b in rows if b['mode'] == 'bd' and b['weapon_id'] == r['weapon_id'])
        assert base['metrics'] == r['metrics'] and base['status'] == r['status']
    ranked = [r for r in rows if r['mode'] == 'bd' and r['automatic'] and r['metrics']]
    def ranks(key):
        ordered = sorted(ranked, key=lambda r: (-key(r['metrics']), r['weapon_id']))
        return {r['weapon_id']: i + 1 for i, r in enumerate(ordered)}
    raw_ranks = ranks(lambda m: m['raw_speed'])
    window_ranks = {w: ranks(lambda m: m['windows'][str(w)]['p90_speed']) for w in WINDOWS}
    fine_ranks = {w: ranks(lambda m: m['windows'][str(w)]['half_ms_p90']) for w in WINDOWS}
    peak_ranks = ranks(lambda m: m['windows'][str(SELECTED_WINDOW_MS)]['fastest_speed'])
    lines = ['# Selected horizontal speed: fastest 200 ms, 20 bullets', '',
             '**User-selected metric:** maximum absolute net horizontal speed over any complete 200 ms window within the 20-bullet trace. '
             'Rank directly in model units/second; no P90 reference, percentile selection or default normalization. '
             '100/300 ms values are sensitivity diagnostics. Raw total-travel speed remains a jitter diagnostic. '
             'Selected horizontal multipliers: 1x for speed <=3, 2x for >3 through 4, 3x for >4 through 5, '
             '5x for >5 model units/s. This supersedes the earlier P90 selection. '
             'Lowest Recoil now applies these tiers to each candidate build; this table ranks base builds.', '',
             '`selected_speed = max_t(abs(x(t + 200 ms) - x(t)) / 0.2 s)`', '',
             'The fastest window is evaluated exactly for the piecewise-linear trace at its endpoints and all knots '
             'of x(t) and x(t+200 ms). It does not depend on the diagnostic sampling grid. '
             'Reported window timestamps are relative to the first post-shot point (0 ms). '
             'This measures net window displacement, not total back-and-forth travel inside that window.', '',
             'For comparison only, retain 100, 200 and 300 ms diagnostics using the 90th percentile (P90) of absolute window speeds. '
             'Rank 1 means greatest speed; lower is better. Only uninterrupted 20-bullet automatic ADS base traces are used.', '',
             '`v(t, Δ) = abs(x(t + Δ) - x(t)) / (Δ / 1000)`', '',
             'P90 diagnostic method: piecewise linear interpolation of source post-shot coordinates; sample window starts every 1 ms from the first shot '
             'through the last valid full window. No padding, origin-to-first-shot interval, shortened windows or extrapolation. '
             'Use the linearly interpolated sample percentile at index `(n-1)*0.9`. Equal time sampling avoids weighting slow/fast fire sections equally by shot. '
             'Interpolation is an explicit analysis assumption, not a measured continuous recoil path.', '',
             f"Source snapshot: `{source['data_version']}`. Units: model units/second. {len(ranked)} weapons ranked; six short-magazine automatic weapons excluded. "
             'Three modes agree exactly. See the [optimizer contract](recoil_generator.md#current-horizontal-speed-tiers-2026-11-15) '
             'for default normalization and unsupported-protocol fallback.', '',
             'Reproduce: `python tools/calculate_horizontal_recoil.py` (all reports), or '
             '`python tools/audit_horizontal_window_speed.py` (this trial from retained trajectories).', '',
             '[Raw travel-speed report](horizontal_recoil_speed.md) | [All-mode trial JSON](../data/horizontal_window_speed.json)', '',
             'P90 window speed and mean absolute travel speed summarize different distributions. A window P90 can exceed the raw mean; '
             'their difference is not a measured jitter percentage. Rapid reversals can cancel within a window, while sustained sideways movement remains. '
             'Repeated reversals are not necessarily jitter; real directional snaking can also be suppressed.', '',
             '## Fastest 200 ms ranking', '',
             '| Rank | Weapon | Weapon ID | Speed (model units/s) | Multiplier | Window start (ms) | Window end (ms) |',
             '| ---: | --- | --- | ---: | ---: | ---: | ---: |']
    for r in sorted(ranked, key=lambda r: peak_ranks[r['weapon_id']]):
        wid = r['weapon_id']
        peak = r['metrics']['windows'][str(SELECTED_WINDOW_MS)]
        speed = peak['fastest_speed']
        multiplier = 5 if speed > 5 else 3 if speed > 4 else 2 if speed > 3 else 1
        lines.append(f"| {peak_ranks[wid]} | {r['name']} | `{wid}` | {speed:.4f} | {multiplier} | {peak['fastest_start_ms']:.4f} | {peak['fastest_end_ms']:.4f} |")
    lines += ['', '## P90 sensitivity comparison (diagnostic only)', '',
             '| Weapon | Weapon ID | Raw speed (rank) | 100 ms P90 (rank) | 200 ms P90 (rank) | 300 ms P90 (rank) |',
             '| --- | --- | ---: | ---: | ---: | ---: |']
    for r in sorted(ranked, key=lambda r: peak_ranks[r['weapon_id']]):
        wid, m = r['weapon_id'], r['metrics']
        cells = [f"{m['raw_speed']:.4f} ({raw_ranks[wid]})"]
        cells += [f"{m['windows'][str(w)]['p90_speed']:.4f} ({window_ranks[w][wid]})" for w in WINDOWS]
        lines.append(f"| {r['name']} | `{wid}` | " + ' | '.join(cells) + ' |')
    lines += ['', '## Largest rank drops: raw travel to fastest 200 ms', '', 'Positive drops mean lower horizontal severity relative to other weapons.', '']
    for r in sorted(ranked, key=lambda r: peak_ranks[r['weapon_id']] - raw_ranks[r['weapon_id']], reverse=True)[:8]:
        wid = r['weapon_id']
        lines.append(f"- {r['name']}: {raw_ranks[wid]} → {peak_ranks[wid]}.")
    lines += ['', '## Sensitivity and limits', '',
              f'Maximum absolute P90 difference when halving the sampling step to 0.5 ms: {max_grid_difference:.6f} model units/second.', '']
    for w in WINDOWS:
        flips = sum(window_ranks[w][r['weapon_id']] != fine_ranks[w][r['weapon_id']] for r in ranked)
        lines.append(f'- {w} ms: {flips} rank positions change on the finer grid.')
    lines += ['', 'A synthetic constant 2-unit/second drift remains 2 for all windows. A synthetic alternating 100 ms reversal '
              'has raw travel speed 10 but zero 200 ms net speed. This demonstrates a cancellation blind spot: a particular window can hide periodic motion. '
              'The selected 200 ms window retains this limitation; other windows remain sensitivity checks. Longer windows can hide genuine short directional kicks. '
              'The selected maximum retains brief events that P90 can downweight and may therefore remain sensitive to a sharp one-direction kick. '
              'Keep raw travel and origin-distance diagnostics. This metric lacks perceptual/client validation.', '']
    (ROOT / 'docs/horizontal_window_speed_trial.md').write_text('\n'.join(lines), encoding='utf-8')
    (ROOT / 'data/horizontal_window_speed.json').write_text(json.dumps(dict(
        data_version=source['data_version'], shot_count=20, windows_ms=WINDOWS, percentile=.9,
        selected_window_ms=SELECTED_WINDOW_MS,
        multiplier_tiers=[dict(above=5, multiplier=5), dict(above=4, multiplier=3), dict(above=3, multiplier=2)],
        default_multiplier=1,
        selected_statistic='maximum', selected_units='source-model units/second',
        maximum_method='exact piecewise-linear breakpoints; no P90 normalization',
        interpolation='piecewise linear', sampling_step_ms=1, max_half_step_difference=max_grid_difference,
        global_verified=False, rows=rows), indent=2) + '\n', encoding='utf-8')
    print(f'Window trial: {len(ranked)} weapons; max finer-grid difference {max_grid_difference:.6f}')
    print('\n'.join(lines[-22:]).encode('ascii', errors='replace').decode('ascii'))


if __name__ == '__main__':
    main()
