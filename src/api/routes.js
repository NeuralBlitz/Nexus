import express from 'express';

const router = express.Router();

// Session storage (in-memory)
const sessions = new Map();

// Helper to generate session ID
function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper to compute platform metrics
function computeMetrics(state) {
  const now = Date.now();
  const uptime = now - state.platform.uptime;
  const agentStats = Object.values(state.agents);
  const totalTasks = agentStats.reduce((sum, a) => sum + a.tasksCompleted, 0);
  const totalXp = agentStats.reduce((sum, a) => sum + a.xp, 0);
  const avgLevel = agentStats.reduce((sum, a) => sum + a.level, 0) / agentStats.length;
  
  return {
    platform: {
      name: state.platform.name,
      version: state.platform.version,
      uptime: Math.floor(uptime / 1000), // seconds
      status: state.platform.status
    },
    agents: {
      total: agentStats.length,
      active: agentStats.filter(a => a.status === 'WORKING').length,
      standby: agentStats.filter(a => a.status === 'STANDBY').length,
      error: agentStats.filter(a => a.status === 'ERROR').length,
      totalTasks,
      totalXp,
      averageLevel: Math.round(avgLevel * 10) / 10
    },
    sessions: sessions.size,
    history: state.history.length,
    tools: state.tools,
    channels: state.channels,
    timestamp: now
  };
}

// Middleware to attach state and providers to request
export function attachContext(stateRef, providersRef) {
  return (req, res, next) => {
    req.state = stateRef;
    req.providers = providersRef;
    next();
  };
}

// Existing routes
router.get('/state', (req, res) => {
  res.json(req.state);
});

router.get('/agents', (req, res) => {
  res.json(req.state.agents);
});

router.get('/providers', async (req, res) => {
  const providerStatus = await Promise.all(
    Object.entries(req.providers).map(async ([name, p]) => ({
      name,
      enabled: p.enabled,
      online: name === 'ollama' ? (await req.providers.ollama.checkHealth()).online : true
    }))
  );
  res.json(providerStatus);
});

router.get('/history', (req, res) => {
  res.json(req.state.history.slice(0, 50));
});

router.post('/execute', async (req, res) => {
  try {
    const { agent, task, provider } = req.body;
    const result = await executeAgentTask(req.state, req.providers, agent || 'NEXUS-1', task, provider);
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// New endpoints

// 1. GET /api/health - Health check
router.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    version: req.state?.platform?.version || '1.0.0',
    providers: Object.keys(req.providers || {}).length
  };
  res.json(health);
});

// 2. GET /api/metrics - Platform metrics
router.get('/metrics', (req, res) => {
  if (!req.state) {
    return res.status(500).json({ error: 'State not available' });
  }
  const metrics = computeMetrics(req.state);
  res.json(metrics);
});

// 3. POST /api/tasks/batch - Execute task on multiple agents
router.post('/tasks/batch', async (req, res) => {
  try {
    const { task, agents, provider } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'task is required' });
    }
    
    const targetAgents = agents || Object.keys(req.state.agents);
    const results = await Promise.all(
      targetAgents.map(async (agentId) => {
        try {
          const result = await executeAgentTask(req.state, req.providers, agentId, task, provider);
          return { agent: agentId, success: true, result };
        } catch (error) {
          return { agent: agentId, success: false, error: error.message };
        }
      })
    );
    
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 4. POST /api/tasks/chain - Execute chained tasks
router.post('/tasks/chain', async (req, res) => {
  try {
    const { tasks, provider } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'tasks array is required' });
    }
    
    const results = [];
    let previousOutput = '';
    
    for (let i = 0; i < tasks.length; i++) {
      const taskObj = tasks[i];
      const taskText = typeof taskObj === 'string' ? taskObj : taskObj.task;
      const agentId = typeof taskObj === 'object' ? taskObj.agent : 'NEXUS-1';
      const taskProvider = typeof taskObj === 'object' ? taskObj.provider : provider;
      
      // If previous output exists and task contains placeholder, replace it
      let finalTask = taskText;
      if (previousOutput && taskText.includes('{{output}}')) {
        finalTask = taskText.replace('{{output}}', previousOutput);
      }
      
      try {
        const result = await executeAgentTask(req.state, req.providers, agentId, finalTask, taskProvider);
        results.push({ step: i, agent: agentId, success: true, result });
        previousOutput = result.content;
      } catch (error) {
        results.push({ step: i, agent: agentId, success: false, error: error.message });
        // Continue chain even on failure? For now we stop
        break;
      }
    }
    
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5. GET /api/sessions - List all sessions
router.get('/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    agentCount: session.agents?.length || 0,
    taskCount: session.history?.length || 0
  }));
  res.json(sessionList);
});

