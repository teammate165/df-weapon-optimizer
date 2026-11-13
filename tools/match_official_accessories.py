"""Match official-wiki accessories by exact ID, preserving existing translations.

uv run --no-project tools/match_official_accessories.py [--apply]
The translation editor must be running. No third-party dependencies.
"""
import hashlib
import json
import sqlite3
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = 'https://www.playdeltaforce.com/act/officialwiki/en/#/accessory/'
API = 'https://sg-apps.vasdgame.com/ide/'
LOCAL = 'http://127.0.0.1:8765'


def get_json(url):
    with urllib.request.urlopen(url, timeout=45) as response:
        return json.loads(response.read().decode('utf-8-sig'))


def wiki_api(method, params):
    # Public anonymous read-only request used by the official wiki's Milo SDK.
    body = urllib.parse.urlencode(dict(iChartId='100005405', sIdeToken='nkxYQl',
        sLanguage='en', instanceid='4005360', method='projectd_oversea/' + method,
        param=json.dumps(params))).encode()
    response = get_json(urllib.request.Request(API, data=body))
    if response.get('iRet') != 0 or response['jData']['data']['code'] != 0:
        raise ValueError('Official wiki returned an error')
    return response['jData']['data']['data']


def main():
    config = wiki_api('config.list', {'configType': 'all'})['config']
    locales = {lang['code']: lang['url'] for lang in config['languageList']}
    english, chinese = get_json(locales['en']), get_json(locales['zh-tw'])
    accessories = wiki_api('object.list', dict(primary='acc', second='', third='', objectID=''))['list']
    ids = [str(item['objectID']) for item in accessories]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate IDs in official source')
    official = {str(item['objectID']): item for item in accessories}
    timestamp = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(f'{(ROOT / "delta_force_weapons.sqlite").as_uri()}?mode=ro', uri=True) as db:
        weapons = {row[0] for row in db.execute('SELECT DISTINCT weapon_id FROM weapons')}
        parts = list(db.execute('SELECT item_id,name,slot,selectable FROM parts ORDER BY item_id'))
    matches, missing = {}, []
    for item_id, name, slot, selectable in parts:
        if item_id in weapons:
            continue
        en = english.get(item_id, {}).get('name')
        zh = chinese.get(item_id, {}).get('name')
        if item_id not in official or not en or not zh:
            if selectable:
                missing.append(dict(item_id=item_id, original=name, slot=slot))
            continue
        if '{{' in en or '{{' in zh:
            raise ValueError('Unresolved localization reference')
        item = official[item_id]
        matches[item_id] = dict(item_id=item_id, original=name, english=en, traditional_chinese=zh,
            slot=slot, wiki_category=item['secondClass'],
            url=PAGE + item['secondClass'] + '/' + item_id,
            match_method='exact item_id = objectID', verified_in_game=False)
    evidence = dict(source=PAGE, retrieved_at=timestamp,
        english_url=locales['en'], chinese_url=locales['zh-tw'], api=API,
        source_accessories=len(official), matches=matches, unmatched_selectable=missing)
    # Read the latest user edits only after remote research completes.
    data = get_json(LOCAL + '/api/data')
    translations = data['translations']
    before = json.loads(json.dumps(translations))
    added, differences = [], []
    for item_id, match in matches.items():
        key = 'part:' + item_id
        entry = translations.get(key, {})
        if entry.get('english', '').strip():
            if entry['english'] != match['english']:
                differences.append(dict(item_id=item_id, existing=entry['english'], official=match['english']))
            continue
        translations[key] = dict(english=match['english'], status='provisional',
            notes=(entry.get('notes', '') + '\n' if entry.get('notes') else '')
            + f'Official wiki exact-ID match ({item_id}); {match["url"]}; retrieved {timestamp}. English and Traditional Chinese share objectID; local Simplified Chinese preserved. Not verified in Global client.')
        added.append(item_id)
    evidence.update(added_ids=added, preserved_differences=differences)
    applied = '--apply' in sys.argv
    if applied:
        path = ROOT / 'translation' / ('translations.before-official-wiki-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json')
        path.write_text(json.dumps(before, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        # Reject a stale snapshot rather than replacing edits made during matching.
        if get_json(LOCAL + '/api/data')['translations'] != before:
            raise ValueError('Translations changed during matching; rerun to include the latest edits.')
        request = urllib.request.Request(LOCAL + '/api/save', data=json.dumps(translations).encode(),
            headers={'Content-Type': 'application/json', 'Origin': LOCAL})
        assert get_json(request)['saved']
        saved = get_json(LOCAL + '/api/data')['translations']
        assert all(saved[key] == value for key, value in before.items())
        assert all(saved['part:' + item_id]['english'] == matches[item_id]['english'] for item_id in added)
        directory = ROOT / 'data'
        directory.mkdir(exist_ok=True)
        payload = json.dumps(evidence, ensure_ascii=False, indent=2) + '\n'
        (directory / 'official_accessory_names.json').write_text(payload, encoding='utf-8')
        evidence['snapshot_sha256'] = hashlib.sha256(payload.encode()).hexdigest()
    report = ['# Official wiki accessory matching', '', f'Source: [{PAGE}]({PAGE}). Retrieved {timestamp}.', '',
        f'{len(official)} official accessories; {len(matches)} exact ID matches; {len(missing)} selectable catalog accessories absent from this source.', '',
        f'{"Applied" if applied else "Preview"}: {len(added)} missing names filled provisionally; all {len(before)} existing entries preserved. {len(differences)} existing accessory names differ from the official name and were kept.', '',
        'Names are linked by shared item ID, not fuzzy text translation. The official Chinese locale is Traditional Chinese; the local original is Simplified Chinese. Official-source matching does not establish current in-game patch verification. Internal components and weapons are outside this import.', '',
        'Machine-readable pairs, source links, unmatched IDs, and existing-name differences: `data/official_accessory_names.json` (written on apply). Source discovery: [official_wiki_accessory_source.md](official_wiki_accessory_source.md).', '',
        'Reproduce: `uv run --no-project tools/match_official_accessories.py` (preview); add `--apply` to fill missing names. Existing names/status/notes are preserved.', '',
        '## Examples', '', '| Item ID | Catalog original | Official English | Official Chinese (Traditional) |', '| --- | --- | --- | --- |']
    for item_id, match in list(matches.items())[:8]:
        report.append(f'| `{item_id}` | {match["original"]} | {match["english"]} | {match["traditional_chinese"]} |')
    (ROOT / 'docs' / 'official_wiki_accessory_matching.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    print(f'{"Applied" if applied else "Preview"}: {len(matches)} exact matches; {len(added)} new names; {len(differences)} differing existing names preserved; {len(missing)} unmatched selectable accessories.')


if __name__ == '__main__':
    main()
