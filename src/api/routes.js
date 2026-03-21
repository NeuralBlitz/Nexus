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

export default router;