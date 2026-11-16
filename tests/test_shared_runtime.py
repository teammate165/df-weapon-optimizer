"""Pinned native folding shim preserves originals and rejects changed sources/policies."""
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import prepare_project_runtime as runtime


class SharedRuntimeTests(unittest.TestCase):
    def test_pinned_shim_is_idempotent_and_policy_change_restores_original(self):
        raw = (runtime.ROOT / '.scratch/calibration-check/kernel.state-cache-base.mjs').read_bytes()
        helper = (runtime.ROOT / 'tools/laser_effects.mjs').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), runtime.STATE_KERNEL_SHA256)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'tools').mkdir()
            (root / 'tools/laser_effects.mjs').write_bytes(helper)
            output = root / 'output'
            output.mkdir()
            (output / 'kernel.mjs').write_bytes(raw)
            with patch.object(runtime, 'ROOT', root):
                runtime.prepare(output)
                prepared = (output / 'kernel.mjs').read_bytes()
                self.assertIn(runtime.STATE_MARKER.encode(), prepared)
                self.assertEqual((output / 'kernel.state-cache-base.mjs').read_bytes(), raw)
                runtime.prepare(output)
                self.assertEqual((output / 'kernel.mjs').read_bytes(), prepared)
                (root / 'tools/laser_effects.mjs').write_bytes(helper + b'\n// changed policy\n')
                runtime.prepare(output)
                self.assertEqual((output / 'kernel.mjs').read_bytes(), raw)
                runtime.prepare(output)
                self.assertEqual((output / 'kernel.mjs').read_bytes(), raw)

    def test_unknown_kernel_is_not_given_accessor(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            raw = runtime.MARKER.encode() + b'export function u() {}\n'
            (output / 'kernel.mjs').write_bytes(raw)
            runtime.prepare(output)
            self.assertEqual((output / 'kernel.mjs').read_bytes(), raw)
            self.assertFalse((output / 'kernel.state-cache-base.mjs').exists())


if __name__ == '__main__':
    unittest.main()
