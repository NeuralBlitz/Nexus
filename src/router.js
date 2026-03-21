// NEXUS AI Platform - Intelligent Model Router
// Routes tasks to optimal models based on type, cost, and performance

const MODEL_CAPABILITIES = {
  'codellama': {
    types: ['code', 'debug', 'refactor'],
    speed: 'medium',
    cost: 'low',
    quality: 'high',
    maxTokens: 4096,
    temperature: 0.2
  },
  'deepseek-coder': {
    types: ['code', 'debug', 'refactor', 'test-generation'],
    speed: 'fast',
    cost: 'low',
    quality: 'high',
    maxTokens: 4096,
    temperature: 0.1
  },
  'llama3.2': {
    types: ['research', 'analysis', 'summarization', 'qa'],
    speed: 'medium',
    cost: 'medium',
    quality: 'high',
    maxTokens: 8192,
    temperature: 0.3,
    webSearch: true
  },
  'mistral': {
    types: ['general', 'fast', 'extraction', 'classification'],
    speed: 'very-fast',
    cost: 'low',
    quality: 'medium',
    maxTokens: 4096,
    temperature: 0.4
  },
  'phi3': {
    types: ['general', 'fast', 'simple-code', 'extraction'],
    speed: 'very-fast',
    cost: 'very-low',
    quality: 'medium',
    maxTokens: 2048,
    temperature: 0.4
  },
  'gpt4': {
    types: ['creative', 'complex', 'reasoning', 'long-form'],
    speed: 'slow',
    cost: 'high',
    quality: 'very-high',
    maxTokens: 16384,
    temperature: 0.8
  },
  'claude': {
    types: ['creative', 'analysis', 'writing', 'complex'],
    speed: 'slow',
    cost: 'high',
    quality: 'very-high',
    maxTokens: 16384,
    temperature: 0.7
  }
};

const LATENCY_TRACKER = {};
const SUCCESS_TRACKER = {};
const HEALTH_STATUS = {};

// Initialize trackers for all models
Object.keys(MODEL_CAPABILITIES).forEach(model => {
  LATENCY_TRACKER[model] = { total: 0, count: 0, avg: 0 };
  SUCCESS_TRACKER[model] = { success: 0, total: 0, rate: 100 };
  HEALTH_STATUS[model] = { healthy: true, lastCheck: Date.now(), errors: 0 };
});

// Keyword patterns for task analysis
const TASK_PATTERNS = {
  code: /\b(code|function|class|method|implement|debug|error|bug|fix|refactor|syntax|compile|programming|javascript|python|typescript|api|endpoint|algorithm)\b/i,
  research: /\b(research|find|search|investigate|explore|summarize|explain|what is|how does|analyze|compare|evaluate|information about)\b/i,
  creative: /\b(write|create|story|poem|creative|imagine|design|brainstorm|ideate|narrative|fiction|article|blog)\b/i,
  fast: /\b(quick|simple|fast|basic|trivial|small|minor|quickly|short|extract|parse|format|convert)\b/i,
  complex: /\b(complex|detailed|comprehensive|thorough|deep|advanced|sophisticated|elaborate)\b/i
};

/**
 * Analyze a task to determine its type and requirements
 * @param {Object} task - Task object with 'prompt' and optional 'context'
 * @returns {Object} Analysis result with task types and metadata
 */
export function analyzeTask(task) {
  const { prompt = '', context = {} } = task;
  const promptLower = prompt.toLowerCase();
  const scores = {};
  const detectedTypes = [];

  // Score each task type based on pattern matching
  Object.entries(TASK_PATTERNS).forEach(([type, pattern]) => {
    const matches = promptLower.match(pattern);
    scores[type] = matches ? matches.length : 0;
    if (matches) detectedTypes.push(type);
  });

  // Boost scores based on context
  if (context.requireCode) scores.code += 3;
  if (context.requireSpeed) scores.fast += 2;
  if (context.requireCreativity) scores.creative += 2;
  if (context.maxTokens && context.maxTokens < 1000) scores.fast += 1;

  // Analyze prompt characteristics
  const wordCount = prompt.split(/\s+/).length;
  const hasQuestions = prompt.includes('?');
  const hasCodeBlocks = /```[\s\S]*```/.test(prompt);
  const hasUrls = /https?:\/\/[^\s]+/.test(prompt);

  if (hasCodeBlocks) scores.code += 3;
  if (hasUrls) scores.research += 1;
  if (wordCount > 100) scores.complex = (scores.complex || 0) + 1;
  if (wordCount < 30) scores.fast = (scores.fast || 0) + 1;

  // Determine primary type
  const sortedTypes = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  const primaryType = sortedTypes.length > 0 ? sortedTypes[0][0] : 'general';
  const secondaryTypes = sortedTypes.slice(1).map(([type]) => type);

  return {
    primaryType,
    secondaryTypes,
    scores,
    detectedTypes,
    metadata: {
      wordCount,
      hasQuestions,
      hasCodeBlocks,
      hasUrls,
      estimatedComplexity: wordCount > 200 ? 'high' : wordCount > 50 ? 'medium' : 'low'
    }
  };
}

