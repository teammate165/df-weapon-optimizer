# Progress reporting

Use one bullet per worker result, sweep checkpoint, or handoff result. Give the outcome, proof status, wall time or case limit, error count or brief error, and links to the evidence. Mark timing and errors as unknown when the run did not record them. Report an interrupted proof as open or interrupted even when its current build replayed successfully.

- Worker reports should identify the completed work and its validation. Keep configuration, diagnostics, and per-partition results in the run artifacts.
- Sweep reports should give completed and planned case counts, certified and open results, errors, and applicable stop or overrun counts. Link the manifest for individual cases and the log for event order.
- Handoffs should give the latest outcome and the next action. Keep commands, restart position, and stop conditions in the runbook where the next operator will use them.

The [sample records](../data/optimizer_validation/reporting_samples.json) show the fields accepted by the [renderer](../tools/compact_report.py). The optional context records details from the sampled prose that need to travel with the evidence. Keep raw JSON reports, manifests, and logs alongside the short summary. Use repository-root paths in records and adjust the rendered links relative to the destination Markdown file. Links under `.scratch` require the original workspace artifacts.

```powershell
python tools/compact_report.py data/optimizer_validation/reporting_samples.json --check-links
```

## Token comparison

The worker baseline is the core-scaling benchmark bullet in TODO.md. The sweep baseline is the unlimited arsenal checkpoint in TODO.md. The handoff baseline is the earlier M4A1 release-check bullet in the development handoff. The worker and sweep samples repeat run settings and case detail from their artifacts. The handoff repeats the release blocker and updated proof already reported in the backlog. The exact baseline lines are preserved in the sample records.

| Sample | Before | After |
|---|---:|---:|
| Worker scaling matrix | 212 | 82 |
| Unlimited arsenal sweep | 140 | 88 |
| M4A1 release handoff | 108 | 100 |
| Total | 460 | 270 |

The three sampled summaries used 190 fewer tokens, a 41.3% reduction. The handoff baseline was already short, and its revised line includes both runs' timing and error status. The totals describe these three prose excerpts.

Count each baseline line and corresponding rendered line independently as plain Markdown, including link text and paths, with no trailing newline. Sum the three counts for each format. This uses `o200k_base` with `tiktoken==0.12.0` and excludes prompt framing and linked artifact contents. The [machine-readable result](../data/optimizer_validation/reporting_token_counts.json) includes the sample-input SHA-256 after normalizing file line endings.

```powershell
python -m pip install tiktoken==0.12.0
python tools/compact_report.py data/optimizer_validation/reporting_samples.json --measure
```
