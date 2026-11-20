# Pruning and certificates

For each partial state n let C(n) be its legal complete descendants. Include every legal mount and slider outcome, or use a proven covering overapproximation. For each descendant, require K ≥ L(n) and P ≤ H(n). Bounds may be weak. Use an unrestrictive bound for unsupported operations. The following rules concern the [three-output contract](problem_definition.md).

| Rule | Condition and proof | Disable when | Correctness test |
| --- | --- | --- | --- |
| Structural infeasibility | Reject only if no source-legal continuation exists. Missing a required provider after all its choices are fixed is one example. The subtree then contributes no candidate. | Parent/provider, default replacement or forced mount remains undecided. | Enumerate tiny source domains; compare identities under defaults, locks, coupled/forced mounts and exclusions. |
| Cost lower bound | Sum minima of unconditional independent cost groups, or use a relaxed model whose feasible set contains every actual continuation. Fixed cost must be irrevocable. Dropping nonnegative charges can lower the bound; double counting can raise it. | Costs can be refunded, repriced or shared and the relaxation omits that behavior. | Check against every tiny descendant including default displacement and budget equality. |
| Score upper bound | Propagate reachable intervals through native-order effects and widen for floating operations. Include alternative references, laser selectors, panel interpolation extrema, absolute values, thresholds and all reachable calibration. For the prototype P = 1000 − d², the largest score on an interval comes from its point closest to zero. | Unsupported effects or numerical uncertainty can fall outside the enclosure; return an unrestrictive bound for that portion. | Compare every tiny subtree bound to exhaustive maxima. Include zeros, tier edges, mixed signs, alias ordering and calibration reversals. Existing default-only source tests cover their declared domain. |
| Attachment or partial-state dominance | A may replace B when every legal suffix of B maps to a legal suffix of A with K no higher and P no lower. Prove continuation inclusion for compatibility, calibration, effects and hard floors. For equal transitions and stats, cheaper irrevocable cost alone works for these three scalar values. Composition with each query is monotone. | Different hosts, reference replacements, future slider choices, crossing response curves or identity/rank requirements lack a proof. | Enumerate successor pairs and compare all three optima with pruning off/on; test a modern top-percentile cohort separately. |
| Exact memoization | Merge states with identical future transitions and sufficient numeric state, cost and context. Induction over remaining decisions yields identical results. Preserve sorted identity/multiplicity where the caller ranks individual paths. | Displayed stats agree but hidden buckets, native event order or remaining controls differ. Approximate rounding changes equivalence. | Compare complete native/DAG manifests, include signed zero, floating aliases and forced cache eviction. |
| Calibration reduction | A slider setting may replace another under the same full continuation dominance test. Independent optimization requires a separable score and product domain with uncoupled feasibility, or a complete value envelope that preserves cost and constraints. Exact attainable vectors can merge if future evaluator state agrees. | Cross terms, shared limits, context-specific costs or mixed signs allow trade-offs. Endpoint-only optimization needs monotonicity throughout the legal domain. | Enumerate all legal slider tuples on fixed small layouts and check the exact value/feasible set against any reduced representation. |
| Simultaneous incumbent pruning | For max and balanced, use bounds H and H − λL, with an empty branch for L > B. For cheapest, maximize −K with bound −L, with an empty branch for H < Pmin. Discard only when all bounds are no better than feasible incumbents or the corresponding query is impossible. | Additional tie-breaks are required on equality without tie bounds; use strict comparisons or encode the tie order. | Compare against independent enumeration, replay all witnesses, interrupt at multiple node counts and check bounds against the oracle. |

Terminal values must come from the reference evaluator. Widen bound operations outward or prove exact integer representation, including the arithmetic used to compare U. A MILP numerical gap concerns its mathematical model and solver tolerances. Native replay validates a witness; a global native certificate additionally requires complete representation or a proved one-sided relaxation. A small sample of admissible bounds is regression evidence, and the proof still needs to cover the claimed domain.

