"""Offline integration checks against the downloaded, hash-verified source snapshot.

Run: uv run --no-project python -m unittest discover -s tests -v
"""
import contextlib
import io
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import sync_dfttk_database as sync


class DfttkSyncTests(unittest.TestCase):
    def test_complete_sync_and_repeat_preserve_source_values_and_unrelated_data(self):
        translations_before = (ROOT / 'translation/translations.json').read_bytes()
        # TemporaryDirectory owns this workspace-local test directory only.
        with tempfile.TemporaryDirectory(prefix='dfttk-test-', dir=ROOT / '.scratch') as temp:
            test_root = Path(temp).resolve()
            self.assertTrue(test_root.is_relative_to((ROOT / '.scratch').resolve()))
            database = test_root / 'catalog.sqlite'
            with contextlib.closing(sqlite3.connect(ROOT / 'delta_force_weapons.sqlite')) as src, contextlib.closing(sqlite3.connect(database)) as target:
                src.backup(target)
            with contextlib.closing(sqlite3.connect(database)) as db:
                prices_before = db.execute('SELECT * FROM prices ORDER BY item_type,item_id').fetchall()
                # Plant one known mismatch to prove conflict resolution and its audit.
                old = json.loads(db.execute("SELECT record_json FROM weapons WHERE profile_key='18010000001:base'").fetchone()[0])
                old['rpm'] = 123
                db.execute("UPDATE weapons SET rpm=123,record_json=? WHERE profile_key='18010000001:base'", (sync.encode(old),))
                db.commit()
            with contextlib.redirect_stdout(io.StringIO()):
                first = sync.synchronize(database, test_root / 'artifacts')
            with contextlib.closing(sqlite3.connect(database)) as db:
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
                self.assertEqual(db.execute('SELECT count(*) FROM weapon_mode_stats').fetchone()[0], 207)
                for mode in ('sol', 'mp', 'bd'):
                    library = sync.load('library/' + mode + '.json')
                    actual = {item: json.loads(raw) for item, raw in db.execute('SELECT weapon_id,library_json FROM weapon_mode_stats WHERE mode=?', (mode,))}
                    self.assertEqual(actual, library['weapons'])
                    actual_parts = {item: json.loads(raw) for item, raw in db.execute('SELECT item_id,record_json FROM part_mode_stats WHERE mode=?', (mode,))}
                    self.assertEqual(actual_parts, library['parts'])
                    for wid, rpm, armor, damage, raw in db.execute('SELECT weapon_id,rpm,armor_damage,flesh_damage,record_json FROM weapon_mode_stats WHERE mode=?', (mode,)):
                        summary = sync.load('catalog/weapons.json')['objects'][wid]['combatSummaryByMode'][mode]
                        self.assertEqual(damage, summary['baseFleshDamage'])
                        self.assertEqual(armor, summary['baseArmorDamage'])
                        self.assertEqual(rpm, summary['fireRateRpm'])
                        self.assertEqual(json.loads(raw)['mode'], mode)
                self.assertEqual(db.execute("SELECT armor_damage FROM weapon_mode_stats WHERE weapon_id='18010000001' AND mode='mp'").fetchone()[0], 0)
                self.assertEqual(db.execute("SELECT rpm FROM weapons WHERE profile_key='18010000001:base'").fetchone()[0], 800)
                self.assertTrue(db.execute("SELECT 1 FROM dfttk_conflicts WHERE run_id=? AND entity_id='18010000001:base' AND field_path='/rpm' AND previous_json='123' AND incoming_json='800.0'", (first['run_id'],)).fetchone())
                self.assertEqual(prices_before, db.execute('SELECT * FROM prices ORDER BY item_type,item_id').fetchall())
                # Every legacy tune column must agree with its full JSON record.
                for item, raw in db.execute('SELECT item_id,record_json FROM parts'):
                    for tune in json.loads(raw).get('tunes', []):
                        self.assertEqual(db.execute('SELECT min_value,max_value,step,default_value FROM part_tunes WHERE item_id=? AND tune_id=?', (item, tune['tune_id'])).fetchone(),
                                         tuple(tune[key] for key in ('min_value', 'max_value', 'step', 'default_value')))
            with contextlib.redirect_stdout(io.StringIO()):
                second = sync.synchronize(database, test_root / 'artifacts')
            self.assertEqual(second['changes'], {})
            self.assertEqual((ROOT / 'translation/translations.json').read_bytes(), translations_before)

    def test_corrupt_cache_is_rejected_before_database_mutation(self):
        sources = sync.load('download_provenance.json')
        source_key = next(iter(sources))
        sources[source_key]['sha256'] = '0' * 64
        original_load = sync.load
        with patch.object(sync, 'load', side_effect=lambda p: sources if p == 'download_provenance.json' else original_load(p)):
            with self.assertRaisesRegex(ValueError, 'Cache hash mismatch'):
                sync.synchronize(ROOT / '.scratch' / 'must-not-create.sqlite')
        self.assertFalse((ROOT / '.scratch' / 'must-not-create.sqlite').exists())


if __name__ == '__main__':
    unittest.main()
