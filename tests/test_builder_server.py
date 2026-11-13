"""Builder API integration: real source resolution and optimizer result round-trip."""
import sys
import json
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from builder_server import execute


class BuilderTests(unittest.TestCase):
    def test_generated_build_round_trip_and_modes(self):
        for mode in ('bd', 'mp', 'sol'):
            with self.subTest(mode=mode):
                request = dict(weapon_id='18010000001', mode=mode, shot_count=20, passes=2)
                if mode == 'sol':
                    request['budget'] = 300000
                result = execute('optimize', request)
                self.assertEqual([r['label'] for r in result['results']], ['Max', 'Balanced', 'Min'])
                base = execute('evaluate', dict(weapon_id=request['weapon_id'], mode=mode))
                self.assertEqual(result['baseline_stats'], base['effective_stats'])
                for row in result['results']:
                    if row['status']=='unavailable':
                        self.assertEqual(mode,'mp')
                        continue
                    self.assertEqual(row['status'], 'best_found')
                    evaluated = execute('evaluate', dict(request, config=row['config'], tunes=row['tunes']))
                    self.assertEqual(evaluated['cost'], row['cost'])
                    self.assertEqual(evaluated['build']['config'], row['config'])
                    if mode == 'bd':
                        self.assertEqual(row['budget'], 800)
                    if mode == 'mp':
                        self.assertIsNone(row['cost'])
                        self.assertIsNone(row['budget'])

    def test_invalid_mode_and_calibration(self):
        with self.assertRaisesRegex(ValueError, 'Unknown mode'):
            execute('evaluate', dict(weapon_id='18010000001', mode='invalid'))
        with self.assertRaisesRegex(ValueError, 'Invalid calibration'):
            execute('evaluate', dict(weapon_id='18010000001', mode='bd', config=[dict(slotPath='1', itemId='13030000109')], tunes={'1': {'authoring:part:13030000109:tune:thickness:0': 999}}))

    def test_part_comparisons_match_independent_builds_and_preserve_current_tuning(self):
        request = dict(weapon_id='18010000001', mode='bd', config=[dict(slotPath='1', itemId='13030000109')])
        initial = execute('evaluate', request)
        control = initial['controls'][0]
        request['tunes'] = {control['slotPath']: {control['id']: control['values'][-1]}}
        compared = execute('evaluate', dict(request, compare_slot='1'))
        by_item = {row['itemId']: row for row in compared['comparisons']}
        for item_id in ('', '13030000109', '13030000111'):
            with self.subTest(item_id=item_id):
                expected_request = dict(request)
                if item_id != '13030000109':
                    expected_request['config'] = [dict(slotPath='1', itemId=item_id)] if item_id else []
                    expected_request['tunes'] = {}
                expected = execute('evaluate', expected_request)['stats']['current']
                self.assertTrue(by_item[item_id]['available'])
                for group, fields in by_item[item_id]['stats'].items():
                    for key, value in fields.items():
                        self.assertEqual(value, expected[group][key], f'{group}.{key}')

    def test_response_curves_match_preserved_reference_and_current_tuned_build(self):
        root = Path(__file__).resolve().parents[1]
        references = json.loads((root / 'data/stat_curves/responses.json').read_text('utf-8'))['responses']
        mappings = {
            '3': ('control', {'vertical': 'auto_vertical', 'horizontal': 'auto_horizontal', 'random_kick': 'random_kick', 'spring_kick': 'spring_kick'}),
            '5': ('handling', {'ads': 'ads_ms', 'sprint_to_fire': 'sprint_to_fire_ms', 'ads_move': 'ads_move_mps'}),
            '6': ('stability', {'breath': 'breath_deg', 'hold': 'hold_breath_s', 'held_recoil': 'held_recoil', 'hit': 'hit_sway', 'movement': 'move_sway'}),
            '4': ('accuracy', {'hip': 'hip_deg', 'maximum': 'hip_max_deg', 'moving': 'hip_moving_deg'}),
        }
        for mode in ('bd', 'sol', 'mp'):
            for attribute, (stat, metrics) in mappings.items():
                with self.subTest(mode=mode, attribute=attribute):
                    result = execute('evaluate', dict(weapon_id='18010000001', mode=mode, response_stat=attribute))
                    curve = result['response_curve']
                    reference = next(r for r in references if r['weapon_id'] == '18010000001' and r['mode'] == mode and r['stat'] == stat)
                    for key, reference_key in metrics.items():
                        actual = next(s for s in curve['series'] if s['key'] == key)
                        expected = next(s for s in reference['series'] if s['key'] == reference_key)
                        for point in (0, 50, 100, 150):
                            self.assertAlmostEqual(actual['values'][curve['xs'].index(point)], expected['values'][reference['xs'].index(point)], places=8)
        request = dict(weapon_id='18010000001', mode='bd', config=[dict(slotPath='1', itemId='13030000111')])
        initial = execute('evaluate', request)
        control = initial['controls'][0]
        request['tunes'] = {control['slotPath']: {control['id']: control['values'][-1]}}
        result = execute('evaluate', dict(request, response_stat='3'))
        curve = result['response_curve']
        self.assertEqual(curve['current_main'], result['stats']['current']['mainAttr']['3'])
        index = curve['xs'].index(curve['current_main'])
        self.assertAlmostEqual(curve['series'][0]['values'][index], result['stats']['current']['raw']['aimContinueVerticalRecoilScale'])
        an94 = execute('evaluate', dict(weapon_id='18010000052', mode='bd', response_stat='3'))
        curve = an94['response_curve']
        self.assertAlmostEqual(curve['series'][0]['values'][curve['xs'].index(curve['current_main'])], an94['stats']['current']['raw']['aimContinueVerticalRecoilScale'])


if __name__ == '__main__':
    unittest.main()
