# Garena data-fetching package assessment

Checked 2026-11-12. Packaging implementation depends on the requested data source; no installed-client extraction capability has been established.

## What the referenced repository provides

Repository map consulted first: [delta_gun_tierlist_repo_map.md](delta_gun_tierlist_repo_map.md).

At pinned revision `c8f3d254e914df1a3509c2be9660c854796f274b`:

- [`src/collectors/game_data_sync.py`](https://github.com/AVA-2568/delta-gun-tierlist/blob/c8f3d254e914df1a3509c2be9660c854796f274b/src/collectors/game_data_sync.py) orchestrates JSON download and normalization. Its `sync_all()` downloads a manifest, catalogs, build/combat weapon packs, Chinese item names, and ranking scenarios.
- [`src/collectors/http.py`](https://github.com/AVA-2568/delta-gun-tierlist/blob/c8f3d254e914df1a3509c2be9660c854796f274b/src/collectors/http.py) fixes `SOURCE_BASE` to `https://dfttk.com/data/v3/` and restricts the downloader to that host. This is a public synchronized dataset, not an installed-client reader or an official Garena API.
- [`src/collectors/normalize.py`](https://github.com/AVA-2568/delta-gun-tierlist/blob/c8f3d254e914df1a3509c2be9660c854796f274b/src/collectors/normalize.py) expects the dfttk-v3 schema. An unrelated wiki or Garena endpoint cannot be substituted by changing only the base URL.
- [`LICENSE`](https://github.com/AVA-2568/delta-gun-tierlist/blob/c8f3d254e914df1a3509c2be9660c854796f274b/LICENSE) is MIT; a redistributed adaptation must include its notice.
- Runtime collectors use Python's standard library. The upstream requirements file lists test dependencies only. A Windows ZIP with a UV launcher can therefore package the public sync workflow without installing third-party runtime packages.

Also checked current upstream revision `67abdb7a2e9472bd13dc3fe091fcb6b724e12d69`: its recursive file tree has the same collector paths and no extraction/unpack/Garena/dump script paths. This tree inspection is not proof that no extraction logic could exist anywhere, but the referenced collector's implementation unambiguously downloads public JSON.

## Requirements before claiming Garena-client extraction

Identify the installed game's layout and the actual input format, plus any existing extraction tool the user intended. Verify access against that installed version before claiming an extractor works. Record client region, version, patch, extraction date, and hashes of inputs/outputs; preserve original catalog data separately.

An installed-game path does not change the provenance of remotely downloaded dfttk data. Public sync output must remain labeled unverified against Garena until separately validated.
