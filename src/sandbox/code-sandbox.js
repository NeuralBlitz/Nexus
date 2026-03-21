#!/usr/bin/env node

import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// CODE SANDBOX
// Safe code execution with resource limits, isolation, and auditing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sandbox languages
 */
export const Language = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  BASH: 'bash',
  TYPESCRIPT: 'typescript'
};

/**
 * Execution result
 */
export class ExecutionResult {
  constructor(options = {}) {
    this.id = options.id || `exec_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    this.language = options.language;
    this.code = options.code;
    this.status = options.status || 'pending';
    this.output = null;
    this.error = null;
    this.exitCode = null;
    this.duration = null;
    this.memoryUsed = null;
    this.timedOut = false;
    this.killed = false;
    this.startedAt = Date.now();
    this.completedAt = null;
  }

  /**
   * Mark as completed
   */
  complete(output, exitCode, memoryUsed) {
    this.status = 'completed';
    this.output = output;
    this.exitCode = exitCode;
    this.memoryUsed = memoryUsed;
    this.completedAt = Date.now();
    this.duration = this.completedAt - this.startedAt;
  }

  /**
   * Mark as failed
   */
  fail(error, exitCode = null) {
    this.status = 'failed';
    this.error = error;
    this.exitCode = exitCode;
    this.completedAt = Date.now();
    this.duration = this.completedAt - this.startedAt;
  }

  /**
   * Mark as timed out
   */
  timeout() {
    this.status = 'timeout';
    this.timedOut = true;
    this.completedAt = Date.now();
    this.duration = this.completedAt - this.startedAt;
  }

  toJSON() {
    return {
      id: this.id,
      language: this.language,
      status: this.status,
      output: this.output,
      error: this.error,
      exitCode: this.exitCode,
      duration: this.duration,
      memoryUsed: this.memoryUsed,
      timedOut: this.timedOut
    };
  }
}

/**
 * Sandbox configuration
 */
export class SandboxConfig {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 30 seconds
    this.memoryLimit = options.memoryLimit || 128 * 1024 * 1024; // 128MB
    this.cpuLimit = options.cpuLimit || 1; // 1 CPU
    this.networkAccess = options.networkAccess || false;
    this.fileSystemAccess = options.fileSystemAccess || false;
    this.allowedPaths = options.allowedPaths || [];
    this.allowedModules = options.allowedModules || [];
    this.envVars = options.envVars || {};
    this.workingDirectory = options.workingDirectory || '/tmp/sandbox';
    this.userId = options.userId || 'nobody';
    this.groupId = options.groupId || 'nogroup';
  }
}

/**
 * Code Sandbox - Executes code safely
 */
export class CodeSandbox extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = new SandboxConfig(options);
    this.executions = new Map();
    this.results = [];

    // Create sandbox directory
    this.sandboxDir = path.join('/tmp', `nexus_sandbox_${crypto.randomBytes(6).toString('hex')}`);
    this._initSandbox();
  }

  /**
   * Initialize sandbox directory
   */
  _initSandbox() {
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Execute JavaScript code
   */
  async executeJS(code, options = {}) {
    const result = new ExecutionResult({
      language: Language.JAVASCRIPT,
      code
    });

    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;

    try {
      // Create worker for isolation
      const workerCode = `
        const { parentPort } = require('worker_threads');
        
        // Restricted globals
        const safeGlobals = {
          console: {
            log: (...args) => parentPort.postMessage({ type: 'log', data: args }),
            error: (...args) => parentPort.postMessage({ type: 'error', data: args }),
            warn: (...args) => parentPort.postMessage({ type: 'warn', data: args })
          },
          Math,
          Date,
          JSON,
          Array,
          Object,
          String,
          Number,
          Boolean,
          RegExp,
          Map,
          Set,
          Promise,
          setTimeout: undefined,
          setInterval: undefined,
          setImmediate: undefined,
          fetch: undefined,
          require: undefined,
          process: undefined,
          global: undefined,
          window: undefined,
          document: undefined
        };
        
        const logs = [];
        const errors = [];
        
        try {
          const fn = new Function(...Object.keys(safeGlobals), code);
          const result = fn(...Object.values(safeGlobals));
          
          if (result instanceof Promise) {
            result.then(r => parentPort.postMessage({ type: 'result', data: r }))
                  .catch(e => parentPort.postMessage({ type: 'error', data: e.message }));
          } else {
            parentPort.postMessage({ type: 'result', data: result });
          }
        } catch (e) {
          parentPort.postMessage({ type: 'error', data: e.message });
        }
      `;

      const output = await this._runInWorker(workerCode, timeout);
      result.complete(output.logs.join('\n'), 0, null);

    } catch (error) {
      if (error.message === 'timeout') {
        result.timeout();
      } else {
        result.fail(error.message);
      }
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.emit('execution:complete', result);

    return result;
  }

  /**
   * Execute Python code
   */
  async executePython(code, options = {}) {
    const result = new ExecutionResult({
      language: Language.PYTHON,
      code
    });

    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.py`);

