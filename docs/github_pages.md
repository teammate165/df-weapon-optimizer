# GitHub Pages deployment

Live: https://teammate165.github.io/df-weapon-optimizer/
Repository: https://github.com/teammate165/df-weapon-optimizer
Initial deployment: https://github.com/teammate165/df-weapon-optimizer/actions/runs/43408180059

The project root uses this same `origin` on branch `source`, tracking
`origin/source`. The generated export in `.scratch/github-pages-site/` uses
`main`, tracking `origin/main`. Project source pushes do not trigger the Pages
workflow; only pushes to the generated site's `main` branch deploy. Both
checkouts use repository-local personal commit identity and GitHub CLI
authentication; global work-account configuration is preserved.

The static export runs the same builder model and full-weapon SCIP optimizer in a module
Web Worker. Python/Node.js and SQLite are needed only to regenerate the export,
not by visitors. Data is loaded per weapon; all 69 weapons and three modes remain
available. Repository-relative paths support project Pages URLs.

Generate from the project root:

```powershell
python tools/build_github_pages.py
python -m http.server 8770 --bind 127.0.0.1 --directory .scratch
```

Preview at `http://127.0.0.1:8770/github-pages-site/`.
Output: `.scratch/github-pages-site/`. Only HTML/CSS/JavaScript, model modules,
JSON data, README, and the Pages workflow are exported. No SQLite database,
translation editor, image files, credentials, or research scratch files are copied.
Weapon JSON is approximately 62 MB in total, loaded one weapon at a time.

The external image URLs are preserved from dfttk's display data, including its
Tencent playerhub URLs; the socket atlas loads from its original dfttk.com URL.
External images and Google fonts require network access. Image loading can fail
if the source removes files or restricts embedding. Existing portrait fallbacks
remain available. Browser cookies store saved builds per origin and browser;
local-host saves do not automatically migrate to the deployed origin. Export JSON
provides a manual backup.

The exported `.github/workflows/pages.yml` publishes on pushes to `main` using
GitHub Actions. Create a public repository under `teammate165` for free Pages,
set its Pages build type to `workflow`, and push the export. The local export is
an isolated Git repository after initial publication. Regeneration preserves its
`.git` directory; inspect the diff, commit and push to publish an update.

Validation:

- `python -m unittest discover -s tests -p test_builder_server.py`
- `python -m unittest discover -s tests -p test_recoil_generator.py`
- `node .scratch/browser-qa/static-check.cjs` against the preview above.

The browser check compares outputs exactly with local-backend fixtures for M4A1
and AN94 in all modes, plus equipment/curves/comparisons and non-default tuning. It checks real worker
optimization, result application, saved builds across reload, external portraits,
and desktop/tablet/mobile overflow at the repository subpath. Evidence is written
to `.scratch/browser-qa/static-report.json`. The export retains existing model
assumptions and provisional data status; hosting does not establish game accuracy.

Initial validation passed: four builder and five optimizer backend tests; local
static browser checks and live Pages browser checks. Live report:
`.scratch/browser-qa/static-live-report.json`. The external socket atlas also
loaded successfully from the live origin. The published repository contains 93
files, approximately 62 MB, and zero image files. Initial publication pushed only
the deployable export to `main`; project code and documentation are now tracked
separately on `source`. SQLite and scratch content remain local.

For future pushes, this export repository has a local personal Git credential
username and GitHub CLI credential helper. Global work-account Git settings were
preserved. If CLI accounts change, first run
`gh auth switch --hostname github.com --user teammate165`.

## Previous release: DF optimizer update

Deployed source `b1c56fe0c160671e7b683b48bf4f58820afd5b00` as generated main commit
`ac3f8741ccaf357a057f6cae7066cc287ae54186` on 2026-11-13.
[Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43461287120).
The deployment follows the export workflow above; do not directly merge Python,
SQLite or source-only research artifacts into the generated hosting branch.

Includes Highest Agility, strict ADS recoil then Handling for Lowest Recoil,
higher-is-better scores, physically distinct priced solution categories,
synchronized solution stat/recoil previews, raw Accuracy points, Control labels,
DF branding and removal of the optimizer firing selector. Missing distinct
alternatives are unavailable rather than cloned.

Validated locally and at the public repository URL with
`.scratch/browser-qa/static-check.cjs` and
`.scratch/browser-qa/static-release-check.cjs`. Live reports:
`.scratch/browser-qa/static-live-report.json` and
`.scratch/browser-qa/live-release-report.json`.
Both presets generated three distinct M4A1 Detonation builds; eight exact
calculator comparisons, application, saved-build persistence and three viewport
widths passed with no page errors or backend API requests.

## Required compatibility for future changes

GitHub Pages is the production target. Features must run from static HTML/CSS/JS
and repository-relative JSON, with calculations in the module worker. Do not add
production dependencies on Python, SQLite, Node servers, `/api/` routes, root-relative
asset paths, secrets or response-header configuration. Keep local-server behavior
and the static worker consistent, and verify the generated site at a repository
subpath before publishing.

