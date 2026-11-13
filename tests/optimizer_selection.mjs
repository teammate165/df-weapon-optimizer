import assert from 'node:assert/strict';
import {selectCategories} from '../tools/optimizer_selection.mjs';

const tiny={cost:1,score:99},cheap={cost:100,score:70},knee={cost:300,score:45},best={cost:1000,score:40};
const result=selectCategories([tiny,cheap,knee,best]);
const slow={score:40,objectives:[40,100],cost:1000};
const fast={score:40,objectives:[40,80],cost:1100};
assert.equal(selectCategories([slow,fast,cheap]).strongest,fast);
assert.equal(selectCategories([slow,{...fast,cost:1000},cheap]).strongest.objectives[1],80);
assert.equal(result.strongest,best);
assert.equal(result.cheapest,cheap); // Exactly half of the 60-point best gain.
assert.equal(result.value,knee);
assert.equal(selectCategories([]),null);
assert.equal(selectCategories([{cost:0,score:100}]).cheapest,null);
assert.equal(selectCategories([{cost:20,score:110}]).value,null);
const free={cost:0,score:40};
assert.equal(selectCategories([free]).cheapest,null); // Do not clone Max as Min.
assert.equal(selectCategories([free]).value,null);
assert.equal(selectCategories([cheap,best]).value,null); // No distinct interior.
assert.equal(selectCategories([{...best,signature:'same'},{...cheap,signature:'same'}]).cheapest,null);
const middle={cost:50,score:55};
assert.equal(selectCategories([{cost:0,score:70},middle,{cost:100,score:40}]).value,middle);
assert.equal(selectCategories([{cost:100,score:40},{cost:90,score:40}]).strongest.cost,90);
console.log('Category checks passed: 50% gate, knee, straight frontier, free calibration, no improvement and ties.');
