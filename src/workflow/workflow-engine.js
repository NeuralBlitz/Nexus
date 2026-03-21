#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW ENGINE
// Complex task orchestration, DAG execution, parallel processing, conditions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Workflow states
 */
export const WorkflowState = {
  DRAFT: 'draft',
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Step states
 */
export const StepState = {
  PENDING: 'pending',
  WAITING: 'waiting',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  RETRYING: 'retrying'
};

/**
 * Step types
 */
export const StepType = {
  TASK: 'task',
  CONDITION: 'condition',
  PARALLEL: 'parallel',
  SEQUENTIAL: 'sequential',
  WAIT: 'wait',
  HTTP: 'http',
  CODE: 'code',
  AGENT: 'agent',
  MAP: 'map',
  MERGE: 'merge',
  SWITCH: 'switch'
};

/**
 * Workflow Step
 */
export class WorkflowStep {
  constructor(config) {
    this.id = config.id || `step_${crypto.randomBytes(6).toString('hex')}`;
    this.name = config.name || 'Unnamed Step';
    this.type = config.type || StepType.TASK;
    this.description = config.description || '';

    // Execution
    this.handler = config.handler || null;
    this.config = config.config || {};

    // Dependencies
    this.dependsOn = config.dependsOn || [];

    // Conditions
    this.condition = config.condition || null;
    this.onSuccess = config.onSuccess || null;
    this.onFailure = config.onFailure || null;

    // Retry
    this.retryConfig = {
      maxAttempts: config.retry?.maxAttempts || 1,
      delay: config.retry?.delay || 1000,
      backoff: config.retry?.backoff || 'fixed'
    };

    // Timeout
    this.timeout = config.timeout || 300000; // 5 minutes

    // State
    this.state = StepState.PENDING;
    this.attempts = 0;
    this.result = null;
    this.error = null;
    this.startedAt = null;
    this.completedAt = null;
    this.duration = null;

    // Metadata
    this.metadata = config.metadata || {};
  }

  /**
   * Check if step is ready to run
   */
  isReady(completedSteps) {
    return this.dependsOn.every(dep => completedSteps.has(dep));
  }

  /**
   * Check condition
   */
  async checkCondition(context) {
    if (!this.condition) return true;

    if (typeof this.condition === 'function') {
      return await this.condition(context);
    }

    if (typeof this.condition === 'string') {
      // Simple expression evaluation
      try {
        const fn = new Function('context', `return ${this.condition}`);
        return fn(context);
      } catch {
        return false;
      }
    }

    return !!this.condition;
  }

  /**
   * Get next step based on result
   */
  getNextStep(result, success) {
    if (success && this.onSuccess) {
      return this.onSuccess;
    }
    if (!success && this.onFailure) {
      return this.onFailure;
    }
    return null;
  }

  /**
   * Calculate retry delay
   */
  getRetryDelay() {
    if (this.retryConfig.backoff === 'exponential') {
      return this.retryConfig.delay * Math.pow(2, this.attempts - 1);
    }
    return this.retryConfig.delay;
  }

  /**
   * To JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      attempts: this.attempts,
      result: this.result,
      error: this.error,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.duration
    };
  }
}

/**
 * Workflow Definition
 */
export class Workflow {
  constructor(config) {
    this.id = config.id || `wf_${crypto.randomBytes(6).toString('hex')}`;
    this.name = config.name || 'Unnamed Workflow';
    this.description = config.description || '';
    this.version = config.version || '1.0.0';

    // Steps
    this.steps = new Map();
    this.entryPoints = config.entryPoints || [];

    // Configuration
    this.config = {
      failFast: config.failFast !== false,
      maxParallel: config.maxParallel || 10,
      timeout: config.timeout || 3600000, // 1 hour
      saveResults: config.saveResults !== false,
      ...config.config
    };

    // Variables
    this.variables = config.variables || {};

    // Metadata
    this.metadata = config.metadata || {};
    this.tags = config.tags || [];

    // Created
    this.createdAt = Date.now();
    this.updatedAt = Date.now();

    // Add steps if provided
    if (config.steps) {
      for (const step of config.steps) {
        this.addStep(step);
      }
    }
  }

  /**
   * Add a step
   */
  addStep(config) {
    const step = config instanceof WorkflowStep ? config : new WorkflowStep(config);
    this.steps.set(step.id, step);
    this.updatedAt = Date.now();
    return step;
  }

  /**
   * Get step
   */
  getStep(stepId) {
    return this.steps.get(stepId);
  }

  /**
   * Validate workflow
   */
  validate() {
    const errors = [];

    // Check entry points
    if (this.entryPoints.length === 0) {
      errors.push('No entry points defined');
    }

    for (const ep of this.entryPoints) {
      if (!this.steps.has(ep)) {
        errors.push(`Entry point not found: ${ep}`);
      }
    }

    // Check dependencies
    for (const [id, step] of this.steps) {
      for (const dep of step.dependsOn) {
        if (!this.steps.has(dep)) {
          errors.push(`Step ${id} depends on unknown step: ${dep}`);
        }
      }
    }

    // Check for cycles (simple check)
    const visited = new Set();
    const visiting = new Set();

    const checkCycle = (stepId) => {
      if (visiting.has(stepId)) {
        errors.push(`Circular dependency detected at: ${stepId}`);
        return true;
      }
      if (visited.has(stepId)) return false;

      visiting.add(stepId);
      const step = this.steps.get(stepId);
      if (step) {
        for (const dep of step.dependsOn) {
          checkCycle(dep);
        }
      }
      visiting.delete(stepId);
      visited.add(stepId);
      return false;
    };

    for (const id of this.steps.keys()) {
      checkCycle(id);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get execution order
   */
  getExecutionOrder() {
    const order = [];
    const visited = new Set();

    const visit = (stepId) => {
      if (visited.has(stepId)) return;

      const step = this.steps.get(stepId);
      if (!step) return;

      for (const dep of step.dependsOn) {
        visit(dep);
      }

      visited.add(stepId);
      order.push(stepId);
    };

    for (const ep of this.entryPoints) {
      visit(ep);
    }

    // Add any unvisited steps
    for (const id of this.steps.keys()) {
      if (!visited.has(id)) {
        visit(id);
      }
    }

    return order;
  }

  /**
   * To JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      steps: Array.from(this.steps.values()).map(s => s.toJSON()),
      entryPoints: this.entryPoints,
      config: this.config,
      tags: this.tags,
      createdAt: this.createdAt
    };
  }
}

/**
 * Workflow Execution
 */
export class WorkflowExecution extends EventEmitter {
  constructor(workflow, context = {}) {
    super();

    this.id = `exec_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    this.workflow = workflow;
    this.context = {
      ...workflow.variables,
      ...context,
      executionId: this.id,
      workflowId: workflow.id
    };

    this.state = WorkflowState.READY;
    this.results = new Map();
    this.errors = new Map();
    this.stepStates = new Map();

    this.startedAt = null;
    this.completedAt = null;
    this.duration = null;

    // Initialize step states
    for (const [id] of workflow.steps) {
      this.stepStates.set(id, StepState.PENDING);
    }
  }

  /**
   * Execute the workflow
   */
  async execute() {
    this.state = WorkflowState.RUNNING;
    this.startedAt = Date.now();

    this.emit('workflow:start', { executionId: this.id, workflow: this.workflow.id });

    try {
      // Validate workflow
      const validation = this.workflow.validate();
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }

      // Execute
      await this._execute();

      this.state = WorkflowState.COMPLETED;
      this.completedAt = Date.now();
      this.duration = this.completedAt - this.startedAt;

      this.emit('workflow:complete', {
        executionId: this.id,
        duration: this.duration,
        results: Object.fromEntries(this.results)
      });

      return {
        success: true,
        executionId: this.id,
        results: Object.fromEntries(this.results),
        duration: this.duration
      };

    } catch (error) {
      this.state = WorkflowState.FAILED;
      this.completedAt = Date.now();
      this.duration = this.completedAt - this.startedAt;

      this.emit('workflow:error', {
        executionId: this.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Internal execution
   */
  async _execute() {
    const completed = new Set();
    const running = new Map();
    const order = this.workflow.getExecutionOrder();

    while (completed.size < this.workflow.steps.size) {
      // Check for steps ready to run
      for (const stepId of order) {
        if (completed.has(stepId) || running.has(stepId)) continue;

        const step = this.workflow.steps.get(stepId);
        if (!step) continue;

        // Check if dependencies are met
        if (!step.isReady(completed)) continue;

        // Check condition
        if (!(await step.checkCondition(this.context))) {
          this.stepStates.set(stepId, StepState.SKIPPED);
          completed.add(stepId);
          this.emit('step:skip', { stepId, reason: 'condition not met' });
          continue;
        }

        // Check parallel limit
        if (running.size >= this.workflow.config.maxParallel) break;

        // Execute step
        const executionPromise = this._executeStep(step);
        running.set(stepId, executionPromise);
      }

      // Wait for any step to complete
      if (running.size > 0) {
        const [stepId, promise] = running.entries().next().value;

        try {
          const result = await promise;
          this.results.set(stepId, result);
          this.stepStates.set(stepId, StepState.COMPLETED);
          completed.add(stepId);
          running.delete(stepId);

          this.emit('step:complete', { stepId, result });

        } catch (error) {
          this.errors.set(stepId, error.message);
          this.stepStates.set(stepId, StepState.FAILED);
          running.delete(stepId);

          this.emit('step:error', { stepId, error: error.message });

          if (this.workflow.config.failFast) {
            throw new Error(`Step ${stepId} failed: ${error.message}`);
          }
        }
      }

      // Safety check - if no progress can be made
      const pendingSteps = order.filter(id => !completed.has(id) && !running.has(id));
      if (pendingSteps.length > 0 && running.size === 0) {
        // Check if any pending step can become ready
        let canProgress = false;
        for (const stepId of pendingSteps) {
          const step = this.workflow.steps.get(stepId);
          if (step && step.isReady(completed)) {
            canProgress = true;
            break;
          }
        }

        if (!canProgress) {
          // Deadlock or missing dependencies
          throw new Error('Workflow cannot progress - possible deadlock or missing dependencies');
        }
      }
    }
  }

  /**
   * Execute a single step
   */
  async _executeStep(step) {
    this.stepStates.set(step.id, StepState.RUNNING);
    step.state = StepState.RUNNING;
    step.startedAt = Date.now();
    step.attempts++;

    this.emit('step:start', { stepId: step.id, name: step.name });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Step timeout')), step.timeout);
    });

    for (let attempt = 1; attempt <= step.retryConfig.maxAttempts; attempt++) {
      try {
        const result = await Promise.race([
          this._runStepHandler(step),
          timeoutPromise
        ]);

        step.result = result;
        step.state = StepState.COMPLETED;
        step.completedAt = Date.now();
        step.duration = step.completedAt - step.startedAt;

        // Update context with result
        this.context[`${step.id}_result`] = result;

        return result;

      } catch (error) {
        step.error = error.message;

        if (attempt < step.retryConfig.maxAttempts) {
          this.stepStates.set(step.id, StepState.RETRYING);
          this.emit('step:retry', { stepId: step.id, attempt, error: error.message });

          await new Promise(resolve => setTimeout(resolve, step.getRetryDelay()));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Run step handler
   */
  async _runStepHandler(step) {
    switch (step.type) {
      case StepType.TASK:
        if (step.handler) {
          return await step.handler(this.context);
        }
        return { stepId: step.id, type: 'task', executed: true };

      case StepType.CONDITION:
        return await step.checkCondition(this.context);

      case StepType.CODE:
        if (step.config.code) {
          const fn = new Function('context', step.config.code);
          return fn(this.context);
        }
        return null;

      case StepType.HTTP:
        if (step.config.url) {
          const response = await fetch(step.config.url, {
            method: step.config.method || 'GET',
            headers: step.config.headers || {},
            body: step.config.body ? JSON.stringify(step.config.body) : undefined
          });
          return await response.json();
        }
        return null;

      case StepType.WAIT:
        const delay = step.config.delay || 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return { waited: delay };

      case StepType.AGENT:
        // Agent step - would use agentRegistry
        return { agent: step.config.agentId, task: step.config.task, executed: true };

      case StepType.MAP:
        // Map over array
        const items = step.config.items || this.context[step.config.arrayKey];
        if (Array.isArray(items)) {
          const results = [];
          for (const item of items) {
            if (step.handler) {
              results.push(await step.handler(item, this.context));
            }
          }
          return results;
        }
        return [];

      case StepType.MERGE:
        // Merge results from previous steps
        const sources = step.config.sources || [];
        const merged = {};
        for (const sourceId of sources) {
          const result = this.results.get(sourceId);
          if (result) {
            Object.assign(merged, result);
          }
        }
        return merged;

      case StepType.SWITCH:
        // Switch based on value
        const value = this.context[step.config.key];
        const cases = step.config.cases || {};
        if (cases[value]) {
          return cases[value];
        }
        return step.config.default;

      default:
        return { stepId: step.id, type: step.type, note: 'no handler' };
    }
  }

  /**
   * Pause execution
   */
  pause() {
    if (this.state === WorkflowState.RUNNING) {
      this.state = WorkflowState.PAUSED;
      this.emit('workflow:pause', { executionId: this.id });
    }
  }

  /**
   * Resume execution
   */
  resume() {
    if (this.state === WorkflowState.PAUSED) {
      this.state = WorkflowState.RUNNING;
      this.emit('workflow:resume', { executionId: this.id });
    }
  }

  /**
   * Cancel execution
   */
  cancel() {
    this.state = WorkflowState.CANCELLED;
    this.emit('workflow:cancel', { executionId: this.id });
  }

  /**
   * Get status
   */
  getStatus() {
    const stepStatuses = {};
    for (const [id, state] of this.stepStates) {
      const step = this.workflow.steps.get(id);
      stepStatuses[id] = {
        name: step?.name,
        state,
        attempts: step?.attempts || 0,
        duration: step?.duration
      };
    }

    return {
      executionId: this.id,
      workflowId: this.workflow.id,
      state: this.state,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.duration,
      stepStatuses,
      results: Object.fromEntries(this.results),
      errors: Object.fromEntries(this.errors)
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export class WorkflowManager extends EventEmitter {
  constructor() {
    super();

    this.workflows = new Map();
    this.executions = new Map();
    this.executionHistory = [];
  }

  /**
   * Create a workflow
   */
  createWorkflow(config) {
    const workflow = new Workflow(config);
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow:created', { workflowId: workflow.id });
    return workflow;
  }

  /**
   * Get a workflow
   */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows() {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute a workflow
   */
  async execute(workflowId, context = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const execution = new WorkflowExecution(workflow, context);

    // Forward events
    execution.on('workflow:start', (data) => this.emit('execution:start', data));
    execution.on('workflow:complete', (data) => this.emit('execution:complete', data));
    execution.on('workflow:error', (data) => this.emit('execution:error', data));
    execution.on('step:start', (data) => this.emit('step:start', data));
    execution.on('step:complete', (data) => this.emit('step:complete', data));
    execution.on('step:error', (data) => this.emit('step:error', data));

    this.executions.set(execution.id, execution);

    try {
      const result = await execution.execute();
      this.executionHistory.push(execution.getStatus());
      return result;
    } finally {
      this.executions.delete(execution.id);
    }
  }

  /**
   * Get execution
   */
  getExecution(executionId) {
    return this.executions.get(executionId);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 50) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get stats
   */
  getStats() {
    const workflows = Array.from(this.workflows.values());

    return {
      workflows: workflows.length,
      activeExecutions: this.executions.size,
      totalExecutions: this.executionHistory.length,
      recentExecutions: this.executionHistory.slice(-10)
    };
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(workflowId) {
    this.workflows.delete(workflowId);
    this.emit('workflow:deleted', { workflowId });
  }
}

// Export singleton
let manager = null;

export function getWorkflowManager() {
  if (!manager) {
    manager = new WorkflowManager();
  }
  return manager;
}

/**
 * Built-in workflow templates
 */
export const WorkflowTemplates = {
  /**
   * Code review workflow
   */
  codeReview: () => ({
    name: 'Code Review',
    description: 'Automated code review with multiple agents',
    steps: [
      { id: 'analyze', type: StepType.TASK, name: 'Analyze Code', handler: async (ctx) => ({ issues: [], suggestions: [] }) },
      { id: 'security', type: StepType.TASK, name: 'Security Check', dependsOn: ['analyze'], handler: async (ctx) => ({ vulnerabilities: [] }) },
      { id: 'performance', type: StepType.TASK, name: 'Performance Check', dependsOn: ['analyze'], handler: async (ctx) => ({ bottlenecks: [] }) },
      { id: 'report', type: StepType.TASK, name: 'Generate Report', dependsOn: ['security', 'performance'], handler: async (ctx) => ({ report: 'complete' }) }
    ]
  }),

  /**
   * Data pipeline workflow
   */
  dataPipeline: () => ({
    name: 'Data Pipeline',
    description: 'ETL data processing pipeline',
    steps: [
      { id: 'extract', type: StepType.TASK, name: 'Extract Data', handler: async (ctx) => ({ records: [] }) },
      { id: 'validate', type: StepType.TASK, name: 'Validate', dependsOn: ['extract'], handler: async (ctx) => ({ valid: true }) },
      { id: 'transform', type: StepType.TASK, name: 'Transform', dependsOn: ['validate'], handler: async (ctx) => ({ transformed: true }) },
      { id: 'load', type: StepType.TASK, name: 'Load Data', dependsOn: ['transform'], handler: async (ctx) => ({ loaded: true }) }
    ]
  }),

  /**
   * Multi-agent research workflow
   */
  research: () => ({
    name: 'Multi-Agent Research',
    description: 'Parallel research with synthesis',
    steps: [
      { id: 'topic1', type: StepType.TASK, name: 'Research Topic 1', handler: async (ctx) => ({ findings: 'topic1' }) },
      { id: 'topic2', type: StepType.TASK, name: 'Research Topic 2', handler: async (ctx) => ({ findings: 'topic2' }) },
      { id: 'topic3', type: StepType.TASK, name: 'Research Topic 3', handler: async (ctx) => ({ findings: 'topic3' }) },
      { id: 'synthesize', type: StepType.TASK, name: 'Synthesize', dependsOn: ['topic1', 'topic2', 'topic3'], handler: async (ctx) => ({ summary: 'synthesized' }) }
    ]
  }),

  /**
   * CI/CD pipeline workflow
   */
  cicd: () => ({
    name: 'CI/CD Pipeline',
    description: 'Build, test, deploy pipeline',
    steps: [
      { id: 'lint', type: StepType.TASK, name: 'Lint', handler: async (ctx) => ({ passed: true }) },
      { id: 'build', type: StepType.TASK, name: 'Build', dependsOn: ['lint'], handler: async (ctx) => ({ artifact: 'build.zip' }) },
      { id: 'test', type: StepType.TASK, name: 'Test', dependsOn: ['build'], handler: async (ctx) => ({ passed: true }) },
      { id: 'deploy', type: StepType.TASK, name: 'Deploy', dependsOn: ['test'], handler: async (ctx) => ({ deployed: true }) }
    ]
  }),

  /**
   * Content creation workflow
   */
  contentCreation: () => ({
    name: 'Content Creation',
    description: 'Research, write, review, publish',
    steps: [
      { id: 'research', type: StepType.TASK, name: 'Research', handler: async (ctx) => ({ sources: [] }) },
      { id: 'outline', type: StepType.TASK, name: 'Create Outline', dependsOn: ['research'], handler: async (ctx) => ({ outline: 'structured' }) },
      { id: 'write', type: StepType.TASK, name: 'Write Draft', dependsOn: ['outline'], handler: async (ctx) => ({ draft: 'complete' }) },
      { id: 'review', type: StepType.TASK, name: 'Review', dependsOn: ['write'], handler: async (ctx) => ({ approved: true }) },
      { id: 'publish', type: StepType.TASK, name: 'Publish', dependsOn: ['review'], handler: async (ctx) => ({ published: true }) }
    ]
  }),

  /**
   * Incident response workflow
   */
  incidentResponse: () => ({
    name: 'Incident Response',
    description: 'Detect, analyze, contain, resolve',
    steps: [
      { id: 'detect', type: StepType.TASK, name: 'Detect Issue', handler: async (ctx) => ({ detected: true }) },
      { id: 'analyze', type: StepType.TASK, name: 'Analyze Impact', dependsOn: ['detect'], handler: async (ctx) => ({ impact: 'medium' }) },
      { id: 'contain', type: StepType.TASK, name: 'Contain', dependsOn: ['analyze'], handler: async (ctx) => ({ contained: true }) },
      { id: 'resolve', type: StepType.TASK, name: 'Resolve', dependsOn: ['contain'], handler: async (ctx) => ({ resolved: true }) },
      { id: 'report', type: StepType.TASK, name: 'Post-Mortem', dependsOn: ['resolve'], handler: async (ctx) => ({ report: 'complete' }) }
    ]
  })
};

export default {
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  WorkflowManager,
  WorkflowState,
  StepState,
  StepType,
  WorkflowTemplates,
  getWorkflowManager
};