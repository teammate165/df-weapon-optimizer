"""Descriptive before/after cache study; full runs are the observation units."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/optimizer_validation/exact_dag_cache_20261118/full"
OLD = ROOT / "data/optimizer_validation/optimized_exact_dag_20261118/full"


def main():
    before, after = [json.loads((directory/"final.json").read_text()) for directory in [OLD, OUT]]
    assert before["passed"] and after["passed"] and before["exact_total"] == after["exact_total"]
    caches = []
    for directory in [OLD, OUT]:
        workers = json.loads((directory/"optimized.json").read_text())["worker_stats"]
        caches.append({name: sum(w["stats"]["scorer"]["caches"]["input"][name] for w in workers) for name in ["hits", "misses", "evictions", "max_bytes", "bytes"]})
    a, b = before["optimized"], after["optimized"]
    result = {
        "passed": True, "workers": 8, "population": after["exact_total"],
        "before": {"seconds": a["wall_ms"]/1000, "objective_evaluations": a["objective_evaluations"], "input_cache": caches[0], "peak_rss_gib": before["peak_sampled_rss_bytes"]/2**30},
        "after": {"seconds": b["wall_ms"]/1000, "objective_evaluations": b["objective_evaluations"], "input_cache": caches[1], "peak_rss_gib": after["peak_sampled_rss_bytes"]/2**30},
        "objective_computations_reduction_fraction": 1-b["objective_evaluations"]/a["objective_evaluations"],
        "observed_wall_time_ratio": a["wall_ms"]/b["wall_ms"],
        "input_diagnostics": after["input_diagnostics"],
        "notes": ["One historical before run and one after run; descriptive only, no inferential intervals or causal speedup estimate.", "After run includes exact miss logging and analysis; its native reference manifests are reused after source/data and population checks.", "Changes are bundled: packed keys, cache reallocation, locality and dead-write projection; contributions are not isolated.", "All layouts and exact ordered survivors retained. Dedicated barrel bipod exclusion does not change M4A1 population."]}
    (OUT/"cache-comparison.json").write_text(json.dumps(result, indent=2)+"\n")
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    fig, axes = plt.subplots(2, 2, figsize=(11, 8), constrained_layout=True)
    for ax, title, values, ylabel in [
        (axes[0, 0], "Full objective computations", [a["objective_evaluations"], b["objective_evaluations"]], "Computations"),
        (axes[0, 1], "Input-cache evictions", [caches[0]["evictions"], caches[1]["evictions"]], "Evictions"),
        (axes[1, 0], "Optimized phase including full audit", [a["wall_ms"]/1000, b["wall_ms"]/1000], "Wall seconds")]:
        bars=ax.bar(["Before", "After"], values, color=["#457b9d", "#2a9d8f"])
        ax.set(title=title, ylabel=ylabel, ylim=(0,max(values)*1.18))
        for bar,value in zip(bars,values):ax.text(bar.get_x()+bar.get_width()/2,value,f"{value:,.1f}" if ylabel=="Wall seconds" else f"{value:,}",ha="center",va="bottom")
        if ylabel=="Computations":ax.axhline(1_000_000,color="#a22",linestyle="--",label="1 million target");ax.legend(fontsize=8)
    d=after["input_diagnostics"]
    labels=["Globally new inputs", "First copies on other workers", "Recomputed after eviction"]
    values=[d["global_distinct_input_keys"],d["additional_first_computations_across_workers"],d["confirmed_worker_recomputations_after_eviction"]]
    ax=axes[1,1];bars=ax.barh(labels[::-1],values[::-1],color=["#e76f51","#e9c46a","#2a9d8f"]);ax.set(title="Exact decomposition of after-run computations",xlabel="Computations",xlim=(0,max(values)*1.4))
    for bar,value in zip(bars,values[::-1]):ax.text(value,bar.get_y()+bar.get_height()/2,f" {value:,}",va="center")
    fig.suptitle("Exact M4A1 screening — 8 workers, 12,885,654 represented layouts\nSingle before/after observations; bundled changes and different diagnostic overhead")
    fig.savefig(OUT/"cache-comparison.png",dpi=180);fig.savefig(OUT/"cache-comparison.svg");plt.close(fig)
    print(json.dumps(result,indent=2))


if __name__ == "__main__":main()
