"""Cache DFTTK's assembly metadata locally; tile images remain externally hosted."""
import concurrent.futures
import argparse
import gzip
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from sync_dfttk_database import load

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--refresh', action='store_true', help='Refetch existing catalogs instead of reusing the saved snapshot')
    args = parser.parse_args()
    destination = ROOT / 'builder/assets/weapon-layers'
    destination.mkdir(parents=True, exist_ok=True)
    directories = [('m4' if wid == '18010000001' else 'experience-18010000052' if wid == '18010000052' else wid)
                   for wid in load('manifest.json')['weaponPacks']]
    directories += ['experience-18040000001', 'experience-18050000007']

    def fetch(directory):
        url = f'https://dfttk.com/data/weapon-layers/{directory}/runtime.json.gz'
        cached = destination / f'{directory}.json'
        if cached.exists() and not args.refresh:
            data = json.loads(cached.read_bytes())
            serialized = cached.read_bytes()
            return directory, dict(url=url, sha256=hashlib.sha256(serialized).hexdigest(), bytes=len(serialized), weapon_id=data['weaponId'])
        try:
            body = urllib.request.urlopen(url, timeout=40).read()
            decoded = gzip.decompress(body) if body[:2] == b'\x1f\x8b' else body
        except Exception:
            url = f'https://dfttk.com/data/weapon-layers/{directory}/index.json'
            decoded = urllib.request.urlopen(url, timeout=40).read()
        data = json.loads(decoded)
        if data.get('kind') not in ('weaponLayerPackedCatalog', 'weaponLayerCatalog'):
            raise ValueError(f'Unexpected layer metadata: {directory}')
        serialized = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
        (destination / f'{directory}.json').write_bytes(serialized)
        return directory, dict(url=url, sha256=hashlib.sha256(serialized).hexdigest(), bytes=len(serialized), weapon_id=data['weaponId'])

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        entries = dict(pool.map(fetch, directories))
    manifest = dict(retrieved_at=datetime.now(timezone.utc).isoformat(), source='https://dfttk.com/',
                    source_builder='https://dfttk.com/static/WeaponBuilderV3-DNrXxWog.js', catalogs=entries)
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Cached {len(entries)} layer catalogs, {sum(e["bytes"] for e in entries.values())} bytes; no tile images downloaded')


if __name__ == '__main__':
    main()
