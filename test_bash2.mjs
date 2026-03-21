import { execute, executeBackground, getProcessStatus, killProcess, getEnvironment, validateCommand } from './src/tools/bash.js';

console.log('Testing bash.js module...');

// Test validateCommand
console.log('Testing validateCommand:');
console.log('Valid command:', validateCommand('ls -la'));
console.log('Invalid command:', validateCommand('rm -rf /'));
console.log('Non-whitelisted:', validateCommand('unknowncmd'));
console.log('Sleep command:', validateCommand('sleep 1'));

// Test getEnvironment
console.log('\nEnvironment keys:', Object.keys(getEnvironment()));

// Test execute (safe command)
console.log('\nTesting execute with "echo hello":');
try {
  const result = await execute('echo hello');
  console.log('Result:', result);
} catch (e) {
  console.error('Error:', e.message);
}

// Test execute with sleep (should succeed now)
console.log('\nTesting execute with sleep 0.1:');
try {
  const result = await execute('sleep 0.1', { timeout: 5000 });
  console.log('Result exitCode:', result.exitCode);
} catch (e) {
  console.error('Error:', e.message);
}

// Test executeBackground
console.log('\nTesting executeBackground with "echo background":');
try {
  const bg = executeBackground('echo background');
  console.log('Background PID:', bg.pid);
  // Wait a bit for process to finish
  await new Promise(resolve => setTimeout(resolve, 500));
  const status = getProcessStatus(bg.pid);
  console.log('Status after termination:', status);
  console.log('Running?', status?.running);
  console.log('ExitCode:', status?.exitCode);
} catch (e) {
  console.error('Error:', e.message);
}

// Test killProcess (start a long-running background process)
console.log('\nTesting killProcess with sleep 10:');
try {
  const bg = executeBackground('sleep 10');
  console.log('Background PID:', bg.pid);
  await new Promise(resolve => setTimeout(resolve, 100));
  const killed = killProcess(bg.pid);
  console.log('Kill success:', killed);
  await new Promise(resolve => setTimeout(resolve, 100));
  const status = getProcessStatus(bg.pid);
  console.log('Status after kill:', status);
} catch (e) {
  console.error('Error:', e.message);
}

// Test timeout (should timeout)
console.log('\nTesting timeout with sleep 5 (timeout 100ms):');
try {
  const result = await execute('sleep 5', { timeout: 100 });
  console.log('Unexpected success:', result);
} catch (e) {
  console.log('Expected timeout error:', e.message);
}

console.log('\nAll tests completed.');