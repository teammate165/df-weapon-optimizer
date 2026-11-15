"""Install a narrow project policy in generated calculator modules, preserving raw sources."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "import {nonstackLaserOperations} from './laser_effects.mjs';\n"


def prepare(directory=None):
    directory = Path(directory or ROOT / '.scratch/calibration-check')
    path = directory / 'kernel.mjs'
    text = path.read_text('utf-8')
    if MARKER not in text:
        needle = 'return{operations:l,appliedParts:f,ammo:g}'
        if text.count(needle) != 1:
            raise ValueError('Source kernel contract changed; review laser-policy insertion before proceeding')
        (directory / 'kernel.unmodified.mjs').write_text(text, encoding='utf-8')
        text = MARKER + text.replace(needle, 'return{operations:nonstackLaserOperations(l),appliedParts:f,ammo:g}')
        path.write_text(text, encoding='utf-8')
    helper = (ROOT / 'tools/laser_effects.mjs').read_bytes()
    target = directory / 'laser_effects.mjs'
    if not target.exists() or target.read_bytes() != helper:
        target.write_bytes(helper)


if __name__ == '__main__':
    prepare()
