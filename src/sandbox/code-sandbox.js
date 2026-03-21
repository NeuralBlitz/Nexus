#!/usr/bin/env node

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const Language = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  BASH: 'bash',
  TYPESCRIPT: 'typescript',
  GO: 'go',
  RUST: 'rust',
  RUBY: 'ruby',
  JAVA: 'java',
  C: 'c',
  CPP: 'cpp',
  CSHARP: 'csharp',
  PHP: 'php',
  PERL: 'perl',
  LUA: 'lua',
  R: 'r',
  SWIFT: 'swift',
  KOTLIN: 'kotlin',
  SCALA: 'scala',
  HASKELL: 'haskell',
  SQL: 'sql',
  HTML: 'html',
  CSS: 'css',
  JSON: 'json',
  YAML: 'yaml',
  MARKDOWN: 'markdown',
  BUN: 'bun'
};

const KNOWN_PATHS = {
  bun: ['/nix/store/1xk3mgscq548ypyrgm2n5kwdii92w9ql-bun-1.3.6/bin/bun'],
};

function findExecutable(name) {
  try {
    const result = execSync(`which ${name}`, { encoding: 'utf8', timeout: 5000 });
    return result.trim();
  } catch {
    if (KNOWN_PATHS[name]) {
      for (const p of KNOWN_PATHS[name]) {
        if (fs.existsSync(p)) return p;
      }
    }
    return name;
  }
}