At interruption, each query's optimistic bound is the maximum of its incumbent and every still-live node bound, including leased/in-flight work. A finite incumbent-to-bound interval certifies a numerical gap in that query's units. If the two endpoints meet, it proves optimality. Exhausted or ruled-out search without a feasible witness proves infeasibility. Otherwise an absent witness is unresolved. If no useful bound exists, label the witness best found. Keep a live parent until its child coverage is registered so cancellation cannot improve a bound by losing work.

The current percentile screen can only guarantee downstream optimality if it retains a representative of each needed optimum. That requires a completion-aware discard proof or exhaustive retention. Default rank alone fails even on a two-by-two domain. In the prototype a core with d=0 beats d=4 before tuning. Mandatory suffix choices −4 and −3 give the kept core best score 991 and the discarded core score 1000. If default must be legal, a corresponding reversal follows with a provisional d=1 core, d=4 competitor and suffix choices 0 and −4. Rank guarantees for the current default DAG do not extend through calibration.

## Ordered native chart interval proof

The opt-in `createNativeChartInterval` bound covers the pinned automatic chart calculation when the profile and shot times are fixed and the incoming horizontal and vertical scales already have valid interval enclosures. It replays the chart's operations in their native order, including per-shot profile lookup, signed accumulation, the native five-decimal rounding operation, and 200 ms piecewise-linear interpolation.

For finite binary64 inputs, rounding to binary64 is monotone. Addition uses the two lower and two upper endpoints. Subtraction crosses the endpoints. Multiplication by a fixed coefficient uses the two endpoint products in sign order. Division uses the fixed positive denominator. Applying these rules in native order proves by induction that each rounded chart coordinate encloses the corresponding native output. The five-decimal expression `Math.round((x + 2**-52) * 1e5) / 1e5` is also monotone. Unsupported or nonfinite chart arithmetic declines the bound.

For horizontal displacement, take the greatest minimum absolute coordinate value. For vertical excursion, subtract the smallest upper coordinate endpoint from the greatest lower endpoint and clamp below at zero. For each native candidate window, use interval subtraction and interpolation at its two fixed times. The minimum possible absolute displacement divided by 0.2 seconds bounds that window from below. The greatest window lower bound bounds the native maximum speed. The tier multipliers are nonnegative and monotone, so the lower tier and lower displacement can be used together with the vertical lower bound. Ignoring correlation between intervals can weaken the bound but preserves enclosure.

The pinned-trajectory regression checks exact singleton agreement on **640 charts** and **144,000** interval comparisons. It exercises signed axes, opening/loop profile fallback, fixed and burst-like timelines, and points at or near all three speed thresholds. This is a proof of the geometry stage under its stated inputs. The upstream stat-bucket regrouping, panel-curve enclosures, discovery of all reachable timelines, and final norm/score rounding still require their own end-to-end guarantees.

## Ordered recoil-axis fold for resolved layouts

For the guarded M4A1 fixture, the native collector supplies the full operation order for a resolved layout. Every active slider position is collected in its actual mount context. The replay accepts one unconditional additive-multiplier write per recoil axis per slider, plus the fixture's known non-scoring targets. This makes the operation order independent of slider values. It also ensures the active controls do not write main-stat inputs or change the recoil reference or shot schedule. Static native operations and direct aliases keep their original positions in the replay.

The replay walks each axis bucket in order. Initial replacement, additive accumulation and multiplicative accumulation follow the same native operations. When the source applies the single fixed DeltaMappingThenScale mapping, its coefficient comes from the already resolved native state. Its placement after the raw fold matches the kernel. The final axis expression uses the same left-associated addition and multiplication as the native getter.

For an unresolved slider interval, substitute the minimum and maximum native operation values at its legal positions. Exact native binary64 operations are monotone on their relevant finite domains. Taking the minimum and maximum of all endpoint products encloses multiplication with either sign. Induction over the original operation order encloses the final axis without a summed-multiplier rounding allowance. On a singleton, the operations produce the native result exactly.

These axis intervals feed the ordered chart enclosure. The resolved-layout camera and kick norms are fixed values from the native scorer. Substituting a lower pattern value into the same nonnegative weighted native score expression bounds loss from below. Subtraction from the fixed stock loss gives the gain upper bound without a separate score-rounding pad. This proof has no need to bound a changing Math.hypot result inside the resolved fixture.

