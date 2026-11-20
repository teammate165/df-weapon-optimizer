# M4A1 solver efficiency study ? 2026-11-17

**Scope correction:** this earlier timed portfolio study does not establish exhaustive-search feasibility. Its repeated-round run was stopped at the user's correction. The replacement is the [single, disjoint exhaustive ordinary-screening study](m4a1_exhaustive_screening_feasibility.md). Its results and frozen diagrams below remain historical measurements.

M4A1 (`18010000001`), Detonation, Lowest Recoil; Insight 3/7 (`13110000091`) locked in root optic slot `11`; actual attachment cap **800 points**. Eight browser workers were selected from the tested pools. The original visible Chrome run used repeated 120-second rounds and has now been stopped. Stop preserves completed checkpoints; closing that browser ends the run. This is local only; no GitHub Pages deployment was performed.

## Worker scaling

| Workers | Median evaluations/s [95% exploratory CI] | Median wall seconds | Median paired rate ratio | Best Max loss |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 1,387 [1,298, 1,613] | 5.059 | 1.00 | 22.9856 |
| 2 | 2,755 [2,732, 2,962] | 5.072 | 2.03 | 22.9856 |
| 4 | 5,592 [5,515, 5,740] | 5.116 | 3.98 | 22.9856 |
| 6 | 8,735 [8,694, 8,834] | 5.149 | 6.30 | 22.9856 |
| 8 | 11,281 [11,226, 11,439] | 5.200 | 7.94 | 22.9856 |

![Worker scaling](../../data/optimizer_validation/m4a1_worker_study_20261117/worker_scaling.png)

![Quality, latency and overhead](../../data/optimizer_validation/m4a1_worker_study_20261117/quality_latency.png)

The paired eight/one-worker rate ratio is **7.94** (exploratory 95% percentile-bootstrap interval **7.02?8.69**). This is a ratio of scored evaluations per second under equal time allowances, not fixed-work speedup. Scores can repeat across workers, cache eviction and calibration; worker orders and the mix of expensive/cheap evaluations differ. The efficiency plot divides this gross rate ratio by worker count; it is not measured CPU utilization. All 35 trials returned exactly the same best loss, **22.985555414115936**. More evaluation work did not improve this fixture's best result in those trials. That loss is the model objective, not a measured percentage reduction of in-game recoil.

Median end-to-end search time was **5.059 seconds** with one worker and **5.200 seconds** with eight, including worker preparation, compute and merge, excluding the separate validation replay. Every feasible published Max/Balanced/Min build was independently replayed through the native source calculator and matched exact cost and effective stats, retained the Insight lock, and respected the 800-point cap. No source errors or page errors were observed.

The host reports Intel Core Ultra 5 225H, 14 logical CPUs and approximately 15.2 GiB total RAM, with about 4.9 GiB free at the initial check. The conservative tested ceiling was eight workers, leaving capacity for the interface and other applications. Eight had the highest median throughput and was the smallest tested pool within 90% of that maximum. This does not establish that eight is optimal on this machine or another device; counts above eight were not tested. The portable default now uses up to eight, at most reported logical CPUs minus one, and at most two when reported device memory is 4 GB or less.

## Statistical design and interpretation

