import json
import sqlite3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from firing_timeline import AutomaticTiming, firing_timeline, install_observation, load_timing


class TimingTests(unittest.TestCase):
    def test_database_override_preserves_catalog_and_all_modes(self):
        with sqlite3.connect(':memory:') as db:
            with sqlite3.connect(ROOT / 'delta_force_weapons.sqlite') as source:
                source.backup(db)
            before = db.execute('SELECT * FROM weapon_mode_stats ORDER BY weapon_id,mode').fetchall()
            legacy = db.execute('SELECT * FROM weapons ORDER BY profile_key').fetchall()
            install_observation(db)
            install_observation(db)
            for mode in ('sol', 'mp', 'bd'):
                timing = load_timing(db, '18010000052:base', mode)
                actual = firing_timeline(timing, [(0, 400)])
                for got, expected in zip(actual, [0, 100/3, 200/3, 500/3, 800/3, 1100/3]):
                    self.assertAlmostEqual(got, expected)
                self.assertEqual(len(actual), 6)
                with self.assertRaisesRegex(ValueError, 'unmeasured'):
                    firing_timeline(timing, [(0, 200), (500, 700)])
            self.assertEqual(before, db.execute('SELECT * FROM weapon_mode_stats ORDER BY weapon_id,mode').fetchall())
            self.assertEqual(legacy, db.execute('SELECT * FROM weapons ORDER BY profile_key').fetchall())

    def test_synthetic_reset_boundary_and_reference(self):
        # Artificial 200 ms threshold tests algorithm only, not AN94 game behavior.
        for reference, restart, should_reset in [
            ('last_shot', 299, False), ('last_shot', 300, True),
            ('trigger_release', 300, False), ('trigger_release', 350, True),
        ]:
            timing = AutomaticTiming((50, 50), 100, 200, reference)
            shots = firing_timeline(timing, [(0, 150), (restart, restart + 160)])
            self.assertEqual(shots[3], restart)
            self.assertEqual(shots[4] - shots[3], 50 if should_reset else 100)

    def test_short_pause_keeps_cooldown_and_sequence(self):
        timing = AutomaticTiming((50, 50), 100, 200, 'trigger_release')
        self.assertEqual(firing_timeline(timing, [(0, 110), (120, 301)]), [0, 50, 100, 200, 300])

    def test_constant_rate_and_release_boundary(self):
        self.assertEqual(firing_timeline(AutomaticTiming((), 100), [(0, 300)]), [0, 100, 200])
        self.assertEqual(firing_timeline(AutomaticTiming((), 100), []), [])
        with self.assertRaises(ValueError):
            firing_timeline(AutomaticTiming((), 100), [(20, 10)])


if __name__ == '__main__':
    unittest.main()