The exporter versions the entire browser dependency graph with one content-derived
release token: HTML entry links, imports, worker entry, worker model/runtime imports
and JSON requests. Do not version only app.js: a cached dependency can otherwise
remain from an older release. The page must be reloaded to load a newly published
release; running tabs retain their already loaded code.

Run `node tests/github_pages.cjs` after export (Playwright installed under
`.scratch/browser-qa/node_modules`). It checks both presets including the untouched
Lowest Recoil default, scoring-card hover/focus/click/Escape, viewport bounds,
one row of four major solution stats at desktop/mobile, versioned code requests,
and absence of backend requests. It injects an obsolete preset module at the old
unversioned URL: the previous live export fails with exactly `Unknown optimizer
preset`, while the versioned export bypasses it. This demonstrates the cache
failure mode; it does not prove which resources were cached in a user's browser.
Also run the existing static calculator/application/persistence regression.

## Latest release: cached-module regression fix

Source `f169e85` deployed as generated `60d5cd3` on 2026-11-13.
[Successful Pages deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43463327228).
Includes full browser dependency versioning, an explicit one-row major-stat grid,
and a larger scoring information button. Local static regression and all eight
exact calculator comparisons, application and saved-build reload checks passed;
four backend builder tests passed. Public-site validation is recorded in TODO.md.

## Translation and calibration display release (2026-11-15)

Source `4eb0f76` deployed as generated `57ffa99`, release token
`72386b22693a6087`. [Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43625335906).

Includes the throwaway branch?s translations and observations, the corrected
0.4 mm Eye Relief step, integer slot display relative to neutral for discrete
placement controls, and reversed slider order within each attachment. One game
slot maps to one existing source notch per user confirmation; calculator inputs,
saved tuning values, allowed positions and optimizer semantics are unchanged.

Local and public-site checks pass: stock slider order, neutral/adjacent slot
interaction with live calculation, both presets/cache/layout regression, eight
exact calculator comparisons including non-default tuning, Apply and saved-build
reload. See `.scratch/browser-qa/calibration-display-report.json` and
`.scratch/browser-qa/static-live-report.json`.

## Horizontal recoil penalty release (2026-11-15)

Source `22e06d0` deployed as generated `baef9df`, release token `00c8bd79fc0611e4`. [Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43630286922).

Lowest Recoil now scores supported automatic base protocols using `V + H + 1.5 * max(0, H - 1.5)` with a fixed 20-point source-chart window: candidate horizontal threshold 1.5, marginal horizontal weight 2.5x. Preserve 30/40/30 normalization and Handling tie-breaking; no implicit Handling floor. Unsupported base protocols retain explicit legacy fallback, and Highest Agility retains its previous recoil tie-breaker. See [definition](horizontal_recoil.md). Eight optimizer integration and four builder tests, all-207 default-score audit, boundary/category checks and both local browser suites pass. Live release token and served formula verified.

Both public-site browser suites pass: both presets/cache handling, score tooltip/layout at desktop/mobile, eight exact calculator comparisons, worker optimization, Apply and saved-build reload, no page errors or backend requests. Initial full-regression page-readiness timeout did not recur on diagnostic reload/retry.

## Speed tiers, laser policy and weapon portraits release (2026-11-16)

Published implementation source `d55e427` as generated `ff39edf`, release `5893bf04f4180971`. [Successful Pages deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43742053455).

Includes candidate fastest-200 ms speed tiers (1x at <=3, 2x at >3, 3x at >4, 5x at >5), origin-distance horizontal contribution, default ADS recoil weights 40/30/30, capped enabled laser bonuses, redundant-laser exclusion, required optic mounting, attachment-aware weapon art with spinner-only loading, and weapon/mode preview invalidation. Also carries forward validated local image caching/loading, price parsing/quotes and attachment display fixes. Source-model/client verification limitations remain.

The uncommitted `part:13030000194` translation was preserved in the source working tree and excluded from both commits/exported names, consistent with prior releases. For this release the exporter catalog was overridden in memory with committed translations; the translation file was not edited. Source data/code and the generated hosting branch remain separate. No database, credentials or local image files were published.

Local repository-subpath checks pass: both presets/cache/score-tooltip layout, eight exact calculator comparisons, real six-pass optimization/Apply/save/reload, portrait preview/fallback/retry and responsive layouts. Two parallel browser starts timed out; independent reload was clean and the isolated checks passed. Published release token and nine critical files match the committed Git blobs (comparison uses normalized committed bytes, not Windows working-tree line endings). [Artifact verification](../.scratch/browser-qa/publish-live-artifacts.json), [local browser report](../.scratch/browser-qa/publish-local-static-report.json).

Final public-site verification passed: eight exact browser/backend comparisons, real six-pass worker optimization/Apply, saved-build persistence, three viewport widths, no page errors or backend requests. The weapon/mode invalidation test (including delayed old responses), spinner-only initial/update loading and portrait preview/cancel/equip/failure/keyboard-retry checks also pass at the production repository URL. [Live browser evidence](../.scratch/browser-qa/publish-live-static-report.json).

