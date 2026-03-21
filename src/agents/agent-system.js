#!/usr/bin/env node

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE AGENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} AgentCapability
 * @property {string} name - Capability name
 * @property {string} description - What this capability does
 * @property {string[]} tools - Tools required for this capability
 * @property {function} execute - Execution function
 */

/**
 * @typedef {Object} AgentConfig
 * @property {string} id - Unique agent identifier
 * @property {string} name - Agent display name
 * @property {string} icon - Agent emoji icon
 * @property {string} color - Agent theme color
 * @property {string} role - Agent role/purpose
 * @property {string} model - Default AI model
 * @property {string[]} capabilities - List of capability names
 * @property {Object} [config] - Additional configuration
 */

/**
 * Agent states
 */
export const AgentState = {
  INITIALIZING: 'INITIALIZING',
  IDLE: 'IDLE',
  WORKING: 'WORKING',
  BUSY: 'BUSY',
  ERROR: 'ERROR',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE'
};

/**
 * Message priority levels
 */
export const MessagePriority = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3
};

/**
 * Core Agent class
 */
export class Agent extends EventEmitter {
  constructor(config) {
    super();

    this.id = config.id || `agent_${crypto.randomBytes(8).toString('hex')}`;
    this.name = config.name;
    this.icon = config.icon || '🤖';
    this.color = config.color || '#9333EA';
    this.role = config.role || 'Assistant';
    this.model = config.model || 'auto';
    this.description = config.description || '';

    // State management
    this.state = AgentState.INITIALIZING;
    this.previousState = null;

    // Capabilities
    this.capabilities = new Map();
    this.tools = new Set(config.tools || ['file', 'bash', 'web', 'search']);

    // Task tracking
    this.currentTask = null;
    this.taskQueue = [];
    this.taskHistory = [];

    // Statistics
    this.stats = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalRuntime: 0,
      xp: 0,
      level: 1,
      lastActive: null,
      createdAt: Date.now()
    };

    // Health monitoring
    this.health = {
      status: 'healthy',
      lastCheck: Date.now(),
      consecutiveErrors: 0,
      errorHistory: []
    };

    // Message queue for inter-agent communication
    this.messageQueue = [];
    this.subscriptions = new Set();

