"""Seed missing names from the user-selected wiki. Requires the local editor server.

Preview: uv run --no-project tools/match_wiki_names.py
Apply:   uv run --no-project tools/match_wiki_names.py --apply
"""
import json
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://delta-force.fandom.com/wiki/Firearms'
# Names transcribed from the search-indexed Firearms table on 2026-11-12.
NAMES = '''AKS-74 Assault Rifle
CAR-15 Assault Rifle
QBZ95-1 Assault Rifle
M4A1 Assault Rifle
M16A4 Assault Rifle
SG 552 Assault Rifle
AK-12 Assault Rifle
PTR-32 Assault Rifle
AKM Assault Rifle
AS Val Assault Rifle
CI-19 Assault Rifle
K416 Assault Rifle
AUG Assault Rifle
K437 Assault Rifle
KC17 Assault Rifle
G3 Battle Rifle
SCAR-H Battle Rifle
Ash-12 Battle Rifle
M7 Battle Rifle
MK47 Battle Rifle
UZI Submachine Gun
Bizon Submachine Gun
SMG-45 Submachine Gun
MP5 Submachine Gun
Vector Submachine Gun
MP7 Submachine Gun
P90 Submachine Gun
SR-3M Compact Assault Rifle
Vityaz Submachine Gun
QCQ171 Submachine Gun
MK4 Submachine Gun
M1014 Shotgun
S12K Shotgun
M870 Shotgun
725 Double Barrel Shotgun
M249 Light Machine Gun
QJB 201 Light Machine Gun
PKM General Machine Gun
M250 General Machine Gun
Mini-14 Marksman Rifle
VSS Marksman Rifle
PSG-1 Marksman Rifle
SVD Sniper Rifle
SR-25 Marksman Rifle
SKS Marksman Rifle
M14 Marksman Rifle
SR9 Marksman Rifle
Marlin Lever-action Rifle
SV-98 Sniper Rifle
R93 Sniper Rifle
M700 Sniper Rifle
AWM Sniper Rifle
Compound Bow
G17
QSZ-92G
93R
Desert Eagle
G18
.357 Revolver
M1911'''.splitlines()
SUFFIX = re.compile(r' (?:Assault Rifle|Battle Rifle|Submachine Gun|Compact Assault Rifle|Shotgun|Double Barrel Shotgun|Light Machine Gun|General Machine Gun|Marksman Rifle|Sniper Rifle|Lever-action Rifle|Revolver)$')


def normalize(name):
    return re.sub('[^a-z0-9]', '', name.lower())


def match(item):
    # Chinese-only identities and translated generic nouns need explicit review.
    aliases = {
        '18020000005': 'Bizon Submachine Gun',
        '18020000009': 'Vityaz Submachine Gun',
        '18070000004': 'Desert Eagle',
        '18150000001': 'Compound Bow',
    }
    if item['id'] in aliases:
        return aliases[item['id']], 'inferred identity; review against Global client'
    source = normalize(item['name'])
    for name in NAMES:
        if normalize(SUFFIX.sub('', name)) == source:
            return name, 'model identifier match (ignoring spacing, punctuation, and Chinese class suffix)'
    return None, 'No safe match in supplied page; do not infer from a similar model.'


def main():
    with urllib.request.urlopen('http://127.0.0.1:8765/api/data') as response:
        data = json.load(response)
    translations = data['translations']
    before = json.loads(json.dumps(translations))
    rows = []
    added = 0
    for item in data['items']:
        if item['kind'] != 'Weapon':
            continue
        name, reason = match(item)
        existing = translations.get(item['key'], {})
        action = 'preserved existing name' if existing.get('english', '').strip() else 'unmatched'
        if name and action != 'preserved existing name':
            translations[item['key']] = dict(
                english=name, status='provisional',
                notes=(existing.get('notes', '') + '\n' if existing.get('notes') else '')
                + f'Wiki name candidate: {URL}; search-indexed page accessed 2026-11-12. {reason}. Not verified in Global client.')
            action = 'filled provisional'
            added += 1
        rows.append(f"| `{item['id']}` | {item['name']} | {name or '—'} | {action} | {reason} |")
    applied = '--apply' in sys.argv
    if applied:
        backup = ROOT / 'translation' / ('translations.before-wiki-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json')
        backup.write_text(json.dumps(before, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        request = urllib.request.Request('http://127.0.0.1:8765/api/save',
            data=json.dumps(translations).encode(), headers={'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:8765'})
        with urllib.request.urlopen(request) as response:
            assert json.load(response)['saved']
    report = ['# Wiki firearm name matching', '', f'Source: [{URL}]({URL}), search-indexed content accessed 2026-11-12. Direct retrieval was blocked; indexed content may be stale. The page states its table concerns Havoc Warfare. Community wiki names do not establish Global-client verification.', '',
        'Matching uses model identifiers with punctuation/case normalization and explicit provisional identity hypotheses for four translated names. AKS-74U is not assumed to equal the page’s AKS-74. 腾龙 → CI-19 remains an unconfirmed hypothesis and was not applied. Attachments are outside this page’s scope.', '',
        f'{"Applied" if applied else "Preview only"}: {added} new provisional names. Existing nonblank entries are preserved, including notes/status. A missing wiki match does not mean a weapon is absent from the game.', '',
        '| Weapon ID | Catalog name | Wiki candidate | Action | Match basis |', '| --- | --- | --- | --- | --- |', *rows, '']
    (ROOT / 'docs' / 'firearms_wiki_matching.md').write_text('\n'.join(report), encoding='utf-8')
    print(f'{"Applied" if applied else "Preview"}: {added} new names; {sum("unmatched |" in row for row in rows)} unfilled weapons. Report: docs/firearms_wiki_matching.md')


if __name__ == '__main__':
    main()
