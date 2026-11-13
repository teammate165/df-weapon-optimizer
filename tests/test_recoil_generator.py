"""Integration checks against the preserved source model (requires Node)."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class GeneratorTests(unittest.TestCase):
    def run_request(self, **options):
        request = dict(weapon_id='18010000001', mode='detonation', passes=2)
        request.update(options)
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory)/'request.json', Path(directory)/'result.json'
            source.write_text(json.dumps(request), encoding='utf-8')
            result = subprocess.run(['python', str(ROOT/'tools/generate_builds.py'), str(source), '--output', str(output)], cwd=ROOT, capture_output=True, text=True)
            return result, json.loads(output.read_text('utf-8')) if output.exists() else None

    def test_tier_caps_fixed_parts_and_replay(self):
        fixed = [dict(slotPath='1', itemId='13030000109')]
        process, result = self.run_request(fixed=fixed)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(result['tier']['gunsmithLimit'], 800)
        self.assertEqual(len(result['results']), 3)
        self.assertEqual([r['label'] for r in result['results']], ['No compromise', 'Cheapest', 'Best price/performance'])
        self.assertEqual(result['cheapest_gate_percent'], 50)
        for row in result['results'][1:]:
            self.assertGreaterEqual(row['effectiveness_percent'] + 1e-7, 50)
        self.assertEqual(result['results'][0]['budget'], 800)
        for row in result['results']:
            self.assertEqual(row['status'], 'best_found')
            self.assertLessEqual(row['cost'], row['budget'])
            self.assertLessEqual(row['score'], 100)
            self.assertTrue(all(any(m['slotPath']==f['slotPath'] and m['itemId']==f['itemId'] for m in row['mounted']) for f in fixed))
        process, repeat = self.run_request(fixed=fixed)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(result, repeat)

    def test_custom_targets_minimums_and_round_trip(self):
        process, result = self.run_request(effectiveness_targets=[60, 85, 95], minimum_stats=dict(control=40, handling=60, stability=50, accuracy=45))
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(len(result['results']), 4)
        anchor = result['results'][0]
        self.assertEqual(anchor['status'], 'best_found')
        costs = []
        import sys
        sys.path.insert(0, str(ROOT/'tools'))
        from builder_server import execute
        for row in result['results']:
            self.assertEqual(row['status'], 'best_found')
            for key, minimum in result['minimum_stats'].items():
                self.assertGreaterEqual(row['stats'][key] + 1e-8, minimum)
            replay = execute('evaluate', dict(weapon_id=result['weapon_id'], mode='bd', config=row['config'], tunes=row['tunes']))
            self.assertEqual(replay['cost'], row['cost'])
            self.assertEqual(row['stats'], replay['effective_stats'])
            if row['target_effectiveness_percent'] is not None:
                self.assertGreaterEqual(row['effectiveness_percent'] + 1e-7, row['target_effectiveness_percent'])
                self.assertLessEqual(row['cost'], anchor['cost'])
                costs.append(row['cost'])
        self.assertEqual(costs, sorted(costs))
        self.assertTrue(any(row['tunes'] for row in result['results']))

    def test_impossible_and_invalid_minimums(self):
        process, result = self.run_request(minimum_stats=dict(handling=10000), passes=1)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertTrue(all(row['status']=='infeasible' for row in result['results']))
        for options in [dict(minimum_stats=dict(range=10)), dict(minimum_stats=dict(control=-1)), dict(effectiveness_targets=[101]), dict(preset='unknown')]:
            process, _ = self.run_request(**options)
            self.assertNotEqual(process.returncode, 0)

    def test_reject_conflicts_and_cap_excess(self):
        process, _ = self.run_request(fixed=[dict(slotPath='999', itemId='13030000109')])
        self.assertNotEqual(process.returncode, 0)
        process, _ = self.run_request(budgets=[100, 500, 801])
        self.assertNotEqual(process.returncode, 0)

    def test_an94_timed_source_model(self):
        process, result = self.run_request(weapon_id='18010000052', shot_count=20)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(result['baseline_recoil_path']['status'], 'modeled')
        self.assertAlmostEqual(result['baseline_recoil_path']['points'][2]['time_ms'], 200/3)
        checks = subprocess.run(['node', str(ROOT/'tests/timed_recoil.mjs'), str(ROOT/'.scratch/generator')], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(checks.returncode, 0, checks.stderr)


if __name__ == '__main__':
    unittest.main()
