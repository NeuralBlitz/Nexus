import { execute, executeBackground, getProcessStatus, killProcess, getEnvironment, validateCommand } from './src/tools/bash.js';

console.log('Testing bash.js module...');

// Test validateCommand
console.log('Testing validateCommand:');
console.log('Valid command:', validateCommand('ls -la'));
console.log('Invalid command:', validateCommand('rm -rf /'));
console.log('Non-whitelisted:', validateCommand('unknowncmd'));

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

// Test execute with timeout (should succeed)
console.log('\nTesting execute with sleep 1 (should succeed):');
try {
  const result = await execute('sleep 1', { timeout: 5000 });
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
  console.log('Status:', status);
} catch (e) {
  console.error('Error:', e.message);
}

console.log('\nAll tests completed.');