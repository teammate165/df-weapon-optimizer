# SCIP WebAssembly feasibility trial

2026-11-16. Verdict: the existing single-threaded community bundle runs on a
plain static origin and accepts nonlinear CIP models, but its nonlinear bounds
cannot currently support this project's optimality claims. No production solver
was replaced, and no M4A1/full-catalog optimality claim is made.

## Reproducible prototype

Local artifact: `.scratch/scip-wasm-prototype/`. Archived on local Git branch
`prototype/scip-wasm-feasibility-20261116`; the branch is not published. This is
throwaway runtime evidence, separate from the production optimizer. The archive
includes the pinned WASM bundle, license notices, source URLs/hashes, demo,
runner, and raw browser solver logs.

Run from the project root:

```powershell
python .scratch/scip-wasm-prototype/fetch.py
python -m http.server 8771 --bind 127.0.0.1 --directory .scratch/scip-wasm-prototype
```

Open `http://127.0.0.1:8771/index.html`. Buttons run independent linear and
nonlinear scenarios in fresh module Workers; Cancel terminates the Worker.
HTTP is necessary for module/WASM loading, so this technical feasibility demo
cannot run by double-clicking its HTML. No backend API or custom isolation
headers are used. No remote deployment was performed.

The existing local Playwright installation can collect browser evidence:

```powershell
node .scratch/scip-wasm-prototype/browser-check.cjs
```

This collector serves the prototype on an ephemeral loopback port, runs both
scenarios and writes `browser-result.json`. It records observations rather than
constituting the production solver's validation suite. `smoke.mjs` also runs the
nonlinear case in Node and saves `smoke-result.json`.

## Bundle and interface

Source: [Industrialist SCIP-WASM](https://github.com/Pollywrath/Industrialist-Production-Calculator/tree/1c9ff48b31d0a871bf9e37f63475ebc6ca4b2b25/tools/scip-wasm),
revision `1c9ff48b31d0a871bf9e37f63475ebc6ca4b2b25`.
Its version manifest records SCIP 10.0.2, SoPlex 8.0.2 and Emscripten 6.0.2.
The WASM file is 6,386,959 bytes; loader is 79,238 bytes. These are uncompressed
file sizes, not a claim about network transfer or runtime memory usage.

The exported `FS` and `callMain` APIs allow a general `.cip` file to be loaded
through SCIP's command shell. No custom C++ compilation, Docker, PySCIPOpt,
or OR-Tools adapter was needed. The source's application-specific ratio wrapper
is not used by this experiment. Downloads are pinned and SHA-256 checked.

## Observed results

Chrome `157.0.8103.79`, Windows, `crossOriginIsolated=false`, no page errors:

| Scenario | Expected result | Observed result | Load + solve time | Solver errors |
| --- | --- | --- | --- | --- |
| Integer nonlinear: minimize z, z >= (x - 1.4)^2, integer x in [0,3] | x=1, z=0.16 | Correct incumbent; SCIP reports optimal | 121 ms | 509 |
| Integer linear: minimize x, x >= 0.4, integer x in [0,3] | x=1 | Correct incumbent; SCIP reports optimal | 113 ms | 0 |

Times are single cold-runtime observations, not weapon-solve benchmarks.
The nonlinear reference is independently enumerable at x=0,1,2,3, giving
1.96, 0.16, 0.36, 2.56. The runtime printed:

```text
[intervalarith.c:253] ERROR: setting rounding mode not available - interval arithmetic is invalid!
```

SCIP's [versioned interval arithmetic source](https://github.com/scipopt/scip/blob/v10.0.2/src/scip/intervalarith.c)
explicitly emits this error in its fallback without rounding-mode control
and returns false from `SCIPintervalHasRoundingControl`. This is a bound-validity
problem, even though the tiny example's incumbent is correct. The prototype
therefore rejects the nonlinear proof instead of trusting the reported zero gap.
Its `proofAccepted` field only means the smoke check saw optimal status and no
runtime errors; it is not an independently checked certificate or full-space
weapon-model validation.

## Consequences and next work

Static hosting is not the immediate blocker. Correct nonlinear interval bounds
in this WASM build are. Do not suppress the error or simply enable a rounding
macro: that would not establish correct outward-rounded arithmetic in WASM.

Two paths remain worth investigating:

1. A SCIP WASM port with a validated software interval-arithmetic implementation,
   preserving safe bounds for every nonlinear operation used by our model.
2. An equivalent MILP formulation, using exact finite tables/linearizations where
   practical, with SCIP or HiGHS in the browser. Feasibility and model size remain
   unbenchmarked; an approximation would only prove the approximated problem.

Native SCIP is still a candidate for establishing a reference M4A1 optimum.
The nonlinear model must preserve current 40/30/30 scoring, speed-tier boundaries,
attachment dependencies, conditional effects, every legal calibration choice,
stat floors and price constraints. This runtime experiment deliberately stops
before encoding that model because it cannot yet rely on the WASM bounds.

## Subsequent production implementation

The [full-weapon linear SCIP model](scip_optimizer.md) avoids nonlinear interval arithmetic entirely. This supersedes the production blocker for the linear path; it does not repair or validate the nonlinear WASM runtime.
