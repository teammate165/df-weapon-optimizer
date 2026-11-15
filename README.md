# Delta Force weapon optimizer

[Live workshop](https://teammate165.github.io/df-weapon-optimizer/)

Weapon builder, calibration research and experimental recoil optimizer based on
preserved dfttk source-model data. Global/Garena verification remains pending;
the current recoil objective is a provisional within-weapon multiplier proxy.

This repository uses two branches:

- `source`: project code, documentation, tests and source data exports.
- `main`: generated static website, published to GitHub Pages by its workflow.

Normal project commits and pushes use `source`. They do not deploy the website.
To publish a website update, regenerate the static export and push its `main`
checkout as described in [deployment instructions](docs/github_pages.md).

Run the local builder with Python 3 and Node.js:

```powershell
python tools/builder_server.py
```

See [builder setup](builder/README.md), [project backlog](TODO.md) and
[terminology](GLOSSARY.md). Start with the [documentation index](docs/README.md)
for maintained contracts, source research and historical trials. The local SQLite dataset, `.scratch` model runtime,
generated reports, backups and images are intentionally excluded from Git.
Dataset references are recorded in [project instructions](AGENTS.md); source
runtime preparation is described in the builder setup. Images use external URLs
in the deployed static export.
