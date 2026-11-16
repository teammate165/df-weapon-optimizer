# Anytime top-K optimizer

2026-11-16. This is the local production optimizer. The user approved replacing the exhaustive top-5% requirement after the full-cap M4A1 ordinary domain reached trillions of combinations. Published on 2026-11-17 as release `cb0a6cf829d3634f` (source `abaeee6`, generated `8d03cb4`). [Successful Pages deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43928951241).

`tools/optimizer_engine.mjs` delegates to `anytime_optimizer.mjs` in both the local Node backend and static module Worker. There is no whole-domain counting pass. The 5/30/120-second UI setting covers attachment search, patch/laser search and calibration together. It is a computational budget; initial HTTP/Worker/data loading and final response rendering add startup/output overhead.

Local follow-up, not yet deployed: [equivalent attachment groups](equivalent_attachment_groups.md) collapse interchangeable sights/lasers and search patch counts by effect type. Locks and compatible concrete reconstruction remain source-verified.

## Search and retention

Each requested budget uses these bounded pools:

| Pool | Maximum retained | Policy |
| --- | ---: | --- |
| Ordinary builds | 256 | 192 score-ranked entries plus 64 structural/cost diversity slots |
| Tactical completions per ordinary base | 16 | Source-ranked patch/laser combinations |
| Complete builds | 512 | 384 score-ranked entries plus 128 structural/cost diversity slots |

Diversity slots use a fixed-size hash of structural choices and cost bands. Collisions affect search quality, never legality. These pools are heuristic shortlists; they are not certified global top-K sets. The source-result cache holds at most 2,048 entries. Expanded-seed tracking is bounded too. No percentage of the full domain is materialized.

Native-scored equipped/default and shipped starts supply initial candidates. Current-mode starts are tried first; every hint is replayed under the current weapon, mode, budget, locks, hidden-item policy, enabled-device limit, required optics and tuning domain. A valid tuned incumbent is retained independently of its default-calibration rank.

Ordinary search improves live-slot neighbors, then explores the symbolic mounting tree in a seed-informed order. All priced legal choices remain eligible. Incremental Boolean/constraint checks, shared stat calculation and conservative branch score bounds remain available; unsupported bounds use ordinary traversal. Locks, source dependencies, defaults, occupancy and budgets are never relaxed for publishing a build. Search can stop with branches unexplored.

Tactical search fixes each ordinary base and explores patches/lasers. A laser-first greedy completion reaches combined benefits promptly, followed by a time-sliced Cartesian walk. Each base retains at most 16 proposals; per-base time shares prevent one large tactical domain consuming the whole stage. No tactic is accepted without source replay and the same budget/lock/effect checks. Minimum-stat shortfalls guide ordinary/tactical ranking; complete published candidates must meet every floor.

## Calibration and feedback

Source-calculator coordinate refinement evaluates legal tuning positions, including interior positions. Joint priority-based tuning values are proposals only; the preset's actual objective must improve before replacing an incumbent. Preset lexicographic recoil/Handling ordering and Agility weighting are unchanged. No tuning change can replace a better retained result with a worse one.

The initial time allocation is 35% ordinary search, 15% tactical search and 30% calibration, followed by 8% attachment feedback, 4% tactical feedback and 8% calibration. Calibrated incumbents guide the feedback round. Unused time can be consumed by later work; the percentages define deadlines, not mandatory delays. Explicit multiple budgets share the requested total allowance.

This production path uses source-scored calibration rather than compiling a large SCIP calibration model. Model compilation previously had no bounded deadline and could defeat the interactive total budget. The exhaustive/SCIP implementation remains separately available through `generateSCIP` in `tools/scip_optimizer.mjs` for reference experiments; it is not the preview's Generate path.

## Results and UI

The UI says **Total search budget**, reports actual scored/retained builds and shows ordinary, tactical and calibration phases. It does not claim to screen all combinations. Results remain **best found**, with `converged:false`, `global_optimality:false`, `attachment_gate.complete:false`, `fraction:null`, and `solver.time_limit_scope:'total_search'`.

Failure to find a feasible build returns `not_found`, explicitly stating that infeasibility is unproven. Max/Balanced/Min and custom effectiveness targets are selected from source-verified retained results. Price-based alternatives can be unavailable, particularly in Warfare. Final configs, tuning, effective stats, cost and chart components retain the existing response format.

Cancel terminates the static Worker or disconnects the local NDJSON stream and kills its Node subprocess. Cancellation is distinct from a normal budget expiry, which returns the best retained candidates. A subsequent request starts cleanly.

## Validation

The focused test uses M4A1 `18010000001` at its actual **800-point Detonation cap**, both presets, five seconds total. It verifies source stat/cost replay, valid tuning, tactical/calibration work, bounded pool/cache sizes and wall time. Additional cases cover locks, floors, honest not-found results, Operations, Warfare, multiple budgets, a future preset and cancellation. The CLI generator and backend round-trip suites also run with the new production path.

Both local and static browser checks exercise full-cap M4A1 Generate, both presets, source replay, cancellation/recovery, Apply, honest UI labels and desktop/mobile layout. Final timings, source hashes and evidence are recorded in [persistent validation](../data/optimizer_validation/anytime_top_k_20261116.json). Search quality is best found; larger runs may explore different candidates and do not establish monotonic cross-run quality or global optimality.

With a five-second budget at M4A1's actual 800-point cap, the local UI completed in 5.31 seconds and the static UI in 5.09 seconds. Direct browser-client runs for both presets completed in 5.00-5.25 seconds, including actual request overhead. All 138 weapon/preset catalog cases also passed at their full Detonation caps with a one-second computational budget; every returned build replayed exact source stats and cost. The slowest direct catalog search was 1.006 seconds. These are completion/validity checks, not optimality or quality guarantees.

```powershell
python tools/build_github_pages.py
node tests/anytime_optimizer.mjs
python -m unittest discover -s tests -p test_exhaustive_stream.py
python -m unittest discover -s tests -p test_builder_server.py
python -m unittest discover -s tests -p test_recoil_generator.py
node tests/scip_browser.cjs
$env:LOCAL_SITE_URL='http://127.0.0.1:8766/'
node tests/exhaustive_local_browser.cjs
```
