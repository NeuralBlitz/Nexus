import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT = 60000; // 60 seconds
const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_CWD = process.cwd();

// Command whitelist (allowed command prefixes)
const COMMAND_WHITELIST = [
  'ls', 'cat', 'echo', 'pwd', 'mkdir', 'touch', 'cp', 'mv', 'grep', 'find',
  'head', 'tail', 'wc', 'sort', 'uniq', 'tr', 'file', 'stat', 'date',
  'uname', 'which', 'whoami', 'env', 'printenv', 'node', 'npm', 'npx',
  'git', 'docker', 'kubectl', 'python', 'python3', 'pip', 'pip3',
  'cargo', 'rustc', 'go', 'java', 'javac', 'mvn', 'gradle',
  'curl', 'wget', 'ping', 'traceroute', 'netstat', 'ss',
  'jq', 'yq', 'xmlstarlet', 'zip', 'unzip', 'tar', 'gzip', 'gunzip',
  'sed', 'awk', 'cut', 'paste', 'join', 'comm', 'diff', 'patch',
  'ps', 'top', 'htop', 'df', 'du', 'free', 'uptime', 'iostat',
  'ssh', 'scp', 'rsync', 'sftp', 'ftp', 'telnet', 'nc',
  'make', 'cmake', 'autotools', 'pkg-config',
  'pytest', 'jest', 'mocha', 'jasmine', 'karma',
  'eslint', 'prettier', 'stylelint', 'lint',
  'tsc', 'babel', 'webpack', 'rollup', 'vite', 'esbuild',
  'sleep', 'timeout', 'yes', 'true', 'false',
  'basename', 'dirname', 'realpath', 'readlink', 'mktemp',
  'tee', 'xargs', 'bash', 'sh', 'zsh',
];

