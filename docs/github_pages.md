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

The static export runs the same builder model and coordinate optimizer in a module
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