export class ExecutionResult {
  constructor(options = {}) {
    this.id = options.id || `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.language = options.language || 'javascript';
    this.code = options.code || '';
    this.status = options.status || 'pending';
    this.output = null;
    this.error = null;
    this.exitCode = null;
    this.duration = null;
    this.memoryStart = null;
    this.memoryEnd = null;
    this.timedOut = false;
    this.killed = false;
    this.startedAt = Date.now();
    this.completedAt = null;
    this.returnValue = null;
    this.logs = [];
    this.warnings = [];
  }

  complete(output, exitCode, memoryEnd) {
    this.status = 'completed';
    this.output = output;
    this.exitCode = exitCode;
    this.memoryEnd = memoryEnd;
    this.completedAt = Date.now();
    this.duration = this.completedAt - this.startedAt;
    return this;
  }

  fail(error, exitCode = 1) {
    this.status = 'failed';
    this.error = String(error);
    this.exitCode = exitCode;
    this.completedAt = Date.now();
    this.duration = this.completedAt - this.startedAt;
    return this;
  }

  timeout() {
    this.status = 'timeout';
    this.timedOut = true;
    this.completedAt = Date.now();
    this.duration = this.completedAt - this.startedAt;
    return this;
  }

  killed() {
    this.status = 'killed';
    this.killed = true;
    this.completedAt = Date.now();
    this.duration = this.completedAt - this.startedAt;
    return this;
  }

  addLog(msg) { this.logs.push(String(msg)); return this; }
  addWarning(msg) { this.warnings.push(String(msg)); return this; }

  getMemoryDelta() {
    if (this.memoryStart && this.memoryEnd) {
      return this.memoryEnd - this.memoryStart;
    }
    return null;
  }

  formatOutput(maxLen = 10000) {
    if (!this.output) return '';
    if (this.output.length <= maxLen) return this.output;
    return this.output.substring(0, maxLen) + `\n... (${this.output.length - maxLen} more characters)`;
  }

  toSummary() {
    return {
      id: this.id,
      lang: this.language,
      status: this.status,
      duration: this.duration ? `${this.duration}ms` : 'N/A',
      memory: this.getMemoryDelta() ? `${(this.getMemoryDelta() / 1024).toFixed(1)}KB` : 'N/A',
      outputSize: this.output ? this.output.length : 0,
      error: this.error ? this.error.substring(0, 100) : null
    };
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
      memoryDelta: this.getMemoryDelta(),
      timedOut: this.timedOut,
      killed: this.killed,
      logs: this.logs,
      warnings: this.warnings,
      returnValue: this.returnValue,
      startedAt: this.startedAt,
      completedAt: this.completedAt
    };
  }
}

export class SandboxConfig {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.memoryLimit = options.memoryLimit || 256 * 1024 * 1024;
    this.cpuLimit = options.cpuLimit || 2;
    this.maxOutput = options.maxOutput || 1024 * 1024;
    this.maxLogs = options.maxLogs || 1000;
    this.networkAccess = options.networkAccess ?? false;
    this.fileSystemAccess = options.fileSystemAccess ?? false;
    this.allowedPaths = options.allowedPaths || [];
    this.allowedModules = options.allowedModules || ['mathjs', 'lodash', 'uuid', 'dayjs'];
    this.envVars = options.envVars || {};
    this.workingDirectory = options.workingDirectory || '/tmp/nexus_sandbox';
    this.userId = options.userId || process.getuid?.() || 1000;
    this.groupId = options.groupId || process.getgid?.() || 1000;
    this.enableGlobals = options.enableGlobals ?? true;
    this.strictMode = options.strictMode ?? true;
    this.allowRecursion = options.allowRecursion ?? true;
    this.maxRecursionDepth = options.maxRecursionDepth || 100;
    this.enableAsync = options.enableAsync ?? true;
    this.enableBuiltins = options.enableBuiltins ?? true;
    this.enableProcessInfo = options.enableProcessInfo ?? false;
  }
}

const SAFE_BUILTINS = {
  // Math
  abs: Math.abs, acos: Math.acos, acosh: Math.acosh, asin: Math.asin, asinh: Math.asinh,
  atan: Math.atan, atanh: Math.atanh, atan2: Math.atan2, ceil: Math.ceil,
  clz32: Math.clz32, cos: Math.cos, cosh: Math.cosh, exp: Math.exp, expm1: Math.expm1,
  floor: Math.floor, fround: Math.fround, hypot: Math.hypot, imul: Math.imul,
  log: Math.log, log10: Math.log10, log1p: Math.log1p, log2: Math.log2,
  max: Math.max, min: Math.min, pow: Math.pow, random: Math.random,
  round: Math.round, sign: Math.sign, sin: Math.sin, sinh: Math.sinh,
  sqrt: Math.sqrt, tan: Math.tanh, tanh: Math.tanh, trunc: Math.trunc,
  E: Math.E, PI: Math.PI, SQRT2: Math.SQRT2, SQRT1_2: Math.SQRT1_2,
  LN2: Math.LN2, LN10: Math.LN10, LOG2E: Math.LOG2E, LOG10E: Math.LOG10E,

  // Core
  parseInt, parseFloat, isNaN, isFinite, decodeURI, decodeURIComponent,
  encodeURI, encodeURIComponent, eval, Function,

  // JSON
  JSON,

  // Constructors
  Array, Object, String, Number, Boolean, Symbol, BigInt,
  Map, Set, WeakMap, WeakSet, Promise, Proxy, Reflect, Symbol,
  Error, TypeError, RangeError, SyntaxError, ReferenceError,
  AggregateError, FinalizationRegistry, WeakRef,

  // TypedArrays
  ArrayBuffer, BigInt64Array, BigUint64Array, Float32Array, Float64Array,
  Int8Array, Int16Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray,

  // DataView
  DataView, Atomics, SharedArrayBuffer,

  // Date
  Date,

  // RegExp
  RegExp,

  // Iterator helpers (these may not exist in all Node versions)

  // Structured clone
  structuredClone,

  // Queue
  queueMicrotask,
};

const DANGEROUS_PATTERNS = [
  /\bprocess\b/, /\bglobal\b/, /\bglobalThis\b/, /\bwindow\b/, /\bdocument\b/,
  /\bfetch\b/, /\bXMLHttpRequest\b/, /\bActiveXObject\b/,
  /\b__proto__\b/, /\bconstructor\b/, /\bprototype\b/,
  /\brequire\b/, /\bimport\b/, /\bdynamicImport\b/,
  /\beval\b/, /\bFunction\b/, /\bexecScript\b/,
  /\bBuffer\b/, /\bmodule\b/, /\bexports\b/, /\b__dirname\b/, /\b__filename\b/,
  /\bchild_process\b/, /\bfs\b/, /\bpath\b/, /\bnet\b/, /\btls\b/, /\bhttp\b/, /\bhttps\b/,
  /\bcrypto\b/, /\bdgram\b/, /\bdns\b/, /\bdomain\b/, /\brePL\b/, /\breadline\b/,
  /\bworker_threads\b/, /\bcluster\b/, /\bzlib\b/, /\butil\b/, /\bv8\b/, /\bvm\b/,
  /\bperf_hooks\b/, /\bcustomInspect\b/, /\bSymbol\(unscopables\)/,
  /process\.env/, /process\.cwd/, /process\.chdir/, /process\.exit/,
  /process\.kill/, /process\.hrtime/, /process\.cpuUsage/,
  /global\.process/, /global\.__/,
  /\\u0070\\u0072\\u006f\\u0063\\u0065\\u0073\\u0073/, // obfuscated "process"
  /\\x[0-9a-f]{2}/i,
];

const DANGEROUS_CODE_PATTERNS = [
  /while\s*\(\s*true/, /for\s*\(\s*;\s*;\s*\)/,
  /\bdebugger\b/,
  /\/\.\//, /\.\.\//,
  /eval\s*\(/, /new\s+Function\s*\(/,
  /\basync\s+function/, /\bawait\s+/,
];

export class CodeSandbox extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = new SandboxConfig(options);
    this.executions = new Map();
    this.results = [];
    this.history = [];
    this.state = new Map();
    this.worker = null;
    this.workerResolve = null;
    this.workerReject = null;

    this.sandboxDir = path.join('/tmp', `nexus_sandbox_${crypto.randomBytes(4).toString('hex')}`);
    this._initSandbox();
  }

  _initSandbox() {
    try {
      if (!fs.existsSync(this.sandboxDir)) {
        fs.mkdirSync(this.sandboxDir, { recursive: true, mode: 0o700 });
      }
    } catch {}
  }

  validateCode(code, language = 'javascript') {
    const warnings = [];
    const errors = [];

    if (!code || typeof code !== 'string') {
      errors.push('Code must be a non-empty string');
      return { valid: false, errors, warnings };
    }

    if (code.length > (this.config.maxOutput * 10)) {
      errors.push(`Code too long (max ${this.config.maxOutput * 10} chars)`);
    }

    if (language === 'javascript') {
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
          errors.push(`Code contains dangerous pattern: ${pattern}`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  buildSafeGlobals(includeProcess = false) {
    const safe = { ...SAFE_BUILTINS };

    safe.console = {
      log: (...args) => this._log('log', args),
      error: (...args) => this._log('error', args),
      warn: (...args) => this._log('warn', args),
      info: (...args) => this._log('info', args),
      debug: (...args) => this._log('debug', args),
      table: (data) => this._log('table', [this._formatTable(data)]),
      time: (label = 'default') => this._log('time', [`${label}: ${Date.now()}ms`]),
      timeEnd: (label = 'default') => this._log('timeEnd', [`${label}: ${Date.now()}ms`]),
      group: (...args) => this._log('group', args),
      groupEnd: () => this._log('groupEnd', []),
      clear: () => this._log('clear', []),
      count: (label = 'default') => this._log('count', [label]),
      assert: (cond, ...args) => { if (!cond) this._log('assert', args); },
      dir: (obj) => this._log('dir', [JSON.stringify(obj, null, 2)]),
    };

    safe.setTimeout = this.config.enableAsync ? setTimeout : undefined;
    safe.setInterval = this.config.enableAsync ? setInterval : undefined;
    safe.setImmediate = this.config.enableAsync ? setImmediate : undefined;
    safe.clearTimeout = this.config.enableAsync ? clearTimeout : undefined;
    safe.clearInterval = this.config.enableAsync ? clearInterval : undefined;
    safe.clearImmediate = this.config.enableAsync ? clearImmediate : undefined;
    safe.queueMicrotask = this.config.enableAsync ? queueMicrotask : undefined;

    safe.global = undefined;
    safe.window = undefined;
    safe.document = undefined;
    safe.parent = undefined;
    safe.frames = undefined;

    safe.process = includeProcess ? {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      env: {},
      cwd: () => this.sandboxDir,
      uptime: process.uptime,
      memoryUsage: () => process.memoryUsage(),
      hrtime: process.hrtime,
      argv: [],
      execArgv: [],
    } : undefined;

    safe.globalThis = safe;

    return safe;
  }

  _log(type, args) {
    if (!this.workerResolve) return;
    const serialized = args.map(a => {
      if (a === undefined) return 'undefined';
      if (a === null) return 'null';
      if (typeof a === 'function') return a.toString().substring(0, 100);
      if (typeof a === 'object') {
        try { return JSON.stringify(a, null, 2); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');
    this.workerResolve({ type: 'log', level: type, data: serialized });
  }

  _formatTable(data) {
    if (!Array.isArray(data)) return JSON.stringify(data);
    if (data.length === 0) return '(empty)';
    if (typeof data[0] === 'object') {
      const keys = Object.keys(data[0]);
      const rows = data.map(row => keys.map(k => String(row[k] ?? '')));
      const widths = keys.map((k, i) => Math.max(k.length, ...rows.map(r => r[i].length)));
      const header = keys.map((k, i) => k.padEnd(widths[i])).join(' | ');
      const sep = widths.map(w => '─'.repeat(w)).join('─┼─');
      const body = rows.map(r => r.map((v, i) => v.padEnd(widths[i])).join(' | ')).join('\n');
      return `${header}\n${sep}\n${body}`;
    }
    return data.join(' | ');
  }

  async executeJS(code, options = {}) {
    const result = new ExecutionResult({ language: 'javascript', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const logs = [];
    const warnings = [];
    let returnValue = undefined;
    let hasError = false;

    const safeGlobals = this.buildSafeGlobals(this.config.enableProcessInfo);
    const globalKeys = Object.keys(safeGlobals);
    const globalVals = Object.values(safeGlobals);

    const safeCode = code.replace(/`/g, '\\`');
    const fnBody = 'return (function() { return (' + safeCode + '); })()';
    const workerCode = `
      const __nexus_logs__ = [];
      const safeConsole = {
        log: (...a) => __nexus_logs__.push({ level: 'log', data: a.map(s => typeof s === 'object' ? JSON.stringify(s) : String(s)).join(' ') }),
        error: (...a) => __nexus_logs__.push({ level: 'error', data: a.map(s => String(s)).join(' ') }),
        warn: (...a) => __nexus_logs__.push({ level: 'warn', data: a.map(s => String(s)).join(' ') }),
        info: (...a) => __nexus_logs__.push({ level: 'info', data: a.map(s => String(s)).join(' ') }),
        debug: (...a) => __nexus_logs__.push({ level: 'debug', data: a.map(s => String(s)).join(' ') }),
        table: (d) => __nexus_logs__.push({ level: 'table', data: JSON.stringify(d, null, 2) }),
        time: (l) => __nexus_logs__.push({ level: 'time', data: l + ': ' + Date.now() + 'ms' }),
        timeEnd: (l) => __nexus_logs__.push({ level: 'timeEnd', data: l + ': ' + Date.now() + 'ms' }),
        group: (...a) => __nexus_logs__.push({ level: 'group', data: a.join(' ') }),
        groupEnd: () => __nexus_logs__.push({ level: 'groupEnd', data: '' }),
        clear: () => __nexus_logs__.push({ level: 'clear', data: '' }),
        count: (l) => __nexus_logs__.push({ level: 'count', data: l }),
        assert: (c, ...a) => { if (!c) __nexus_logs__.push({ level: 'assert', data: a.join(' ') }); },
        dir: (o) => __nexus_logs__.push({ level: 'dir', data: JSON.stringify(o, null, 2) }),
      };
      const safeGlobals = {
        console: safeConsole,
        Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp,
        Map, Set, Promise, Error, TypeError, RangeError, SyntaxError,
        ReferenceError, AggregateError, DataView, ArrayBuffer,
        Float32Array, Float64Array, Int8Array, Int16Array, Int32Array,
        Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray,
        BigInt64Array, BigUint64Array, Symbol, BigInt,
        parseInt, parseFloat, isNaN, isFinite,
        decodeURI, decodeURIComponent, encodeURI, encodeURIComponent,
        setTimeout: ${this.config.enableAsync ? 'setTimeout' : 'undefined'},
        setInterval: ${this.config.enableAsync ? 'setInterval' : 'undefined'},
        setImmediate: ${this.config.enableAsync ? 'setImmediate' : 'undefined'},
        clearTimeout: ${this.config.enableAsync ? 'clearTimeout' : 'undefined'},
        clearInterval: ${this.config.enableAsync ? 'clearInterval' : 'undefined'},
        clearImmediate: ${this.config.enableAsync ? 'clearImmediate' : 'undefined'},
        queueMicrotask: ${this.config.enableAsync ? 'queueMicrotask' : 'undefined'},
        global: undefined, window: undefined, globalThis: undefined,
        document: undefined, parent: undefined, frames: undefined,
        process: undefined, fetch: undefined, require: undefined,
        module: undefined, exports: undefined,
      };
      (function() {
        'use strict';
        try {
          const fn = new Function(...Object.keys(safeGlobals), '${fnBody}');
          const rv = fn(...Object.values(safeGlobals));
          const serialize = (v) => v !== undefined ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : 'undefined';
          if (rv instanceof Promise) {
            rv.then(r => { console.log('__NEXUS_RESULT__' + JSON.stringify({ success: true, returnValue: serialize(r), logs: __nexus_logs__ })); })
              .catch(e => { console.log('__NEXUS_RESULT__' + JSON.stringify({ success: false, error: e.message, name: e.name, logs: __nexus_logs__ })); });
          } else {
            console.log('__NEXUS_RESULT__' + JSON.stringify({ success: true, returnValue: serialize(rv), logs: __nexus_logs__ }));
          }
        } catch (e) {
          console.log('__NEXUS_RESULT__' + JSON.stringify({ success: false, error: e.message, name: e.name, stack: e.stack, logs: __nexus_logs__ }));
        }
      })();
    `;

