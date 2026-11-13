import assert from 'node:assert/strict';
import {selectCategories} from '../tools/optimizer_selection.mjs';

const tiny={cost:1,score:99},cheap={cost:100,score:70},knee={cost:300,score:45},best={cost:1000,score:40};
const result=selectCategories([tiny,cheap,knee,best]);
assert.equal(result.strongest,best);
assert.equal(result.cheapest,cheap); // Exactly half of the 60-point best gain.
assert.equal(result.value,knee);
assert.equal(selectCategories([]),null);
assert.equal(selectCategories([{cost:0,score:100}]).cheapest,null);
assert.equal(selectCategories([{cost:20,score:110}]).value,null);
const free={cost:0,score:40};
assert.equal(selectCategories([free]).cheapest,free); // Free calibration may qualify.
assert.equal(selectCategories([free]).value,free);
const middle={cost:50,score:55};
assert.equal(selectCategories([{cost:0,score:70},middle,{cost:100,score:40}]).value,middle);
assert.equal(selectCategories([{cost:100,score:40},{cost:90,score:40}]).strongest.cost,90);
console.log('Category checks passed: 50% gate, knee, straight frontier, free calibration, no improvement and ties.');