// 6. GET /api/sessions/:id - Get session details
router.get('/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ id: req.params.id, ...session });
});

// 7. DELETE /api/sessions/:id - Delete session
router.delete('/sessions/:id', (req, res) => {
  if (sessions.delete(req.params.id)) {
    res.json({ success: true, message: 'Session deleted' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// 8. GET /api/providers/:name/models - Get models for provider
router.get('/providers/:name/models', async (req, res) => {
  const { name } = req.params;
  const provider = req.providers?.[name];
  
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  try {
    let models = [];
    
    if (name === 'ollama') {
      const health = await provider.checkHealth();
      if (health.online) {
        models = health.models;
      }
    } else if (name === 'openai') {
      // Return default OpenAI models
      models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    } else if (name === 'anthropic') {
      models = ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'];
    } else if (name === 'opencode') {
      models = ['opencode-default'];
    } else if (name === 'claude') {
      models = ['claude-default'];
    }
    
    res.json({ provider: name, models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to execute agent task (moved from server.js)
async function executeAgentTask(state, providers, agentId, task, provider = 'auto') {
  const agent = state.agents[agentId];
  if (!agent) throw new Error('Agent not found');
  
  agent.status = 'WORKING';
  agent.currentTask = task;
  
  const startTime = Date.now();
  let result;
  
  try {
    let selectedProvider;
    
    if (provider === 'auto') {
      // Smart routing based on task type
      if (task.includes('code') || task.includes('function') || task.includes('debug')) {
        selectedProvider = providers.opencode.enabled ? providers.opencode : providers.ollama;
      } else if (task.includes('research') || task.includes('analyze')) {
        selectedProvider = providers.opencode.enabled ? providers.opencode : providers.anthropic;
      } else {
        selectedProvider = providers.ollama.enabled ? providers.ollama : providers.opencode;
      }
    } else if (provider === 'local') {
      selectedProvider = providers.ollama;
    } else {
      selectedProvider = providers[provider] || providers.opencode;
    }
    
    const response = await selectedProvider.complete(task, {
      model: agent.model !== 'auto' ? agent.model : undefined,
      temperature: 0.7,
      maxTokens: 4096
    });
    
    result = {
      content: response.content,
      provider: response.provider,
      duration: Math.round((Date.now() - startTime) / 1000),
      tokens: Math.floor(response.content.length / 4)
    };
    
    agent.status = 'STANDBY';
    agent.currentTask = null;
    agent.tasksCompleted++;
    agent.xp += Math.floor(result.tokens / 10);
    agent.level = Math.floor(agent.xp / 100) + 1;
    agent.lastActive = Date.now();
    
    state.history.push({
      agent: agentId,
      task,
      result: result.content.substring(0, 500),
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    agent.status = 'ERROR';
    agent.currentTask = null;
    throw error;
  }
}

// Create a new session
router.post('/sessions', (req, res) => {
  const id = generateSessionId();
  const session = {
    createdAt: Date.now(),
    lastActivity: Date.now(),
    agents: req.body.agents || ['NEXUS-1'],
    history: [],
    data: req.body.data || {}
  };
  sessions.set(id, session);
  res.status(201).json({ id, ...session });
});

// Update session
router.put('/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  session.lastActivity = Date.now();
  session.data = { ...session.data, ...req.body.data };
  if (req.body.agents) session.agents = req.body.agents;
  res.json({ id: req.params.id, ...session });
});

// Integration Routes
router.get('/integrations', async (req, res) => {
  try {
    const { getIntegrationManager } = await import('../integrations.js');
    const manager = getIntegrationManager();
    const integrations = manager.getAll();
    res.json({
      success: true,
      count: integrations.length,
      integrations: integrations.map(i => ({
        id: i.id,
        name: i.name,
        status: i.status,
        configured: i.isConfigured()
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/integrations/:id', async (req, res) => {
  try {
    const { getIntegrationManager } = await import('../integrations.js');
    const manager = getIntegrationManager();
    const integration = manager.get(req.params.id);
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }
    res.json({ success: true, integration });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/integrations/:id/test', async (req, res) => {
  try {
    const { getIntegrationManager } = await import('../integrations.js');
    const manager = getIntegrationManager();
    const integration = manager.get(req.params.id);
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }
    
    const result = await integration.test();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/features', async (req, res) => {
  try {
    const featuresModule = await import('../features/index.js');
    const featureNames = Object.keys(featuresModule).filter(k => 
      k !== 'default' && k !== '__esModule' && k !== 'features' && k !== 'featureCount'
    );
    res.json({
      success: true,
      count: featureNames.length,
      features: featureNames
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/plugins/community', async (req, res) => {
  try {
    const { plugins, pluginDescriptions } = await import('../plugins/community/index.js');
    res.json({
      success: true,
      count: plugins.length,
      plugins: plugins.map(p => ({
        id: p,
        name: p.replace(/-plugin$/, ''),
        description: pluginDescriptions[p]
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orchestrator/analyze', async (req, res) => {
  try {
    const { getLLMOrchestrator } = await import('../orchestrator/llm-orchestrator.js');
    const orchestrator = getLLMOrchestrator();
    const { task } = req.body;
    const analysis = orchestrator.analyzeTask(task);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/orchestrator/templates', async (req, res) => {
  try {
    const { getLLMOrchestrator } = await import('../orchestrator/llm-orchestrator.js');
    const orchestrator = getLLMOrchestrator();
    const templates = Array.from(orchestrator.templates.values());
    res.json({ success: true, count: templates.length, templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/knowledge/stats', async (req, res) => {
  try {
    const { getKnowledgeGraph } = await import('../knowledge/knowledge-graph.js');
    const kg = getKnowledgeGraph();
    const stats = kg.getDetailedStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/knowledge/nodes', async (req, res) => {
  try {
    const { getKnowledgeGraph } = await import('../knowledge/knowledge-graph.js');
    const kg = getKnowledgeGraph();
    const node = kg.addNode(req.body);
    res.json({ success: true, node: node.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/knowledge/nodes/:type', async (req, res) => {
  try {
    const { getKnowledgeGraph } = await import('../knowledge/knowledge-graph.js');
    const kg = getKnowledgeGraph();
    const nodes = kg.getNodesByType(req.params.type);
    res.json({ success: true, count: nodes.length, nodes: nodes.map(n => n.toJSON()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/knowledge/search', async (req, res) => {
  try {
    const { getKnowledgeGraph } = await import('../knowledge/knowledge-graph.js');
    const kg = getKnowledgeGraph();
    const results = kg.search(req.body.query, req.body);
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/knowledge/path', async (req, res) => {
  try {
    const { getKnowledgeGraph } = await import('../knowledge/knowledge-graph.js');
    const kg = getKnowledgeGraph();
    const path = kg.findPath(req.body.from, req.body.to);
    res.json({ success: true, path, found: path.length > 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CACHE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/cache/stats', async (req, res) => {
  try {
    const { getCacheManager } = await import('../cache/cache-system.js');
    const cm = getCacheManager();
    const cache = cm.getCache(req.query.name || 'default');
    const stats = cache.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cache/get', async (req, res) => {
  try {
    const { getCacheManager } = await import('../cache/cache-system.js');
    const cm = getCacheManager();
    const cache = cm.getCache(req.body.cache || 'default');
    const value = await cache.get(req.body.key);
    res.json({ success: true, key: req.body.key, found: value !== null, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cache/set', async (req, res) => {
  try {
    const { getCacheManager } = await import('../cache/cache-system.js');
    const cm = getCacheManager();
    const cache = cm.getCache(req.body.cache || 'default');
    await cache.set(req.body.key, req.body.value, { ttl: req.body.ttl });
    res.json({ success: true, key: req.body.key });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/cache/invalidate/:pattern', async (req, res) => {
  try {
    const { getCacheManager } = await import('../cache/cache-system.js');
    const cm = getCacheManager();
    const cache = cm.getCache(req.query.cache || 'default');
    const count = cache.invalidatePattern(req.params.pattern);
    res.json({ success: true, invalidated: count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/events/channels', async (req, res) => {
  try {
    const { getEventBus } = await import('../events/event-bus.js');
    const bus = getEventBus();
    const channels = bus.getChannels();
    const stats = bus.getChannelStats();
    res.json({ success: true, channels, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/events/publish', async (req, res) => {
  try {
    const { getEventBus, Event } = await import('../events/event-bus.js');
    const bus = getEventBus();
    const event = new Event(req.body.type, req.body.payload, req.body.options);
    await bus.publish(event);
    res.json({ success: true, eventId: event.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/security/stats', async (req, res) => {
  try {
    const { getSecurityManager } = await import('../security/security-system.js');
    const sec = getSecurityManager();
    res.json({ success: true, stats: sec.getStats() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/security/audit', async (req, res) => {
  try {
    const { getSecurityManager } = await import('../security/security-system.js');
    const sec = getSecurityManager();
    const entries = sec.queryAuditLog(req.query);
    res.json({ success: true, count: entries.length, entries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/security/apikeys', async (req, res) => {
  try {
    const { getSecurityManager } = await import('../security/security-system.js');
    const sec = getSecurityManager();
    const key = sec.createApiKey(req.body);
    res.json({ success: true, key: key.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/workflows', async (req, res) => {
  try {
    const { getWorkflowManager, WorkflowTemplates } = await import('../workflow/workflow-engine.js');
    const wm = getWorkflowManager();
    const workflows = wm.getAllWorkflows();
    const templates = Object.keys(WorkflowTemplates);
    res.json({ success: true, workflows: workflows.map(w => w.toJSON()), templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/workflows', async (req, res) => {
  try {
    const { getWorkflowManager } = await import('../workflow/workflow-engine.js');
    const wm = getWorkflowManager();
    const wf = wm.createWorkflow(req.body);
    res.json({ success: true, workflow: wf.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/workflows/:id/execute', async (req, res) => {
  try {
    const { getWorkflowManager } = await import('../workflow/workflow-engine.js');
    const wm = getWorkflowManager();
    const wf = wm.getWorkflow(req.params.id);
    if (!wf) return res.status(404).json({ success: false, error: 'Workflow not found' });
    const execution = await wf.execute(req.body.context || {});
    res.json({ success: true, execution: execution.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/queue/stats', async (req, res) => {
  try {
    const { getQueueManager } = await import('../queue/task-queue.js');
    const qm = getQueueManager();
    res.json({ success: true, stats: qm.getCombinedStats(), queues: qm.getQueueNames() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/queue/add', async (req, res) => {
  try {
    const { getQueueManager } = await import('../queue/task-queue.js');
    const qm = getQueueManager();
    const queue = qm.getQueue(req.body.queue) || qm.createQueue(req.body.queue);
    const job = await queue.add(req.body.data, req.body.options);
    res.json({ success: true, jobId: job.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// RESILIENCE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/resilience/status', async (req, res) => {
  try {
    const { getResilienceManager } = await import('../resilience/resilience-system.js');
    const rm = getResilienceManager();
    res.json({ success: true, status: rm.getAllStatus(), health: rm.getHealth() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEXT ANALYSIS ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router.post('/analyze/sentiment', async (req, res) => {
  try {
    const { TextAnalyzer } = await import('../multimodal/multimodal-system.js');
    const result = TextAnalyzer.sentiment(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/analyze/keywords', async (req, res) => {
  try {
    const { TextAnalyzer } = await import('../multimodal/multimodal-system.js');
    const result = TextAnalyzer.extractKeywords(req.body.text, req.body.limit);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/analyze/entities', async (req, res) => {
  try {
    const { TextAnalyzer } = await import('../multimodal/multimodal-system.js');
    const result = TextAnalyzer.extractEntities(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/analyze/language', async (req, res) => {
  try {
    const { TextAnalyzer } = await import('../multimodal/multimodal-system.js');
    const result = TextAnalyzer.detectLanguage(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/analyze/statistics', async (req, res) => {
  try {
    const { TextAnalyzer } = await import('../multimodal/multimodal-system.js');
    const result = TextAnalyzer.statistics(req.body.text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;