// Dangerous command patterns (blacklist)
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf /
  /rm\s+-rf\s+~/, // rm -rf ~
  /rm\s+-rf\s+\.\./, // rm -rf ..
  /chmod\s+777/, // chmod 777
  /chown\s+root/, // chown root
  /dd\s+if=/, // dd if=
  /mkfs\./, // mkfs.
  /fdisk/, // fdisk
  /parted/, // parted
  /shutdown/, // shutdown
  /reboot/, // reboot
  /poweroff/, // poweroff
  /init\s+0/, // init 0
  /kill\s+-9\s+1/, // kill -9 1
  /:\(\)\{\s*:\|:&\s*\};/, // fork bomb
  />\s*\/dev\/sd/, // write to disk device
  /wget\s+.*\s+-O\s+.*\.sh.*\|\s*sh/, // wget and pipe to shell
  /curl\s+.*\|\s*sh/, // curl and pipe to shell
  /python\s+-c\s+.*exec/, // python exec
  /eval\s*\(/, // eval
  /exec\s*\(/, // exec
  /system\s*\(/, // system
  /passthru\s*\(/, // passthru
  /shell_exec\s*\(/, // shell_exec
  /proc_open\s*\(/, // proc_open
  /popen\s*\(/, // popen
];

// Background processes map
const backgroundProcesses = new Map();

/**
 * Validate command for safety
 * @param {string} command - Command to validate
 * @param {string} cwd - Working directory
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateCommand(command, cwd = DEFAULT_CWD) {
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { valid: false, reason: `Dangerous command pattern detected: ${pattern}` };
    }
  }

  // Check command whitelist
  const commandBase = command.trim().split(/\s+/)[0];
  const isWhitelisted = COMMAND_WHITELIST.some(allowed => 
    commandBase === allowed || commandBase.endsWith(`/${allowed}`)
  );
  
  if (!isWhitelisted) {
    return { valid: false, reason: `Command '${commandBase}' not in whitelist` };
  }

  // Check working directory restriction
  const resolvedCwd = path.resolve(cwd);
  const allowedBase = path.resolve(DEFAULT_CWD);
  if (!resolvedCwd.startsWith(allowedBase)) {
    return { valid: false, reason: `Working directory outside allowed base: ${allowedBase}` };
  }

  return { valid: true };
}

/**
 * Execute a shell command with safety features
 * @param {string} command - Shell command to execute
 * @param {Object} options - Execution options
 * @param {number} [options.timeout=60000] - Timeout in milliseconds
 * @param {string} [options.cwd] - Working directory
 * @param {Object} [options.env] - Environment variables
 * @param {boolean} [options.shell=true] - Use shell
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function execute(command, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT,
    cwd = DEFAULT_CWD,
    env = process.env,
    shell = true,
  } = options;

  // Validate command
  const validation = validateCommand(command, cwd);
  if (!validation.valid) {
    throw new Error(`Command validation failed: ${validation.reason}`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env,
      timeout,
      maxBuffer: MAX_OUTPUT_SIZE,
      shell,
    });

    return {
      stdout: stdout.slice(0, MAX_OUTPUT_SIZE),
      stderr: stderr.slice(0, MAX_OUTPUT_SIZE),
      exitCode: 0,
    };
  } catch (error) {
    return {
      stdout: error.stdout?.slice(0, MAX_OUTPUT_SIZE) || '',
      stderr: error.stderr?.slice(0, MAX_OUTPUT_SIZE) || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Execute a shell command in background
 * @param {string} command - Shell command to execute
 * @param {Object} options - Execution options
 * @param {string} [options.cwd] - Working directory
 * @param {Object} [options.env] - Environment variables
 * @param {boolean} [options.shell=true] - Use shell
 * @returns {Object} Process info with PID
 */
export function executeBackground(command, options = {}) {
  const {
    cwd = DEFAULT_CWD,
    env = process.env,
    shell = true,
  } = options;

  // Validate command
  const validation = validateCommand(command, cwd);
  if (!validation.valid) {
    throw new Error(`Command validation failed: ${validation.reason}`);
  }

  const child = spawn(command, [], {
    cwd,
    env,
    shell,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const pid = child.pid;
  const processInfo = {
    pid,
    command,
    cwd,
    startTime: Date.now(),
    stdout: '',
    stderr: '',
    exitCode: null,
    killed: false,
  };

  child.stdout.on('data', (data) => {
    processInfo.stdout += data.toString();
    // Keep only last MAX_OUTPUT_SIZE bytes
    if (processInfo.stdout.length > MAX_OUTPUT_SIZE) {
      processInfo.stdout = processInfo.stdout.slice(-MAX_OUTPUT_SIZE);
    }
  });

  child.stderr.on('data', (data) => {
    processInfo.stderr += data.toString();
    if (processInfo.stderr.length > MAX_OUTPUT_SIZE) {
      processInfo.stderr = processInfo.stderr.slice(-MAX_OUTPUT_SIZE);
    }
  });

  child.on('exit', (code) => {
    processInfo.exitCode = code;
  });

  child.on('error', (err) => {
    processInfo.stderr += `\nProcess error: ${err.message}`;
  });

  backgroundProcesses.set(pid, processInfo);

  // Auto-remove from map after process exits
  child.on('exit', () => {
    // Keep for a while for status checks
    setTimeout(() => {
      backgroundProcesses.delete(pid);
    }, 300000); // 5 minutes
  });

  return { pid, command };
}

/**
 * Get status of a background process
 * @param {number} pid - Process ID
 * @returns {Object|null} Process status or null if not found
 */
export function getProcessStatus(pid) {
  const processInfo = backgroundProcesses.get(pid);
  if (!processInfo) {
    return null;
  }

  // Check if process is still running
  let exists = true;
  try {
    process.kill(pid, 0); // Signal 0 checks if process exists
  } catch (error) {
    if (error.code === 'ESRCH') {
      exists = false;
    }
  }

  // If process doesn't exist and we haven't recorded exit code, set to -1
  if (!exists && processInfo.exitCode === null) {
    processInfo.exitCode = -1;
  }

  return {
    pid: processInfo.pid,
    command: processInfo.command,
    cwd: processInfo.cwd,
    startTime: processInfo.startTime,
    running: processInfo.exitCode === null && !processInfo.killed,
    exitCode: processInfo.exitCode,
    stdout: processInfo.stdout,
    stderr: processInfo.stderr,
    killed: processInfo.killed,
  };
}

/**
 * Kill a background process
 * @param {number} pid - Process ID
 * @param {string} [signal='SIGTERM'] - Signal to send
 * @returns {boolean} Success
 */
export function killProcess(pid, signal = 'SIGTERM') {
  const processInfo = backgroundProcesses.get(pid);
  if (!processInfo) {
    return false;
  }

  try {
    process.kill(pid, signal);
    processInfo.killed = true;
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') {
      backgroundProcesses.delete(pid);
    }
    return false;
  }
}

/**
 * Get safe environment variables (filtered)
 * @returns {Object} Safe environment variables
 */
export function getEnvironment() {
  const safeEnv = {};
  const allowedKeys = [
    'PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TERM', 'SHELL',
    'PWD', 'OLDPWD', 'TMPDIR', 'TEMP', 'TMP',
    'NODE_ENV', 'NODE_PATH', 'NPM_CONFIG_PREFIX',
    'EDITOR', 'VISUAL',
    'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS_HOME',
  ];

  for (const key of allowedKeys) {
    if (process.env[key] !== undefined) {
      safeEnv[key] = process.env[key];
    }
  }

  // Add current working directory
  safeEnv.CWD = process.cwd();

  // Add Node.js version
  safeEnv.NODE_VERSION = process.version;

  // Add platform info
  safeEnv.PLATFORM = process.platform;
  safeEnv.ARCH = process.arch;

  return safeEnv;
}

// Export validation for external use
export { validateCommand };