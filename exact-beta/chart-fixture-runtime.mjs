const browser = typeof process === 'undefined';
function check(value, message = 'Assertion failed') {
  if (!value) throw Error(message);
}
const browserAssert = Object.assign(check, {
  equal(actual, expected, message) {
    check(Object.is(actual, expected), message ?? 'Values differ');
  },
  deepEqual(actual, expected, message) {
    check(JSON.stringify(actual) === JSON.stringify(expected), message ?? 'Structures differ');
  },
});
export const assert = browser ? browserAssert : (await import('node:assert/strict')).default;
const fs = browser ? null : await import('node:fs');
export async function readFixture(name) {
  const url = new URL('../data/' + name, import.meta.url);
  if (fs) return JSON.parse(fs.readFileSync(url, 'utf8'));
  const response = await fetch(url);
  if (!response.ok) throw Error('Fixture request failed: ' + url.pathname);
  return response.json();
}
