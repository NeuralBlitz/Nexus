#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// GIT INTEGRATION TOOL
// ═══════════════════════════════════════════════════════════════════════════

const WHITELISTED_COMMANDS = [
  'git status', 'git log', 'git diff', 'git add', 'git commit', 'git push',
  'git pull', 'git fetch', 'git branch', 'git checkout', 'git merge',
  'git stash', 'git remote', 'git tag', 'git clone', 'git init',
  'git show', 'git blame', 'git rebase', 'git reset'
];

/**
 * Validate if git command is safe to execute
 */
export function validateGitCommand(command) {
  const cmd = command.toLowerCase().trim();

  // Check if command starts with git
  if (!cmd.startsWith('git ')) {
    return { valid: false, reason: 'Command must start with "git"' };
  }

  // Check if command is whitelisted
  const isWhitelisted = WHITELISTED_COMMANDS.some(whitelisted =>
    cmd.startsWith(whitelisted)
  );

  if (!isWhitelisted) {
    return { valid: false, reason: 'Command not in whitelist' };
  }

  // Block dangerous commands
  const dangerousPatterns = [
    /git\s+push\s+--force/,
    /git\s+push\s+-f/,
    /git\s+reset\s+--hard/,
    /git\s+clean\s+-[fdx]+/,
    /git\s+reflog\s+expire/,
    /git\s+gc\s+--prune/
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmd)) {
      return { valid: false, reason: 'Dangerous command blocked' };
    }
  }

  return { valid: true };
}

/**
 * Execute a git command
 */
export async function executeGitCommand(command, options = {}) {
  const validation = validateGitCommand(command);
  if (!validation.valid) {
    throw new Error(`Invalid git command: ${validation.reason}`);
  }

  const { cwd = process.cwd(), timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    execSync(command, {
      cwd,
      timeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });

    resolve({
      success: true,
      command,
      duration: Date.now() - startTime
    });
  });
}

/**
 * Get repository status
 */
export async function getStatus(cwd = process.cwd()) {
  try {
    const status = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf-8'
    });

    const branches = execSync('git branch --show-current', {
      cwd,
      encoding: 'utf-8'
    }).trim();

    const remotes = execSync('git remote -v', {
      cwd,
      encoding: 'utf-8'
    });

    const lastCommit = execSync('git log -1 --format="%H %s %an %ar"', {
      cwd,
      encoding: 'utf-8'
    }).trim();

    return {
      branch: branches,
      remotes: remotes.trim().split('\n').filter(Boolean),
      lastCommit,
      changes: parseGitStatus(status),
      isClean: status.trim() === ''
    };
  } catch (error) {
    return { error: error.message, isGitRepo: false };
  }
}

/**
 * Parse git status output
 */
function parseGitStatus(output) {
  const changes = [];

  for (const line of output.split('\n').filter(Boolean)) {
    const statusCode = line.substring(0, 2);
    const filename = line.substring(3);

    let status = 'unknown';
    if (statusCode === '??') status = 'untracked';
    else if (statusCode === 'A ') status = 'added';
    else if (statusCode === 'M ') status = 'modified';
    else if (statusCode === ' M') status = 'modified_staged';
    else if (statusCode === 'D ') status = 'deleted';
    else if (statusCode.includes('R')) status = 'renamed';

    changes.push({ filename, status, code: statusCode });
  }

  return changes;
}

/**
 * Get commit history
 */
export async function getLog(cwd = process.cwd(), limit = 20) {
  try {
    const log = execSync(`git log -${limit} --format="%H|%an|%ae|%ar|%s"`, {
      cwd,
      encoding: 'utf-8'
    });

    return log.split('\n').filter(Boolean).map(line => {
      const [hash, author, email, date, message] = line.split('|');
      return { hash, author, email, date, message };
    });
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get diff between commits or working tree
 */
export async function getDiff(options = {}) {
  const { cwd = process.cwd(), commit1, commit2, file } = options;

  let command = 'git diff';
  if (commit1 && commit2) {
    command += ` ${commit1} ${commit2}`;
  } else if (commit1) {
    command += ` ${commit1}`;
  }

  if (file) {
    command += ` -- "${file}"`;
  }

  try {
    const diff = execSync(command, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    return { diff, hasChanges: diff.length > 0 };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Stage files
 */
export async function stage(files = '.', cwd = process.cwd()) {
  const fileList = Array.isArray(files) ? files.join(' ') : files;
  return executeGitCommand(`git add ${fileList}`, { cwd });
}

/**
 * Create a commit
 */
export async function commit(message, options = {}) {
  const { cwd = process.cwd(), author } = options;

  let command = 'git commit -m "' + message.replace(/"/g, '\\"') + '"';
  if (author) {
    command += ` --author="${author}"`;
  }

  return executeGitCommand(command, { cwd });
}

/**
 * Push changes
 */
export async function push(options = {}) {
  const { cwd = process.cwd(), remote = 'origin', branch, force = false } = options;

  let command = 'git push';
  if (force) {
    command += ' --force-with-lease';
  }
  if (remote) {
    command += ` ${remote}`;
  }
  if (branch) {
    command += ` ${branch}`;
  }

  return executeGitCommand(command, { cwd });
}

/**
 * Pull changes
 */
export async function pull(options = {}) {
  const { cwd = process.cwd(), remote = 'origin', branch, rebase = false } = options;

  let command = 'git pull';
  if (rebase) {
    command += ' --rebase';
  }
  if (remote) {
    command += ` ${remote}`;
  }
  if (branch) {
    command += ` ${branch}`;
  }

  return executeGitCommand(command, { cwd });
}

/**
 * Create a new branch
 */
export async function createBranch(name, options = {}) {
  const { cwd = process.cwd(), checkout = true } = options;

  const command = checkout ? `git checkout -b ${name}` : `git branch ${name}`;
  return executeGitCommand(command, { cwd });
}

/**
 * Switch branch
 */
export async function switchBranch(name, cwd = process.cwd()) {
  return executeGitCommand(`git checkout ${name}`, { cwd });
}

/**
 * List branches
 */
export async function listBranches(cwd = process.cwd()) {
  try {
    const local = execSync('git branch', {
      cwd,
      encoding: 'utf-8'
    });

    const remote = execSync('git branch -r', {
      cwd,
      encoding: 'utf-8'
    });

    return {
      local: local.split('\n').filter(Boolean).map(b => b.trim().replace('* ', '')),
      remote: remote.split('\n').filter(Boolean).map(b => b.trim())
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Search git history
 */
export async function searchLog(query, options = {}) {
  const { cwd = process.cwd(), limit = 50, author, since, until } = options;

  let command = `git log -${limit} --grep="${query}" --format="%H|%an|%ar|%s"`;

  if (author) {
    command += ` --author="${author}"`;
  }
  if (since) {
    command += ` --since="${since}"`;
  }
  if (until) {
    command += ` --until="${until}"`;
  }

  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf-8'
    });

    return result.split('\n').filter(Boolean).map(line => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date, message };
    });
  } catch (error) {
    return { error: error.message, results: [] };
  }
}

export default {
  validateGitCommand,
  executeGitCommand,
  getStatus,
  getLog,
  getDiff,
  stage,
  commit,
  push,
  pull,
  createBranch,
  switchBranch,
  listBranches,
  searchLog
};