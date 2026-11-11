import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT = 60_000;
const MAX_OUTPUT = 1_048_576;

/**
 * Execute a single OpenCode request without passing user input to a shell.
 * Returns CLI output only when the subprocess exits successfully.
 */
export function runOpenCode(prompt, { timeoutMs = DEFAULT_TIMEOUT, maxOutputBytes = MAX_OUTPUT, spawnProcess = spawn } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return Promise.reject(new TypeError('A non-empty prompt is required'));
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 240_000) {
    return Promise.reject(new RangeError('Invalid timeout'));
  }
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 10 * MAX_OUTPUT) {
    return Promise.reject(new RangeError('Invalid output limit'));
  }

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnProcess('opencode', ['run', '--', prompt], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let done = false;
    const settle = (error, result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(new Error('OpenCode execution timed out'));
    }, timeoutMs);
    const collect = (current, chunk) => {
      const remaining = maxOutputBytes - Buffer.byteLength(current);
      const next = Buffer.from(chunk);
      if (remaining <= 0 || next.length > remaining) {
        child.kill('SIGKILL');
        settle(new Error('OpenCode output exceeded the configured limit'));
        return current;
      }
      return current + next.toString('utf8');
    };

    child.stdout?.on('data', (chunk) => { stdout = collect(stdout, chunk); });
    child.stderr?.on('data', (chunk) => { stderr = collect(stderr, chunk); });
    child.on('error', (error) => settle(error));
    child.on('close', (code, signal) => {
      if (code !== 0) {
        settle(new Error('OpenCode execution failed' + (signal ? ' (' + signal + ')' : '') + (stderr ? ': ' + stderr.slice(0, 200) : '')));
        return;
      }
      const content = stdout.replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/^> build · .+$/gm, '')
        .replace(/^◈ .+$/gm, '').trim();
      settle(null, { content, provider: 'OpenCode' });
    });
  });
}
