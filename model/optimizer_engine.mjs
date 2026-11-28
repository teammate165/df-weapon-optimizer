// Production is a time-limited bounded-shortlist search. The exhaustive SCIP
// implementation remains available separately for reference/proof experiments.
import {generateAnytime} from './anytime_optimizer.mjs?v=9e8766cc9937fb42';
import {generatePasses} from './pass_optimizer.mjs?v=9e8766cc9937fb42';

export function generate(input,runtime){
  return input.request.search_method==='coordinate_passes'
    ?generatePasses(input,runtime):generateAnytime(input,runtime);
}
