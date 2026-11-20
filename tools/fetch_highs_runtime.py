"""Fetch a pinned highs-js npm artifact without running package scripts."""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

version = '1.15.4'
root = Path(__file__).resolve().parents[1]
target = root / 'vendor' / f'highs-{version}'
metadata_url = f'https://registry.npmjs.org/highs/{version}'
metadata = json.load(urlopen(metadata_url))
payload = urlopen(metadata['dist']['tarball']).read()
integrity = 'sha512-' + base64.b64encode(hashlib.sha512(payload).digest()).decode()
if integrity != metadata['dist']['integrity']:
    raise ValueError('HiGHS npm integrity mismatch')
target.mkdir(parents=True, exist_ok=True)
files = []
with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
    for member in archive.getmembers():
        if not member.isfile():
            continue
        path = Path(member.name)
        if not path.parts or path.parts[0] != 'package' or '..' in path.parts:
            raise ValueError('Unexpected npm archive path')
        relative = Path(*path.parts[1:])
        destination = (target / relative).resolve()
        if target.resolve() not in destination.parents:
            raise ValueError('Archive path escapes vendor directory')
        data = archive.extractfile(member).read()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        files.append({'name': relative.as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
provenance = {'package': 'highs', 'version': version, 'metadata_url': metadata_url,
              'tarball': metadata['dist']['tarball'], 'integrity': integrity, 'files': files}
(target / 'provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
print(json.dumps({'directory': str(target), 'files': len(files), 'bytes': sum(f['bytes'] for f in files)}))