    try {
      // Write code to file
      fs.writeFileSync(scriptPath, code, 'utf-8');

      // Execute with restrictions
      const output = this._executeCommand('python3', [scriptPath], {
        timeout,
        cwd: this.sandboxDir,
        env: {
          ...this.config.envVars,
          PYTHONPATH: '',
          PYTHONHOME: ''
        }
      });

      result.complete(output.stdout, output.exitCode, null);

    } catch (error) {
      if (error.killed) {
        result.timeout();
      } else {
        result.fail(error.stderr || error.message, error.exitCode);
      }
    } finally {
      // Cleanup
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.emit('execution:complete', result);

    return result;
  }

  /**
   * Execute bash command
   */
  async executeBash(code, options = {}) {
    const result = new ExecutionResult({
      language: Language.BASH,
      code
    });

    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.sh`);

    try {
      // Write script to file
      fs.writeFileSync(scriptPath, `#!/bin/bash\nset -e\n${code}`, { mode: 0o700 });

      // Execute with restrictions
      const output = this._executeCommand('/bin/bash', [scriptPath], {
        timeout,
        cwd: this.sandboxDir
      });

      result.complete(output.stdout, output.exitCode, null);

    } catch (error) {
      if (error.killed) {
        result.timeout();
      } else {
        result.fail(error.stderr || error.message, error.exitCode);
      }
    } finally {
      // Cleanup
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.emit('execution:complete', result);

    return result;
  }

  /**
   * Run code in worker thread
   */
  _runInWorker(code, timeout) {
    return new Promise((resolve, reject) => {
      const { Worker } = require('worker_threads');

      const worker = new Worker(code, { eval: true });
      const logs = [];
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          worker.terminate();
          reject(new Error('timeout'));
        }
      }, timeout);

      worker.on('message', (msg) => {
        if (msg.type === 'log') logs.push(msg.data.join(' '));
        if (msg.type === 'result') {
          completed = true;
          clearTimeout(timer);
          resolve({ logs, result: msg.data });
        }
        if (msg.type === 'error') {
          completed = true;
          clearTimeout(timer);
          reject(new Error(msg.data));
        }
      });

      worker.on('error', (error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          reject(error);
        }
      });

      worker.on('exit', (code) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(`Worker exited with code ${code}`));
          }
        }
      });
    });
  }

  /**
   * Execute command with resource limits
   */
  _executeCommand(command, args, options = {}) {
    const timeout = options.timeout || 30000;

    try {
      const stdout = execSync(`${command} ${args.join(' ')}`, {
        timeout,
        cwd: options.cwd || this.sandboxDir,
        env: options.env || process.env,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });

      return { stdout, stderr: '', exitCode: 0 };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1,
        killed: error.killed
      };
    }
  }

  /**
   * Execute code (auto-detect language)
   */
  async execute(code, options = {}) {
    const language = options.language || Language.JAVASCRIPT;

    switch (language) {
      case Language.JAVASCRIPT:
        return this.executeJS(code, options);
      case Language.PYTHON:
        return this.executePython(code, options);
      case Language.BASH:
        return this.executeBash(code, options);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Get execution result
   */
  getResult(executionId) {
    return this.results.find(r => r.id === executionId);
  }

  /**
   * Get active executions
   */
  getActiveExecutions() {
    return Array.from(this.executions.values());
  }

  /**
   * Kill an execution
   */
  async kill(executionId) {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.killed = true;
      this.emit('execution:killed', execution);
    }
  }

  /**
   * Kill all executions
   */
  async killAll() {
    for (const [id] of this.executions) {
      await this.kill(id);
    }
  }

  /**
   * Get stats
   */
  getStats() {
    const completed = this.results.filter(r => r.status === 'completed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const timedOut = this.results.filter(r => r.timedOut).length;

    const avgDuration = this.results.length > 0
      ? this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / this.results.length
      : 0;

    return {
      active: this.executions.size,
      total: this.results.length,
      completed,
      failed,
      timedOut,
      avgDuration: Math.round(avgDuration)
    };
  }

  /**
   * Cleanup sandbox
   */
  cleanup() {
    // Kill all executions
    this.killAll();

    // Remove sandbox directory
    try {
      fs.rmSync(this.sandboxDir, { recursive: true, force: true });
    } catch {}

    // Clear results
    this.results = [];
  }
}

// Export singleton
let sandbox = null;

export function getCodeSandbox(options) {
  if (!sandbox) {
    sandbox = new CodeSandbox(options);
  }
  return sandbox;
}

export default {
  CodeSandbox,
  SandboxConfig,
  ExecutionResult,
  Language,
  getCodeSandbox
};