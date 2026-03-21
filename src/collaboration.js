/**
 * NEXUS AI Platform - Agent Collaboration System
 * 
 * Provides primitives for multi-agent coordination:
 * - Parallel task execution across agents
 * - Task delegation between agents
 * - Sequential task chaining
 * - Result aggregation
 */

/**
 * @typedef {Object} Agent
 * @property {string} id - Unique agent identifier
 * @property {string} name - Agent name
 * @property {function} execute - Executes a task and returns result
 */

/**
 * @typedef {Object} TaskResult
 * @property {string} agentId - Agent that executed the task
 * @property {string} task - The task description
 * @property {any} output - Agent output
 * @property {number} timestamp - Execution timestamp
 * @property {number} duration - Execution duration in ms
 */

/**
 * @typedef {function} TaskFunction
 * @param {any} [previousResult] - Result from previous task in chain
 * @returns {Promise<Object>|Object} - Object with { agent, task } properties
 */

/**
 * Run task on multiple agents in parallel
 * @param {Agent[]} agents - Array of agent objects
 * @param {string} task - Task description
 * @param {Object} [options] - Execution options
 * @param {number} [options.timeout=30000] - Timeout per agent in ms
 * @returns {Promise<TaskResult[]>} - Array of results from each agent
 */
export async function Collaborate(agents, task, options = {}) {
  const timeout = options.timeout || 30000;
  
  const promises = agents.map(async (agent) => {
    const startTime = Date.now();
    
    try {
      // Wrap execution with timeout
      const result = await Promise.race([
        agent.execute(task),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      
      return {
        agentId: agent.id,
        task,
        output: result,
        timestamp: startTime,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      return {
        agentId: agent.id,
        task,
        output: null,
        error: error.message,
        timestamp: startTime,
        duration: Date.now() - startTime,
        status: 'error'
      };
    }
  });
  
  return Promise.all(promises);
}

/**
 * Delegate a task from one agent to another
 * @param {Agent} fromAgent - Agent delegating the task
 * @param {Agent} toAgent - Agent receiving the task
 * @param {string} task - Task to delegate
 * @param {Object} [context] - Additional context for delegation
 * @returns {Promise<TaskResult>} - Result from delegated execution
 */
export async function Delegate(fromAgent, toAgent, task, context = {}) {
  // Optionally enhance task with delegation context
  const delegatedTask = context.includeDelegationInfo
    ? `[Delegated by ${fromAgent.name}]: ${task}`
    : task;
  
  const startTime = Date.now();
  
  try {
    const result = await toAgent.execute(delegatedTask);
    
    return {
      fromAgent: fromAgent.id,
      toAgent: toAgent.id,
      task: delegatedTask,
      output: result,
      timestamp: startTime,
      duration: Date.now() - startTime,
      status: 'success'
    };
  } catch (error) {
    return {
      fromAgent: fromAgent.id,
      toAgent: toAgent.id,
      task: delegatedTask,
      output: null,
      error: error.message,
      timestamp: startTime,
      duration: Date.now() - startTime,
      status: 'error'
    };
  }
}

/**
 * Run sequential chain of tasks where output feeds into next
 * @param {Array<Object|TaskFunction>} tasks - Array of task definitions or functions
 * @param {any} [initialInput] - Optional initial input to first task
 * @returns {Promise<Object>} - Chain execution results
 */
export async function Chain(tasks, initialInput = null) {
  const results = [];
  let previousResult = initialInput;
  
  for (let i = 0; i < tasks.length; i++) {
    const taskItem = tasks[i];
    const startTime = Date.now();
    
    try {
      let agent, taskDescription;
      
      // Support both object and function task definitions
      if (typeof taskItem === 'function') {
        // Function returns { agent, task } or just task string (uses previous agent?)
        const computed = await Promise.resolve(taskItem(previousResult));
        if (typeof computed === 'string') {
          // Assume same agent as previous step, or we need a default agent
          // For simplicity, we'll require explicit agent in function
          throw new Error('Chain function must return { agent, task } object');
        }
        agent = computed.agent;
        taskDescription = computed.task;
      } else {
        // Object with agent and task
        agent = taskItem.agent;
        taskDescription = typeof taskItem.task === 'function' 
          ? await Promise.resolve(taskItem.task(previousResult))
          : taskItem.task;
      }
      
      if (!agent || !taskDescription) {
        throw new Error('Each chain step must specify agent and task');
      }
      
      // Execute the task on the specified agent
      const result = await agent.execute(taskDescription);
      
      results.push({
        step: i + 1,
        task: taskDescription,
        agentId: agent.id,
        output: result,
        timestamp: startTime,
        duration: Date.now() - startTime,
        status: 'success'
      });
      
      previousResult = result;
    } catch (error) {
      results.push({
        step: i + 1,
        error: error.message,
        timestamp: startTime,
        duration: Date.now() - startTime,
        status: 'error'
      });
      
      // Chain continues on error by default, but we could break here
      // Set options to control this behavior
      break;
    }
  }
  
  return {
    chainLength: tasks.length,
    completedSteps: results.filter(r => r.status === 'success').length,
    results,
    finalOutput: previousResult
  };
}

/**
 * Aggregate results from multiple agents
 * @param {TaskResult[]} results - Array of agent results
 * @param {Object} [strategy] - Aggregation strategy
 * @returns {Object} - Aggregated result
 */
export function Aggregate(results, strategy = {}) {
  const {
    method = 'concat', // 'concat', 'first', 'last', 'best', 'voting', 'custom'
    customAggregator = null,
    filterErrors = true,
    sortBy = 'timestamp' // 'timestamp', 'duration', 'agentId'
  } = strategy;
  
  // Filter out errors if requested
  let validResults = results;
  if (filterErrors) {
    validResults = results.filter(r => r.status === 'success' && r.output != null);
  }
  
  // Sort results
  if (sortBy) {
    validResults.sort((a, b) => {
      if (sortBy === 'duration') return a.duration - b.duration;
      if (sortBy === 'agentId') return a.agentId.localeCompare(b.agentId);
      return a.timestamp - b.timestamp;
    });
  }
  
  // Apply aggregation method
  switch (method) {
    case 'first':
      return {
        aggregated: validResults[0]?.output,
        selected: validResults[0],
        method,
        totalResults: results.length,
        validResults: validResults.length
      };
      
    case 'last':
      return {
        aggregated: validResults[validResults.length - 1]?.output,
        selected: validResults[validResults.length - 1],
        method,
        totalResults: results.length,
        validResults: validResults.length
      };
      
    case 'best':
      // Select result with shortest duration
      const best = validResults.reduce((best, current) => 
        current.duration < best.duration ? current : best
      , validResults[0]);
      return {
        aggregated: best?.output,
        selected: best,
        method,
        totalResults: results.length,
        validResults: validResults.length
      };
      
    case 'voting':
      // Simple voting: return most common output (works for strings)
      const outputMap = new Map();
      validResults.forEach(r => {
        const key = JSON.stringify(r.output);
        outputMap.set(key, (outputMap.get(key) || 0) + 1);
      });
      
      let maxVotes = 0;
      let winningOutput = null;
      outputMap.forEach((votes, key) => {
        if (votes > maxVotes) {
          maxVotes = votes;
          winningOutput = JSON.parse(key);
        }
      });
      
      return {
        aggregated: winningOutput,
        votes: maxVotes,
        method,
        totalResults: results.length,
        validResults: validResults.length
      };
      
    case 'custom':
      if (typeof customAggregator !== 'function') {
        throw new Error('Custom aggregator function required');
      }
      return customAggregator(validResults);
      
    case 'concat':
    default:
      // Concatenate all outputs
      const concatenated = validResults
        .map(r => `[${r.agentId}]: ${r.output}`)
        .join('\n\n');
      
      return {
        aggregated: concatenated,
        individualResults: validResults.map(r => ({
          agent: r.agentId,
          output: r.output,
          duration: r.duration
        })),
        method,
        totalResults: results.length,
        validResults: validResults.length
      };
  }
}

/**
 * Factory function to create a collaboration-ready agent
 * @param {Object} config - Agent configuration
 * @returns {Agent} - Agent object with execute method
 */
export function createAgent(config) {
  if (!config.id || !config.name || !config.execute) {
    throw new Error('Agent must have id, name, and execute function');
  }
  
  return {
    id: config.id,
    name: config.name,
    icon: config.icon || '🤖',
    role: config.role || 'Assistant',
    execute: config.execute,
    
    // Convenience method for delegation
    delegate: function(toAgent, task, context) {
      return Delegate(this, toAgent, task, context);
    }
  };
}

/**
 * Example usage (commented out):
 * 
 * // Create agents
 * const agent1 = createAgent({
 *   id: 'agent1',
 *   name: 'Researcher',
 *   execute: async (task) => {
 *     // Implementation using your AI provider
 *     return `Research result for: ${task}`;
 *   }
 * });
 * 
 * const agent2 = createAgent({
 *   id: 'agent2', 
 *   name: 'Coder',
 *   execute: async (task) => {
 *     return `Code result for: ${task}`;
 *   }
 * });
 * 
 * // Parallel execution
 * const results = await Collaborate([agent1, agent2], 'Analyze codebase');
 * 
 * // Delegation
 * const result = await Delegate(agent1, agent2, 'Optimize algorithm');
 * 
 * // Chaining
 * const chainResults = await Chain([
 *   (prev) => ({ agent: agent1, task: 'Research AI trends' }),
 *   (prev) => ({ agent: agent2, task: `Summarize: ${prev}` })
 * ]);
 * 
 * // Aggregation
 * const aggregated = Aggregate(results, { method: 'voting' });
 */

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED WORKFLOW ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} WorkflowStep
 * @property {string} id - Unique step identifier
 * @property {Agent} agent - Agent to execute this step
 * @property {string|function} task - Task description or function
 * @property {string[]} dependencies - Step IDs that must complete first
 * @property {function} [condition] - Optional condition function
 * @property {Object} [retry] - Retry configuration
 * @property {number} [retry.attempts=3] - Number of retry attempts
 * @property {number} [retry.delay=1000] - Delay between retries in ms
 * @property {function} [onError] - Error handler function
 */

/**
 * @typedef {Object} WorkflowConfig
 * @property {string} name - Workflow name
 * @property {WorkflowStep[]} steps - Array of workflow steps
 * @property {Object} [context] - Initial context
 * @property {boolean} [failFast=false] - Stop on first error
 * @property {number} [timeout=300000] - Total workflow timeout in ms
 */

/**
 * Advanced Workflow Orchestrator
 * Manages complex multi-agent workflows with dependencies, conditions, and retry logic
 */
export class WorkflowOrchestrator {
  constructor(config = {}) {
    this.config = config;
    this.steps = new Map();
    this.results = new Map();
    this.errors = new Map();
    this.executionOrder = [];
    this.status = 'pending';
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Add a step to the workflow
   */
  addStep(step) {
    if (!step.id) {
      step.id = `step_${this.steps.size + 1}`;
    }
    this.steps.set(step.id, step);
    return this;
  }

  /**
   * Add multiple steps
   */
  addSteps(steps) {
    steps.forEach(step => this.addStep(step));
    return this;
  }

  /**
   * Build dependency graph and determine execution order
   */
  buildExecutionOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (stepId) => {
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected involving step: ${stepId}`);
      }
      if (visited.has(stepId)) {
        return;
      }

      visiting.add(stepId);
      const step = this.steps.get(stepId);

      if (step && step.dependencies) {
        for (const depId of step.dependencies) {
          if (!this.steps.has(depId)) {
            throw new Error(`Unknown dependency: ${depId} for step: ${stepId}`);
          }
          visit(depId);
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      order.push(stepId);
    };

    for (const stepId of this.steps.keys()) {
      visit(stepId);
    }

    this.executionOrder = order;
    return order;
  }

  /**
   * Check if a step's dependencies are satisfied
   */
  dependenciesSatisfied(step) {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }

    return step.dependencies.every(depId => {
      return this.results.has(depId) || this.errors.has(depId);
    });
  }

  /**
   * Check if step's condition is met
   */
  async checkCondition(step, context) {
    if (!step.condition) {
      return true;
    }

    try {
      return await Promise.resolve(step.condition(context));
    } catch (error) {
      console.error(`Condition check failed for step ${step.id}:`, error);
      return false;
    }
  }

  /**
   * Execute a single step with retry logic
   */
  async executeStep(step, context) {
    const maxAttempts = step.retry?.attempts || 1;
    const retryDelay = step.retry?.delay || 1000;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const task = typeof step.task === 'function'
          ? await Promise.resolve(step.task(context))
          : step.task;

        const result = await step.agent.execute(task);

        this.results.set(step.id, {
          stepId: step.id,
          agentId: step.agent.id,
          output: result,
          attempt,
          timestamp: Date.now()
        });

        return result;
      } catch (error) {
        lastError = error;
        console.error(`Step ${step.id} attempt ${attempt} failed:`, error.message);

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    // All attempts failed
    const errorInfo = {
      stepId: step.id,
      error: lastError.message,
      attempts: maxAttempts,
      timestamp: Date.now()
    };

    this.errors.set(step.id, errorInfo);

    if (step.onError) {
      await Promise.resolve(step.onError(lastError, context));
    }

    throw lastError;
  }

  /**
   * Execute the workflow
   */
  async execute(initialContext = {}) {
    this.status = 'running';
    this.startTime = Date.now();
    this.results.clear();
    this.errors.clear();

    try {
      this.buildExecutionOrder();
    } catch (error) {
      this.status = 'failed';
      throw error;
    }

    const context = { ...initialContext, results: {}, errors: {} };

    // Execute steps based on dependencies
    const executing = new Map();

    for (const stepId of this.executionOrder) {
      const step = this.steps.get(stepId);

      // Wait for dependencies
      if (step.dependencies && step.dependencies.length > 0) {
        await Promise.all(
          step.dependencies.map(depId => executing.get(depId))
        );
      }

      // Check condition
      const conditionMet = await this.checkCondition(step, context);
      if (!conditionMet) {
        console.log(`Step ${step.id} skipped (condition not met)`);
        continue;
      }

      // Execute step
      const executionPromise = this.executeStep(step, context)
        .then(result => {
          context.results[stepId] = result;
          return result;
        })
        .catch(error => {
          context.errors[stepId] = error;
          if (this.config.failFast) {
            throw error;
          }
          return null;
        });

      executing.set(stepId, executionPromise);
    }

    // Wait for all steps to complete
    try {
      await Promise.all(executing.values());
    } catch (error) {
      this.status = 'failed';
      this.endTime = Date.now();
      throw error;
    }

    this.status = 'completed';
    this.endTime = Date.now();

    return {
      status: this.status,
      duration: this.endTime - this.startTime,
      results: Object.fromEntries(this.results),
      errors: Object.fromEntries(this.errors),
      context
    };
  }

  /**
   * Get workflow status
   */
  getStatus() {
    const completed = this.results.size;
    const failed = this.errors.size;
    const total = this.steps.size;

    return {
      status: this.status,
      steps: {
        total,
        completed,
        failed,
        pending: total - completed - failed
      },
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime
    };
  }

  /**
   * Visualize workflow execution
   */
  visualize() {
    const lines = [];
    lines.push('┌─── Workflow ───┐');
    lines.push('│');

    for (const stepId of this.executionOrder) {
      const step = this.steps.get(stepId);
      const result = this.results.get(stepId);
      const error = this.errors.get(stepId);

      let status = '○';
      if (result) status = '✓';
      if (error) status = '✗';

      const deps = step.dependencies?.length ? ` [depends: ${step.dependencies.join(', ')}]` : '';
      lines.push(`│ ${status} ${stepId}: ${step.agent.name} - ${step.task}${deps}`);
    }

    lines.push('│');
    lines.push('└────────────────┘');

    return lines.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLABORATION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a debate between multiple agents
 * Each agent argues for their position, then a judge decides
 */
export async function Debate(agents, topic, judgeAgent, options = {}) {
  const { maxRounds = 3, timePerRound = 30000 } = options;

  const debateArguments = [];

  // Each agent presents their initial argument
  for (const agent of agents) {
    const result = await agent.execute(`Argue your position on: ${topic}`);
    debateArguments.push({
      agentId: agent.id,
      agentName: agent.name,
      argument: result,
      round: 1
    });
  }

  // Multiple rounds of rebuttal
  for (let round = 2; round <= maxRounds; round++) {
    for (const agent of agents) {
      const otherArguments = debateArguments.filter(a => a.agentId !== agent.id);
      const context = otherArguments.map(a => `${a.agentName}: ${a.argument}`).join('\n');

      const result = await agent.execute(
        `Respond to these arguments about "${topic}":\n${context}`
      );

      debateArguments.push({
        agentId: agent.id,
        agentName: agent.name,
        argument: result,
        round
      });
    }
  }

  // Judge decides
  const allArguments = debateArguments.map(a => `[Round ${a.round}] ${a.agentName}: ${a.argument}`).join('\n\n');
  const verdict = await judgeAgent.execute(
    `Based on the following debate about "${topic}", determine the winner and explain why:\n\n${allArguments}`
  );

  return {
    topic,
    arguments: debateArguments,
    verdict,
    participants: agents.map(a => a.id),
    rounds: maxRounds
  };
}

/**
 * Create a review board where multiple agents review and approve/reject
 */
export async function ReviewBoard(reviewers, artifact, options = {}) {
  const { requiredApprovals = Math.ceil(reviewers.length / 2) } = options;

  const reviews = [];

  for (const reviewer of reviewers) {
    const result = await reviewer.execute(`Review the following and provide approval or rejection with feedback:\n\n${artifact}`);
    reviews.push({
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      result,
      timestamp: Date.now()
    });
  }

  const approvals = reviews.filter(r =>
    r.result.toLowerCase().includes('approve') ||
    r.result.toLowerCase().includes('approved')
  ).length;

  return {
    artifact,
    reviews,
    approvals,
    requiredApprovals,
    approved: approvals >= requiredApprovals,
    reviewerCount: reviewers.length
  };
}

/**
 * Create a round-robin task distribution
 */
export async function RoundRobin(agents, tasks, options = {}) {
  const { parallel = false } = options;
  const results = [];

  if (parallel) {
    // Assign tasks to agents in round-robin fashion and execute in parallel
    const assignments = tasks.map((task, index) => ({
      agent: agents[index % agents.length],
      task,
      index
    }));

    const promises = assignments.map(async ({ agent, task, index }) => {
      const result = await agent.execute(task);
      return {
        taskIndex: index,
        agentId: agent.id,
        task,
        result,
        timestamp: Date.now()
      };
    });

    results.push(...await Promise.all(promises));
  } else {
    // Sequential round-robin
    let agentIndex = 0;

    for (const task of tasks) {
      const agent = agents[agentIndex];
      const result = await agent.execute(task);

      results.push({
        taskIndex: results.length,
        agentId: agent.id,
        task,
        result,
        timestamp: Date.now()
      });

      agentIndex = (agentIndex + 1) % agents.length;
    }
  }

  return {
    totalTasks: tasks.length,
    agentCount: agents.length,
    results
  };
}

/**
 * Consensus voting - agents vote on options, majority wins
 */
export async function Consensus(agents, proposal, options = {}) {
  const { minVotes = Math.ceil(agents.length / 2), requireUnanimous = false } = options;
  const votes = [];

  for (const agent of agents) {
    const result = await agent.execute(
      `Vote on this proposal (respond with APPROVE or REJECT, followed by reasoning):\n\n${proposal}`
    );
    const approved = result.toUpperCase().includes('APPROVE');
    votes.push({
      agentId: agent.id,
      agentName: agent.name,
      vote: approved ? 'approve' : 'reject',
      reasoning: result,
      timestamp: Date.now()
    });
  }

  const approvals = votes.filter(v => v.vote === 'approve').length;
  const rejections = votes.filter(v => v.vote === 'reject').length;

  return {
    proposal,
    votes,
    approvals,
    rejections,
    totalVotes: votes.length,
    requiredVotes: requireUnanimous ? agents.length : minVotes,
    passed: requireUnanimous ? rejections === 0 : approvals >= minVotes,
    consensusLevel: (approvals / agents.length * 100).toFixed(1) + '%'
  };
}

/**
 * Tournament - agents compete on the same task, best result wins
 */
export async function Tournament(agents, task, judgeAgent, options = {}) {
  const { criteria = 'quality, accuracy, and completeness' } = options;

  // All agents execute the same task
  const submissions = [];
  for (const agent of agents) {
    const startTime = Date.now();
    try {
      const result = await agent.execute(task);
      submissions.push({
        agentId: agent.id,
        agentName: agent.name,
        result,
        duration: Date.now() - startTime,
        timestamp: startTime
      });
    } catch (error) {
      submissions.push({
        agentId: agent.id,
        agentName: agent.name,
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  }

  // Judge evaluates all submissions
  const evaluation = submissions
    .filter(s => !s.error)
    .map((s, i) => `Submission ${i + 1} (by ${s.agentName}):\n${s.result}`)
    .join('\n\n---\n\n');

  const verdict = await judgeAgent.execute(
    `Evaluate these submissions for the task "${task}" based on ${criteria}. Rank them 1st, 2nd, 3rd etc and explain your reasoning:\n\n${evaluation}`
  );

  return {
    task,
    submissions,
    verdict,
    participantCount: agents.length,
    successCount: submissions.filter(s => !s.error).length
  };
}

/**
 * Pipeline - stream data through a chain of agents with transformation
 */
export async function Pipeline(stages, input, options = {}) {
  const { onError = 'stop', collectIntermediate = true } = options;
  const intermediate = [];
  let current = input;

  for (let i = 0; i < stages.length; i++) {
    const { agent, transform } = stages[i];
    const startTime = Date.now();

    try {
      const task = typeof transform === 'function' ? transform(current) : `Process: ${JSON.stringify(current)}`;
      const result = await agent.execute(task);

      if (collectIntermediate) {
        intermediate.push({
          stage: i,
          agentId: agent.id,
          agentName: agent.name,
          input: current,
          output: result,
          duration: Date.now() - startTime
        });
      }

      current = result;
    } catch (error) {
      if (onError === 'stop') throw error;
      if (onError === 'skip') continue;
      if (onError === 'default') {
        intermediate.push({ stage: i, error: error.message });
        continue;
      }
    }
  }

  return {
    input,
    output: current,
    stages: stages.length,
    intermediate
  };
}

/**
 * ParallelMap - execute a task across items in parallel with multiple agents
 */
export async function ParallelMap(agents, items, taskTemplate, options = {}) {
  const { maxConcurrency = agents.length } = options;
  const results = [];
  let agentIndex = 0;

  const executeItem = async (item, index) => {
    const agent = agents[agentIndex % agents.length];
    agentIndex++;
    const task = typeof taskTemplate === 'function'
      ? taskTemplate(item, index)
      : `${taskTemplate}\n\nItem: ${JSON.stringify(item)}`;

    const startTime = Date.now();
    try {
      const result = await agent.execute(task);
      return { index, agentId: agent.id, item, result, duration: Date.now() - startTime };
    } catch (error) {
      return { index, agentId: agent.id, item, error: error.message, duration: Date.now() - startTime };
    }
  };

  // Process in batches for concurrency control
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map((item, j) => executeItem(item, i + j))
    );
    results.push(...batchResults);
  }

  return {
    totalItems: items.length,
    successCount: results.filter(r => !r.error).length,
    errorCount: results.filter(r => r.error).length,
    results
  };
}

export default {
  Collaborate,
  Delegate,
  Chain,
  Aggregate,
  createAgent,
  WorkflowOrchestrator,
  Debate,
  ReviewBoard,
  RoundRobin,
  Consensus,
  Tournament,
  Pipeline,
  ParallelMap
};