This argument covers guarded resolved layouts. It does not cover the partially ordered operation streams when mounts are still undecided, calibration that can change main-stat curve inputs, or variable camera/kick intervals. The opt-in mounted-subtree gain bound still uses its upstream bucket regrouping allowances.

## Order-independent stat buckets and native stat curves

For unresolved mounts, a path can contribute one of several native operation sequences. The opt-in bound records the raw operands, including direct aliases and contextual slider extrema. Each path contributes the hull over the possible item sequences, including the empty sequence when applicable. Choices across paths can be combined independently in the bound because this admits a superset of legal completions.

- **Sums.** The real-valued operand sum is order-independent. Widening each interval operation to its adjacent representable endpoints encloses that real sum. Let S be the upper bound on the sum of absolute operand values and N the maximum number of native additions. For a finite ceiling just above 2S, its upward ULP bounds an addition's rounding error below that ceiling. When N times this ULP is at most S/2, induction bounds each exact intermediate addition by S plus the accumulated error, below the ceiling. Widen the real sum by that proven error. Safe integer operands use exact accumulation when their absolute sum is a safe integer.
- **Products.** Outward interval operations enclose the order-independent real product. Products of `min(1, |operand|)` and `max(1, |operand|)` enclose every prefix magnitude. The guard uses these and an interval for all rounding factors to stay well inside the normal finite binary64 range. Each native product is then its real product times factors enclosed by `1 ± Number.EPSILON`. The implementation includes enough factors for the maximum path length. Zero-crossing or unsafe products decline pruning.
- **Initial writes.** A hull includes every possible initial writer and the no-writer fallback. Thus any native last-writer order stays inside it.
- **Stat curves.** The range code intersects the main-stat interval with each native curve segment and endpoint clamp. It evaluates the native linear or cubic expression in its original binary64 order using monotone endpoint operations. Adjacent subdivisions of cubic segments reduce dependency loss while covering the entire interval. For a singleton, the bound calls the native curve evaluator. The branch option supports the declared delta mappings; unsupported mapping types decline pruning.

The stat evaluator applies those mappings in source order. The existing ordered chart enclosure consumes the resulting axis intervals. This removes the earlier per-bucket regrouping and real-arithmetic curve allowances for the guarded branch mode. Coverage of profile and scheduling alternatives and the final `Math.hypot`/score allowance are separate obligations. The proof assumes the path alternatives enclose all source operations for the fixture; it does not certify arbitrary future modifiers or contextual source behavior.

## Native profile and timing coverage for the guarded mount domain

The pinned source initializes the ADS profile from the weapon aiming data. With ammo overrides outside the admitted domain, the only mounted writer for that reference is a native AimingId.RecoilId replacement. The manifest starts with the weapon profile and includes every replacement emitted by a possible mounted occurrence. The bound includes every possible last writer. It may drop the weapon profile when a writer is forced, because a forced unconditional replacement leaves no completion with the unchanged reference. Conditional context writes decline this mode.

For timing, the guarded SDK source reads FireInterval, GRateOfFire, FireRateMode, FireCD, FireDelayTime and ChamberTime, along with fixed weapon timing data and special-fire policy. The guard checks each operation through the native one-operation fold so direct aliases are included. It declines timing-related curve mappings, admitted item special-fire overrides, conditional context writers, and more than one possible timing writer or occurrence. The active slider operations are already guarded to exclude these inputs and profile replacements.

With zero or one timing occurrence, all other parts leave the source timing inputs and selection rules unchanged. The proof therefore reduces all timing event orders to weapon-only and weapon-plus-writer. Each schedule comes from the full native timed scorer on that context, so the representative uses the same rate conversions as ordinary scoring. The bound retains both schedules when writer activity is unresolved. The profile/schedule cross product is a superset of the reachable pairs. Enclosing extra pairs can weaken pruning and remains safe.

The manifest for the largest fixture contains the weapon profile and the 13020000173 barrel profile. Magazine 13130000169 is the only timing writer. Its two native schedules finish the 20-shot chart at 1,425 and 1,638.75 ms. The independent native audit compared every shot time and profile on 3,982 resolved layouts with default tuning and a simultaneous legal slider endpoint. This validates representative construction alongside the source dependency argument. It does not generalize to tune-driven timing, interacting timing writers, or different source contracts.

