"""Only the pinned native calculator gets the fast chart accessor."""
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from prepare_project_runtime import prepare, ROOT, ATTRIBUTE_SHA256, CHART_MARKER


class ScoringRuntimeTests(unittest.TestCase):
    def test_pinned_accessor_is_idempotent_and_preserves_original(self):
        raw = (ROOT / '.scratch/calibration-check/attributes.unmodified.mjs').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), ATTRIBUTE_SHA256)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'kernel.mjs').write_bytes((ROOT / '.scratch/calibration-check/kernel.mjs').read_bytes())
            (path / 'attributes.mjs').write_bytes(raw)
            prepare(path)
            prepared = (path / 'attributes.mjs').read_bytes()
            self.assertIn(CHART_MARKER.encode(), prepared)
            self.assertEqual((path / 'attributes.unmodified.mjs').read_bytes(), raw)
            prepare(path)
            self.assertEqual((path / 'attributes.mjs').read_bytes(), prepared)

    def test_unknown_calculator_is_left_unmodified(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'kernel.mjs').write_bytes((ROOT / '.scratch/calibration-check/kernel.mjs').read_bytes())
            raw = b'export function t() { return {}; }\n'
            (path / 'attributes.mjs').write_bytes(raw)
            prepare(path)
            self.assertEqual((path / 'attributes.mjs').read_bytes(), raw)
            self.assertFalse((path / 'attributes.unmodified.mjs').exists())


if __name__ == '__main__':
    unittest.main()
