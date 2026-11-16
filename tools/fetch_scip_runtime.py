"""Fetch/verify the pinned single-threaded SCIP distribution and notices."""
import hashlib
import json
import pathlib
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
REVISION='1c9ff48b31d0a871bf9e37f63475ebc6ca4b2b25'
DESTINATION=ROOT/'vendor/scip-7e68f9ca'
EXPECTED={
    'scip.js':'fbce1535ff0eea41b0b1d4a3d9e2c3a8e0b6239fcf7fa30715e3fe629964889a',
    'scip.wasm':'7e68f9ca51d1fdb1b36e35eeac242792f7afcf1b93eaf601baa44449950fea6b',
    'VERSION.txt':'1b0710b6ad2dfba1d02eb658aaf89a930558434a0ab307a386f24474ccd0ea3c',
    'THIRD_PARTY_LICENSES.txt':'933567b6be8b65a59ac79fbaf0d50f796579a89cd873536538fd9c00bb5e0eec',
}
def main():
    DESTINATION.mkdir(parents=True,exist_ok=True)
    records=[]
    for name,digest in EXPECTED.items():
        path=DESTINATION/name
        url=f'https://raw.githubusercontent.com/Pollywrath/Industrialist-Production-Calculator/{REVISION}/public/scip/{name}'
        body=path.read_bytes() if path.exists() else urllib.request.urlopen(url,timeout=60).read()
        if hashlib.sha256(body).hexdigest()!=digest:
            raise ValueError('SCIP checksum mismatch: '+name)
        path.write_bytes(body)
        records.append(dict(name=name,url=url,sha256=digest,bytes=len(body)))
    (DESTINATION/'package.json').write_text(json.dumps({'type':'module'}),encoding='utf-8')
    (DESTINATION/'provenance.json').write_text(json.dumps(dict(revision=REVISION,files=records),indent=2),encoding='utf-8')
    print('Verified SCIP 10.0.2 / SoPlex 8.0.2 runtime, WASM and notices')
if __name__=='__main__':
    main()