## Conservative final score without a norm tolerance

ECMAScript describes Math.hypot as implementation-approximated and gives no numerical error radius. For fixed arguments, the guarded branch mode calls the same native routine. For varying finite arguments it uses zero as the lower bound of the nonnegative norm, without relying on an error radius or on monotonicity of the approximation. The score uses the native expression over nonnegative components, fixed nonnegative weights and positive normalizers. Each operation is monotone where used, so substituting the chart, camera and kick lower bounds yields a loss lower bound without a final rounding allowance. Resolved tuning boxes instead use the exact fixed native camera and kick values and the ordered-axis proof. [ECMAScript Math.hypot](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.hypot).

The guarded profile, schedule, stat, chart and score arguments apply together only to the declared fixture and pinned source model. The zero norm floor can be too weak to prune many feasible attachment branches. A stronger portable bound would require a versioned norm with known numerical behavior, or a separate proof for each supported runtime's native implementation.

## Tighter native norm bound on audited V8 builds

The reviewed two-argument V8 builtin takes absolute values, computes their maximum (m), divides each by (m), squares and adds the ratios, and returns the square root times (m). For nonzero finite (m), the larger ratio is exactly one. Let (a_L,b_L) be lower bounds on the two absolute inputs and (m_U) an upper bound on their maximum. Then (m_L=max(a_L,b_L)) and (r_L=min(a_L,b_L)/m_U), with native division, are lower bounds on the multiplier and the smaller ratio. The native expression `sqrt(1 + rL*rL) * mL) is monotone for these nonnegative values, so it encloses the builtin result from below without a rounding tolerance. It uses the same native square-root operation. When (m_L=0), zero is valid and avoids division by a possibly zero magnitude.

The harness enables this bound for the source-reviewed Windows x64 Node 24.22.0 and Chrome 157.0.8103.79 builds with JavaScript JIT disabled. Node checks its executable and V8 versions plus the launch flag. Chrome is launched by the harness and the DevTools session verifies exact browser revision, V8 version and command-line flag before passing the runtime identity to the Worker. A generic web page lacks that attestation. The research bound remains scoped to the reviewed builds, and the scorer still uses native Math.hypot. [Node V8 builtin](https://raw.githubusercontent.com/nodejs/node/v24.22.0/deps/v8/src/builtins/math.tq), [Chromium V8 dependency](https://raw.githubusercontent.com/chromium/chromium/6dc9bc3bdaea5c35ed6d41fceab2f7a3a2227c4f/DEPS), [Chrome V8 builtin at the pinned revision](https://raw.githubusercontent.com/v8/v8/307108153d1e35e6e74528ee55f97b0cd59bf182/src/builtins/math.tq).

Both audited x64 instruction selectors map Float64Sqrt to the same scalar square-root operation used by the two builtins. [Node x64 lowering](https://raw.githubusercontent.com/nodejs/node/v24.22.0/deps/v8/src/compiler/backend/x64/instruction-selector-x64.cc), [Chrome x64 lowering](https://raw.githubusercontent.com/v8/v8/307108153d1e35e6e74528ee55f97b0cd59bf182/src/compiler/backend/x64/instruction-selector-x64.cc).

## Versioned deterministic norm and interval bound

The research objective version `binary64-normalized-hypot-v1` defines its own two-argument norm. It takes the larger absolute input as the scale, divides the smaller by that scale with binary64 arithmetic, and computes the binary64 sum (s=1+r^2). The final product is the correctly rounded binary64 square root of (s) times the scale, rounded in that multiplication. This specifies the individual operations and intermediate rounding points. It is a versioned normalized norm, with no promise that an implementation-approximated Math.hypot elsewhere gives the same bits. [ECMAScript Number arithmetic](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types-number-type).

Since (1 le s le 2), (s 	imes 2^{52}) is an exactly representable integer and the square root lies on the binary64 grid of spacing (2^{-52}) when rounded. With integer (N=(s 	imes 2^{52}) 	imes 2^{52}), find (k=lfloorsqrt{N}floor). The exact integer comparison (4N>(2k+1)^2) determines whether to round up. Equality is impossible because the right side is odd. A native Math.sqrt estimate is accepted only after integer comparisons verify the floor root, with integer Newton iteration as fallback. Thus the host estimate cannot affect the returned bits.

For each pair of axis intervals, bound the smaller absolute component from below, the larger absolute component from below and from above, and divide the smaller lower by the larger upper. Division is monotone for nonnegative numerator and positive denominator. The deterministic square root, binary64 addition and multiplication, and final nonnegative weighted score are monotone on these inputs. The resulting norm lower bound uses the same versioned arithmetic as the scorer, including both normalization constants and the final product. If the lower scale is zero, the norm lower bound is zero. This proof is independent of runtime Math.hypot and does not need a V8 version or launch flag.

The deterministic norm applies only when the research driver explicitly selects it. Native-score screening adapters stay on their existing objective. All other mount, context and calibration guards still apply to this certificate.

## Separating gun-kick and chart calibration

The guarded active-control classifier reads the actual mounted occurrence and its native tune context. A score-affecting control must write exactly one additive multiplier to each axis of either the chart pair or the gun-kick pair. Other emitted targets must be among the already audited non-objective targets. The mount bound includes the native extrema from every admitted score-affecting dial, including optional mounts. A missing manifest or unsupported active control stops the guarded fixture instead of freezing a potentially relevant dial.

For a fixed legal layout, the two groups have disjoint score dependencies. Chart controls do not write kick inputs, and kick controls do not write chart inputs, references, timing, camera inputs or main-stat curve inputs. Terms such as movement speed remain outside this scalar objective. Neither group changes mounting legality or cost under the fixture contract. Consequently a native kick minimum can be paired with every chart tuple. That minimizes recoil loss for each such tuple because the weight on kick is nonnegative and the native score arithmetic is monotone in the kick term.

The kick subproblem uses the same ordered native bucket fold and deterministic norm bound as the other guarded subproblems. It evaluates legal singleton settings exactly and rejects a kick box only when its norm lower bound cannot improve the best feasible kick value. The winning legal kick settings attach to every scored chart witness. A layout with no active chart controls has a single empty chart tuple, and a layout with no kick controls keeps its fixed native kick value. The argument allows two active kick controls and does not assume endpoint optima or raw-axis monotonicity of the rounded norm.

## Guaranteed half-max incumbent

Let H be a certified upper bound on the fixture maximum and m a feasible evaluated build with gain at least H/2. The true maximum is at most H, so m qualifies for Minimum Acceptable even before the true threshold is known. A branch whose cost lower bound exceeds the cost of m cannot win Minimum Acceptable. At equal cost it cannot win if its gain upper bound is at most the gain of m, under the higher-gain tie rule. A branch can be dropped only if its independent Maximum and Balanced checks also exclude improvement. Use this rule only with a valid fixture-wide upper bound, an already evaluated feasible incumbent, and valid branch cost and gain bounds.

Prioritizing mount paths changes traversal only. Every decision still branches over the same compiled choices and keeps the same compatibility constraints, including unresolved parent choices. The regression compares reordered and default traversals without gain cuts and checks that a cheaper feasible build below the conservative half-max threshold can still win once the true maximum is known. It also checks that a more expensive branch is skipped once a qualifying cheap incumbent is available. [Regression](../../tests/full-ordinary-search-pruning.mjs).

## Balanced with certified price endpoints

Let m be the certified Minimum Acceptable cost and M the certified Maximum Performance cost, including their tie rules. Balanced admits only costs satisfying m < C < M and maximizes gain divided by C, breaking ratio ties by higher gain. The endpoints are resolved first. An unfinished endpoint search cannot establish the price window. An unrestricted ratio winner or a cheaply dominating layout can lie beyond the window, so the second pass restarts over the compiled domain.

For integer nonnegative costs, an unresolved branch with cost lower bound L, cost upper bound U and gain upper bound H has eligible costs in [max(L, m + 1), min(U, M - 1)]. The branch is infeasible when that interval is empty. For H at least zero, divide H by the lower end. For negative H, divide by the upper end. These choices yield an upper bound on gain per point by monotonicity of division for positive denominators. Resolved layouts use their exact cost for both ends. Unresolved mounts can leave U unbounded. A branch can be cut if its ratio bound is below the incumbent ratio, or if it ties and its gain bound cannot beat the incumbent gain.

The regression filters a finite set independently and checks the winning value, including a cheaper out-of-window ratio winner and an in-window winner whose gain is matched by a cheaper excluded build. It also checks strict endpoint exclusion, a window with no legal integer cost, negative gains and a stopped search with an unresolved bound. Apply the integer-adjusted bound only to integer pricing. [Regression](../../tests/full-ordinary-search-pruning.mjs).


With a strict performance floor F from the certified Minimum Acceptable row, a branch is also ineligible when H is at most F. A gain exactly equal to F fails eligibility. This holds independently of the ratio bound. The regression verifies that a cheaper ratio winner at exactly F is excluded, and that a price window containing only gains at or below F certifies no Balanced build.

For incremental gain per point, subtract F from H and divide by the smallest possible extra cost, max(1, L - m). Eligibility guarantees a positive increment in score and cost. For gain above the line between the endpoints, use the certified slope s and bound the surplus by (H - F) - s * max(1, L - m). The slope is nonnegative, so higher cost cannot increase this bound. Both rules preserve gain as the secondary ordering on an objective tie. Regression fixtures distinguish the two optima. These are separate objective choices within the same admissible price and gain window.

### Relative Minimum Acceptable threshold

For a fixed share s in (0, 1], the true threshold is s times the attainable maximum gain. Multiplying the available lower and upper maximum bounds by s preserves their order. The archive lookup at the scaled upper bound gives a certainly qualifying incumbent. The scaled lower bound gives the optimistic threshold used to preserve unresolved cheaper contenders. A pre-certified fixture-wide upper bound H still supports the guaranteed-incumbent cut when a feasible row reaches sH. Equality at the threshold qualifies. The 60% fixture checks equality, the cheaper rejected row and the interrupted lower-cost certificate. [Regression](../../tests/full-ordinary-search-pruning.mjs).

### Exact search across four partitions

The ordinary M4A1 domain splits by explicit barrel choice, with one additional alternative for layouts that use the bundled barrel. Each compiled layout has at most one explicit choice at that path. The coordinator obtains exact ordinary layout counts for the alternatives and assigns each alternative to one of four Workers. Their counts sum to 12,268,642. Each Worker also checks its restricted count before search.

In the endpoint pass each Worker retains its nondominated cost/gain witnesses. Let L be its local maximum witness and let H be the global gain upper bound used during local search. The unknown global Minimum threshold lies between 0.6L and 0.6H. Local pruning must preserve a cost-minimizing witness for every threshold in that range, up to identical values. A dominated witness can be dropped because the dominating witness also qualifies and cannot cost more. A guaranteed qualifying witness at 0.6H can close branches whose cost and gain bounds rule out improvement. The union of the four archives therefore suffices to select Minimum at 60% of the merged, certified Maximum. If any endpoint partition is open, the preview reports a qualifying minimum only at the scaled global upper bound and withholds endpoint proofs.

The coordinator sends one certified price/gain window and the best eligible seed from the combined archive to all Workers. A valid seed from any partition is a lower bound on the global Balanced objective. A Worker can cut branches that cannot beat it even if the seed is outside that Worker's assigned mounts. The global objective upper bound is the maximum of the four reported bounds. The demo certifies Balanced only when all four partitions certify their work under this window. [Partition and certificate tests](../../tests/exact_beta_pool.mjs).
# Shared resolved-layout calibration bounds

The local exact ordinary solver checks for the pinned native state and chart
contracts, validates the resolved profile against the native 20-shot chart,
and restricts varying chart writes to one additive multiplier per recoil axis
per control. Other allowed writes leave the recoil profile, firing timeline,
and main-stat mappings fixed. Contexts that fail a guard use direct native
evaluation of the full tuning grid.

For each admitted calibration box, the ordered axis replay encloses the native
binary64 operations. The chart enclosure gives a lower bound on
`vertical excursion + horizontal tier × horizontal distance`, including the
200 ms speed thresholds. The search skips a box when that bound strictly exceeds
the cap. It also skips a box when its lower loss strictly exceeds the incumbent
at the same price. This preserves handling ties and all price categories.

For nonsingleton horizontal ranges, a second speed floor retains the same
multiplier at every shot. Each unrounded position is the cumulative sum of the
scaled source coefficients divided by ten, times the multiplier. Interpolating
those slopes and subtracting the slopes of each window's endpoints gives a
displacement slope. The largest absolute window slope times the minimum
absolute multiplier bounds the peak real displacement from below after
subtracting the error allowance. Ranges crossing zero have a zero floor.

Each window endpoint is a convex combination of rounded points, so the
five-decimal quantization contributes at most half a decimal unit per endpoint
before binary64 error. With at most 64 shots, the implementation allows
`4096 × Number.EPSILON × max(1, scale)` in displacement units, where scale
bounds the sum of the absolute coefficients times the maximum absolute
multiplier. Each ordered sum contributes at most 64 addition roundoffs
plus the product and division roundoffs per term. The slope calculation
has the same accumulation bound. The remaining operations are the decimal
scaling and unscaling, two endpoint interpolations in each calculation,
their subtraction and the final speed division. Their magnitudes are
bounded by the coefficient mass after factoring out the multiplier.
The guard restricts interpolation durations to 1 through 10¹² ms and
caps scale at 10¹² to keep intermediates finite and prevent the interpolation
division from amplifying subnormal rounding. The
solver takes the larger of this floor and the original interval floor,
and uses the original ordered replay for singleton axes.

The same shared-axis argument bounds vertical excursion. The difference
between the largest and smallest cumulative vertical slopes, multiplied by
the minimum absolute vertical multiplier, is a floor on the unrounded
excursion. Subtracting one five-decimal unit and the binary64 allowance
above covers the two rounded points and their subtraction. Singleton axes
retain the ordered replay.

Camera is constant within admitted boxes. When independent kick controls write
one additive multiplier per kick axis, the solver replays both ordered axes
at every kick tuple and applies the same native norm as the scorer. Each
prefix of kick choices stores the smallest evaluated norm below it. The chart
bound uses the root minimum until the search fixes all chart choices. It then
uses the corresponding prefix minimum as it fixes each kick choice. This
keeps kick settings that can tie on loss and win on handling. The kick
subdomain is limited to 16,384 prefix and leaf nodes for this bound, with
up to 65,536 cached nodes per request. Larger or unsupported subdomains
use zero as the kick floor.

An ADS-only control can use its smallest native additive multiplier when the
ordered ADS replay proves the initial value plus addends and the final scale
are nonnegative. The relative handling loss is monotone in ADS time. A
constant native absolute mapping can supply the initial value, and other ADS
writers remain in the sign check. Because the eliminated control can change
only ADS time and inert targets, replacing it leaves the loss, cap and stat
floors unchanged. Unsupported writers keep their full native domains.

With the same guards, controls whose targets affect only view settings, breath
scale, aim movement sway, ADS movement speed or bullet velocity use one legal
representative. These targets do not enter the recoil objective, the handling
tie-break, the main-stat floors or the fixed chart. Unknown controls keep all
their positions. [Exhaustive parity suite](../../tests/exact_ordinary_bounds.mjs).

## Witness-backed priced mount cuts

For integer-priced domains the mount enumerator builds suffix sums from
the remaining socket choices. It includes incompatible combinations, so
adding the already-selected cost and applying the budget gives a superset
of possible completion prices. Every price in that superset must have a
scored witness before the branch can be cut. The loss lower bound must
strictly exceed the largest of those witness losses. Equal-loss completions
remain eligible for the handling tie-break. This preserves the best witness at
each price used by Max, Minimum Acceptable and Balanced.

Suffix sets with more than 2,048 entries disable this check at that depth
and all earlier depths. Non-integer prices, incomplete witness coverage
and unsupported native loss enclosures also leave the branch searchable.
The existing pattern-cap bound runs first when applicable.
[Native mount-cut regression](../../tests/exact_ordinary_mount_bounds.mjs).

Staged searches use the chart floor from the loss enclosure for the pattern
cap in the same pass. A declined loss enclosure falls back to the separate
pattern enclosure. Tune envelopes cover the minimum and maximum of the
legal positions for a required mount. An optional mount already contributes
the neutral alternative through the mount domain, so required tune envelopes
need no extra zero unless a legal position emits it.

## Category-specific ordinary phases

Max cuts a layout or branch when its loss lower bound strictly exceeds the
loss of a qualifying witness. Equal loss remains searchable for handling and
price. The Max mount bound can reuse a finite native kick floor after every
possible kick writer is fixed. The guard requires equal static multiplication
factors and equal paired `Mult_A` tune values on the two kick axes, plus one
shared `DeltaMappingThenScale` from a bounded integer main-stat range. The
program enumerates every legal pair of tune values and every binary64 fold of
the fixed static factors across source orders. It then appends each possible
native curve scale and calls the same native norm as the scorer. Taking the
minimum covers the actual mount order and stat, even though some combinations
in the enclosure may be infeasible. The two tune additions commute from
zero. Unsupported writers, optional kick mounts, and domains that exceed the
work limit keep the existing norm floor. [Native enumeration and mount parity](../../tests/exact_ordinary_mount_bounds.mjs).

Once all Max partitions close, Min uses the fixed threshold
`0.6 * maximum.score`. For a lower bound `L` its optimistic score is
`100 - L`, evaluated in the same order as the native objective. A score
strictly below the threshold cannot qualify. A qualifying witness caps
the prices Min needs to consider. At the incumbent price Min still searches
equal loss for the handling tie-break.

Balanced opens after both endpoints close. Its score must exceed Min's score
and its price must lie strictly between Min and Max. Because the line between
the endpoint scores has a nonnegative slope, using the smallest possible
completion price and the optimistic score bounds the surplus above the line.
The solver cuts only when the upper bound is strictly less than the
incumbent surplus. It uses the original floating-point expression order.
Integer suffix prices are a superset of legal prices. Branches with
fractional or unsupported suffix prices keep the resolved-layout cost test.

Every staged partition searches the same representatives throughout the
proof. The same-price grouping is limited to ordinary sight and magwell
leaf choices with the same host availability, the same ordered native
static operations, and only view calibration. The groups exclude locked
paths and items with mount, occupancy, special-fire or ammo dependencies.
The applied result uses a concrete legal attachment. [Grouping regression](../../tests/exact_ordinary_choice_groups.mjs).

For admitted stat mappings, an integer-valued main stat with only integer
addends can use the finite grid inside its interval. The bound evaluates
the native curve at every integer in that grid. If two norm axes use the
same stat and all other terms are fixed, the bound supplies each pair to
the same native norm as the scorer and takes the smallest result. This
keeps the stat value shared across the paired axes. The branch uses
the existing conservative norm floor when the finite-grid guards fail.
An unordered bucket fold with at most two nonidentity operands per
completion also needs no regrouping allowance.

At a resolved layout, the ordered horizontal interval alone determines the
weighted horizontal distance including its speed tier. The vertical interval
alone determines the excursion. The staged solver caches those two values
by exact interval endpoints inside a request and for a fixed profile and
timeline. Their sum uses the same arithmetic as the uncached bound.

The ordered axis replay folds the fixed Initial, Addend and Mult_C buckets
once per layout. It keeps the source order inside Mult_A and computes both
interval endpoints in that order. The staged search can reuse completed
calibration exclusions when the ordered programs and their native position
tables match. A cap-only exclusion requires every cut to follow from the
same fixed cap. A Max loss exclusion also requires matching camera and kick
bound inputs and a Max incumbent at least as strong as the recorded
cutoff. A traversal that evaluated a full tuple, dropped its bounds, or
reached a deadline supplies no reusable exclusion.

A timeout or failed shard closes no new phase. Earlier completed phases
remain proven. An interrupted Max phase can return provisional price
categories from its witnessed rows. [Independent oracle and phase parity](../../tests/exact_ordinary_native_oracle.mjs).