- **Experimental unit:** one complete browser portfolio invocation. Seven complete blocks contain each of 1/2/4/6/8 workers once, in deterministic randomized order (seed `20261117`): **35 measured trials** at five seconds. Separate two-second warm-ups for each pool are excluded. Trial workers are fresh; browser HTTP cache is warmed. No solver benchmark ran concurrently with another trial.
- **Blocking:** adjacent trials within a block help control temporal variation such as OS load and thermal drift. Rate ratios pair each treatment with the one-worker observation from the same block, following the rationale for [NIST randomized block designs](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm).
- **Uncertainty:** raw observations are plotted alongside medians and 95% percentile-bootstrap intervals using 10,000 resamples with replacement and seed `20261117`; whole paired blocks are resampled for ratios. The approach follows [NIST's bootstrap discussion](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm). With only seven blocks and one machine/session, these intervals are exploratory. No significance test, population-wide scaling claim, or guaranteed nominal coverage is asserted.
- **No pseudoreplication:** individual worker measurements and progress messages are not independent experimental replicates. The ongoing run's time series has no confidence band because its observations are serially dependent and it is one run. No outliers were removed and there was no optional stopping based on statistical significance.
- **Quality:** compare source-verified final loss separately from throughput. Constant final loss yields a degenerate bootstrap interval for this sample; it does not prove all future runs will return the same result. The first-feasible metric is time to the first progress message containing a complete candidate, not an exact discovery timestamp.
- **Timing boundaries:** `prepare_ms` covers loading/preparation, `compute_wall_ms` covers the portfolio work until workers settle (including message delivery), and `merge_ms` covers shared final candidate selection. Wall time covers their combined search invocation. Component medians need not add to the median total. Summed phase durations are worker-wall seconds, not CPU seconds.
- **Coverage:** gross evaluations include overlap. Exact uniqueness describes only retained final candidate pools. Pruned branch counts do not count excluded leaves. Whole-domain percentage complete, remaining time, global optimum and unique evaluated domain coverage remain unknown.

## Continuous run

The frozen first checkpoint (`continuous_snapshot.json`) completed in **120.278
seconds** of search invocation wall time (120.289 seconds including replay and
checkpoint preparation). The continuous process ran beyond this
snapshot before it was stopped; later local checkpoints are not independent statistical replicates.

| First-round metric | Observed value |
| --- | ---: |
| Scored source evaluations | 1,879,259 |
| Gross scored throughput | 15,624.3 evaluations/s |
| Evaluation attempts | 1,994,550 |
| Result-cache hits | 79,337 (3.98% of attempts) |
| Rejected proposals | 35,954 (1.80% of attempts) |
| Source errors | 0 |
| Calibration evaluations | 867,764 (46.18% of scored work) |
| Tree nodes visited | 13,199,881 |
| Branches pruned | 295,089 |
| Unique configurations in worker-retained complete pools | 859 |
| Final merged retained configurations | 474 |
| Prepare / compute / merge | 125.6 / 120,047.6 / 104.7 ms |
| Best source loss / cost | 22.985555414115936 / 800 |
| Effective Control / Handling / Stability / Accuracy | 89 / 34 / 71 / 43 |

![Continuous-run work, rate, quality and phase allocation](../../data/optimizer_validation/m4a1_worker_study_20261117/continuous_run.png)

The objective did not improve over the five-second trials. The higher average
evaluation rate in this longer, visible-browser run is descriptive; it is not a
controlled estimate of a duration effect, since duration, workload mix and
headless/visible browser conditions differ. Source scoring nearly stalls between
about 97.6 and 99.7 seconds (evaluated stays at 1,549,997), while tree nodes rise
from 11,000,160 to 11,475,424. Every worker reports attachment search during that
interval. This is evidence of traversal work without new scores, not evidence
that the solver stopped. Summed phase wall time is 412.71 worker-seconds for
attachments, 139.57 for tactical work and 407.60 for calibration; these include
concurrent workers and are not elapsed or CPU time. The pruning counter cannot
be converted into a percentage of eliminated complete configurations.

The [diagnostics page](http://127.0.0.1:8770/github-pages-site/solver-diagnostics.html) was run in the visible Chrome window opened by the benchmark; that run is now stopped. Opening a new copy of that URL creates a separate ready page; the active run belongs to its original browser window. The page supports per-worker progress, live charts, Stop, and JSON download.

The ongoing portfolio uses 120-second rounds so all search/calibration stages receive time. Each round replays outputs, retains the best objective seen, and seeds the next round with its configuration/tuning and a different portfolio-order offset. It is not a resumed exhaustive traversal: rounds may revisit prior work. Bounded shortlists and heuristic coordinate calibration remain in effect. The process has no overall time limit. The latest completed snapshot is saved as `continuous.json`; a partially running/cancelled round is excluded from completed-round totals.

## Artifacts and reproduction

All measurements and exportable figures are in [the study directory](../../data/optimizer_validation/m4a1_worker_study_20261117/):

- `benchmark.json`: all trials, sampled progress, complete outputs, per-worker reports, environment and validation.
- `trials.csv`, `statistics.json`: tabular data, bootstrap estimates and selection.
- `provenance.json`: Git HEAD, dirty-source acknowledgement, static release and SHA-256 hashes of code/data/runtime.
- `continuous.json`: latest ongoing-run completed checkpoints, live samples and best build (updated while the process runs).
- `continuous_snapshot.json`: frozen first checkpoint used by the report and charts. The plotting script prefers this file when present so later solver activity cannot silently change the report.
- `worker_scaling.png/.svg`, `quality_latency.png/.svg`, `continuous_run.png/.svg`: shareable charts.

```powershell
python tools/build_github_pages.py
python -m http.server 8770 --bind 127.0.0.1 --directory .scratch
# In another terminal; requires Chrome and .scratch/browser-qa/node_modules/playwright:
node tools/benchmark_solver_browser.cjs
# After the first checkpoint; requires NumPy and Matplotlib:
python tools/plot_solver_study.py
```

The benchmark keeps its own Chrome instance alive for the continuous run. It writes console logs and completed snapshots; process/browser lifetime is intentional. Static worker and dashboard code require ordinary static files and messages, without a backend, SharedArrayBuffer or special headers. The local static export can be hosted on GitHub Pages using the existing publication workflow, but publication was not requested here.

Validation: all 35 timed trials and the first continuous checkpoint passed source
stat/cost/optic-lock/cap replay. `node tests/parallel_search.mjs` passes both
presets, locks, categories, mode/budget variants and merging. `node
tests/parallel_search_browser.cjs` passes common deadlines, worker failures,
cancellation and recovery. `node tests/solver_diagnostics_browser.cjs` passes
continuous checkpoints, objective retention, aggregate-counter reconciliation,
Stop preserving checkpoints, and desktop/mobile layout. These regression checks
ran after the frozen first checkpoint; their timings are not benchmark data.
The four real local backend integration tests also pass (`python -m unittest
discover -s tests -p test_builder_server.py`).
