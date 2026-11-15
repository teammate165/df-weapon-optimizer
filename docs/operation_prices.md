# Operations price units and refresh

`万` means 10,000 currency units: `1.25万` becomes 12,500. Prices are stored in whole currency units; do not multiply existing numeric quotes by 10,000.

Run `python tools/update_operation_prices.py` to refresh the local SQLite catalog. This reads the current Orzice equipment pages, matches only exact official object IDs, and preserves unavailable/unmatched records. It archives downloaded pages, a database backup, and a per-item before/after log in `data/operation_prices/<UTC timestamp>/`. Each matched price record retains its raw quote, page URL and retrieval time. Unmatched quotes retain their original dates. These third-party market quotes do not establish Global/Garena verification.

The parser supports comma-separated numbers, `NumQfw` template numbers and decimal `万` values. Unrecognized and zero values remain unavailable. Validation: `python -m unittest discover -s tests -p test_operation_prices.py`.

Source parser reference: upstream `src/collectors/orzice_price_sync.py` at `c8f3d254e914df1a3509c2be9660c854796f274b` supports integers and templates but rejects `万`. The local correction adds the unit without rescaling already normalized integers.
