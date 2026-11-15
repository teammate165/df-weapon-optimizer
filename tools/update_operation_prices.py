"""Refresh Operations quotes by exact source object ID; archive pages and changes."""
from datetime import datetime, timezone
from decimal import Decimal
import html
import json
from pathlib import Path
import re
import sqlite3
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def parse_price(value):
    text = html.unescape(value).strip().replace(',', '')
    template = re.fullmatch(r"\{\{NumQfw\((\d+)\)\}\}", text)
    if template:
        return int(template[1])
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(\u4e07)?", text)
    if not match:
        return None
    result = Decimal(match[1]) * (10000 if match[2] else 1)
    return int(result) if result > 0 and result == result.to_integral_value() else None

def refresh():
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    archive = ROOT / 'data' / 'operation_prices' / stamp
    archive.mkdir(parents=True, exist_ok=True)
    quotes = {}
    for page in range(1, 101):
        url = f'https://orzice.com/v/zhanbei?p={page}'
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        body = urllib.request.urlopen(request, timeout=30).read()
        (archive / f'page-{page}.html').write_bytes(body)
        text = body.decode('utf-8')
        rows = 0
        for chunk in text.split('<tr>'):
            oid = re.search(r'/object/(\d+)\.png', chunk)
            values = re.findall(r'icon-gold ui-num">([^<]*)<', chunk)
            if not oid or not values:
                continue
            rows += 1
            price = parse_price(values[0])
            if price is not None:
                quotes.setdefault(oid[1], dict(price=price, raw=values[0], url=url))
        print(f'Page {page}: {rows} rows', flush=True)
        if not rows or f'?p={page+1}' not in text:
            break
        time.sleep(.7)
    else:
        raise RuntimeError('Pagination limit reached; database unchanged')
    changes = []
    with sqlite3.connect(ROOT / 'delta_force_weapons.sqlite') as db:
        backup = sqlite3.connect(archive / 'before.sqlite')
        db.backup(backup)
        backup.close()
        for kind, item, old, record in db.execute('SELECT item_type,item_id,price_daily,record_json FROM prices').fetchall():
            quote = quotes.get(item)
            if quote is None:
                continue
            data = json.loads(record)
            data.update(price_daily=quote['price'], quote_raw=quote['raw'], quote_url=quote['url'], quote_fetched_at=stamp)
            db.execute('UPDATE prices SET price_daily=?,record_json=? WHERE item_type=? AND item_id=?', (quote['price'], json.dumps(data,ensure_ascii=False),kind,item))
            changes.append(dict(type=kind,id=item,before=old,after=quote['price'],**quote))
        # Unmatched records retain their original quote dates; matched records carry per-row provenance.
    (archive / 'changes.json').write_text(json.dumps(changes,indent=2,ensure_ascii=False),'utf-8')
    print(f'Refreshed {len(changes)} exact-ID quotes; archive: {archive}', flush=True)

if __name__ == '__main__':
    refresh()
