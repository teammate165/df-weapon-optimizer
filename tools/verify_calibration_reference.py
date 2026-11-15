"""Run executable calibration checks against the deployed dfttk JavaScript.

uv run --no-project tools/verify_calibration_reference.py
Requires Node.js. Downloaded code runs locally; no browser or game required.
"""
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path

from sync_dfttk_database import ROOT, assemble, load


def main():
    directory = ROOT / '.scratch' / 'calibration-check'
    directory.mkdir(parents=True, exist_ok=True)
    names = dict(curves='weaponBuilderV3Curves-xeDUt094.js',
                 kernel='weaponBuilderV3FireControl-C-hA1uh4.js',
                 attributes='weaponBuilderV3AttributeCalculator-DsSa40Fx.js')
    sources = {}
    for key, filename in names.items():
        url = 'https://dfttk.com/static/' + filename
        body = urllib.request.urlopen(url, timeout=45).read()
        sources[key] = dict(url=url, sha256=hashlib.sha256(body).hexdigest())
        text = body.decode('utf-8')
        (directory / filename).write_bytes(body)
        if key == 'kernel':
            # Remove unrelated React selector UI and preserve calculator functions.
            # The retained functions are unchanged; add test-only exports.
            text = 'import{c,m as l,r as u,t as d}from"./curves.mjs";var ' + text[text.index('v=/(?:FireCD'):]
            text = text.replace(',_ as p', '') + '\nexport{k,A,j};\n'
        if key == 'attributes':
            text = text.replace('./' + names['curves'], './curves.mjs').replace('./' + names['kernel'], './kernel.mjs')
        (directory / (key + '.mjs')).write_text(text, encoding='utf-8')
    manifest = load('manifest.json')
    pack = assemble(manifest['weaponPacks']['18010000001'])
    (directory / 'pack.json').write_text(json.dumps(pack), encoding='utf-8')
    (directory / 'inventory.json').write_bytes((ROOT / 'data' / 'calibration' / 'inventory.json').read_bytes())
    (directory / 'package.json').write_text('{"type":"module"}\n', encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'tests' / 'calibration_reference.mjs'), str(directory)], check=True)
    result = json.loads((directory / 'results.json').read_text('utf-8'))
    result.update(data_version=manifest['dataVersion'], runtime_version=manifest['version'], sources=sources,
        execution='Local Node execution of deployed source; kernel UI prefix removed, test-only exports added; calculator functions unchanged.')
    output = ROOT / 'data' / 'calibration' / 'reference_checks.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Evidence:', output)
    # Source parity above is checked before adding the explicit project policy.
    from prepare_project_runtime import prepare
    prepare(directory)


if __name__ == '__main__':
    main()
