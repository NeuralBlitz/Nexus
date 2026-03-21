import { EventEmitter } from 'events';
import crypto from 'crypto';

export class WorkflowStep {
  constructor(config) {
    this.id = config.id || `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = config.type;
    this.name = config.name || config.type;
    this.config = config.config || {};
    this.input = config.input || {};
    this.output = null;
    this.status = 'pending';
    this.error = null;
    this.startedAt = null;
    this.completedAt = null;
    this.retryCount = 0;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 60000;
    this.conditions = config.conditions || [];
    this.next = config.next || null;
    this.onError = config.onError || null;
  }

  async execute(context) {
    this.status = 'running';
    this.startedAt = Date.now();

    try {
      const result = await this.run(context);
      this.output = result;
      this.status = 'completed';
      this.completedAt = Date.now();
      return result;
    } catch (error) {
      this.error = error.message;
      this.status = 'failed';

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.status = 'retrying';
        const delay = Math.pow(2, this.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.execute(context);
      }

      this.completedAt = Date.now();
      throw error;
    }
  }

  async run(context) {
    throw new Error('Step run() must be implemented');
  }

  shouldContinue(context) {
    if (this.conditions.length === 0) return true;

    for (const condition of this.conditions) {
      const value = this.getNestedValue(context.data, condition.field);

      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'notEquals':
          if (value === condition.value) return false;
          break;
        case 'contains':
          if (!String(value).includes(condition.value)) return false;
          break;
        case 'exists':
          if (condition.value && !value) return false;
          if (!condition.value && value) return false;
          break;
        case 'gt':
          if (!(value > condition.value)) return false;
          break;
        case 'lt':
          if (!(value < condition.value)) return false;
          break;
      }
    }

    return true;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getDuration() {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt - this.startedAt;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
      error: this.error,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.getDuration(),
      retryCount: this.retryCount
    };
  }
}

export class Workflow {
  constructor(config) {
    this.id = config.id || `workflow_${Date.now()}`;
    this.name = config.name;
    this.description = config.description;
    this.version = config.version || '1.0';
    this.steps = [];
    this.context = {};
    this.status = 'idle';
    this.currentStepIndex = -1;
    this.startedAt = null;
    this.completedAt = null;
    this.error = null;
    this.history = [];
    this.onComplete = config.onComplete;
    this.onError = config.onError;
  }

  addStep(step) {
    this.steps.push(step);
    return this;
  }

  addSteps(...steps) {
    for (const step of steps) {
      this.steps.push(step);
    }
    return this;
  }

  async execute(initialContext = {}) {
    this.context = { ...initialContext, workflow: { id: this.id, name: this.name } };
    this.status = 'running';
    this.startedAt = Date.now();
    this.currentStepIndex = -1;

    try {
      for (let i = 0; i < this.steps.length; i++) {
        this.currentStepIndex = i;
        const step = this.steps[i];

        if (!step.shouldContinue(this.context)) {
          step.status = 'skipped';
          continue;
        }

        const input = this.resolveInput(step.input);
        const result = await step.execute({ ...this.context, input });

        this.context[step.id] = result;
        this.context.data = { ...this.context.data, ...result };

        this.history.push({ step: step.id, status: 'success', duration: step.getDuration() });
      }

      this.status = 'completed';
      this.completedAt = Date.now();

      if (this.onComplete) {
        await this.onComplete(this.context);
      }
    } catch (error) {
      this.error = error.message;
      this.status = 'failed';
      this.completedAt = Date.now();

      if (this.onError) {
        await this.onError(error, this.context);
      }
    }

    return {
      status: this.status,
      context: this.context,
      error: this.error,
      duration: this.completedAt - this.startedAt
    };
  }

  resolveInput(input) {
    if (typeof input === 'string') {
      return this.getNestedValue(this.context, input);
    }
    if (typeof input === 'object' && input !== null) {
      const resolved = {};
      for (const [key, value] of Object.entries(input)) {
        resolved[key] = this.resolveInput(value);
      }
      return resolved;
    }
    return input;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getCurrentStep() {
    return this.steps[this.currentStepIndex];
  }

  getHistory() {
    return this.history;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.completedAt - this.startedAt,
      steps: this.steps.map(s => s.toJSON()),
      error: this.error
    };
  }
}

export class WorkflowBuilder {
  constructor(name) {
    this.workflow = new Workflow({ name });
  }

  description(text) {
    this.workflow.description = text;
    return this;
  }

  step(type, config = {}) {
    const step = new WorkflowStep({ type, ...config });
    this.workflow.addStep(step);
    return this;
  }

  condition(config) {
    const lastStep = this.workflow.steps[this.workflow.steps.length - 1];
    if (lastStep) {
      lastStep.conditions.push(config);
    }
    return this;
  }

  timeout(ms) {
    const lastStep = this.workflow.steps[this.workflow.steps.length - 1];
    if (lastStep) {
      lastStep.timeout = ms;
    }
    return this;
  }

  retries(count) {
    const lastStep = this.workflow.steps[this.workflow.steps.length - 1];
    if (lastStep) {
      lastStep.maxRetries = count;
    }
    return this;
  }

  onComplete(fn) {
    this.workflow.onComplete = fn;
    return this;
  }

  onError(fn) {
    this.workflow.onError = fn;
    return this;
  }

  build() {
    return this.workflow;
  }
}

export class WorkflowEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.workflows = new Map();
    this.running = new Map();
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
  }

  register(workflow) {
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow:registered', workflow);
  }

  async run(workflowId, context = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const instance = new Workflow({ ...workflow, id: `${workflow.id}_${Date.now()}` });
    this.running.set(instance.id, instance);

    this.emit('workflow:started', instance);

    try {
      const result = await instance.execute(context);
      this.running.delete(instance.id);

      this.history.push(instance);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      this.emit('workflow:completed', result);
      return result;
    } catch (error) {
      this.running.delete(instance.id);
      this.emit('workflow:error', { workflow: instance.id, error: error.message });
      throw error;
    }
  }

  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  listWorkflows() {
    return Array.from(this.workflows.values()).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      version: w.version,
      steps: w.steps.length
    }));
  }

  getRunning() {
    return Array.from(this.running.values()).map(w => w.toJSON());
  }

  getStats() {
    return {
      totalWorkflows: this.workflows.size,
      running: this.running.size,
      history: this.history.length
    };
  }
}

let workflowEngine = null;

export function getWorkflowEngine(options = {}) {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine(options);
  }
  return workflowEngine;
}

export default { WorkflowEngine, Workflow, WorkflowStep, WorkflowBuilder, getWorkflowEngine };
