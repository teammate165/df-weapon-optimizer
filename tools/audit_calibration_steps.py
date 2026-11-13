"""Audit declared UI calibration grids in the preserved source inventory."""
import csv
import hashlib
import json
from collections import Counter
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    source = ROOT / 'data/calibration/controls.csv'
    with source.open(encoding='utf-8-sig', newline='') as handle:
        rows = list(csv.DictReader(handle))
    enabled = [r for r in rows if r['enabled'] == 'True']
    steps, counts = Counter(), Counter()
    examples = {}
    for row in enabled:
        discrete = row['slider_type'] == 'Discrete'
        step = Decimal(row['notch'] or '12.5') if discrete else Decimal(row['step'])
        if step <= 0:
            count = 1
        else:
            span = (Decimal(row['max_value']) - Decimal(row['min_value'])) / step
            # JS Math.round for nonnegative range widths, not Python bankers rounding.
            count = int((span + Decimal('.5')).to_integral_value(rounding='ROUND_FLOOR')) + 1
        key = f'{row["slider_type"]}:{step}'
        steps[key] += 1
        counts[str(count)] += 1
        examples.setdefault(key, {k: row[k] for k in ('item_id', 'tune_id', 'context', 'min_value', 'max_value', 'default_value', 'dimension', 'unit')})
    result = dict(source='data/calibration/controls.csv', source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                  data_version='20261108-an94-bd-shop.1', contexts=len(rows), enabled_contexts=len(enabled),
                  scope='Declared website-source grids, not measured Global/Garena client precision',
                  effective_step_histogram=dict(sorted(steps.items())), ui_position_count_histogram=dict(sorted(counts.items(), key=lambda kv: int(kv[0]))), examples=examples)
    target = ROOT / 'data/calibration/step_audit.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'examples'}, ensure_ascii=True))


if __name__ == '__main__':
    main()
