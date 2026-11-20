"""Describe a completed eight-worker exact-DAG validation; no inferred CIs."""
import hashlib
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / (sys.argv[1] if len(sys.argv)>1 else "data/optimizer_validation/optimized_exact_dag_20261118/full")


def main():
    result = json.loads((OUT / "final.json").read_text())
    assert result["passed"] and result["workers"] == 8
    resources = json.loads((OUT / "resources.json").read_text())
    reference, optimized = result["reference"], result["optimized"]
    population = int(result["exact_total"])
    metrics = {
        "population": population,
        "selected": result["selected"],
        "terminal_classes": optimized["terminal_classes"],
        "objective_evaluations": optimized["objective_evaluations"],
        "objective_evaluations_per_path": optimized["objective_evaluations"] / population,
        "under_one_million_objective_evaluations": optimized["objective_evaluations"] < 1_000_000,
        "selection_materialized_paths": optimized["materialized_paths"],
        "audit_materialized_paths": population,
        "reference_phase_seconds": reference["wall_ms"] / 1000,
        "optimized_phase_seconds": optimized["wall_ms"] / 1000,
        "total_seconds": result["total_wall_ms"] / 1000,
        "peak_sampled_rss_gib": result["peak_sampled_rss_bytes"] / 2**30,
        "spill_gib": optimized["spill_bytes"] / 2**30,
        "reference_paths_per_wall_second": population / (reference["wall_ms"] / 1000),
        "optimized_paths_per_wall_second": population / (optimized["wall_ms"] / 1000),
        "optimized_objective_computations_per_wall_second": optimized["objective_evaluations"] / (optimized["wall_ms"] / 1000),
        "optimized_transition_reuse_fraction": optimized["transitions_reused"] / max(1, optimized["transitions_reused"] + optimized["transitions_computed"]),
        "notes": [
            "Reference timing is historical when reference_reused_from is set; descriptive observations, no confidence intervals.",
            "Reference memoizes complete scorer inputs and native-witnesses each new input; it is not an uncached baseline.",
            "Phase times include validation and coordination. Full identity audit reconstructs every path separately from selection.",
            "Objective evaluations include repeated cache misses across all eight workers and after eviction.",
            "Terminal classes are summed across batches; they are not globally unique states.",
            "RSS is the sampled aggregate Node process including worker threads; estimated cache caps are not heap limits.",
        ],
    }
    metrics["reference_reused_from"] = result.get("reference_reused_from")
    metrics["input_diagnostics"] = result.get("input_diagnostics")
    detail = json.loads((OUT / "optimized.json").read_text())
    metrics["optimized_worker_seconds_sum"] = sum(row["wall_ms"] for row in detail["results"]) / 1000
    metrics["optimized_audit_worker_seconds_sum"] = optimized["audit_ms_sum"] / 1000
    metrics["spill_read_gib"] = sum(row["read_bytes"] for row in detail["materialization"]) / 2**30
    cache_totals = {}
    for worker in detail["worker_stats"]:
        for name, cache in worker["stats"]["scorer"]["caches"].items():
            total = cache_totals.setdefault(name, {"hits": 0, "misses": 0, "evictions": 0})
            for counter in total:
                total[counter] += cache[counter]
    for cache in cache_totals.values():
        cache["hit_fraction"] = cache["hits"] / max(1, cache["hits"] + cache["misses"])
    metrics["optimized_caches"] = cache_totals
    sources = ["tools/optimized_exact_dag.mjs", "tools/exact_recoil_scorer.mjs",
               "tools/exact_dag_storage.mjs", "tools/run_optimized_exact_dag.mjs",
               "tools/screening_rank.mjs", "tools/optimizer_presets.mjs",
               ".scratch/calibration-check/kernel.mjs", ".scratch/calibration-check/curves.mjs",
               ".scratch/calibration-check/attributes.mjs",
               ".scratch/github-pages-site/data/catalog.json",
               ".scratch/github-pages-site/data/weapons/18010000001.json"]
    metrics["source_sha256"] = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sources}
    (OUT / "analysis.json").write_text(json.dumps(metrics, indent=2) + "\n")
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    fig, axes = plt.subplots(2, 2, figsize=(12, 8), constrained_layout=True)
    labels = ["Represented paths", "Batch terminal classes", "Objective computations", "Selection identities"]
    values = [population, optimized["terminal_classes"], optimized["objective_evaluations"], optimized["materialized_paths"]]
    ax = axes[0, 0]
    ax.barh(labels[::-1], values[::-1], color=["#457b9d", "#2a9d8f", "#e9c46a", "#e76f51"][::-1])
    ax.set_xscale("log")
    ax.axvline(1_000_000, color="#a22", linestyle="--", linewidth=1, label="1 million target")
    for y, value in enumerate(values[::-1]):
        ax.text(value*1.05, y, f"{value:,}", va="center", fontsize=9)
    ax.set_xlim(max(1, min(values)/2), max(values)*6)
    ax.set_title("Different work counts (log scale)")
    ax.legend(loc="lower right", fontsize=8)
    ax = axes[0, 1]
    names = {"reference": "Reference", "optimized": "Optimized", "validation": "Native replay"}
    for phase in names:
        rows = [r for r in resources if r["phase"] == phase]
        if rows:
            ax.plot([r["elapsed_ms"]/60000 for r in rows], [r["rss_bytes"]/2**30 for r in rows], label=names[phase])
    ax.set(xlabel="Elapsed minutes", ylabel="Process RSS (GiB)", title="Aggregate memory, sampled every 0.5 seconds")
    ax.legend(fontsize=8)
    ax = axes[1, 0]
    for phase in ["reference", "optimized"]:
        rows = [r for r in resources if r["phase"] == phase]
        if rows:
            start = rows[0]["elapsed_ms"]
            ax.plot([(r["elapsed_ms"]-start)/60000 for r in rows], [r["paths"]/1e6 for r in rows], label=names[phase])
    ax.set(xlabel="Minutes within phase", ylabel="Completed paths (millions)", title="Progress counts completed batches")
    ax.legend(fontsize=8)
    ax = axes[1, 1]
    seconds = [reference["wall_ms"]/1000, optimized["wall_ms"]/1000]
    bars = ax.bar(["Memoized reference", "Optimized + full audit"], seconds, color=["#457b9d", "#2a9d8f"])
    for bar, value in zip(bars, seconds):
        ax.text(bar.get_x()+bar.get_width()/2, value, f"{value:,.1f}s", ha="center", va="bottom")
    ax.set(ylabel="Seconds", title="Historical reference comparison; no intervals" if result.get("reference_reused_from") else "One observed validation pair; no inferential intervals")
    ax.set_ylim(0, max(seconds)*1.15)
    fig.suptitle("M4A1 / Detonation / Lowest Recoil / Insight 3/7 — 8 workers\nAll original grouped ordinary layouts; dominance and score pruning disabled", fontsize=12)
    fig.savefig(OUT / "efficiency.png", dpi=180)
    fig.savefig(OUT / "efficiency.svg")
    plt.close(fig)
    print(json.dumps({key:value for key,value in metrics.items() if key not in ["notes", "source_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