/**
 * Select the best model for a given task type
 * @param {string} taskType - The analyzed task type
 * @param {Object} options - Selection options (preferSpeed, preferQuality, budget)
 * @returns {string} Selected model name
 */
export function selectModel(taskType, options = {}) {
  const { preferSpeed = false, preferQuality = false, budget = 'medium' } = options;

  // Filter models that can handle this task type
  const capableModels = Object.entries(MODEL_CAPABILITIES)
    .filter(([_, cap]) => cap.types.includes(taskType) || cap.types.includes('general'))
    .map(([model, cap]) => ({ model, ...cap }));

  if (capableModels.length === 0) {
    return 'mistral'; // Fallback to general purpose
  }

  // Apply selection strategy
  let selected;

  if (preferSpeed) {
    // Sort by speed, considering health status
    selected = capableModels
      .filter(m => HEALTH_STATUS[m.model]?.healthy)
      .sort((a, b) => {
        const speedOrder = { 'very-fast': 0, 'fast': 1, 'medium': 2, 'slow': 3 };
        return speedOrder[a.speed] - speedOrder[b.speed];
      })[0];
  } else if (preferQuality || budget === 'high') {
    // Sort by quality
    const qualityOrder = { 'very-high': 0, 'high': 1, 'medium': 2, 'low': 3 };
    selected = capableModels
      .filter(m => HEALTH_STATUS[m.model]?.healthy)
      .sort((a, b) => qualityOrder[a.quality] - qualityOrder[b.quality])[0];
  } else {
    // Balance cost and quality, considering success rate
    selected = capableModels
      .filter(m => HEALTH_STATUS[m.model]?.healthy)
      .sort((a, b) => {
        const costScore = { 'very-low': 0, 'low': 1, 'medium': 2, 'high': 3 };
        const qualityScore = { 'very-high': 4, 'high': 3, 'medium': 2, 'low': 1 };
        const scoreA = qualityScore[a.quality] - costScore[a.cost] + (SUCCESS_TRACKER[a.model]?.rate || 0) / 100;
        const scoreB = qualityScore[b.quality] - costScore[b.cost] + (SUCCESS_TRACKER[b.model]?.rate || 0) / 100;
        return scoreB - scoreA;
      })[0];
  }

  return selected?.model || 'mistral';
}

/**
 * Execute a fallback chain of models
 * @param {string} primary - Primary model to try
 * @param {string[]} fallbacks - Array of fallback models in order
 * @param {Object} task - Task to execute
 * @param {Function} executeFn - Async function to execute model call (model, task) => result
 * @returns {Promise<Object>} Result with model used and response
 */
