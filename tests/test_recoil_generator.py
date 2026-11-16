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
        self.assertEqual(result['objective_names'], ['ads_recoil', 'handling'])
        self.assertEqual(len(result['results']), 3)
        self.assertEqual([r['label'] for r in result['results']], ['Max', 'Balanced', 'Min'])
        self.assertEqual(result['cheapest_gate_percent'], 50)
        for row in result['results'][1:]:
            if row['status']=='best_found':
                self.assertGreaterEqual(row['effectiveness_percent'] + 1e-7, 50)
        self.assertEqual(result['results'][0]['budget'], 800)
        for row in result['results']:
            if row['status']=='unavailable':
                self.assertNotEqual(row['label'],'Max')
                continue
            self.assertEqual(row['status'], 'best_found')
            self.assertLessEqual(row['cost'], row['budget'])
            self.assertLessEqual(row['score'], 100)
            self.assertAlmostEqual(row['score'], 100-row['loss'])
            self.assertAlmostEqual(row['objectives'][0], row['loss'])
            expected_handling=50*(row['components']['ads_seconds']/result['baseline']['ads_seconds']+row['components']['sprint_to_fire_seconds']/result['baseline']['sprint_to_fire_seconds'])
            self.assertAlmostEqual(row['objectives'][1], expected_handling)
            c = row['components']
            self.assertEqual(c['pattern_model'], 'ads-chart-speed-tier-v2')
            points = row['recoil_path']['points']
            horizontal = max(p['x'] for p in points) - min(p['x'] for p in points)
            vertical = max(p['y'] for p in points) - min(p['y'] for p in points)
            self.assertAlmostEqual(c['horizontal_span'], horizontal)
            import sys
            sys.path.insert(0, str(ROOT/'tools'))
            from audit_horizontal_window_speed import window_speed
            speed = window_speed(points, 200)['fastest_speed']
            multiplier = 10 if speed > 5 else 6 if speed > 4 else 4 if speed > 3 else 1
            self.assertAlmostEqual(c['horizontal_speed'], speed)
            self.assertEqual(c['horizontal_multiplier'], multiplier)
            distance = max(abs(p['x']) for p in points)
            self.assertAlmostEqual(c['horizontal_distance'], distance)
            self.assertAlmostEqual(c['pattern'], vertical + multiplier * distance)
            expected_loss = 100 * sum(w * c[k] / result['baseline'][k] for k, w in result['weights'].items()) / sum(result['weights'].values())
            self.assertAlmostEqual(row['loss'], expected_loss)
            self.assertTrue(all(any(m['slotPath']==f['slotPath'] and m['itemId']==f['itemId'] for m in row['mounted']) for f in fixed))
        process, repeat = self.run_request(fixed=fixed)
        self.assertEqual(process.returncode, 0, process.stderr)
        # Wall-time-limited anytime runs may terminate at different incumbents;
        # elapsed times/bounds are not deterministic output fields.
        self.assertEqual(result['solver']['name'],'Anytime')
        self.assertEqual(repeat['solver']['name'],'Anytime')
        self.assertEqual(result['minimum_stats'],repeat['minimum_stats'])
        self.assertEqual([r['label'] for r in result['results']],[r['label'] for r in repeat['results']])
        self.assertEqual(repeat['results'][0]['status'],'best_found')
        for row in repeat['results']:
            if row['status']=='best_found':
                self.assertLessEqual(row['cost'],row['budget'])
                self.assertTrue(all(any(m['slotPath']==f['slotPath'] and m['itemId']==f['itemId'] for m in row['mounted']) for f in fixed))

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
        self.assertEqual([r['label'] for r in result['results']], ['Max', 'Balanced', 'Min'])
        self.assertTrue(all(row['status']=='not_found' for row in result['results']))
        for options in [dict(minimum_stats=dict(range=10)), dict(minimum_stats=dict(control=-1)), dict(effectiveness_targets=[101]), dict(preset='unknown')]:
            process, _ = self.run_request(**options)
            self.assertNotEqual(process.returncode, 0)

    def test_no_distinct_alternative_is_unavailable_instead_of_duplicated(self):
        process, result = self.run_request(budgets=[0], passes=1)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual([r['label'] for r in result['results']], ['Max', 'Balanced', 'Min'])
        self.assertEqual(result['results'][0]['status'], 'best_found')
        self.assertEqual(result['results'][0]['cost'], 0)
        self.assertTrue(all(r['status']=='unavailable' for r in result['results'][1:]))

    def test_m4a1_detonation_recoil_categories_are_distinct(self):
        process, result = self.run_request(preset='recoil', passes=8)
        self.assertEqual(process.returncode, 0, process.stderr)
        rows = result['results']
        self.assertEqual([r['label'] for r in rows], ['Max', 'Balanced', 'Min'])
        self.assertEqual(len({json.dumps([r['config'], r['tunes']], sort_keys=True) for r in rows}), 3)
        self.assertGreater(rows[0]['score'], rows[1]['score'])
        self.assertGreater(rows[1]['score'], rows[2]['score'])
        self.assertGreater(rows[0]['cost'], rows[1]['cost'])
        self.assertGreater(rows[1]['cost'], rows[2]['cost'])
        self.assertTrue(all(r['category_note'] is None for r in rows))

    def test_reject_conflicts_and_cap_excess(self):
        process, _ = self.run_request(fixed=[dict(slotPath='999', itemId='13030000109')])
        self.assertNotEqual(process.returncode, 0)
        process, _ = self.run_request(budgets=[100, 500, 801])
        self.assertNotEqual(process.returncode, 0)

    def test_agility_preset_and_source_replay(self):
        checks = subprocess.run(['node', str(ROOT/'tests/agility_optimizer.mjs')], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(checks.returncode, 0, checks.stderr)
        import sys
        sys.path.insert(0, str(ROOT/'tools'))
        from builder_server import execute
        for mode in ['detonation', 'warfare', 'operations']:
            process, result = self.run_request(preset='agility', mode=mode, budget=300000, passes=1)
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertEqual(result['selection'], 'weighted')
            self.assertEqual(result['recoil_context'], 'ads')
            self.assertEqual(result['objective_names'], ['weighted_agility'])
            self.assertEqual([r['label'] for r in result['results']], ['Max', 'Balanced', 'Min'])
            self.assertEqual(result['output_standard'], 'max_balanced_min')
            available=[r for r in result['results'] if r['status']=='best_found']
            self.assertEqual(len({r['signature'] for r in available}), len(available))
            if mode=='warfare':
                self.assertEqual(len(available), 1)
                self.assertTrue(all(r['status']=='unavailable' for r in result['results'][1:]))
            else:
                self.assertEqual(len(available), 3)
                self.assertGreater(available[0]['cost'], available[1]['cost'])
                self.assertGreater(available[1]['cost'], available[2]['cost'])
                self.assertTrue(all(r['effectiveness_percent']+1e-7>=50 for r in available[1:]))
            for alternative in available:
                replay=execute('evaluate',dict(weapon_id=result['weapon_id'],mode=result['mode'],config=alternative['config'],tunes=alternative['tunes']))
                c = alternative['components']
                b = result['baseline']
                expected = 25*(c['ads_seconds']/b['ads_seconds'] + c['sprint_to_fire_seconds']/b['sprint_to_fire_seconds']) + 30*c['accuracy']/b['accuracy'] + 0.2*c['recoil']
                self.assertAlmostEqual(alternative['loss'], expected)
                self.assertEqual(alternative['stats'],replay['effective_stats'])
                self.assertEqual(alternative['cost'],replay['cost'])
            row = result['results'][0]
            self.assertEqual(row['status'], 'best_found')
            replay = execute('evaluate', dict(weapon_id=result['weapon_id'], mode=result['mode'], config=row['config'], tunes=row['tunes']))
            self.assertEqual(row['stats'], replay['effective_stats'])
            self.assertEqual(row['cost'], replay['cost'])
            self.assertLessEqual(row['score'], 100 + 1e-8)
            self.assertEqual(row['objectives'][0], row['loss'])
            self.assertAlmostEqual(row['score'], 100-row['loss'])
            self.assertEqual(result['baseline_score'], 0)
            self.assertEqual(result['score_direction'], 'higher')
            self.assertAlmostEqual(row['components']['accuracy'], replay['stats']['current']['waist']['hipSpreadDeg'])
            self.assertNotIn('jumping_spread_proxy_deg', row['components'])
            self.assertEqual(row['label'], 'Max')
            self.assertTrue(result['limitations'])
        process, _ = self.run_request(preset='agility', effectiveness_targets=[50])
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
