import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const start = source.indexOf('class OpenCodeProvider {');
const end = source.indexOf('// Legacy Claude Code Provider', start);
assert.ok(start >= 0 && end > start, 'OpenCode provider implementation must be present');
const implementation = source.slice(start, end);

test('OpenCode provider passes prompt as a separate argv value without a shell', () => {
  assert.match(implementation, /spawnSync\(\s*['"]opencode['"]\s*,\s*\[\s*['"]run['"]\s*,\s*String\(prompt\)\s*\]/);
  assert.match(implementation, /shell:\s*false/);
  assert.doesNotMatch(implementation, /execSync\s*\(/);
});

test('OpenCode provider bounds execution and fails on subprocess errors', () => {
  assert.match(implementation, /timeout:\s*60000/);
  assert.match(implementation, /maxBuffer:\s*10\s*\*\s*1024\s*\*\s*1024/);
  assert.match(implementation, /if\s*\(result\.error\)\s*throw/);
  assert.match(implementation, /if\s*\(result\.status\s*!==\s*0\)/);
});
