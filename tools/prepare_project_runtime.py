"""Install a narrow project policy in generated calculator modules, preserving raw sources."""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
MARKER = "import {nonstackLaserOperations} from './laser_effects.mjs';\n"
CHART_MARKER = '// Project pinned-source chart accessor v1\n'
ATTRIBUTE_SHA256 = '6cbf4c9f3f065552987922bed7b7fd6df94b4679c74d8d84ea32e807ecea1850'
STATE_KERNEL_SHA256 = 'fdb5afdc78af20d5d4c88eb2af17dfd6a20652b18677cc8d5824edb42b5a9d09'
LASER_POLICY_SHA256 = '1898c81a9ea892c3f4cac806595ab0884d67209e9286abb5fa6462b5e6d4692c'
STATE_MARKER = '// Project native default-state prefix accessor v1\n'
STATE_ACCESSOR = STATE_MARKER + "Object.defineProperty(R,'screeningStateContract',{value:Object.freeze({version:1,evaluate:R,single:j,collect:N,references:P,numeric:F,targets:I,mapped:L,value:A,selectOperations:nonstackLaserOperations,policy:'strongest_per_stat_v1'})});\n"
NUMERIC_OLD = b'function F(e,t){let n=D();for'
NUMERIC_NEW = b'function F(e,t,n=D()){for'


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
    # Keep default two-argument numeric evaluation identical, while allowing
    # the exact native fold to resume from a privately cloned prefix Map.
    state_base = directory / 'kernel.state-cache-base.mjs'
    raw_kernel = path.read_bytes()
    original = raw_kernel if hashlib.sha256(raw_kernel).hexdigest() == STATE_KERNEL_SHA256 else None
    if original is None and state_base.exists():
        candidate = state_base.read_bytes()
        if hashlib.sha256(candidate).hexdigest() == STATE_KERNEL_SHA256:
            owned = candidate.replace(NUMERIC_OLD, NUMERIC_NEW) + b'\n' + STATE_ACCESSOR.encode('ascii')
            if raw_kernel == owned:
                original = candidate
    if original is not None:
        policy_known = hashlib.sha256(helper).hexdigest() == LASER_POLICY_SHA256
        if policy_known and original.count(NUMERIC_OLD) == 1:
            state_base.write_bytes(original)
            prepared = original.replace(NUMERIC_OLD, NUMERIC_NEW) + b'\n' + STATE_ACCESSOR.encode('ascii')
        else:
            prepared = original  # A changed laser policy uses whole-state evaluation.
        if raw_kernel != prepared:
            path.write_bytes(prepared)
    # Expose the actual native trajectory function only for this exact source
    # revision. Unknown calculators keep full scoring; never infer compatibility
    # from a function name or silently duplicate an upstream numeric algorithm.
    attributes = directory / 'attributes.mjs'
    if attributes.exists():
        raw = attributes.read_bytes()
        if hashlib.sha256(raw).hexdigest() == ATTRIBUTE_SHA256:
            (directory / 'attributes.unmodified.mjs').write_bytes(raw)
            accessor = CHART_MARKER + "Object.defineProperty(h,'screeningChartContract',{value:Object.freeze({version:1,calculate:h,trajectory:f,kernel:Object.freeze({d:n,n:a,r:s,s:c,t:l,u})})});\n"
            attributes.write_bytes(raw + b'\n' + accessor.encode('ascii'))


if __name__ == '__main__':
    prepare()
