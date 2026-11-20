// Scoped to source-audited x64 V8 runtimes launched without JS JIT.
// Browser identity comes from the benchmark harness's CDP session.
export function nodeNormRuntime(process) {
  return {engine: 'node', version: process.version, v8: process.versions.v8,
    platform: process.platform, arch: process.arch,
    jitless: !process.env.NODE_OPTIONS && process.execArgv.length === 1 &&
      process.execArgv[0] === '--jitless'};
}
export function v8NormFloorFor(runtime) {
  if (!runtime?.jitless || runtime.platform !== 'win32' || runtime.arch !== 'x64') return null;
  const auditedNode = runtime.engine === 'node' && runtime.version === 'v24.22.0' &&
    runtime.v8 === '13.6.233.17-node.57';
  const auditedChrome = runtime.engine === 'chrome' && runtime.version === 'Chrome/157.0.8103.79' &&
    runtime.v8 === '15.7.112.43' && runtime.revision === '@6dc9bc3bdaea5c35ed6d41fceab2f7a3a2227c4f';
  return auditedNode || auditedChrome ? lowerV8Hypot : null;
}

function minimumMagnitude([lo, hi]) {
  return lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi));
}
function lowerV8Hypot(a, b) {
  const minA = minimumMagnitude(a), minB = minimumMagnitude(b);
  const minMax = Math.max(minA, minB);
  if (minMax === 0) return 0;
  const maxMax = Math.max(...a.map(Math.abs), ...b.map(Math.abs));
  // V8 divides both magnitudes by the larger one. Its larger ratio is
  // exactly 1; the smaller ratio is at least the following lower bound.
  const lowerRatio = Math.min(minA, minB) / maxMax;
  return Math.sqrt(1 + lowerRatio * lowerRatio) * minMax;
}