## Weighted agility release (2026-11-16)

Published source `e84a28b` as generated `9ee8f9a`, release `e6e3c470b921ffef`. [Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43747655986).

Highest Agility now uses default-normalized Handling/hip spread/ADS recoil weights 50/30/20. Panel retains numbered slash-separated format with percentages; score and category floors use weighted improvement. Existing recoil metric definitions remain.

Eight generator integration tests pass. Local subpath checks pass for exact calculator results, optimization/Apply/save/reload, both presets and cache/layout. Live browser checks confirm the label, weights, independent weighted-loss calculation, both presets, versioned dependencies and desktop/mobile score tooltips with no page errors/backend calls. Reproduction: `.scratch/browser-qa/agility-weighted-release.cjs` and `tests/github_pages.cjs`. Uncommitted translations and unrelated research edits were excluded.

## Shared top-5% attachment search release (2026-11-16)

Published implementation `38b7f21` and presentation-preserving source
`ef0099c` as generated `f849338`, release
`4ff8cb158b5ce7d6`. [Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43749585072).

Every preset now uses default-tuned top-5% screening of compatible complete
replacement configurations per search pass, then legal-position coordinate
calibration. Future presets inherit the shared gate without opt-in. Preset
objectives/weights, constraints and distinct Max/Balanced/Min category policies
remain. Existing published preset labels and info-button placement are preserved.
The page says Top 5% attachment screening / Best found. This is a per-pass
neighborhood heuristic, not exhaustive full-weapon optimization or a global proof.
See the [search contract](top5_attachment_search.md).

All 69 weapons pass both presets in Detonation (138 one-pass searches), including
source stat/cost replay, unique available categories, legal optics, budgets and
laser policy. Eight optimizer and four builder integration tests, category and
special-effect checks pass. A dynamically registered test-only future preset
inherits the exact ceil(5% of neighborhood) gate automatically.

Local subpath and public-site browser checks pass for both presets, source replay,
versioned module/worker imports, responsive score-card layout, eight exact
calculator comparisons, real six-pass Generate/Apply, saved-build reload and no
page errors/backend calls. Nine live critical assets match committed Git blobs.
The browser graph includes the new attachment_gate module with the same release
token. No backend or response-header dependency is added. Translations use the
reviewed committed source; unrelated working-copy translations remain local.

The first public startup check exceeded its 30-second wait once. An isolated
readiness check then found no page errors, failed requests or HTTP errors, and
the complete public browser rerun passed.

Evidence: `.scratch/top5-release/catalog-report.json`, `browser-local.json`,
`browser-live.json`, `static-live.json`, `live-artifacts.json`. Browser reproduction:
`.scratch/browser-qa/top5-release.cjs`, `tests/github_pages.cjs` and
`.scratch/browser-qa/static-check.cjs` with STATIC_SITE_URL set to the public URL.

## Multi-start refinement release (2026-11-16)

Published source `e81d22f2d15e39561fe348462c92ea615f23cc8e` as generated
`21db06f4bd1c54c5749040af84dd87f309cf1a70`, release `6be8e9ba4f046b71`.
[Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43824320832).

All presets retain the old top-5% search and price-target frontier, then explore
all-slot replacements, structural alternatives and deterministic multi-start
perturbations. Added bounded caches and Cancel search with worker recovery.
Scoring, weights, budget/floor/lock rules, required optics, enabled-laser policy
and distinct Max/Balanced/Min selection remain. Results are still best found.
See [the implementation contract](multistart_optimizer.md).

All 69 weapons / both presets pass (138 Detonation searches), with no Max-score
regressions against the published one-pass baseline and exact calculator replay.
Standard full-budget checks improve all eight previous non-optimal cases and
preserve both exact G18 results. Eight generator/four builder integration tests,
future-preset, exploration, multiple-budget, category and special-effect checks
pass. Standard ten-case local timings range from 2 to 64 seconds.

Reviewed-export and public browser checks pass: cancellation/regeneration,
worker recovery, both presets, calculator parity, cache/versioning, desktop/mobile
layout, real Generate/Apply/save/reload and no page errors/backend calls. Ten
critical public assets match the committed Git blobs. The public P90 Operations
search at 5,000,000 and 12 passes returns loss 32.660529010656475, cost 293,171,
with exact replay in about 35.4 seconds. The public six-pass UI search takes
about 24 seconds. These are individual desktop observations.

Evidence: `.scratch/multistart-release/` contains `regression.json`,
`catalog-report.json`, `browser-reviewed.json`, `static-reviewed.json`,
`browser-live.json`, `static-live.json`, `operations-live.json` and
`live-artifacts.json`. Persistent results are in
`data/optimizer_validation/multistart_20261116.json`. Unrelated working-copy
translations and research edits were preserved and excluded from publication.