    // Configuration
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 1,
      taskTimeout: config.taskTimeout || 120000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      ...config.config
    };

    // Initialize
    this._initialize();
  }

  /**
   * Initialize the agent
   */
  async _initialize() {
    try {
      // Register default capabilities
      this._registerDefaultCapabilities();

      // Set state to idle
      this.setState(AgentState.IDLE);

      this.emit('initialized', { agent: this.id });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Register default capabilities
   */
  _registerDefaultCapabilities() {
    // Thinking capability
    this.registerCapability({
      name: 'thinking',
      description: 'Analyze and reason about problems',
      tools: [],
      execute: async (task, context) => {
        return { analysis: 'Thinking process completed', context };
      }
    });

    // Task execution capability
    this.registerCapability({
      name: 'execute',
      description: 'Execute assigned tasks',
      tools: ['bash', 'file'],
      execute: async (task, context) => {
        return { result: 'Task executed', task };
      }
    });

    // Communication capability
    this.registerCapability({
      name: 'communicate',
      description: 'Communicate with other agents or users',
      tools: [],
      execute: async (message, context) => {
        return { sent: true, message };
      }
    });
  }

  /**
   * Register a capability
   */
  registerCapability(capability) {
    if (!capability.name || !capability.execute) {
      throw new Error('Capability must have name and execute function');
    }

    this.capabilities.set(capability.name, {
      name: capability.name,
      description: capability.description || '',
      tools: capability.tools || [],
      execute: capability.execute
    });

    this.emit('capability:registered', { agent: this.id, capability: capability.name });
  }

  /**
   * Set agent state
   */
  setState(newState) {
    if (this.state === newState) return;

    const oldState = this.state;
    this.previousState = oldState;
    this.state = newState;

    this.emit('state:changed', {
      agent: this.id,
      from: oldState,
      to: newState,
      timestamp: Date.now()
    });
  }

  /**
   * Execute a task
   */
  async execute(task, context = {}) {
    const startTime = Date.now();

    // Check if agent can accept task
    if (!this.canAcceptTask()) {
      throw new Error(`Agent ${this.name} cannot accept task in state ${this.state}`);
    }

    // Set state to working
    this.setState(AgentState.WORKING);
    this.currentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: typeof task === 'string' ? task : task.description,
      context,
      startTime,
      attempts: 0
    };

    this.emit('task:started', { agent: this.id, task: this.currentTask });

    let lastError = null;

    // Retry loop
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      this.currentTask.attempts = attempt;

      try {
        // Execute with timeout
        const result = await this._executeWithTimeout(task, context);

        // Task succeeded
        const duration = Date.now() - startTime;
        this._completeTask(true, result, duration);

        return result;
      } catch (error) {
        lastError = error;
        this._recordError(error);

        // Wait before retry (except on last attempt)
        if (attempt < this.config.retryAttempts) {
          await this._sleep(this.config.retryDelay * attempt);
        }
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    this._completeTask(false, null, duration, lastError);
    throw lastError;
  }

  /**
   * Execute task with timeout
   */
  async _executeWithTimeout(task, context) {
    return Promise.race([
      this._executeInternal(task, context),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout)
      )
    ]);
  }

  /**
   * Internal execution logic
   */
  async _executeInternal(task, context) {
    // Determine which capability to use
    const capabilityName = context.capability || 'execute';
    const capability = this.capabilities.get(capabilityName);

    if (!capability) {
      throw new Error(`Capability '${capabilityName}' not found`);
    }

    // Check required tools are available
    for (const tool of capability.tools) {
      if (!this.tools.has(tool)) {
        throw new Error(`Required tool '${tool}' not available`);
      }
    }

    // Execute the capability
    const result = await capability.execute(task, {
      ...context,
      agent: this,
      model: this.model
    });

    return result;
  }

  /**
   * Complete a task
   */
  _completeTask(success, result, duration, error = null) {
    const taskRecord = {
      ...this.currentTask,
      success,
      result,
      duration,
      error: error ? error.message : null,
      completedAt: Date.now()
    };

    this.taskHistory.push(taskRecord);

    // Update statistics
    if (success) {
      this.stats.tasksCompleted += 1;
      this.stats.xp += this._calculateXP(duration);
      this._checkLevelUp();
    } else {
      this.stats.tasksFailed += 1;
    }

    this.stats.totalRuntime += duration;
    this.stats.lastActive = Date.now();

    // Clear current task
    this.currentTask = null;

    // Set state back to idle (or handle queued tasks)
    if (this.taskQueue.length > 0) {
      this._processQueue();
    } else {
      this.setState(AgentState.IDLE);
    }

    this.emit('task:completed', {
      agent: this.id,
      task: taskRecord,
      success
    });
  }

  /**
   * Calculate XP for a task
   */
  _calculateXP(duration) {
    // Base XP, reduced for longer tasks
    const baseXP = 10;
    const timeBonus = Math.max(0, 50 - (duration / 1000));
    return Math.round(baseXP + timeBonus);
  }

  /**
   * Check if agent should level up
   */
  _checkLevelUp() {
    const xpNeeded = this.stats.level * 100;
    if (this.stats.xp >= xpNeeded) {
      this.stats.level += 1;
      this.stats.xp -= xpNeeded;
      this.emit('level:up', { agent: this.id, level: this.stats.level });
    }
  }

  /**
   * Record an error
   */
  _recordError(error) {
    this.health.consecutiveErrors += 1;
    this.health.errorHistory.push({
      error: error.message,
      timestamp: Date.now()
    });

    // Keep only last 50 errors
    if (this.health.errorHistory.length > 50) {
      this.health.errorHistory = this.health.errorHistory.slice(-50);
    }

    // Update health status
    if (this.health.consecutiveErrors >= 5) {
      this.health.status = 'unhealthy';
      this.setState(AgentState.ERROR);
    }
  }

  /**
   * Handle an error
   */
  handleError(error) {
    this._recordError(error);
    this.emit('error', { agent: this.id, error: error.message });
  }

  /**
   * Check if agent can accept a task
   */
  canAcceptTask() {
    return this.state === AgentState.IDLE || this.state === AgentState.BUSY;
  }

  /**
   * Queue a task for later execution
   */
  queueTask(task, context = {}) {
    const queueItem = {
      id: `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      task,
      context,
      queuedAt: Date.now()
    };

    this.taskQueue.push(queueItem);
    this.emit('task:queued', { agent: this.id, task: queueItem });

    return queueItem.id;
  }

  /**
   * Process queued tasks
   */
  async _processQueue() {
    if (this.taskQueue.length === 0) return;

    const item = this.taskQueue.shift();
    try {
      await this.execute(item.task, item.context);
    } catch (error) {
      // Error already handled by execute
    }
  }

  /**
   * Send a message to another agent or channel
   */
  async sendMessage(to, message, priority = MessagePriority.NORMAL) {
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: this.id,
      to,
      content: message,
      priority,
      timestamp: Date.now()
    };

    this.emit('message:sent', msg);
    return msg;
  }

  /**
   * Receive a message
   */
  async receiveMessage(message) {
    this.messageQueue.push(message);
    this.emit('message:received', message);

    // Process based on message type
    if (message.type === 'task') {
      return this.execute(message.content, message.context);
    }

    return { received: true, messageId: message.id };
  }

  /**
   * Subscribe to an event/topic
   */
  subscribe(topic) {
    this.subscriptions.add(topic);
    this.emit('subscribed', { agent: this.id, topic });
  }

  /**
   * Unsubscribe from an event/topic
   */
  unsubscribe(topic) {
    this.subscriptions.delete(topic);
    this.emit('unsubscribed', { agent: this.id, topic });
  }

  /**
   * Perform health check
   */
  healthCheck() {
    const now = Date.now();
    this.health.lastCheck = now;

    // Reset consecutive errors if enough time has passed
    if (this.health.consecutiveErrors > 0) {
      const lastError = this.health.errorHistory[this.health.errorHistory.length - 1];
      if (lastError && (now - lastError.timestamp) > 300000) {
        this.health.consecutiveErrors = 0;
        this.health.status = 'healthy';
        if (this.state === AgentState.ERROR) {
          this.setState(AgentState.IDLE);
        }
      }
    }

    return {
      agent: this.id,
      state: this.state,
      health: this.health,
      stats: this.stats,
      queueLength: this.taskQueue.length
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      color: this.color,
      role: this.role,
      model: this.model,
      state: this.state,
      currentTask: this.currentTask,
      stats: this.stats,
      health: this.health,
      capabilities: Array.from(this.capabilities.keys()),
      tools: Array.from(this.tools)
    };
  }

  /**
   * Stop the agent
   */
  async stop() {
    this.setState(AgentState.OFFLINE);
    this.emit('stopped', { agent: this.id });
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT REGISTRY - Manages all agents
// ═══════════════════════════════════════════════════════════════════════════

export class AgentRegistry extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.groups = new Map();
  }

  /**
   * Register an agent
   */
  register(agent) {
    if (!(agent instanceof Agent)) {
      throw new Error('Must be an Agent instance');
    }

    this.agents.set(agent.id, agent);

    // Forward agent events
    agent.on('state:changed', (data) => this.emit('agent:state', data));
    agent.on('task:started', (data) => this.emit('agent:task', data));
    agent.on('task:completed', (data) => this.emit('agent:task', data));
    agent.on('error', (data) => this.emit('agent:error', data));

    this.emit('agent:registered', { agent: agent.id });
    return this;
  }

  /**
   * Unregister an agent
   */
  unregister(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.stop();
      this.agents.delete(agentId);
      this.emit('agent:unregistered', { agent: agentId });
    }
  }

  /**
   * Get an agent by ID
   */
  get(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAll() {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by state
   */
  getByState(state) {
    return this.getAll().filter(agent => agent.state === state);
  }

  /**
   * Get available agents (idle)
   */
  getAvailable() {
    return this.getByState(AgentState.IDLE);
  }

  /**
   * Get agents by capability
   */
  getByCapability(capability) {
    return this.getAll().filter(agent => agent.capabilities.has(capability));
  }

  /**
   * Get agents by role
   */
  getByRole(role) {
    return this.getAll().filter(agent => agent.role === role);
  }

  /**
   * Create a group of agents
   */
  createGroup(name, agentIds) {
    const group = {
      name,
      agents: new Set(agentIds),
      createdAt: Date.now()
    };
    this.groups.set(name, group);
    return group;
  }

  /**
   * Get group members
   */
  getGroup(name) {
    const group = this.groups.get(name);
    if (!group) return [];

    return Array.from(group.agents)
      .map(id => this.agents.get(id))
      .filter(Boolean);
  }

  /**
   * Assign task to best available agent
   */
  async assignTask(task, options = {}) {
    const { capability, role, preferredAgent } = options;

    let agent;

    // Try preferred agent first
    if (preferredAgent) {
      agent = this.agents.get(preferredAgent);
      if (agent && !agent.canAcceptTask()) {
        agent = null;
      }
    }

    // Find agent by capability
    if (!agent && capability) {
      const capable = this.getByCapability(capability).filter(a => a.canAcceptTask());
      if (capable.length > 0) {
        agent = capable[0];
      }
    }

    // Find agent by role
    if (!agent && role) {
      const byRole = this.getByRole(role).filter(a => a.canAcceptTask());
      if (byRole.length > 0) {
        agent = byRole[0];
      }
    }

    // Fall back to any available agent
    if (!agent) {
      const available = this.getAvailable();
      if (available.length > 0) {
        agent = available[0];
      }
    }

    if (!agent) {
      throw new Error('No available agents to handle task');
    }

    return agent.execute(task);
  }

  /**
   * Broadcast to all agents
   */
  broadcast(message) {
    const results = [];
    for (const agent of this.agents.values()) {
      results.push(agent.receiveMessage(message));
    }
    return Promise.all(results);
  }

  /**
   * Get registry status
   */
  getStatus() {
    const agents = this.getAll();

    return {
      total: agents.length,
      byState: {
        idle: agents.filter(a => a.state === AgentState.IDLE).length,
        working: agents.filter(a => a.state === AgentState.WORKING).length,
        busy: agents.filter(a => a.state === AgentState.BUSY).length,
        error: agents.filter(a => a.state === AgentState.ERROR).length,
        offline: agents.filter(a => a.state === AgentState.OFFLINE).length
      },
      groups: this.groups.size,
      agents: agents.map(a => a.getStatus())
    };
  }

  /**
   * Perform health check on all agents
   */
  healthCheck() {
    const results = [];
    for (const agent of this.agents.values()) {
      results.push(agent.healthCheck());
    }
    return results;
  }
}

// Export singleton
let registry = null;

export function getAgentRegistry() {
  if (!registry) {
    registry = new AgentRegistry();
  }
  return registry;
}

export default {
  Agent,
  AgentRegistry,
  AgentState,
  MessagePriority,
  getAgentRegistry
};