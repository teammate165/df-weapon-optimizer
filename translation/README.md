# Local translation desk

From the project root, run:

```powershell
uv run --no-project tools/translation_server.py
```

Open http://127.0.0.1:8765 in your browser. Keep the terminal running while editing; Ctrl+C stops it. No packages need installing.

Search and filter the 69 unique weapons and 583 unique selectable attachments (plus 510 internal components, hidden by default). Type English names, then mark them provisional or Global verified. Record game patch, mode, verification date, and evidence in notes. Each weapon appears once; its attachment-based profiles share the base weapon translation. Older profile-keyed JSON is consolidated, with conflicting entries rejected rather than discarded; hover the source item for its catalog source path.

Edits automatically save to `translation/translations.json` after a short pause. Check for “Saved to disk” before closing. Export JSON for backups or to share completed translations. Import merges by stable key and asks before replacing conflicting entries. The SQLite catalog remains unchanged. Only one editing tab should be used at a time.

The server listens only on this computer. Names are blank initially; no automatic translation is treated as verified.

Attachment rows show readable slot labels and catalog weapon compatibility. Filter by weapon and slot to locate an item. Shared items appear once by item ID, across all profiles and weapons; expand the compatibility list to see every associated weapon. These are imported socket options, not a guarantee that every complete build is legal. Weapon records that also occur in the parts table are presented only as weapons. Original IDs and source paths remain available under Item ID & source.

Official wiki matching evidence and bilingual references are kept in `data/official_accessory_names.json` and `docs/official_wiki_accessory_matching.md`; reference blocks and source links are omitted from desk rows. Imported names remain provisional. Reproduce matching with `uv run --no-project tools/match_official_accessories.py` (preview), or add `--apply` to fill missing names.