    const timer = setTimeout(() => {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      result.timeout();
    }, timeout);

    try {
      let stdoutData = '';
      let stderrData = '';
      
      const worker = new Worker(workerCode, { eval: true });
      this.worker = worker;

      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          worker.terminate();
          reject(new Error('timeout'));
        }, timeout);

        if (worker.stdout) {
          worker.stdout.on('data', (data) => {
            stdoutData += data.toString();
          });
        }

        if (worker.stderr) {
          worker.stderr.on('data', (data) => {
            stderrData += data.toString();
          });
        }

        worker.on('error', (e) => {
          hasError = true;
          result.error = e.message;
          clearTimeout(timeoutId);
          resolve();
        });

        worker.on('exit', (code) => {
          clearTimeout(timeoutId);
          if (!hasError && code !== 0) {
            result.error = `Worker exited with code ${code}`;
          }
          resolve();
        });
      });

      worker.terminate().catch(() => {});
      this.worker = null;

      const lines = stdoutData.split('\n');
      for (const line of lines) {
        if (line.startsWith('__NEXUS_RESULT__')) {
          try {
            const parsed = JSON.parse(line.slice('__NEXUS_RESULT__'.length));
            if (!parsed.success) {
              hasError = true;
              result.error = parsed.error;
              if (parsed.stack) result.stack = parsed.stack;
            }
            returnValue = parsed.returnValue;
            if (parsed.logs && Array.isArray(parsed.logs)) {
              for (const log of parsed.logs) {
                logs.push(`[${log.level}] ${log.data}`);
              }
            }
          } catch (e) {
            hasError = true;
            result.error = 'Failed to parse result: ' + e.message;
          }
        } else if (line.trim()) {
          logs.push(line);
        }
      }

      if (stderrData.trim()) {
        logs.push('[stderr] ' + stderrData.trim());
      }

    } catch (e) {
      result.error = e.message;
    } finally {
      clearTimeout(timer);
      this.workerResolve = null;
    }

    result.memoryEnd = process.memoryUsage().heapUsed;
    result.logs = logs;
    result.warnings = warnings;
    result.returnValue = returnValue;

    if (result.status === 'pending') {
      if (hasError) {
        result.fail(result.error);
      } else {
        const allOutput = [...logs];
        if (returnValue && returnValue !== 'undefined') {
          allOutput.push(`→ ${returnValue}`);
        }
        result.complete(allOutput.join('\n'), 0, result.memoryEnd);
      }
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executePython(code, options = {}) {
    const result = new ExecutionResult({ language: 'python', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.py`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn('python3', [scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: {
            ...this.config.envVars,
            PYTHONPATH: '',
            PYTHONHOME: '',
            HOME: this.sandboxDir,
            PATH: process.env.PATH,
          }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executePerl(code, options = {}) {
    const result = new ExecutionResult({ language: 'perl', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.pl`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn('perl', [scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executeGo(code, options = {}) {
    const result = new ExecutionResult({ language: 'go', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.go`);
    const binaryPath = path.join(this.sandboxDir, `${result.id}`);

    try {
      let wrappedCode = code;
      if (!code.includes('package main') && !code.includes('func main()')) {
        wrappedCode = `package main\n\nimport "fmt"\n\nfunc main() {\n${code.split('\n').map(l => '  ' + l).join('\n')}\n}`;
      }
      fs.writeFileSync(scriptPath, wrappedCode, 'utf-8');

      const compileOutput = await new Promise((resolve) => {
        const proc = spawn('go', ['build', '-o', binaryPath, scriptPath], {
          cwd: this.sandboxDir,
          timeout: 30000,
          env: { ...process.env, HOME: this.sandboxDir, GOCACHE: this.sandboxDir }
        });

        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', (code) => resolve({ stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stderr: 'Compilation timed out', exitCode: 124 }); }, 30000);
      });

      if (compileOutput.exitCode !== 0) {
        result.memoryEnd = process.memoryUsage().heapUsed;
        result.fail(compileOutput.stderr || 'Compilation failed', compileOutput.exitCode);
        this.finalizeResult(result);
        return result;
      }

      const output = await new Promise((resolve) => {
        const proc = spawn(binaryPath, [], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(binaryPath); } catch {}
    }

    this.finalizeResult(result);
    return result;
  }

  async executeC(code, options = {}) {
    const result = new ExecutionResult({ language: 'c', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.c`);
    const binaryPath = path.join(this.sandboxDir, `${result.id}`);

    try {
      let wrappedCode = code;
      if (!code.includes('#include') && !code.includes('int main')) {
        wrappedCode = `#include <stdio.h>\n\nint main() {\n${code.split('\n').map(l => '  ' + l).join('\n')}\n  return 0;\n}`;
      }
      fs.writeFileSync(scriptPath, wrappedCode, 'utf-8');

      const compileOutput = await new Promise((resolve) => {
        const proc = spawn('gcc', ['-o', binaryPath, scriptPath, '-lm'], {
          cwd: this.sandboxDir,
          timeout: 30000,
          env: { ...process.env, HOME: this.sandboxDir }
        });

        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', (code) => resolve({ stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stderr: 'Compilation timed out', exitCode: 124 }); }, 30000);
      });

      if (compileOutput.exitCode !== 0) {
        result.memoryEnd = process.memoryUsage().heapUsed;
        result.fail(compileOutput.stderr || 'Compilation failed', compileOutput.exitCode);
        this.finalizeResult(result);
        return result;
      }

      const output = await new Promise((resolve) => {
        const proc = spawn(binaryPath, [], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(binaryPath); } catch {}
    }

    this.finalizeResult(result);
    return result;
  }

  async executeCpp(code, options = {}) {
    const result = new ExecutionResult({ language: 'cpp', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.cpp`);
    const binaryPath = path.join(this.sandboxDir, `${result.id}`);

    try {
      let wrappedCode = code;
      if (!code.includes('#include') && !code.includes('int main')) {
        wrappedCode = `#include <iostream>\nusing namespace std;\n\nint main() {\n${code.split('\n').map(l => '  ' + l).join('\n')}\n  return 0;\n}`;
      }
      fs.writeFileSync(scriptPath, wrappedCode, 'utf-8');

      const compileOutput = await new Promise((resolve) => {
        const proc = spawn('g++', ['-o', binaryPath, scriptPath, '-std=c++17'], {
          cwd: this.sandboxDir,
          timeout: 30000,
          env: { ...process.env, HOME: this.sandboxDir }
        });

        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', (code) => resolve({ stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stderr: 'Compilation timed out', exitCode: 124 }); }, 30000);
      });

      if (compileOutput.exitCode !== 0) {
        result.memoryEnd = process.memoryUsage().heapUsed;
        result.fail(compileOutput.stderr || 'Compilation failed', compileOutput.exitCode);
        this.finalizeResult(result);
        return result;
      }

      const output = await new Promise((resolve) => {
        const proc = spawn(binaryPath, [], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(binaryPath); } catch {}
    }

    this.finalizeResult(result);
    return result;
  }

  async executeRuby(code, options = {}) {
    const result = new ExecutionResult({ language: 'ruby', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.rb`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn('ruby', [scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executePHP(code, options = {}) {
    const result = new ExecutionResult({ language: 'php', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.php`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn('php', [scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executeLua(code, options = {}) {
    const result = new ExecutionResult({ language: 'lua', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.lua`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn('lua', [scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executeR(code, options = {}) {
    const result = new ExecutionResult({ language: 'r', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.R`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn('Rscript', [scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executeSQL(code, options = {}) {
    const result = new ExecutionResult({ language: 'sql', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    try {
      const { getDatabase } = await import('../persistence.js');
      const db = getDatabase();
      await db.initialize();
      const stmt = db.prepare(code);
      const rows = stmt.all();
      result.memoryEnd = process.memoryUsage().heapUsed;
      result.complete(JSON.stringify(rows, null, 2), 0, result.memoryEnd);
    } catch (error) {
      result.fail(error.message);
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);
    return result;
  }

  async executeJSON(code, options = {}) {
    const result = new ExecutionResult({ language: 'json', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    try {
      const parsed = JSON.parse(code);
      result.memoryEnd = process.memoryUsage().heapUsed;
      result.complete(JSON.stringify(parsed, null, 2), 0, result.memoryEnd);
    } catch (error) {
      result.fail(`Invalid JSON: ${error.message}`, 1);
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);
    return result;
  }

  async executeYAML(code, options = {}) {
    const result = new ExecutionResult({ language: 'yaml', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    try {
      // Simple YAML parser for basic documents
      const lines = code.split('\n');
      const parsed = this._parseSimpleYAML(lines);
      result.memoryEnd = process.memoryUsage().heapUsed;
      result.complete(JSON.stringify(parsed, null, 2), 0, result.memoryEnd);
    } catch (error) {
      result.fail(`Invalid YAML: ${error.message}`, 1);
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);
    return result;
  }

  _parseSimpleYAML(lines, indent = 0) {
    const result = {};
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) { i++; continue; }
      const lineIndent = line.search(/\S/);
      if (lineIndent < indent) break;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) { i++; continue; }
      const key = trimmed.substring(0, colonIdx).trim();
      const val = trimmed.substring(colonIdx + 1).trim();
      if (val) {
        result[key] = val === 'true' ? true : val === 'false' ? false : val === 'null' ? null : isNaN(val) ? val : Number(val);
      } else {
        const childLines = [];
        i++;
        while (i < lines.length) {
          const childLine = lines[i];
          const childIndent = childLine.search(/\S/);
          if (childIndent > lineIndent || childLine.trim() === '') {
            childLines.push(childLine);
            i++;
          } else break;
        }
        result[key] = this._parseSimpleYAML(childLines, lineIndent + 2);
        continue;
      }
      i++;
    }
    return result;
  }

  async executeHTML(code, options = {}) {
    const result = new ExecutionResult({ language: 'html', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    try {
      // Extract and count elements
      const tags = (code.match(/<(\w+)/g) || []).map(t => t.slice(1));
      const tagCounts = {};
      tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
      const analysis = {
        elementCount: tags.length,
        uniqueTags: Object.keys(tagCounts).length,
        tags: tagCounts,
        hasDoctype: code.toLowerCase().includes('<!doctype'),
        hasHead: code.toLowerCase().includes('<head'),
        hasBody: code.toLowerCase().includes('<body'),
        length: code.length
      };
      result.memoryEnd = process.memoryUsage().heapUsed;
      result.complete(JSON.stringify(analysis, null, 2), 0, result.memoryEnd);
    } catch (error) {
      result.fail(error.message);
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);
    return result;
  }

  async executeMarkdown(code, options = {}) {
    const result = new ExecutionResult({ language: 'markdown', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    try {
      const lines = code.split('\n');
      const headings = lines.filter(l => l.startsWith('#')).map(l => ({
        level: l.match(/^#+/)[0].length,
        text: l.replace(/^#+\s*/, '').trim()
      }));
      const links = (code.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).map(l => {
        const m = l.match(/\[([^\]]+)\]\(([^)]+)\)/);
        return { text: m[1], url: m[2] };
      });
      const codeBlocks = (code.match(/```[\s\S]*?```/g) || []).length;
      const analysis = {
        headings,
        linkCount: links.length,
        links: links.slice(0, 10),
        codeBlockCount: codeBlocks,
        wordCount: code.replace(/[#*`\[\]()]/g, '').split(/\s+/).filter(w => w).length,
        lineCount: lines.length,
        length: code.length
      };
      result.memoryEnd = process.memoryUsage().heapUsed;
      result.complete(JSON.stringify(analysis, null, 2), 0, result.memoryEnd);
    } catch (error) {
      result.fail(error.message);
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);
    return result;
  }

  async executeRust(code, options = {}) {
    const result = new ExecutionResult({ language: 'rust', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.rs`);
    const binaryPath = path.join(this.sandboxDir, `${result.id}`);

    try {
      let wrappedCode = code;
      if (!code.includes('fn main()') && !code.includes('use std')) {
        wrappedCode = `fn main() {\n${code.split('\n').map(l => '  ' + l).join('\n')}\n}`;
      }
      fs.writeFileSync(scriptPath, wrappedCode, 'utf-8');

      const compileOutput = await new Promise((resolve) => {
        const proc = spawn('rustc', [scriptPath, '-o', binaryPath], {
          cwd: this.sandboxDir,
          timeout: 60000,
          env: { ...process.env, HOME: this.sandboxDir }
        });

        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', (code) => resolve({ stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stderr: 'Compilation timed out', exitCode: 124 }); }, 60000);
      });

      if (compileOutput.exitCode !== 0) {
        result.memoryEnd = process.memoryUsage().heapUsed;
        result.fail(compileOutput.stderr || 'Compilation failed', compileOutput.exitCode);
        this.finalizeResult(result);
        return result;
      }

      const output = await new Promise((resolve) => {
        const proc = spawn(binaryPath, [], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(binaryPath); } catch {}
    }

    this.finalizeResult(result);
    return result;
  }

  async executeTypeScript(code, options = {}) {
    const result = new ExecutionResult({ language: 'typescript', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.ts`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn('npx', ['ts-node', '--transpile-only', scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...process.env, HOME: this.sandboxDir, PATH: process.env.PATH }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executeBun(code, options = {}) {
    const result = new ExecutionResult({ language: 'bun', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.js`);

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8');

      const output = await new Promise((resolve) => {
        const proc = spawn(findExecutable('bun'), [scriptPath], {
          cwd: this.sandboxDir,
          timeout,
          maxBuffer: this.config.maxOutput,
          env: { ...this.config.envVars, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  async executeBash(code, options = {}) {
    const result = new ExecutionResult({ language: 'bash', code });
    result.memoryStart = process.memoryUsage().heapUsed;
    this.executions.set(result.id, result);
    this.emit('execution:start', result);

    const timeout = options.timeout || this.config.timeout;
    const scriptPath = path.join(this.sandboxDir, `${result.id}.sh`);

    try {
      const wrapped = `#!/bin/bash\nset -e\nset -o pipefail\ncd "${this.sandboxDir}"\n${code}`;
      fs.writeFileSync(scriptPath, wrapped, { mode: 0o700 });

      const output = await new Promise((resolve) => {
        const proc = spawn('/bin/bash', [scriptPath], {
          cwd: this.sandboxDir,
          env: { ...process.env, HOME: this.sandboxDir }
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > this.config.maxOutput) proc.kill(); });
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
        setTimeout(() => { proc.kill('SIGKILL'); resolve({ stdout, stderr: 'Timed out', exitCode: 124 }); }, timeout);
      });

      result.memoryEnd = process.memoryUsage().heapUsed;
      const combined = output.stdout + (output.stderr ? `\n${output.stderr}` : '');
      if (output.exitCode === 0) {
        result.complete(combined.trim(), output.exitCode, result.memoryEnd);
      } else {
        result.fail(output.stderr || 'Execution failed', output.exitCode);
      }

    } catch (error) {
      result.fail(error.message);
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);

    return result;
  }

  finalizeResult(result) {
    this.executions.delete(result.id);
    this.results.push(result);
    this.history.unshift(result);
    if (this.history.length > 100) this.history.pop();
    this.emit('execution:complete', result);
  }

  async execute(code, options = {}) {
    const lang = (options.language || 'javascript').toLowerCase();
    switch (lang) {
      case 'javascript': case 'js': return this.executeJS(code, options);
      case 'typescript': case 'ts': return this.executeTypeScript(code, options);
      case 'python': case 'py': return this.executePython(code, options);
      case 'bash': case 'sh': return this.executeBash(code, options);
      case 'perl': case 'pl': return this.executePerl(code, options);
      case 'go': case 'golang': return this.executeGo(code, options);
      case 'c': case 'c99': case 'c11': return this.executeC(code, options);
      case 'cpp': case 'c++': case 'cxx': return this.executeCpp(code, options);
      case 'ruby': case 'rb': return this.executeRuby(code, options);
      case 'php': return this.executePHP(code, options);
      case 'lua': return this.executeLua(code, options);
      case 'rust': case 'rs': return this.executeRust(code, options);
      case 'bun': return this.executeBun(code, options);
      case 'r': return this.executeR(code, options);
      case 'sql': return this.executeSQL(code, options);
      case 'json': return this.executeJSON(code, options);
      case 'yaml': case 'yml': return this.executeYAML(code, options);
      case 'html': return this.executeHTML(code, options);
      case 'markdown': case 'md': return this.executeMarkdown(code, options);
      default: throw new Error(`Unsupported language: ${lang}`);
    }
  }

  async executeWithState(code, options = {}) {
    const result = await this.execute(code, options);
    return result;
  }

  getStats() {
    const completed = this.results.filter(r => r.status === 'completed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const timedOut = this.results.filter(r => r.status === 'timeout').length;
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
    const avgDuration = this.results.length > 0 ? totalDuration / this.results.length : 0;
    const totalMemory = this.results.reduce((sum, r) => sum + (r.getMemoryDelta() || 0), 0);
    const totalOutput = this.results.reduce((sum, r) => sum + (r.output?.length || 0), 0);

    return {
      active: this.executions.size,
      total: this.results.length,
      completed,
      failed,
      timedOut,
      avgDuration: Math.round(avgDuration),
      totalDuration,
      totalMemory,
      totalOutput,
      successRate: this.results.length > 0 ? ((completed / this.results.length) * 100).toFixed(1) + '%' : 'N/A',
    };
  }

  getHistory(limit = 20) {
    return this.history.slice(0, limit).map(r => r.toSummary());
  }

  kill(executionId) {
    if (this.executions.has(executionId)) {
      const exec = this.executions.get(executionId);
      exec.killed();
      this.emit('execution:killed', exec);
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    }
  }

  killAll() {
    for (const [id] of this.executions) this.kill(id);
  }

  cleanup() {
    this.killAll();
    try { fs.rmSync(this.sandboxDir, { recursive: true, force: true }); } catch {}
    this.results = [];
    this.history = [];
    this.state.clear();
  }

  setState(key, value) { this.state.set(key, value); }
  getState(key) { return this.state.get(key); }
  clearState() { this.state.clear(); }
}

let sandbox = null;

export function getCodeSandbox(options) {
  if (!sandbox) sandbox = new CodeSandbox(options);
  return sandbox;
}

export default { CodeSandbox, SandboxConfig, ExecutionResult, Language, getCodeSandbox };
