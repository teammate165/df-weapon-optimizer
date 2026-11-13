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
