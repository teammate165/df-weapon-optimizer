# Shared optimizer solution preview

This is the standard for recoil, agility and future optimizer presets. The shared
`renderResults` implementation in `builder/app.js` owns this presentation; presets
provide data and score semantics rather than separate preview layouts.

- Row 1: two equal cells, **Relative score** and **Cost**.
- Row 2: four equal cells, **Control**, **Handling**, **Stability**, **Accuracy**.
- Every cell contains its title and one number. The four main stats use effective
  `row.stats` points, not objective losses, component scores, or percentage deltas.
- No inline detailed metrics, effectiveness card, or baseline-change annotations.
- Relative score uses `row.score`, the percent reduction of primary loss from default.
  Default is 0; higher is better; negative means worse than default. The API preserves
  `row.loss` (default 100, lower is better) for search diagnostics. Agility's scalar score represents hip-fire spread improvement;
  Handling and ADS recoil are lexicographic tie-breakers, not weighted into it.
- Cost uses the existing quoted attachment total; unavailable values say Unpriced.
- Keep the same two-row structure on desktop and mobile. Apply and Save actions
  remain beneath the preview, with Max/Balanced/Min selection for every automatic preset/mode.

Scoring information belongs beside the preset heading, outside optimizer results. The preview Accuracy cell contains only raw effective Accuracy points; it has no icon or tooltip. The preset heading has an information button. Hover, keyboard focus or click
opens a short card explaining effective Accuracy points versus the relative
objective score. Agility explains `100 * (1 - current idle spread / default idle spread)`;
recoil identifies its overall score as the ADS recoil proxy. The current accuracy
model excludes maximum spread and independent jumping penalties. New presets must
keep their score interpretation clear without changing the shared six-cell layout.
The card is placed in the viewport outside the scrolling panel to avoid clipping,
and closes on pointer departure, blur, Escape, outside interaction or scrolling.

Browser reproduction: `.scratch/browser-qa/agility-distinct-check.cjs`.
Evidence: `.scratch/browser-qa/agility-distinct-report.json`.

## Standard optimizer output

Every automatic preset returns exactly three choices in this order: **Max**, **Balanced**, **Min**. This is shared engine behavior, including future presets, not a frontend-only duplicate of one response. Legacy custom effectiveness-target requests remain an explicit research interface outside this default contract; legacy three-budget requests still produce one result per budget, ordered by the three standard names.

For both priced presets, Max is best found; Highest Agility uses strict Accuracy -> Handling -> ADS recoil ordering for this search. Min is the cheapest evaluated distinct build retaining at least 50% of Max's primary improvement over default. Balanced is a distinct interior cost/performance knee above the same floor. Thus cheaper categories may sacrifice primary performance under an explicit bound; they do not claim equal primary performance to Max. Locks, mounting, legal tuning, mode restrictions, optional stat floors, budgets and missing-quote exclusions remain mandatory.

Successful categories must represent distinct physical equipment/tuning, with strictly descending cost from Max to Balanced to Min. Build signatures include mounted item/slot pairs and non-default legal tuning, so omitted/default slider values cannot create fake alternatives. If no distinct eligible build is found, the category is `unavailable` with a reason, not a copy. If all constraints are infeasible, entries remain `infeasible`. Warfare provides Max but has no priced alternatives; Balanced/Min are unavailable. No global optimality is claimed.

Category-button tooltips show `category_note`. Changing the selected preset clears prior results so a single legacy result cannot appear to be output from the newly selected preset. The `output_standard` response field identifies automatic `max_balanced_min` output.

## Synchronize the full performance preview

Selecting a solution also evaluates that build for the large performance cards,
weapon details and recoil graph. These views use the selected solution while the
Optimizer tab is active and identify it as `SOLUTION PREVIEW / <category>`.
The Builder tab continues to show the equipped build. Only **Apply build** equips
the selection; browsing solutions must not change equipment, locks or tuning.

Preview calculations are cached per weapon/mode/configuration/tuning/shot count.
Only the latest requested selection may update the visible preview, so a slow
Max response cannot overwrite a later Min choice. Preview identity is distinct from the selected category label. New searches and preset changes clear
the cache and invalidate pending previews.

Regression reproduction: `.scratch/browser-qa/recoil-full-preview-check.cjs`.
Evidence: `.scratch/browser-qa/recoil-full-preview-report.json`. The original
failure left the large cards at equipped M4A1 values even while the small solution
summary changed; testing only the summary and Apply routing did not detect it.

The score-direction contract is explicit: `score_direction: "higher"`, `baseline_score: 0`, `baseline_loss: 100`, and `row.score = 100 - row.loss = row.improvement_percent`. The search and category gates continue using loss; changing display direction must not change rankings or the 50% improvement floor. Older results without the direction field are converted when displayed.

The optimizer form has no Automatic/Spam firing selector and sends no firing field. The shared engine defaults to its ordinary ADS recoil proxy; legacy research API inputs are outside the UI.

## Weapon and mode context lifecycle

Weapon/mode changes and explicit loadout resets invalidate optimizer results, cached solution evaluations and pending preview serials before rendering the new context. Adopting a different weapon/mode (including saved-build loads) also clears this state. Opening Optimizer without results for the current context therefore shows its equipped build. Late previous-context solution responses fail the existing serial/run-identity checks and cannot restore the old weapon image, stats or chart. Same-context tab switches retain valid results.

Regression: `.scratch/browser-qa/weapon-context-check.cjs` covers loaded and deliberately delayed previous-weapon previews, mode changes and fresh result rendering.
