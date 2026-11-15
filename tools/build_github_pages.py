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
        source = path.read_text('utf-8')
        source = reference.sub(lambda m: f'{m[1]}{m[2]}?v={version}{m[1]}', source)
        path.write_text(source, 'utf-8')
    (destination / 'release.json').write_text(json.dumps({'version': version}), 'utf-8')
    return version


def build(destination):
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    # Copy only reviewed browser source types. Never copy local binary assets.
    for source in (ROOT / 'builder').rglob('*'):
        if source.is_file() and (source.suffix in ('.html', '.css', '.js') or
                                 source.suffix == '.json' and 'weapon-layers' in source.parts):
            target = destination / source.relative_to(ROOT / 'builder')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    app = destination / 'app.js'
    text = app.read_text('utf-8')
    start = text.index('async function api(action,payload){')
    end = text.index('\n', start)
    text = text[:start] + "const api=createStaticClient();" + text[end:]
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
    modules = ['builder_model', 'builder_stat_response', 'optimizer_engine', 'optimizer_mounts', 'optimizer_policy', 'optimizer_presets', 'optimizer_selection', 'timed_recoil', 'horizontal_speed']
    (destination / 'model').mkdir(exist_ok=True)
    for name in modules:
        shutil.copyfile(ROOT / f'tools/{name}.mjs', destination / f'model/{name}.mjs')
    (destination / 'runtime').mkdir(exist_ok=True)
    for name in ('curves', 'kernel', 'attributes', 'laser_effects'):
        shutil.copyfile(REFERENCE / f'{name}.mjs', destination / f'runtime/{name}.mjs')
    data = catalog()
    data_dir = destination / 'data'
    (data_dir / 'weapons').mkdir(parents=True, exist_ok=True)
    def dump(path, value):
        path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    dump(data_dir / 'catalog.json', data)
    for weapon in data['weapons']:
        dump(data_dir / 'weapons' / f"{weapon['id']}.json", pack(weapon['id']))
    (destination / '.nojekyll').touch()
    (destination / 'README.md').write_text('''# Delta Weapon Workshop

Static weapon builder and experimental recoil optimizer. Calculations run in a
browser Web Worker. No backend, credentials, game-server API, or image files.

Weapon/attachment portraits use the external URLs supplied by dfttk.com (including
its Tencent playerhub image URLs). Socket icons load directly from dfttk.com.
External assets may change or become unavailable. These assets belong to their
respective owners. This is an independent, unofficial project.

Source model: dfttk snapshot `20261108-an94-bd-shop.1`. Global/Garena validation,
prices and translations remain provisional. Optimization is best-found coordinate
search using the experimental 40/30/30 proxy, without an optimality guarantee.
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
    build(parser.parse_args().output)
