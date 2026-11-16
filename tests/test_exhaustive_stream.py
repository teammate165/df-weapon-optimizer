"""Real local-process progress, cancellation and recovery for anytime search."""
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from builder_server import execute


class AnytimeStreamTests(unittest.TestCase):
    def test_progress_replay_and_all_modes(self):
        for mode, preset in [('bd', 'recoil'), ('sol', 'agility'), ('mp', 'recoil')]:
            with self.subTest(mode=mode, preset=preset):
                events = []
                request = dict(weapon_id='18070000005', mode=mode, preset=preset, budget=5000000, time_limit_seconds=2)
                result = execute('optimize', request, lambda event: events.append(event) if event else None)
                phases = [event['phase'] for event in events]
                self.assertIn('search_attachments', phases)
                self.assertIn('search_tactical', phases)
                self.assertEqual(phases[-1], 'calibration')
                self.assertFalse(result['attachment_gate']['complete'])
                self.assertEqual(result['solver']['time_limit_scope'], 'total_search')
                self.assertEqual(result['solver']['name'], 'Anytime')
                self.assertFalse(result['solver']['global_optimality'])
                self.assertLessEqual(result['attachment_gate']['budgets'][0]['ordinary_retained'], 256)
                self.assertLessEqual(result['attachment_gate']['budgets'][0]['candidate_count'], 512)
                for row in result['results']:
                    if row['status'] != 'best_found':
                        continue
                    replay = execute('evaluate', dict(weapon_id=request['weapon_id'], mode=mode, config=row['config'], tunes=row['tunes']))
                    self.assertEqual(replay['effective_stats'], row['stats'])
                    self.assertEqual(replay['cost'], row['cost'])

    def test_disconnect_stops_anytime_subprocess_and_can_retry(self):
        children = []
        actual_popen = subprocess.Popen

        def record_child(*args, **kwargs):
            child = actual_popen(*args, **kwargs)
            children.append(child)
            return child

        started = time.perf_counter()
        def disconnect(event):
            if event and event['phase'] == 'search_attachments' and event['evaluated'] > 0 and time.perf_counter() - started > .3:
                raise BrokenPipeError('browser cancelled during anytime search')

        with patch('builder_server.subprocess.Popen', side_effect=record_child):
            with self.assertRaises(BrokenPipeError):
                execute('optimize', dict(weapon_id='18010000001', mode='bd', time_limit_seconds=5), disconnect)
        self.assertLess(time.perf_counter() - started, 4, 'Cancellation did not stop the search promptly')
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll(), 'Cancelled anytime Node process was left running')
        recovered = execute('evaluate', dict(weapon_id='18070000005', mode='bd'))
        self.assertEqual(recovered['stats']['weaponId'], '18070000005')


if __name__ == '__main__':
    unittest.main()
