import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runOpenCode } from './opencode-runner.js';

function fakeProcess({ code = 0, stdout = 'OK', stderr = '', leaveRunning = false } = {}) {
  const captured = {};
  const spawnProcess = (file, args, options) => {
    captured.file = file;
    captured.args = args;
    captured.options = options;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => { captured.killed = true; return true; };
    queueMicrotask(() => {
      if (leaveRunning) return;
      if (stdout) child.stdout.emit('data', Buffer.from(stdout));
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', code, null);
    });
    return child;
  };
  return { spawnProcess, captured };
}

test('passes shell metacharacters as a literal single argument', async () => {
  const fake = fakeProcess();
  const prompt = '$(touch /tmp/should-not-run); echo "hello" && whoami';
  const result = await runOpenCode(prompt, { spawnProcess: fake.spawnProcess });
  assert.equal(fake.captured.file, 'opencode');
  assert.deepEqual(fake.captured.args, ['run', '--', prompt]);
  assert.equal(fake.captured.options.shell, false);
  assert.equal(result.content, 'OK');
});

test('rejects failing commands rather than returning output as success', async () => {
  const fake = fakeProcess({ code: 1, stderr: 'provider unavailable' });
  await assert.rejects(runOpenCode('test', { spawnProcess: fake.spawnProcess }), /provider unavailable/);
});

test('rejects invalid input before invoking the subprocess', async () => {
  const fake = fakeProcess();
  await assert.rejects(runOpenCode('', { spawnProcess: fake.spawnProcess }), TypeError);
  assert.equal(fake.captured.file, undefined);
});

test('terminates subprocesses exceeding output budget', async () => {
  const fake = fakeProcess({ stdout: 'abcdef' });
  await assert.rejects(runOpenCode('test', { spawnProcess: fake.spawnProcess, maxOutputBytes: 3 }), /output exceeded/);
  assert.equal(fake.captured.killed, true);
});

test('terminates subprocesses after timeout', async () => {
  const fake = fakeProcess({ leaveRunning: true });
  await assert.rejects(runOpenCode('test', { spawnProcess: fake.spawnProcess, timeoutMs: 1 }), /timed out/);
  assert.equal(fake.captured.killed, true);
});
