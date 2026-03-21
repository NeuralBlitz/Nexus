#!/usr/bin/env node

import { execSync, spawn } from 'child_process';

// ═══════════════════════════════════════════════════════════════════════════
// DOCKER INTEGRATION TOOL
// ═══════════════════════════════════════════════════════════════════════════

const WHITELISTED_COMMANDS = [
  'docker ps', 'docker images', 'docker logs', 'docker inspect',
  'docker stats', 'docker network', 'docker volume', 'docker compose',
  'docker build', 'docker run', 'docker stop', 'docker start',
  'docker restart', 'docker rm', 'docker rmi', 'docker pull',
  'docker push', 'docker exec', 'docker cp', 'docker top'
];

/**
 * Check if Docker is available
 */
export async function checkDocker() {
  try {
    const version = execSync('docker --version', { encoding: 'utf-8' }).trim();
    const composeVersion = execSync('docker compose version', { encoding: 'utf-8' }).trim();
    return {
      available: true,
      version,
      composeVersion
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

/**
 * Validate Docker command
 */
export function validateDockerCommand(command) {
  const cmd = command.toLowerCase().trim();

  if (!cmd.startsWith('docker ')) {
    return { valid: false, reason: 'Command must start with "docker"' };
  }

  const isWhitelisted = WHITELISTED_COMMANDS.some(whitelisted =>
    cmd.startsWith(whitelisted)
  );

  if (!isWhitelisted) {
    return { valid: false, reason: 'Command not in whitelist' };
  }

  // Block dangerous commands
  const dangerousPatterns = [
    /docker\s+run.*--privileged/,
    /docker\s+run.*--pid=host/,
    /docker\s+run.*--network=host/,
    /docker\s+rm\s+-f/,
    /docker\s+system\s+prune/,
    /docker\s+volume\s+rm\s+-f/
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmd)) {
      return { valid: false, reason: 'Dangerous command blocked' };
    }
  }

  return { valid: true };
}

/**
 * Execute Docker command
 */
export async function executeDockerCommand(command, options = {}) {
  const validation = validateDockerCommand(command);
  if (!validation.valid) {
    throw new Error(`Invalid Docker command: ${validation.reason}`);
  }

  const { timeout = 60000, cwd = process.cwd() } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    try {
      const result = execSync(command, {
        cwd,
        timeout,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024
      });

      resolve({
        success: true,
        command,
        output: result,
        duration: Date.now() - startTime
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * List running containers
 */
export async function listContainers(options = {}) {
  const { all = false, format = 'table' } = options;

  let command = 'docker ps';
  if (all) command += ' -a';
  if (format === 'json') command += ' --format "{{json .}}"';
  else command += ' --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"';

  try {
    const result = execSync(command, { encoding: 'utf-8' });

    if (format === 'json') {
      return result.split('\n').filter(Boolean).map(line => JSON.parse(line));
    }

    return result;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * List images
 */
export async function listImages(options = {}) {
  const { dangling = false, format = 'table' } = options;

  let command = 'docker images';
  if (dangling) command += ' --filter "dangling=true"';
  if (format === 'json') command += ' --format "{{json .}}"';
  else command += ' --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"';

  try {
    const result = execSync(command, { encoding: 'utf-8' });

    if (format === 'json') {
      return result.split('\n').filter(Boolean).map(line => JSON.parse(line));
    }

    return result;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get container logs
 */
export async function getContainerLogs(containerId, options = {}) {
  const { tail = 100, follow = false, since, until } = options;

  let command = `docker logs ${containerId} --tail ${tail}`;
  if (since) command += ` --since ${since}`;
  if (until) command += ` --until ${until}`;

  if (follow) {
    // Streaming mode - return spawn process
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', ['logs', containerId, '--tail', String(tail), '-f']);

      proc.stdout.on('data', (data) => {
        // This would need to be handled by the caller
      });

      resolve(proc);
    });
  }

  try {
    const logs = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return logs;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get container stats
 */
export async function getContainerStats(containerId) {
  try {
    const stats = execSync(
      `docker stats ${containerId} --no-stream --format "{{json .}}"`,
      { encoding: 'utf-8' }
    );

    return JSON.parse(stats);
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Build image
 */
export async function buildImage(options = {}) {
  const { tag, path = '.', dockerfile = 'Dockerfile', buildArgs = {} } = options;

  let command = `docker build -f ${dockerfile}`;
  if (tag) command += ` -t ${tag}`;

  for (const [key, value] of Object.entries(buildArgs)) {
    command += ` --build-arg ${key}=${value}`;
  }

  command += ` ${path}`;

  return executeDockerCommand(command, { timeout: 300000 });
}

/**
 * Run container
 */
export async function runContainer(image, options = {}) {
  const {
    name,
    detach = true,
    ports = [],
    volumes = [],
    env = {},
    network,
    restart = 'no'
  } = options;

  let command = 'docker run';

  if (detach) command += ' -d';
  if (name) command += ` --name ${name}`;
  if (restart !== 'no') command += ` --restart ${restart}`;
  if (network) command += ` --network ${network}`;

  for (const [hostPort, containerPort] of ports) {
    command += ` -p ${hostPort}:${containerPort}`;
  }

  for (const [hostPath, containerPath] of volumes) {
    command += ` -v ${hostPath}:${containerPath}`;
  }

  for (const [key, value] of Object.entries(env)) {
    command += ` -e ${key}=${value}`;
  }

  command += ` ${image}`;

  return executeDockerCommand(command);
}

/**
 * Stop container
 */
export async function stopContainer(containerId, options = {}) {
  const { timeout = 10 } = options;
  return executeDockerCommand(`docker stop -t ${timeout} ${containerId}`);
}

/**
 * Remove container
 */
export async function removeContainer(containerId, options = {}) {
  const { force = false } = options;
  let command = 'docker rm';
  if (force) command += ' -f';
  command += ` ${containerId}`;
  return executeDockerCommand(command);
}

/**
 * Get Docker system info
 */
export async function getSystemInfo() {
  try {
    const df = execSync('docker system df', { encoding: 'utf-8' });
    const info = execSync('docker system info --format "{{json .}}"', { encoding: 'utf-8' });

    return {
      diskUsage: df,
      systemInfo: JSON.parse(info)
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * List networks
 */
export async function listNetworks() {
  try {
    const result = execSync('docker network ls --format "{{json .}}"', {
      encoding: 'utf-8'
    });

    return result.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * List volumes
 */
export async function listVolumes() {
  try {
    const result = execSync('docker volume ls --format "{{json .}}"', {
      encoding: 'utf-8'
    });

    return result.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    return { error: error.message };
  }
}

export default {
  checkDocker,
  validateDockerCommand,
  executeDockerCommand,
  listContainers,
  listImages,
  getContainerLogs,
  getContainerStats,
  buildImage,
  runContainer,
  stopContainer,
  removeContainer,
  getSystemInfo,
  listNetworks,
  listVolumes
};