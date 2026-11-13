# Builder portrait audit

Checked 2026-11-13 at `2026-11-13T02:24:52.243Z`, against preserved dfttk snapshot `20261108-an94-bd-shop.1`.

The inventory covers all 69 weapons and 583 selectable attachment/ammo entries across Operations, Warfare and Detonation. Sources come from all preserved build-pack display objects plus the mode libraries, matched by ID. Source-relative URLs resolve against `https://dfttk.com/`. Four entries have no declared portrait; their existing legacy CDN fallback URLs were also checked.

Each URL was fetched, decoded in Chrome, and checked for nonzero image dimensions and visible pixels using a downsampled canvas. This checks availability and image content, not whether the art depicts the correct item or an exact equipped build.

| Inventory | Valid portraits | Missing |
| --- | ---: | ---: |
| Weapons | 69 | 0 |
| Attachments / special ammo | 581 | 2 |
| Total | 650 | 2 |

The two missing images are `.300 BLK TIV` (`13550000003`) and `5.56×45mm CINDER` (`13550000004`). Neither has a declared source portrait; their legacy CDN image URLs return HTTP 404. The interface now deliberately uses the matching dfttk ammo socket icon for both instead of requesting a missing image. These are fallback glyphs, not replacement item portraits. The exception list is [unavailable-portraits.json](../builder/assets/unavailable-portraits.json).

The AN94 source portrait loads successfully. The weapon picker now shares the complete canonical [portrait map](../builder/assets/portraits.js) with the current build so the dfttk-hosted AN94 override is available before selecting the weapon, too. Browser checks confirmed that the picker loads the image and the CINDER entry displays an ammo glyph without making its broken image request.

Reproduction:

```powershell
python tools/prepare_portrait_audit.py
node .scratch/portrait-audit/check.cjs
```

The audit requires the scratch Playwright installation and Chrome. [Detailed results](../.scratch/portrait-audit/report.json) retain per-item URL, status, content hash, decoded dimensions and visible-pixel samples; [inventory](../.scratch/portrait-audit/inventory.json) records source versus fallback paths. Re-running the audit can identify whether an unavailable source has recovered; update the explicit exception list only after verifying the image, then regenerate the portrait map.
