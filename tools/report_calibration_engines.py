"""Descriptive browser adapter comparison; one concurrent 16-worker cohort."""
import json
import statistics
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

directory = Path('data/optimizer_validation/calibration_engines_20261118')
data = json.loads((directory/'raw.json').read_text(encoding='utf-8'))
workers = data['study']['results']
records = [r for worker in workers for r in worker['records']]
fixtures = ['insight-only', 'barrel-muzzle', 'grip-magazine', 'recorded-ordinary-best']
summary = {'workers': len(workers), 'solver_calls': len(records),
           'all_reported_optimal': all(r['status']=='optimal' for r in records),
           'all_final_native_vectors_equal': all(w['best']['scip']==w['best']['highs'] for w in workers),
           'wall_seconds': data['study']['wall_ms']/1000, 'cohorts': 1,
           'scip_version': '10.0.2', 'highs_package': '1.15.4',
           'highs_native_version': next(r['version'] for r in records if r['engine']=='highs'),
           'fixtures': [], 'notes': [
               'Four fixed-layout M4A1 examples; not a sampled or complete survivor cohort.',
               'Four repeats per fixture in one concurrent 16-worker cohort; order counterbalanced within fixture.',
               'SCIP fresh CLI runtime versus HiGHS persistent sparse-model adapter, not isolated core-solver performance.',
               'Primary phase followed by Handling with a shared primary bound plus1e-8, as in the reference tolerance policy.',
               'Two solver seconds per call, at most six refinement rounds per phase; no screening deadline changed.',
               'Every incumbent source-replayed; paired model inputs have matching SHA256.',
               'No supporting/rounding cuts were needed on these fixtures; only the primary-bound row was appended.',
               'No confidence intervals: contended concurrent repeats are not independent whole-machine runs.',
           ]}
fig, axes = plt.subplots(1,2,figsize=(12,4.8))
colors={'scip':'#63798e','highs':'#16816b'}
for ax, phase in zip(axes,['primary','handling']):
    for i, fixture in enumerate(fixtures):
        group={'fixture':fixture,'phase':phase}
        for engine,offset in [('scip',-.17),('highs',.17)]:
            rows=[r for r in records if r['fixture']==fixture and r['phase']==phase and r['engine']==engine]
            times=[r['elapsed_ms'] for r in rows]
            group[engine]={'n':len(times),'median_ms':statistics.median(times),'min_ms':min(times),'max_ms':max(times),'optimal':sum(r['status']=='optimal' for r in rows)}
            ax.bar(i+offset,statistics.median(times),width=.32,color=colors[engine],alpha=.65,label=engine if i==0 else None)
            ax.scatter([i+offset+(j-1.5)*.02 for j in range(len(times))],times,color=colors[engine],s=18,zorder=3)
        summary['fixtures'].append(group)
    ax.set_xticks(range(len(fixtures)),['Optic only','Barrel/muzzle','Grip/magazine','Recorded best'],rotation=15)
    ax.set_ylabel('Milliseconds per paired solve (including adapter setup)')
    ax.set_title(phase.capitalize()+' phase')
    ax.grid(axis='y',alpha=.2);ax.legend()
fig.suptitle('SCIP / HiGHS in16 browser workers: same calibration-model inputs')
fig.text(.5,.015,'Bars: medians; dots: four contended repeats per fixture. One concurrent cohort; no inferential confidence bands.',ha='center',fontsize=9)
fig.tight_layout(rect=[0,.06,1,.94])
for extension in ['png','svg']:
    fig.savefig(directory/f'calibration_engine_comparison.{extension}',dpi=160)
plt.close(fig)
(directory/'statistics.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
