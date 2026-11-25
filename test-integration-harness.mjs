// Offline regression tests for the actual integration harness source.
// Run: node --test test-integration-harness.mjs
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(new URL('./test-integrations.mjs', import.meta.url), 'utf8');
const start = source.indexOf('const results =');
const end = source.indexOf("console.log('\\n');", start);
const summaryMarker = source.indexOf('// SUMMARY');
const summary = source.indexOf("console.log('\\n');", summaryMarker);
assert.ok(start >= 0 && end > start && summaryMarker > end && summary > summaryMarker,
  'Harness extraction boundaries changed; update regression fixture');

const cases = [
  ['pass', "await testClass('Fixture', async ({pass}) => pass('ok'));", 0, /Fixture: 1\/1 tests/, /All recorded integration checks passed/],
  ['failure', "await testClass('Fixture', async ({fail}) => fail('bad', 'fixture'));", 1, /❌ Fixture: 0\/1 tests/, /1 test\(s\) failed/],
  ['exception', "await testClass('Fixture', async () => { throw new Error('fixture'); });", 1, /❌ Fixture: 0\/1 tests/, /1 test\(s\) failed/],
  ['empty', '', 1, /Total Tests:\s+0/, /No integration checks executed/],
];

for (const [name, body, status, group, message] of cases) {
  test(name, () => {
    const script = "import { performance } from 'node:perf_hooks';\n" +
      source.slice(start, end) + body + '\n' + source.slice(summary);
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script],
      { encoding: 'utf8', timeout: 10000, env: {} });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, status, result.stderr);
    assert.match(result.stdout, group);
    assert.match(result.stdout, message);
  });
}
