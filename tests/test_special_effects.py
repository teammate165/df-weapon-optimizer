"""Default enabled tactical effects and real optic optimizer dependencies."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from builder_server import ROOT, pack, execute


class SpecialEffectsTests(unittest.TestCase):
    def test_source_lasers_and_riser_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / 'pack.json'
            fixture.write_text(json.dumps(pack('18010000001')), 'utf-8')
            jad = Path(directory) / 'jad.json'
            jad.write_text(json.dumps(pack('18070000003')), 'utf-8')
            subprocess.run(['node', str(ROOT / 'tests/special_effects.mjs'), str(fixture), str(jad)], check=True)

    def test_generated_riser_requires_optic_and_round_trips(self):
        fixed = [dict(slotPath='11', itemId='13210000013'),
                 dict(slotPath='4/17', itemId='13160000006')]
        result = execute('optimize', dict(weapon_id='18010000001', mode='mp', fixed=fixed, passes=1))
        best = result['results'][0]
        self.assertEqual(best['status'], 'best_found')
        mounted = best['mounted']
        for lock in fixed:
            self.assertTrue(any(m['slotPath'] == lock['slotPath'] and m['itemId'] == lock['itemId'] for m in mounted))
        for riser in [m for m in mounted if m['itemId'] in ('13210000012', '13210000013', '13210000014')]:
            self.assertTrue(any(m['slotPath'].startswith(riser['slotPath'] + '/') and m['itemId'].startswith('1311') for m in mounted))
        evaluated = execute('evaluate', dict(weapon_id='18010000001', mode='mp', config=best['config'], tunes=best['tunes']))
        self.assertEqual(evaluated['effective_stats'], best['stats'])
        self.assertEqual(evaluated['cost'], best['cost'])


if __name__ == '__main__':
    unittest.main()