export async function fallbackChain(primary, fallbacks, task, executeFn) {
  const modelsToTry = [primary, ...fallbacks];
  const errors = [];

  for (const model of modelsToTry) {
    if (!HEALTH_STATUS[model]?.healthy) {
      errors.push({ model, error: 'Model marked as unhealthy' });
      continue;
    }

    const startTime = Date.now();

    try {
      const result = await executeFn(model, task);
      const latency = Date.now() - startTime;

      // Update trackers
      updateLatencyTracker(model, latency);
      updateSuccessTracker(model, true);

      return {
        success: true,
        model,
        result,
        latency,
        attemptedModels: modelsToTry.slice(0, modelsToTry.indexOf(model) + 1)
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      updateLatencyTracker(model, latency);
      updateSuccessTracker(model, false);
      errors.push({ model, error: error.message });

      // Mark model as potentially unhealthy if multiple failures
      if (SUCCESS_TRACKER[model]?.rate < 50) {
        HEALTH_STATUS[model].healthy = false;
        HEALTH_STATUS[model].lastCheck = Date.now();
      }
    }
  }

  return {
    success: false,
    error: 'All models failed',
    errors,
    attemptedModels: modelsToTry
  };
}

/**
 * Select the cheapest capable model for a task
 * @param {Object} task - Task object with prompt
 * @returns {string} Cheapest capable model
 */
export function costOptimizer(task) {
  const analysis = analyzeTask(task);
  const taskType = analysis.primaryType;

  // Get capable models
  const capableModels = Object.entries(MODEL_CAPABILITIES)
    .filter(([_, cap]) => cap.types.includes(taskType) || cap.types.includes('general'))
    .filter(([model]) => HEALTH_STATUS[model]?.healthy)
    .map(([model, cap]) => ({ model, ...cap }));

  if (capableModels.length === 0) return 'phi3'; // Cheapest fallback

  // Sort by cost, then by success rate as tiebreaker
  const costOrder = { 'very-low': 0, 'low': 1, 'medium': 2, 'high': 3 };
  capableModels.sort((a, b) => {
    const costDiff = costOrder[a.cost] - costOrder[b.cost];
    if (costDiff !== 0) return costDiff;
    return (SUCCESS_TRACKER[b.model]?.rate || 0) - (SUCCESS_TRACKER[a.model]?.rate || 0);
  });

  return capableModels[0].model;
}

/**
 * Check health of a specific model
 * @param {string} model - Model name to check
 * @param {Function} healthCheckFn - Async function to check model health
 * @returns {Promise<boolean>} Health status
 */
export async function checkModelHealth(model, healthCheckFn) {
  try {
    await healthCheckFn(model);
    HEALTH_STATUS[model] = { healthy: true, lastCheck: Date.now(), errors: 0 };
    return true;
  } catch (error) {
    HEALTH_STATUS[model].errors++;
    HEALTH_STATUS[model].healthy = HEALTH_STATUS[model].errors < 3;
    HEALTH_STATUS[model].lastCheck = Date.now();
    return false;
  }
}

/**
 * Get model statistics
 * @param {string} model - Optional model name, if omitted returns all
 * @returns {Object} Statistics object
 */
export function getModelStats(model = null) {
  if (model) {
    return {
      capabilities: MODEL_CAPABILITIES[model],
      latency: LATENCY_TRACKER[model],
      success: SUCCESS_TRACKER[model],
      health: HEALTH_STATUS[model]
    };
  }

  const stats = {};
  Object.keys(MODEL_CAPABILITIES).forEach(m => {
    stats[m] = getModelStats(m);
  });
  return stats;
}

/**
 * Get the capability matrix for all models
 * @returns {Object} Matrix of model capabilities
 */
export function getCapabilityMatrix() {
  const matrix = {};
  const allTypes = new Set();

  // Collect all task types
  Object.values(MODEL_CAPABILITIES).forEach(cap => {
    cap.types.forEach(type => allTypes.add(type));
  });

  // Build matrix
  Object.entries(MODEL_CAPABILITIES).forEach(([model, cap]) => {
    matrix[model] = {};
    allTypes.forEach(type => {
      matrix[model][type] = cap.types.includes(type);
    });
  });

  return matrix;
}

// Helper functions
function updateLatencyTracker(model, latency) {
  const tracker = LATENCY_TRACKER[model];
  tracker.total += latency;
  tracker.count++;
  tracker.avg = Math.round(tracker.total / tracker.count);
}

function updateSuccessTracker(model, success) {
  const tracker = SUCCESS_TRACKER[model];
  tracker.total++;
  if (success) tracker.success++;
  tracker.rate = Math.round((tracker.success / tracker.total) * 100);
}

// Auto-run health checks periodically
setInterval(async () => {
  const models = Object.keys(MODEL_CAPABILITIES);
  for (const model of models) {
    const timeSinceCheck = Date.now() - HEALTH_STATUS[model].lastCheck;
    if (timeSinceCheck > 300000 && !HEALTH_STATUS[model].healthy) { // 5 minutes
      // Reset error count for retry
      HEALTH_STATUS[model].errors = Math.max(0, HEALTH_STATUS[model].errors - 1);
    }
  }
}, 60000); // Check every minute

export default {
  analyzeTask,
  selectModel,
  fallbackChain,
  costOptimizer,
  checkModelHealth,
  getModelStats,
  getCapabilityMatrix,
  MODEL_CAPABILITIES
};
