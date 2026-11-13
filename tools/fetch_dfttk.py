"""Download a hash-verified, release-pinned dfttk snapshot using UV/stdlib."""
import concurrent.futures
import hashlib
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data' / 'dfttk'
ORIGIN = 'https://dfttk.com'


def fetch(url):
    error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                body = response.read()
            json.loads(body)
            return body
        except Exception as exc:
            error = exc
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f'{url}: {error}')


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    manifest_bytes = fetch(ORIGIN + '/data/v3/manifest.json')
    manifest = json.loads(manifest_bytes)
    (CACHE / 'manifest.json').write_bytes(manifest_bytes)
    base = ORIGIN + manifest['resourceBaseUrl'].rstrip('/') + '/'
    paths = {'common.json', 'catalog/weapons.json', 'catalog/ammo.json', 'catalog/bd-shop.json',
             'locales/zh-CN/items.json', 'client-config.json'}
    paths.update(manifest['entrypoints']['library'].values())
    paths.update(manifest['entrypoints']['defense'].values())
    for spec in manifest['weaponPacks'].values():
        paths.add(spec['sharedBuild']['core'])
        paths.update(spec['sharedBuild']['shards'])
        paths.add(spec['combat'])
    sources = {}

    def one(path):
        target = CACHE / path
        expected = manifest['files'][path]['sha256']
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == expected:
            return path, expected
        body = fetch(base + path)
        if hashlib.sha256(body).hexdigest() != expected:
            raise ValueError(f'Hash mismatch: {path}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        return path, expected

    print(f'Fetching {len(paths)} files from release {manifest["version"]}', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for index, (path, digest) in enumerate(pool.map(one, sorted(paths)), 1):
            sources[path] = dict(url=base + path, sha256=digest)
            if index % 25 == 0:
                print(f'Verified {index}/{len(paths)}', flush=True)
    for name, key in [('runtime-ui.json', 'runtimeUiUrl'), ('library-insights.json', 'libraryInsightsUrl')]:
        url = ORIGIN + manifest[key]
        body = fetch(url)
        digest = hashlib.sha256(body).hexdigest()
        expected = manifest[key].split('v=')[-1]
        if digest != expected:
            raise ValueError(f'Hash mismatch: {name}')
        (CACHE / name).write_bytes(body)
        sources[name] = dict(url=url, sha256=digest)
    sources['manifest.json'] = dict(url=ORIGIN + '/data/v3/manifest.json', sha256=hashlib.sha256(manifest_bytes).hexdigest())
    (CACHE / 'download_provenance.json').write_text(json.dumps(sources, indent=2) + '\n', encoding='utf-8')
    print(f'Complete: {len(sources)} hash-verified sources', flush=True)


if __name__ == '__main__':
    download()
