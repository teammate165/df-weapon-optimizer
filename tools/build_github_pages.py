"""Export an image-free, server-free GitHub Pages site from the local catalog."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

from builder_server import ROOT, REFERENCE, catalog, pack


def version_browser_assets(destination):
    """Version the complete browser graph, including worker imports, as one release."""
    files = sorted(p for p in destination.rglob('*')
                   if p.is_file() and p.name != 'release.json' and '.git' not in p.relative_to(destination).parts
                   and p.suffix in ('.html', '.css', '.js', '.mjs', '.json'))
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.relative_to(destination).as_posix().encode())
        digest.update(path.read_bytes())
    version = digest.hexdigest()[:16]
    # Include new URL(...) and dynamic weapon JSON paths, as well as imports.
    reference = re.compile(r"([\"'`])((?:\./|\.\./)?[A-Za-z0-9_./${}-]+\.(?:m?js|css|json))(?:\?[^\"'`]*)?\1")
    for path in files:
        if path.suffix == '.json':
            continue
        if 'vendor' in path.relative_to(destination).parts:
            continue  # Preserve checksummed third-party runtime bytes verbatim.
        source = path.read_text('utf-8')
        source = reference.sub(lambda m: f'{m[1]}{m[2]}?v={version}{m[1]}', source)
        path.write_text(source, 'utf-8')
    (destination / 'release.json').write_text(json.dumps({'version': version}), 'utf-8')
    return version


def export_exact_beta(destination):
    """Package the audited M4A1 solver against its verified data and runtime."""
    research = ROOT / 'docs/optimization'
    target = destination / 'exact-beta'
    target.mkdir(exist_ok=True)
    pins = {
        'data/catalog.json': 'dfdca81af777648db031283cbe804df0a7d281dcb574d953579b639e537df052',
        'data/weapons/18010000001.json': '7a2d29cc20497e71b17c5592a9273a0613e320eb95b36c8146755308e22d3a5c',
        'runtime/curves.mjs': '6b93bc42e7c3a6fbec755b1306a946f60260ffc7096ea6b5541e5a84b7e8e7a1',
        'runtime/kernel.mjs': 'a834dec1bcdf85bb155a7b4c2feabb1dc35d8486bdde85d581e84ef841ea2dfb',
        'runtime/attributes.mjs': '7fd496bb66a3b9a31bf7b4d5b749a2258f8a14ab0f241c4c5fe2bd711c097cdc',
        'runtime/laser_effects.mjs': '1898c81a9ea892c3f4cac806595ab0884d67209e9286abb5fa6462b5e6d4692c',
    }
    enabled = all(hashlib.sha256((destination / path).read_bytes()).hexdigest() == digest
                  for path, digest in pins.items())
    modules = ('category-search', 'chart-fixture-runtime', 'deterministic-norm', 'm4-active-controls',
               'm4-calibrated-mount-bound', 'm4-chart-axis-boxes', 'm4-chart-mount-stream',
               'm4-full-ordinary-study', 'ordered-axis-intervals', 'v8-norm-floor')
    for name in modules:
        source = (research / f'{name}.mjs').read_text('utf-8')
        source = source.replace('../../tools/', '../model/')
        source = source.replace('../../.scratch/calibration-check/', '../runtime/')
        source = source.replace('../../.scratch/github-pages-site/data/', '../data/')
        (target / f'{name}.mjs').write_text(source, 'utf-8')
    seeds = []
    if enabled:
        for name in ('m4-deterministic-norm-largest.json', 'm4-active-control-study.json'):
            for run in json.loads((research / name).read_text('utf-8'))['runs']:
                seeds.extend(run['bounded']['outputs'].values())
    (target / 'inputs.json').write_text(json.dumps({'enabled': enabled, 'seedRows': seeds}), 'utf-8')


def build(destination, public=False):
    research_entries = {
        'calibration-engine-study.html', 'calibration-engine-study.js', 'calibration-engine-worker.js',
        'exact-dag-study.html', 'exact-dag-study.js', 'exact-dag-worker.js',
        'screening-study.html', 'screening-study.js',
        'solver-diagnostics.html', 'solver-diagnostics.js',
    }
    research_modules = {
        'optimized_exact_dag', 'exact_recoil_scorer', 'exact_dag_storage',
        'ranked_screening_heap', 'highs_runtime', 'calibration_engine_benchmark',
        'dominance_reduction',
    }
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    if public:
        for name in research_entries:
            (destination / name).unlink(missing_ok=True)
        for name in research_modules:
            (destination / f'model/{name}.mjs').unlink(missing_ok=True)
        if (destination / 'vendor/highs-1.15.4').exists():
            raise ValueError('Build the public export in a clean checkout without the research vendor directory')
    # Copy only reviewed browser source types. Never copy local binary assets.
    for source in (ROOT / 'builder').rglob('*'):
        if public and source.name in research_entries:
            continue
        if source.is_file() and (source.suffix in ('.html', '.css', '.js', '.mjs') or
                                 source.suffix == '.json' and 'weapon-layers' in source.parts):
            target = destination / source.relative_to(ROOT / 'builder')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    app = destination / 'app.js'
    text = app.read_text('utf-8')
    text = text.replace("import {createLocalClient} from './local-client.js';\n", '')
    text = text.replace('const api=createLocalClient();', 'const api=createStaticClient();')
    text = "import {createStaticClient} from './static-client.js';\n" + text
    text = text.replace("const response=await fetch('/api/catalog');if(!response.ok)throw Error('Catalog unavailable');state.catalog=await response.json();", "state.catalog=await api('catalog');")
    app.write_text(text, 'utf-8')
    index = destination / 'index.html'
    index.write_text(index.read_text('utf-8').replace('class="brand" href="/"', 'class="brand" href="./"'), 'utf-8')
    icons = (ROOT / 'builder/assets/slot-icons.js').read_text('utf-8')
    atlas = json.loads(icons.split('=', 1)[1].strip().rstrip(';'))['source_url']
    css = destination / 'style.css'
    style = css.read_text('utf-8').replace('assets/dfttk-slot-icons.webp', atlas)
    # Cross-origin CSS masks require CORS; ordinary backgrounds do not.
    style = re.sub(r'-webkit-mask-[a-z-]+:[^;{}]+;', '', style)
    for key in ('image', 'size', 'position', 'repeat'):
        style = style.replace(f'mask-{key}:', f'background-{key}:')
    style += '\n.default-slot-icon,.slot-tile.active .default-slot-icon{background-color:transparent;opacity:.8}\n'
    css.write_text(style, 'utf-8')
    (destination / 'assets/slot-icons.js').write_text(icons.replace('"dfttk-slot-icons.webp"', json.dumps(atlas)), 'utf-8')
    modules = ['optimized_exact_dag', 'exact_recoil_scorer', 'exact_dag_storage', 'ranked_screening_heap', 'highs_runtime', 'calibration_engine_benchmark', 'screening_rank', 'dominance_reduction', 'exhaustive_screening_study', 'builder_model', 'builder_stat_response', 'optimizer_engine', 'pass_optimizer', 'anytime_optimizer', 'choice_groups', 'optimizer_mounts', 'optimizer_policy', 'optimizer_presets', 'optimizer_selection', 'scip_optimizer', 'exhaustive_attachment_gate', 'mount_search', 'scoring_bounds', 'branch_score_bounds', 'branch_native_ranges', 'shared_stats', 'scip_linear_model', 'scip_mount_model', 'scip_stat_model', 'scip_objective_model', 'scip_runtime', 'timed_recoil', 'horizontal_speed']
    (destination / 'model').mkdir(exist_ok=True)
    for name in ('attachment_gate', 'optimizer_exploration'):
        (destination / f'model/{name}.mjs').unlink(missing_ok=True)
    for name in modules:
        if public and name in research_modules:
            continue
        target = destination / f'model/{name}.mjs'
        if name == 'optimizer_presets':
            source = (ROOT / f'tools/{name}.mjs').read_text('utf-8')
            target.write_text(source.replace('../builder/optimizer_weights.mjs', '../optimizer_weights.mjs'), 'utf-8')
        else:
            shutil.copyfile(ROOT / f'tools/{name}.mjs', target)
    for name in ('exact_ordinary', 'exact_ordinary_bounds', 'exact_ordinary_mount_bounds',
                 'exact_ordinary_partitions', 'exact_ordinary_phase'):
        source = (ROOT / f'tools/{name}.mjs').read_text('utf-8')
        source = source.replace('../docs/optimization/', '../exact-beta/')
        (destination / f'model/{name}.mjs').write_text(source, 'utf-8')
    (destination / 'runtime').mkdir(exist_ok=True)
    for name in ('curves', 'kernel', 'attributes', 'laser_effects'):
        shutil.copyfile(REFERENCE / f'{name}.mjs', destination / f'runtime/{name}.mjs')
    vendor = ROOT / 'vendor/scip-7e68f9ca'
    pinned = json.loads((vendor / 'provenance.json').read_text('utf-8'))
    for item in pinned['files']:
        if hashlib.sha256((vendor / item['name']).read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Pinned SCIP runtime checksum mismatch: ' + item['name'])
    shutil.copytree(vendor, destination / 'vendor/scip-7e68f9ca', dirs_exist_ok=True)
    if not public:
        highs_vendor = ROOT / 'vendor/highs-1.15.4'
        highs_pinned = json.loads((highs_vendor / 'provenance.json').read_text('utf-8'))
        for item in highs_pinned['files']:
            if hashlib.sha256((highs_vendor / item['name']).read_bytes()).hexdigest() != item['sha256']:
                raise ValueError('Pinned HiGHS runtime checksum mismatch: ' + item['name'])
        shutil.copytree(highs_vendor, destination / 'vendor/highs-1.15.4', dirs_exist_ok=True)
    data = catalog()
    data_dir = destination / 'data'
    (data_dir / 'weapons').mkdir(parents=True, exist_ok=True)
    def dump(path, value):
        path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    dump(data_dir / 'catalog.json', data)
    for weapon in data['weapons']:
        dump(data_dir / 'weapons' / f"{weapon['id']}.json", pack(weapon['id']))
    export_exact_beta(destination)
    (data_dir / 'solver-starts').mkdir(parents=True, exist_ok=True)
    for source in (ROOT / 'data/solver_starts').glob('*.json'):
        shutil.copyfile(source, data_dir / 'solver-starts' / source.name)
    (destination / '.nojekyll').touch()
    (destination / '.gitattributes').write_text('vendor/scip-7e68f9ca/* -text\n', 'utf-8')
    (destination / 'README.md').write_text('''# Delta Weapon Workshop

Static weapon builder and experimental recoil optimizer. Calculations run in a
browser module Web Workers (one to eight, sized to the device). No backend,
credentials, game-server API, special response headers, or image files.

Weapon/attachment portraits use the external URLs supplied by dfttk.com (including
its Tencent playerhub image URLs). Socket icons load directly from dfttk.com.
External assets may change or become unavailable. These assets belong to their
respective owners. This is an independent, unofficial project.

Source model: dfttk snapshot `20261108-an94-bd-shop.1`. Global/Garena validation,
prices and translations remain provisional. Both presets use parallel time-limited top-K search in browser workers.
Ordinary builds, patch/laser completions and source-scored calibration share the total search budget.
Each worker retains at most 256 ordinary and 512 complete builds; the merged pool is capped at 512.
Workers share one compute deadline and can overlap in the builds explored. Legal combinations can remain unexplored.
Results are best found, with no global-optimum claim. Lowest Recoil uses the experimental 40/30/30 proxy.
Saved builds stay in this browser's cookies; JSON export provides a backup.

Published with GitHub Actions to GitHub Pages. Local preview:
`python -m http.server 8080` then visit http://localhost:8080/.
''', 'utf-8')
    workflow = destination / '.github/workflows/pages.yml'
    workflow.parent.mkdir(parents=True, exist_ok=True)
    workflow.write_text('''name: Deploy GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: .
      - uses: actions/deploy-pages@v4
        id: deployment
''', 'utf-8')
    version_browser_assets(destination)
    files = [p for p in destination.rglob('*') if p.is_file() and '.git' not in p.relative_to(destination).parts]
    print(json.dumps(dict(directory=str(destination), weapons=len(data['weapons']), files=len(files), bytes=sum(p.stat().st_size for p in files))))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.scratch/github-pages-site')
    parser.add_argument('--public', action='store_true', help='Exclude standalone research pages and their private runtime')
    args = parser.parse_args()
    build(args.output, public=args.public)
