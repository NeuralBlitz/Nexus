#!/usr/bin/env node

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import apiRoutes, { attachContext } from './api/routes.js';
import { getDatabase } from './persistence.js';
import { getGitHub, getSlack, getWebhookManager, createWebhookMiddleware } from './integrations.js';
import gitTool from './tools/git.js';
import dockerTool from './tools/docker.js';

// Comprehensive Systems
import { Agent, AgentRegistry, AgentState, getAgentRegistry } from './agents/agent-system.js';
import './agents/additional-agents.js';
import { 
  ProviderManager, 
  OpenAIProvider, 
  AnthropicProvider, 
  OllamaProvider,
  getProviderManager 
} from './providers/provider-system.js';
import { 
  ChannelManager, 
  WebSocketChannel, 
  HTTPChannel, 
  CLIChannel,
  SlackChannel,
  DiscordChannel,
  TelegramChannel,
  getChannelManager 
} from './channels/channel-system.js';
import { additionalChannels } from './channels/additional-channels.js';

// Advanced Systems
import { getMemoryManager, MemoryType } from './memory/memory-system.js';
import { getPluginManager, PluginState } from './plugins/plugin-system.js';
import { getEventBus, Event, EventPriority } from './events/event-bus.js';
import { getQueueManager, JobPriority } from './queue/task-queue.js';
import { getSecurityManager, Permission, Roles } from './security/security-system.js';
import { getCodeSandbox, Language as CodeLanguage } from './sandbox/code-sandbox.js';
import { getKnowledgeGraph, NodeType, RelationType } from './knowledge/knowledge-graph.js';
import { getWorkflowManager, StepType } from './workflow/workflow-engine.js';
import { getLLMOrchestrator, TaskCategory, ModelCapability } from './orchestrator/llm-orchestrator.js';

// Advanced Integrations
import { RateLimiter, WebhookVerifier, AgentCommunicator, RedisCache } from './integrations/advanced-integrations.js';

// Middleware Systems
import { 
  WebSocketAuth, 
  CorsMiddleware, 
  RequestLogger, 
  CompressionMiddleware, 
  HealthChecker,
  APIKeyManager 
} from './integrations/middleware.js';

// Webhook Providers
import { 
  WebhookProviderManager,
  GitLabWebhookProvider,
  BitbucketWebhookProvider,
  N8NWebhookProvider,
  ZapierWebhookProvider
} from './integrations/webhook-providers.js';

// File Upload Handler
import { FileUploadHandler, FileAnalyzer } from './integrations/file-upload.js';

// App Integrations (10 common apps)
import { 
  getIntegrationManager,
  NotionIntegration,
  CanvaIntegration,
  FigmaIntegration,
  LinearIntegration,
  JiraIntegration,
  TrelloIntegration,
  AirtableIntegration,
  GoogleWorkspaceIntegration,
  SalesforceIntegration,
  HubSpotIntegration
} from './integrations/app-integrations.js';

// More App Integrations (10 more apps)
import { createIntegrationRoutes } from './integrations/routes-v6.js';

// Enterprise App Integrations (13 apps)
import { createEnterpriseRoutes } from './integrations/routes-v7.js';

// Social & Communication Integrations (9 apps)
import { createSocialRoutes } from './integrations/routes-v8.js';

// DevOps & Infrastructure Integrations (11 apps)
import { createDevopsRoutes } from './integrations/routes-v9.js';

// Business & Productivity Integrations (18 apps)
import { createBusinessRoutes } from './integrations/routes-v10.js';

// Marketing & Analytics Integrations (20 apps)
import { createMarketingRoutes } from './integrations/routes-v11.js';

// IoT, Hardware & Utility Integrations (10 apps)
import { createIoTRoutes } from './integrations/routes-v12.js';

// Data, Scientific & Research Integrations (20 apps)
import { createDataRoutes } from './integrations/routes-v13.js';

// Education, Media & Communication Integrations (30 apps)
import { createMediaRoutes } from './integrations/routes-v14.js';

// Fintech, Healthcare & Lifestyle Integrations (30 apps)
import { createLifestyleRoutes } from './integrations/routes-v15.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════
// NEXUS COMMAND PLATFORM - Unified AI Agent System
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  port: parseInt(process.env.NEXUS_PORT || process.env.PORT || 3000),
  ollama: {
    baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'qwen2.5', 'phi3', 'deepseek-r1']
  },
  providers: {
    opencode: { enabled: true, command: 'opencode' },
    claude: { enabled: true, command: 'claude' },
    openai: { enabled: !!process.env.OPENAI_API_KEY, apiKey: process.env.OPENAI_API_KEY },
    anthropic: { enabled: !!process.env.ANTHROPIC_API_KEY, apiKey: process.env.ANTHROPIC_API_KEY }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE STATE
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  platform: {
    name: 'NEXUS',
    version: '1.0.0',
    uptime: Date.now(),
    status: 'OPERATIONAL'
  },
  agents: {},
  providers: {},
  models: {
    local: [],
    cloud: []
  },
  sessions: [],
  history: [],
  tools: {
    file: true,
    bash: true,
    web: true,
    search: true,
    code: true
  },
  channels: {
    cli: true,
    websocket: true,
    http: true
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// AI PROVIDERS (Legacy compatibility - uses new Provider System)
// ═══════════════════════════════════════════════════════════════════════════

// Legacy OpenCode Provider
class OpenCodeProvider {
  constructor() {
    this.name = 'OpenCode';
    this.enabled = CONFIG.providers.opencode.enabled;
  }

  async complete(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const output = execSync(`opencode run "${prompt.replace(/"/g, '\\"')}" 2>&1`, { timeout: 60000 });
        const clean = output.toString()
          .replace(/\x1b\[[0-9;]*m/g, '')
          .replace(/^> build · .+$/gm, '')
          .replace(/^◈ .+$/gm, '')
          .trim();
        resolve({ content: clean, provider: this.name });
      } catch (e) {
        reject(new Error(e.message || 'OpenCode failed'));
      }
    });
  }
}

// Legacy Claude Code Provider
class ClaudeProvider {
  constructor() {
    this.name = 'Claude';
    this.enabled = CONFIG.providers.claude.enabled;
  }

  async complete(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn('claude', ['--print', prompt]);
      let output = '';
      
      proc.stdout.on('data', d => output += d.toString());
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ content: output.trim(), provider: this.name });
        } else {
          reject(new Error('Claude CLI failed'));
        }
      });
      
      setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, 120000);
    });
  }
}

// Initialize legacy providers (for backward compatibility)
// The new comprehensive provider system is initialized later
const providers = {
  opencode: new OpenCodeProvider(),
  claude: new ClaudeProvider(),
  ollama: { name: 'Ollama', enabled: true },  // Placeholder - new system handles this
  openai: { name: 'OpenAI', enabled: !!process.env.OPENAI_API_KEY },  // Placeholder
  anthropic: { name: 'Anthropic', enabled: !!process.env.ANTHROPIC_API_KEY }  // Placeholder
};

// ═══════════════════════════════════════════════════════════════════════════
// AGENT EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

async function executeAgentTask(agentId, task, provider = 'auto') {
  const agent = state.agents[agentId];
  if (!agent) throw new Error('Agent not found');
  
  agent.status = 'WORKING';
  agent.currentTask = task;
  broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } }, agentId);
  
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
    
    log(`🤖 ${agent.icon} ${agent.name} using ${selectedProvider.name}`, 'AGENT');
    
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
    
    broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } }, agentId);
    broadcast({ type: 'TASK_COMPLETE', agent: agentId, task, result }, agentId);
    
    log(`✅ ${agent.icon} ${agent.name} completed task (${result.duration}s)`, 'SUCCESS');
    
    return result;
    
  } catch (error) {
    agent.status = 'ERROR';
    agent.currentTask = null;
    log(`❌ ${agent.icon} ${agent.name} failed: ${error.message}`, 'ERROR');
    broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } }, agentId);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function log(msg, type = 'INFO') {
  const entry = { time: new Date().toISOString(), type, msg };
  state.history.unshift(entry);
  if (state.history.length > 1000) state.history.pop();
  console.log(`[${type}] ${msg}`);
  broadcast({ type: 'LOG', entry });
}

function broadcast(data, agentId = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      // If agentId specified, check if client subscribed to that agent
      if (agentId) {
        // If client subscribes to all, send
        if (client.subscribeAll) {
          client.send(msg);
        } else if (client.subscriptions && client.subscriptions.has(agentId)) {
          client.send(msg);
        }
        // else skip
      } else {
        // System message, send to all
        client.send(msg);
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WEB SERVER & WEBSOCKET
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());
app.use(express.static(join(rootDir, 'src/web/public')));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket handling
wss.on('connection', (ws) => {
  // Connection state
  ws.isAlive = true;
  ws.subscriptions = new Set(); // specific agent IDs, empty means subscribeAll
  ws.subscribeAll = true;
  
  log('Client connected', 'SYSTEM');
  ws.send(JSON.stringify({ type: 'INIT', state, subscriptions: { subscribeAll: true, agents: [] } }));
  
  // Heartbeat
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', async (msg) => {
    try {
      const cmd = JSON.parse(msg);
      await handleCommand(ws, cmd);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'ERROR', error: e.message }));
    }
  });
  
  ws.on('close', () => {
    log('Client disconnected', 'SYSTEM');
  });
});

async function handleCommand(ws, cmd) {
  switch (cmd.type) {
    case 'EXECUTE':
      const result = await executeAgentTask(cmd.agent || 'NEXUS-1', cmd.task, cmd.provider);
      ws.send(JSON.stringify({ type: 'RESULT', result }));
      break;
      
    case 'EXECUTE_ALL':
      const results = await Promise.all(
        Object.keys(state.agents).map(id => executeAgentTask(id, cmd.task, cmd.provider))
      );
      ws.send(JSON.stringify({ type: 'RESULTS', results }));
      break;
      
    case 'STREAM':
      const streamProvider = providers[cmd.provider] || providers.ollama;
      ws.send(JSON.stringify({ type: 'STREAM_START' }));
      if (typeof streamProvider.stream === 'function') {
        for await (const chunk of streamProvider.stream(cmd.task)) {
          ws.send(JSON.stringify({ type: 'STREAM_CHUNK', chunk }));
        }
      } else {
        // Fallback to non-streaming
        const result = await streamProvider.complete(cmd.task);
        ws.send(JSON.stringify({ type: 'STREAM_CHUNK', chunk: result.content }));
      }
      ws.send(JSON.stringify({ type: 'STREAM_END' }));
      break;
      
    case 'EXECUTE_STREAM':
      const agentId = cmd.agent || 'NEXUS-1';
      const agent = state.agents[agentId];
      if (!agent) {
        ws.send(JSON.stringify({ type: 'ERROR', error: 'Agent not found' }));
        break;
      }
      agent.status = 'WORKING';
      agent.currentTask = cmd.task;
      broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } }, agentId);
      
      const agentStreamProvider = providers[cmd.provider] || providers.ollama;
      ws.send(JSON.stringify({ type: 'STREAM_START', agent: agentId }));
      let fullContent = '';
      const startTime = Date.now();
      try {
        if (typeof agentStreamProvider.stream === 'function') {
          for await (const chunk of agentStreamProvider.stream(cmd.task)) {
            fullContent += chunk;
            broadcast({ type: 'STREAM_CHUNK', agent: agentId, chunk }, agentId);
          }
        } else {
          // Fallback to non-streaming
          const response = await agentStreamProvider.complete(cmd.task);
          fullContent = response.content;
          broadcast({ type: 'STREAM_CHUNK', agent: agentId, chunk: fullContent }, agentId);
        }
        const result = {
          content: fullContent,
          provider: agentStreamProvider.name,
          duration: Math.round((Date.now() - startTime) / 1000),
          tokens: Math.floor(fullContent.length / 4)
        };
        agent.status = 'STANDBY';
        agent.currentTask = null;
        agent.tasksCompleted++;
        agent.xp += Math.floor(result.tokens / 10);
        agent.level = Math.floor(agent.xp / 100) + 1;
        agent.lastActive = Date.now();
        broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } }, agentId);
        broadcast({ type: 'TASK_COMPLETE', agent: agentId, task: cmd.task, result }, agentId);
        ws.send(JSON.stringify({ type: 'STREAM_END', agent: agentId }));
      } catch (error) {
        agent.status = 'ERROR';
        agent.currentTask = null;
        broadcast({ type: 'AGENT_UPDATE', agent: { id: agentId, ...agent } }, agentId);
        ws.send(JSON.stringify({ type: 'ERROR', error: error.message }));
      }
      break;
      
    case 'QUERY_OLLAMA':
      ws.send(JSON.stringify({ type: 'OLLAMA_STATUS', online: false }));
      break;
      
    case 'GET_STATE':
      ws.send(JSON.stringify({ type: 'STATE', state }));
      break;
      
    case 'GET_PROVIDERS':
      const providerStatus = Object.entries(providers).map(([name, p]) => ({
        name,
        enabled: p.enabled,
        online: true
      }));
      ws.send(JSON.stringify({ type: 'PROVIDERS', providers: providerStatus }));
      break;
      
    case 'SUBSCRIBE':
      if (cmd.agent === '*') {
        ws.subscribeAll = true;
        ws.subscriptions.clear();
      } else if (cmd.agent) {
        ws.subscribeAll = false;
        ws.subscriptions.add(cmd.agent);
      }
      ws.send(JSON.stringify({ 
        type: 'SUBSCRIPTIONS', 
        subscriptions: { 
          subscribeAll: ws.subscribeAll, 
          agents: Array.from(ws.subscriptions) 
        } 
      }));
      break;
      
    case 'UNSUBSCRIBE':
      if (cmd.agent === '*') {
        ws.subscribeAll = false;
        ws.subscriptions.clear();
      } else if (cmd.agent) {
        ws.subscriptions.delete(cmd.agent);
        if (ws.subscriptions.size === 0) {
          ws.subscribeAll = false; // no subscriptions
        }
      }
      ws.send(JSON.stringify({ 
        type: 'SUBSCRIPTIONS', 
        subscriptions: { 
          subscribeAll: ws.subscribeAll, 
          agents: Array.from(ws.subscriptions) 
        } 
      }));
      break;
      
    case 'LIST_SUBSCRIPTIONS':
      ws.send(JSON.stringify({ 
        type: 'SUBSCRIPTIONS', 
        subscriptions: { 
          subscribeAll: ws.subscribeAll, 
          agents: Array.from(ws.subscriptions) 
        } 
      }));
      break;
  }
}

// REST API - Mount new routes
app.use('/api', attachContext(state, providers));
app.use('/api', apiRoutes);

// ═══════════════════════════════════════════════════════════════════════════
// STATIC FILES - Serve Dashboard
// ═══════════════════════════════════════════════════════════════════════════
app.use(express.static(join(rootDir, 'public')));

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(join(rootDir, 'public', 'dashboard.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE & INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════
const db = await getDatabase().initialize();
const github = getGitHub();
const slack = getSlack();
const webhooks = getWebhookManager(process.env.WEBHOOK_SECRET);

// Webhook middleware
app.use(express.json());
app.use(createWebhookMiddleware(webhooks));

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE SYSTEMS - Agent, Provider, Channel
// ═══════════════════════════════════════════════════════════════════════════

// Initialize comprehensive systems
const agentRegistry = getAgentRegistry();
const providerManager = getProviderManager();
const channelManager = getChannelManager();

// Initialize providers
const PROVIDERS = {
  openai: new OpenAIProvider({ enabled: !!process.env.OPENAI_API_KEY, apiKey: process.env.OPENAI_API_KEY }),
  anthropic: new AnthropicProvider({ enabled: !!process.env.ANTHROPIC_API_KEY, apiKey: process.env.ANTHROPIC_API_KEY }),
  ollama: new OllamaProvider({ enabled: true, baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434' })
};

// Load additional providers
try {
  const { GoogleAIProvider, MistralProvider, CohereProvider, AI21Provider, MetaProvider, HuggingFaceProvider, ReplicateProvider, PerplexityProvider, GroqProvider, DeepSeekProvider, FireworksProvider, TogetherProvider, AnyscaleProvider, CloudflareProvider, StabilityAIProvider } = await import('./providers/additional-providers.js');
  const extraProviders = [
    new GoogleAIProvider({ id: 'google-ai', name: 'Google AI', apiKey: process.env.GOOGLE_AI_API_KEY || '' }),
    new MistralProvider({ id: 'mistral', name: 'Mistral AI', apiKey: process.env.MISTRAL_API_KEY || '' }),
    new CohereProvider({ id: 'cohere', name: 'Cohere', apiKey: process.env.COHERE_API_KEY || '' }),
    new AI21Provider({ id: 'ai21', name: 'AI21 Jamba', apiKey: process.env.AI21_API_KEY || '' }),
    new MetaProvider({ id: 'meta', name: 'Meta AI', apiKey: process.env.META_API_KEY || '' }),
    new HuggingFaceProvider({ id: 'huggingface', name: 'Hugging Face', apiKey: process.env.HUGGINGFACE_API_KEY || '' }),
    new ReplicateProvider({ id: 'replicate', name: 'Replicate', apiKey: process.env.REPLICATE_API_KEY || '' }),
    new PerplexityProvider({ id: 'perplexity', name: 'Perplexity', apiKey: process.env.PERPLEXITY_API_KEY || '' }),
    new GroqProvider({ id: 'groq', name: 'Groq', apiKey: process.env.GROQ_API_KEY || '' }),
    new DeepSeekProvider({ id: 'deepseek', name: 'DeepSeek', apiKey: process.env.DEEPSEEK_API_KEY || '' }),
    new FireworksProvider({ id: 'fireworks', name: 'Fireworks AI', apiKey: process.env.FIREWORKS_API_KEY || '' }),
    new TogetherProvider({ id: 'together', name: 'Together AI', apiKey: process.env.TOGETHER_API_KEY || '' }),
    new AnyscaleProvider({ id: 'anyscale', name: 'Anyscale', apiKey: process.env.ANYSCALE_API_KEY || '' }),
    new CloudflareProvider({ id: 'cloudflare', name: 'Cloudflare Workers AI', apiKey: process.env.CLOUDFLARE_API_KEY || '', accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '' }),
    new StabilityAIProvider({ id: 'stability', name: 'Stability AI', apiKey: process.env.STABILITY_API_KEY || '' })
  ];

  extraProviders.forEach(provider => {
    if (provider.apiKey) {
      PROVIDERS[provider.id] = provider;
      console.log(`✅ Provider loaded: ${provider.name}`);
    }
  });
} catch (error) {
  console.warn('⚠️ Failed to load additional providers:', error.message);
}

// Register providers with provider manager
Object.values(PROVIDERS).forEach(provider => {
  providerManager.register(provider);
});

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED SYSTEMS - Memory, Events, Queue, Security, Sandbox, Knowledge
// ═══════════════════════════════════════════════════════════════════════════

// Initialize Advanced Systems
const memory = getMemoryManager();
const pluginManager = getPluginManager({ pluginDirs: ['./src/plugins/community'] });
await pluginManager.initialize();
const eventBus = getEventBus();
const queueManager = getQueueManager();
const security = getSecurityManager();
const codeSandbox = getCodeSandbox();
const knowledgeGraph = getKnowledgeGraph();

// Initialize Advanced Integrations
const rateLimiter = new RateLimiter();
const webhookVerifier = new WebhookVerifier();
const agentCommunicator = new AgentCommunicator();
const redisCache = new RedisCache();

// Initialize Middleware
const wsAuth = new WebSocketAuth();
const corsMiddleware = new CorsMiddleware();
const requestLogger = new RequestLogger();
const compressionMiddleware = new CompressionMiddleware();
const healthChecker = new HealthChecker();
const apiKeyManager = new APIKeyManager();
// Simple security middleware using SecurityManager
const securityMiddleware = (req, res, next) => {
  const auth = security.authenticate(req);
  req.security = security;
  req.auth = auth;
  next();
};

// Initialize Webhook Providers (constructor registers GitLab, Bitbucket, N8N, Zapier defaults)
const webhookProviderManager = new WebhookProviderManager();

// Initialize File Upload
const fileUploadHandler = new FileUploadHandler();

// Initialize Channels (only if tokens provided)
const discordChannel = process.env.DISCORD_TOKEN
  ? new DiscordChannel({ token: process.env.DISCORD_TOKEN, clientId: process.env.DISCORD_CLIENT_ID, guildId: process.env.DISCORD_GUILD_ID })
  : null;
const telegramChannel = process.env.TELEGRAM_TOKEN
  ? new TelegramChannel({ token: process.env.TELEGRAM_TOKEN })
  : null;

// Register channels with ChannelManager
try {
  if (discordChannel) {
    await channelManager.register(discordChannel);
    console.log('✅ Discord channel registered');
  }
  if (telegramChannel) {
    await channelManager.register(telegramChannel);
    console.log('✅ Telegram channel registered');
  }
} catch (error) {
  console.warn('⚠️ Channel registration error:', error.message);
}

// Apply middleware
app.use(securityMiddleware);

// Event bus middleware for request tracking
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    eventBus.publish(new Event('http:request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - startTime
    }, { source: 'http-server' }));
  });
  next();
});

console.log(`✅ Memory System: ${memory.getStats().episodic + memory.getStats().semantic} memories`);
console.log(`✅ Plugin Manager: ${pluginManager.getAll().length} plugins discovered`);
console.log(`✅ Event Bus: Ready (${eventBus.getStats().nodeId})`);
console.log(`✅ Task Queue: ${Object.keys(queueManager.getAllStats()).length} queues active`);
console.log(`✅ Security Manager: ${security.getStats().users} users, ${security.getStats().apiKeys} API keys`);
console.log(`✅ Code Sandbox: Ready`);
console.log(`✅ Knowledge Graph: ${knowledgeGraph.getStats().nodes} nodes`);

// Advanced Integrations Status
console.log(`✅ Rate Limiter: Active (${rateLimiter.getStats().maxRequests} req/min)`);
console.log(`✅ Webhook Verifier: Ready`);
console.log(`✅ Agent Communicator: ${agentCommunicator.getStats().totalAgents} agents, ${agentCommunicator.getStats().totalProtocols} protocols`);
console.log(`✅ Redis Cache: ${redisCache.connected ? 'Connected' : 'In-memory fallback'}`);

// Middleware Systems Status
console.log(`✅ CORS Middleware: Active`);
console.log(`✅ Request Logger: ${requestLogger.logLevel} level`);
console.log(`✅ Health Checker: ${healthChecker.getStats().checkCount} checks registered`);
console.log(`✅ WebSocket Auth: Ready`);
console.log(`✅ API Key Manager: ${apiKeyManager.getStats().total} keys`);
console.log(`✅ Webhook Providers: GitLab, Bitbucket, N8N, Zapier`);
console.log(`✅ File Upload Handler: ${fileUploadHandler.maxFileSize / 1024 / 1024}MB max`);

// Initialize App Integrations Manager
const integrationManager = getIntegrationManager();

// Initialize individual integrations
const notion = new NotionIntegration({ apiKey: process.env.NOTION_API_KEY });
const canva = new CanvaIntegration({ accessToken: process.env.CANVA_ACCESS_TOKEN });
const figma = new FigmaIntegration({ apiKey: process.env.FIGMA_ACCESS_TOKEN });
const linear = new LinearIntegration({ apiKey: process.env.LINEAR_API_KEY });
const jira = new JiraIntegration({ 
  domain: process.env.JIRA_DOMAIN, 
  email: process.env.JIRA_EMAIL, 
  apiKey: process.env.JIRA_API_TOKEN 
});
const trello = new TrelloIntegration({ 
  appKey: process.env.TRELLO_APP_KEY, 
  token: process.env.TRELLO_TOKEN 
});
const airtable = new AirtableIntegration({ apiKey: process.env.AIRTABLE_API_KEY });
const google = new GoogleWorkspaceIntegration({ accessToken: process.env.GOOGLE_ACCESS_TOKEN });
const salesforce = new SalesforceIntegration({ 
  accessToken: process.env.SALESFORCE_ACCESS_TOKEN,
  instanceUrl: process.env.SALESFORCE_INSTANCE_URL
});
const hubspot = new HubSpotIntegration({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

// Register integrations
integrationManager.register('notion', notion);
integrationManager.register('canva', canva);
integrationManager.register('figma', figma);
integrationManager.register('linear', linear);
integrationManager.register('jira', jira);
integrationManager.register('trello', trello);
integrationManager.register('airtable', airtable);
integrationManager.register('google', google);
integrationManager.register('salesforce', salesforce);
integrationManager.register('hubspot', hubspot);

// Log integration status
const integrationStatus = integrationManager.getConfigured();
console.log(`✅ App Integrations: ${integrationStatus.length}/10 configured`);

// Initialize More App Integrations (v6 - 10 more apps)
const v6Integrations = createIntegrationRoutes(app);
console.log(`✅ More Integrations: ${v6Integrations.manager.getAll().length} total integrations registered`);

// Initialize Enterprise App Integrations (v7 - 13 apps)
const v7Integrations = createEnterpriseRoutes(app);
console.log(`✅ Enterprise Integrations: ${v7Integrations.manager.getAll().length} total integrations registered`);

// Initialize Social & Communication Integrations (v8 - 9 apps)
const v8Integrations = createSocialRoutes(app);
console.log(`✅ Social Integrations: ${v8Integrations.manager.getAll().length} total integrations registered`);

// Initialize DevOps & Infrastructure Integrations (v9 - 11 apps)
const v9Integrations = createDevopsRoutes(app);
console.log(`✅ DevOps Integrations: ${v9Integrations.manager.getAll().length} total integrations registered`);

// Initialize Business & Productivity Integrations (v10 - 18 apps)
const v10Integrations = createBusinessRoutes(app);
console.log(`✅ Business Integrations: ${v10Integrations.manager.getAll().length} total integrations registered`);

// Initialize Marketing & Analytics Integrations (v11 - 20 apps)
const v11Integrations = createMarketingRoutes(app);
console.log(`✅ Marketing Integrations: ${v11Integrations.manager.getAll().length} total integrations registered`);

// Initialize IoT, Hardware & Utility Integrations (v12 - 10 apps)
const v12Integrations = createIoTRoutes(app);
console.log(`✅ IoT Integrations: ${v12Integrations.manager.getAll().length} total integrations registered`);

// Initialize Data, Scientific & Research Integrations (v13 - 20 apps)
const v13Integrations = createDataRoutes(app);
console.log(`✅ Data Integrations: ${v13Integrations.manager.getAll().length} total integrations registered`);

// Initialize Education, Media & Communication Integrations (v14 - 30 apps)
const v14Integrations = createMediaRoutes(app);
console.log(`✅ Media Integrations: ${v14Integrations.manager.getAll().length} total integrations registered`);

// Initialize Fintech, Healthcare & Lifestyle Integrations (v15 - 30 apps)
const v15Integrations = createLifestyleRoutes(app);
console.log(`✅ Lifestyle Integrations: ${v15Integrations.manager.getAll().length} total integrations registered`);

// Initialize Workflow Engine
const workflowManager = getWorkflowManager();

// Create sample workflows
const codeReviewWorkflow = workflowManager.createWorkflow({
  name: 'Code Review Pipeline',
  description: 'Automated code review with testing',
  tags: ['code', 'review', 'automated'],
  steps: [
    { id: 'lint', name: 'Lint Code', type: StepType.CODE, config: { code: 'return { passed: true };' } },
    { id: 'test', name: 'Run Tests', type: StepType.AGENT, dependsOn: ['lint'], config: { agentId: 'TESTER' } },
    { id: 'review', name: 'AI Review', type: StepType.AGENT, dependsOn: ['test'], config: { agentId: 'CODEX' } },
    { id: 'report', name: 'Generate Report', type: StepType.CODE, dependsOn: ['review'], config: { code: 'return { report: "Review complete" };' } }
  ],
  entryPoints: ['lint']
});

// Initialize LLM Orchestrator
const llmOrchestrator = getLLMOrchestrator({
  cache: { maxSize: 1000, ttl: 3600000 },
  fallbackChain: ['gpt-3.5-turbo', 'llama3.2']
});

// Register models with orchestrator
llmOrchestrator.registerModel({
  id: 'gpt-4',
  name: 'GPT-4',
  provider: 'openai',
  capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING],
  supportedCategories: [TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.CREATIVE],
  metrics: { qualityScore: 0.95, costPerToken: 0.00003, avgLatency: 3000 },
  limits: { maxTokens: 8192, contextWindow: 128000 }
});

llmOrchestrator.registerModel({
  id: 'gpt-3.5-turbo',
  name: 'GPT-3.5 Turbo',
  provider: 'openai',
  capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
  supportedCategories: Object.values(TaskCategory),
  metrics: { qualityScore: 0.85, costPerToken: 0.000001, avgLatency: 1000 },
  limits: { maxTokens: 4096, contextWindow: 16385 }
});

llmOrchestrator.registerModel({
  id: 'claude-3-opus',
  name: 'Claude 3 Opus',
  provider: 'anthropic',
  capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.LONG_CONTEXT],
  supportedCategories: [TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.CREATIVE, TaskCategory.SUMMARIZATION],
  metrics: { qualityScore: 0.93, costPerToken: 0.000015, avgLatency: 2500 },
  limits: { maxTokens: 4096, contextWindow: 200000 }
});

llmOrchestrator.registerModel({
  id: 'llama3.2',
  name: 'Llama 3.2',
  provider: 'ollama',
  capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
  supportedCategories: [TaskCategory.TEXT_GENERATION, TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION],
  metrics: { qualityScore: 0.75, costPerToken: 0, avgLatency: 500 },
  limits: { maxTokens: 4096, contextWindow: 128000 }
});

// Register templates
llmOrchestrator.registerTemplate({
  id: 'code-review',
  name: 'Code Review Template',
  category: TaskCategory.CODE_REVIEW,
  systemPrompt: 'You are an expert code reviewer. Analyze the code for bugs, security issues, and improvements.',
  template: 'Please review the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\nProvide feedback on: correctness, security, performance, and style.'
});

llmOrchestrator.registerTemplate({
  id: 'debug-help',
  name: 'Debug Assistant',
  category: TaskCategory.CODE_DEBUG,
  systemPrompt: 'You are a debugging expert. Help identify and fix issues in code.',
  template: 'I\'m getting the following error:\n\n```\n{{error}}\n```\n\nIn this code:\n\n```{{language}}\n{{code}}\n```\n\nPlease help me fix it.'
});

console.log(`✅ Workflow Engine: ${workflowManager.getAllWorkflows().length} workflows`);
console.log(`✅ LLM Orchestrator: ${llmOrchestrator.models.size} models registered`);

// Periodic maintenance
setInterval(async () => {
  await memory.consolidate();
  eventBus.eventStore.compact();
}, 300000); // Every 5 minutes

// ═══════════════════════════════════════════════════════════════════════════
// TOOLS API
// ═══════════════════════════════════════════════════════════════════════════

// Git operations
app.get('/api/tools/git/status', async (req, res) => {
  try {
    const status = await gitTool.getStatus(req.query.cwd);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tools/git/log', async (req, res) => {
  try {
    const log = await gitTool.getLog(req.query.cwd, parseInt(req.query.limit) || 20);
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/git/commit', async (req, res) => {
  try {
    const result = await gitTool.commit(req.body.message, req.body.options);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/git/push', async (req, res) => {
  try {
    const result = await gitTool.push(req.body.options);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/git/pull', async (req, res) => {
  try {
    const result = await gitTool.pull(req.body.options);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Docker operations
app.get('/api/tools/docker/containers', async (req, res) => {
  try {
    const containers = await dockerTool.listContainers({ all: req.query.all === 'true' });
    res.json({ success: true, data: containers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tools/docker/images', async (req, res) => {
  try {
    const images = await dockerTool.listImages();
    res.json({ success: true, data: images });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tools/docker/system', async (req, res) => {
  try {
    const info = await dockerTool.getSystemInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TASKS API (Persistence)
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = db.getRecentTasks({
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      status: req.query.status,
      agentId: req.query.agentId
    });
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tasks/stats', async (req, res) => {
  try {
    const stats = db.getTaskStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = db.createTask(req.body);
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const updated = db.updateTask(req.params.id, req.body);
    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS API (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/agents', (req, res) => {
  const agentsList = Object.values(state.agents).map(agent => ({
    ...agent,
    stats: db.getAgentStats(agent.id)
  }));
  res.json({ success: true, agents: agentsList });
});

app.get('/api/agents/:id', (req, res) => {
  const agent = state.agents[req.params.id];
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  const stats = db.getAgentStats(req.params.id);
  const history = db.getAgentHistory(req.params.id, { limit: 20 });
  res.json({ success: true, agent, stats, history });
});

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB INTEGRATION API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/integrations/github/status', (req, res) => {
  res.json({ success: true, configured: github.isConfigured() });
});

app.get('/api/integrations/github/user', async (req, res) => {
  try {
    const user = await github.getUser();
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/integrations/github/repos', async (req, res) => {
  try {
    const repos = await github.listRepos(req.query);
    res.json({ success: true, repos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/integrations/github/repos/:owner/:repo/issues', async (req, res) => {
  try {
    const issues = await github.listIssues(req.params.owner, req.params.repo, req.query);
    res.json({ success: true, issues });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/integrations/github/repos/:owner/:repo/issues', async (req, res) => {
  try {
    const issue = await github.createIssue(req.params.owner, req.params.repo, req.body);
    db.logIntegrationEvent('github', 'create_issue', { owner: req.params.owner, repo: req.params.repo });
    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SLACK INTEGRATION API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/integrations/slack/status', (req, res) => {
  res.json({ success: true, configured: slack.isConfigured() });
});

app.post('/api/integrations/slack/message', async (req, res) => {
  try {
    const result = await slack.postMessage(req.body.channel, req.body.text, req.body.options);
    db.logIntegrationEvent('slack', 'post_message', { channel: req.body.channel });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/integrations/slack/channels', async (req, res) => {
  try {
    const channels = await slack.listChannels(req.query);
    res.json({ success: true, channels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS API
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/webhooks/send', async (req, res) => {
  try {
    const result = await webhooks.send(req.body.url, req.body.event, req.body.data);
    db.logIntegrationEvent('webhook', 'send', { url: req.body.url, event: req.body.event });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/webhooks/logs', (req, res) => {
  const logs = webhooks.getLogs(parseInt(req.query.limit) || 50);
  res.json({ success: true, logs });
});

app.get('/api/integration-logs', (req, res) => {
  const logs = db.getIntegrationLogs(req.query.integration, parseInt(req.query.limit) || 100);
  res.json({ success: true, logs });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE SYSTEMS API
// ═══════════════════════════════════════════════════════════════════════════

// Agents API
app.get('/api/v2/agents', (req, res) => {
  const status = agentRegistry.getStatus();
  res.json({ success: true, ...status });
});

app.get('/api/v2/agents/:id', (req, res) => {
  const agent = agentRegistry.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({ success: true, agent: agent.getStatus() });
});

app.post('/api/v2/agents/:id/execute', async (req, res) => {
  try {
    const agent = agentRegistry.get(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    const result = await agent.execute(req.body.task, req.body.context);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v2/agents/assign', async (req, res) => {
  try {
    const result = await agentRegistry.assignTask(req.body.task, req.body.options);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v2/agents/available', (req, res) => {
  const available = agentRegistry.getAvailable();
  res.json({ success: true, agents: available.map(a => a.getStatus()) });
});

app.get('/api/v2/agents/capability/:capability', (req, res) => {
  const agents = agentRegistry.getByCapability(req.params.capability);
  res.json({ success: true, agents: agents.map(a => a.getStatus()) });
});

// Providers API
app.get('/api/v2/providers', (req, res) => {
  const status = providerManager.getStatus();
  res.json({ success: true, ...status });
});

app.get('/api/v2/providers/:id', (req, res) => {
  const provider = providerManager.get(req.params.id);
  if (!provider) {
    return res.status(404).json({ success: false, error: 'Provider not found' });
  }
  res.json({ success: true, provider: provider.getStatus() });
});

app.get('/api/v2/providers/:id/models', (req, res) => {
  const provider = providerManager.get(req.params.id);
  if (!provider) {
    return res.status(404).json({ success: false, error: 'Provider not found' });
  }
  res.json({ success: true, models: provider.getModels() });
});

app.post('/api/v2/providers/chat', async (req, res) => {
  try {
    const result = await providerManager.chatWithFailover(req.body.messages, req.body.options);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v2/providers/health-check', async (req, res) => {
  try {
    const results = await providerManager.healthCheckAll();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v2/providers/:id/enable', (req, res) => {
  const provider = providerManager.get(req.params.id);
  if (!provider) {
    return res.status(404).json({ success: false, error: 'Provider not found' });
  }
  provider.enable();
  res.json({ success: true });
});

app.post('/api/v2/providers/:id/disable', (req, res) => {
  const provider = providerManager.get(req.params.id);
  if (!provider) {
    return res.status(404).json({ success: false, error: 'Provider not found' });
  }
  provider.disable();
  res.json({ success: true });
});

// Channels API
app.get('/api/v2/channels', (req, res) => {
  const status = channelManager.getStatus();
  res.json({ success: true, ...status });
});

app.get('/api/v2/channels/:id', (req, res) => {
  const channel = channelManager.get(req.params.id);
  if (!channel) {
    return res.status(404).json({ success: false, error: 'Channel not found' });
  }
  res.json({ success: true, channel: channel.getStatus() });
});

app.post('/api/v2/channels/:id/send', async (req, res) => {
  try {
    const channel = channelManager.get(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    await channel.send(req.body.target, req.body.message, req.body.options);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v2/channels/broadcast', async (req, res) => {
  try {
    await channelManager.broadcast(req.body.message, req.body.options);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v2/channels/health', async (req, res) => {
  try {
    const results = await channelManager.healthCheck();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v2/channels/bridge', (req, res) => {
  try {
    const bridgeId = channelManager.bridgeChannels(
      req.body.channel1,
      req.body.channel2,
      req.body.options
    );
    res.json({ success: true, bridgeId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// System Status API
app.get('/api/v2/system/status', (req, res) => {
  const systemStatus = {
    platform: {
      name: 'NEXUS',
      version: '2.0.0',
      uptime: Date.now() - state.platform.uptime,
      status: 'OPERATIONAL'
    },
    agents: agentRegistry.getStatus(),
    providers: providerManager.getStatus(),
    channels: channelManager.getStatus(),
    database: db.getDatabaseInfo(),
    memory: process.memoryUsage()
  };
  res.json({ success: true, system: systemStatus });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED SYSTEMS API
// ═══════════════════════════════════════════════════════════════════════════

// Memory API
app.get('/api/v3/memory/stats', (req, res) => {
  res.json({ success: true, stats: memory.getStats() });
});

app.get('/api/v3/memory/recall', (req, res) => {
  const results = memory.recall(req.query.q, {
    type: req.query.type,
    limit: parseInt(req.query.limit) || 10,
    agentId: req.query.agentId
  });
  res.json({ success: true, memories: results });
});

app.post('/api/v3/memory/remember', (req, res) => {
  const entry = memory.remember(req.body.content, {
    type: req.body.type,
    importance: req.body.importance,
    tags: req.body.tags,
    agentId: req.body.agentId,
    context: req.body.context
  });
  res.json({ success: true, memory: entry });
});

app.get('/api/v3/memory/context', (req, res) => {
  const context = memory.getContext({
    agentId: req.query.agentId,
    taskDescription: req.query.task
  });
  res.json({ success: true, context });
});

app.post('/api/v3/memory/clear', (req, res) => {
  memory.clear();
  res.json({ success: true });
});

// Plugin API
app.get('/api/v3/plugins', (req, res) => {
  res.json({ success: true, ...pluginManager.getStatus() });
});

app.get('/api/v3/plugins/:id', (req, res) => {
  const plugin = pluginManager.get(req.params.id);
  if (!plugin) return res.status(404).json({ success: false, error: 'Plugin not found' });
  res.json({ success: true, plugin: plugin.getInfo() });
});

app.post('/api/v3/plugins/:id/load', async (req, res) => {
  try {
    await pluginManager.loadAndActivate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v3/plugins/:id/deactivate', async (req, res) => {
  const plugin = pluginManager.get(req.params.id);
  if (!plugin) return res.status(404).json({ success: false, error: 'Plugin not found' });
  await plugin.deactivate();
  res.json({ success: true });
});

// Event Bus API
app.get('/api/v3/events/stats', (req, res) => {
  res.json({ success: true, stats: eventBus.getStats() });
});

app.get('/api/v3/events/history', (req, res) => {
  const events = eventBus.getHistory({
    type: req.query.type,
    source: req.query.source,
    limit: parseInt(req.query.limit) || 50
  });
  res.json({ success: true, events });
});

app.post('/api/v3/events/publish', async (req, res) => {
  const event = await eventBus.publish(new Event(req.body.type, req.body.payload, {
    source: req.body.source || 'api',
    priority: req.body.priority
  }));
  res.json({ success: true, eventId: event.id });
});

app.get('/api/v3/events/dead-letter', (req, res) => {
  const letters = eventBus.getDeadLetterQueue(parseInt(req.query.limit) || 50);
  res.json({ success: true, deadLetters: letters });
});

// Queue API
app.get('/api/v3/queues', (req, res) => {
  res.json({ success: true, queues: queueManager.getAllStats() });
});

app.post('/api/v3/queues/:name/add', async (req, res) => {
  const queue = queueManager.getQueue(req.params.name);
  if (!queue) return res.status(404).json({ success: false, error: 'Queue not found' });
  try {
    const job = await queue.add(req.body.data, req.body.options);
    res.json({ success: true, jobId: job.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v3/queues/:name/job/:jobId', (req, res) => {
  const queue = queueManager.getQueue(req.params.name);
  if (!queue) return res.status(404).json({ success: false, error: 'Queue not found' });
  const job = queue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, job: job.toJSON() });
});

// Security API
app.get('/api/v3/security/stats', (req, res) => {
  res.json({ success: true, stats: security.getStats() });
});

app.get('/api/v3/security/users', (req, res) => {
  const users = Array.from(security.users.values()).map(u => u.toJSON());
  res.json({ success: true, users });
});

app.post('/api/v3/security/users', (req, res) => {
  const user = security.createUser(req.body);
  res.json({ success: true, user: user.toJSON() });
});

app.get('/api/v3/security/api-keys', (req, res) => {
  const keys = Array.from(security.apiKeys.values()).map(k => k.toJSON());
  res.json({ success: true, apiKeys: keys });
});

app.post('/api/v3/security/api-keys', (req, res) => {
  const apiKey = security.createApiKey(req.body);
  res.json({ success: true, apiKey: { id: apiKey.id, key: apiKey.key } });
});

app.get('/api/v3/security/audit-log', (req, res) => {
  const log = security.getAuditLog({
    userId: req.query.userId,
    action: req.query.action,
    limit: parseInt(req.query.limit) || 100
  });
  res.json({ success: true, auditLog: log });
});

// Code Sandbox API
app.get('/api/v3/sandbox/stats', (req, res) => {
  res.json({ success: true, stats: codeSandbox.getStats() });
});

app.post('/api/v3/sandbox/execute', async (req, res) => {
  try {
    const result = await codeSandbox.execute(req.body.code, {
      language: req.body.language || 'javascript',
      timeout: req.body.timeout
    });
    res.json({ success: true, result: result.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v3/sandbox/execution/:id', (req, res) => {
  const result = codeSandbox.getResult(req.params.id);
  if (!result) return res.status(404).json({ success: false, error: 'Execution not found' });
  res.json({ success: true, result: result.toJSON() });
});

app.post('/api/v3/sandbox/kill/:id', async (req, res) => {
  await codeSandbox.kill(req.params.id);
  res.json({ success: true });
});

// Knowledge Graph API
app.get('/api/v3/knowledge/stats', (req, res) => {
  res.json({ success: true, stats: knowledgeGraph.getStats() });
});

app.get('/api/v3/knowledge/nodes', (req, res) => {
  let nodes;
  if (req.query.type) {
    nodes = knowledgeGraph.getNodesByType(req.query.type);
  } else if (req.query.tag) {
    nodes = knowledgeGraph.getNodesByTag(req.query.tag);
  } else {
    nodes = Array.from(knowledgeGraph.nodes.values());
  }
  res.json({ success: true, nodes: nodes.slice(0, parseInt(req.query.limit) || 100) });
});

app.post('/api/v3/knowledge/nodes', (req, res) => {
  const node = knowledgeGraph.addNode(req.body);
  res.json({ success: true, node: node.toJSON() });
});

app.get('/api/v3/knowledge/nodes/:id', (req, res) => {
  const node = knowledgeGraph.getNode(req.params.id);
  if (!node) return res.status(404).json({ success: false, error: 'Node not found' });
  res.json({ success: true, node: node.toJSON() });
});

app.get('/api/v3/knowledge/nodes/:id/neighbors', (req, res) => {
  const neighbors = knowledgeGraph.getNeighbors(req.params.id, {
    relationType: req.query.relation,
    direction: req.query.direction,
    depth: parseInt(req.query.depth) || 1
  });
  res.json({ success: true, neighbors });
});

app.post('/api/v3/knowledge/relationships', (req, res) => {
  try {
    const rel = knowledgeGraph.addRelationship(req.body);
    res.json({ success: true, relationship: rel.toJSON() });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/v3/knowledge/path', (req, res) => {
  const path = knowledgeGraph.findPath(req.query.source, req.query.target);
  if (!path) return res.status(404).json({ success: false, error: 'No path found' });
  res.json({ success: true, path });
});

app.get('/api/v3/knowledge/search', (req, res) => {
  const results = knowledgeGraph.search(req.query.q, {
    type: req.query.type,
    limit: parseInt(req.query.limit) || 20
  });
  res.json({ success: true, results });
});

app.get('/api/v3/knowledge/subgraph/:id', (req, res) => {
  const subgraph = knowledgeGraph.getSubgraph(req.params.id, {
    radius: parseInt(req.query.radius) || 2
  });
  res.json({ success: true, subgraph });
});

// Workflow Engine API
app.get('/api/v3/workflows', (req, res) => {
  res.json({ success: true, ...workflowManager.getStats() });
});

app.post('/api/v3/workflows', (req, res) => {
  const workflow = workflowManager.createWorkflow(req.body);
  res.json({ success: true, workflow: workflow.toJSON() });
});

app.get('/api/v3/workflows/:id', (req, res) => {
  const workflow = workflowManager.getWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
  res.json({ success: true, workflow: workflow.toJSON() });
});

app.post('/api/v3/workflows/:id/execute', async (req, res) => {
  try {
    const result = await workflowManager.execute(req.params.id, req.body.context || {});
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v3/workflows/executions/:id', (req, res) => {
  const execution = workflowManager.getExecution(req.params.id);
  if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });
  res.json({ success: true, execution: execution.getStatus() });
});

app.get('/api/v3/workflows/history', (req, res) => {
  const history = workflowManager.getExecutionHistory(parseInt(req.query.limit) || 50);
  res.json({ success: true, history });
});

// LLM Orchestrator API
app.get('/api/v3/orchestrator/stats', (req, res) => {
  res.json({ success: true, stats: llmOrchestrator.getStats() });
});

app.get('/api/v3/orchestrator/models', (req, res) => {
  const models = Array.from(llmOrchestrator.models.values()).map(m => m.toJSON());
  res.json({ success: true, models });
});

app.post('/api/v3/orchestrator/models', (req, res) => {
  const model = llmOrchestrator.registerModel(req.body);
  res.json({ success: true, model: model.toJSON() });
});

app.post('/api/v3/orchestrator/complete', async (req, res) => {
  try {
    const result = await llmOrchestrator.complete(req.body.messages, req.body.options || {});
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v3/orchestrator/analyze', (req, res) => {
  const analysis = llmOrchestrator.analyzeTask(req.body.task || req.body.prompt);
  res.json({ success: true, analysis });
});

app.post('/api/v3/orchestrator/select', (req, res) => {
  const selection = llmOrchestrator.selectModel(req.body.task || req.body.prompt);
  res.json({
    success: true,
    selection: {
      model: selection.model?.toJSON(),
      score: selection.score,
      analysis: selection.analysis
    }
  });
});

app.post('/api/v3/orchestrator/recommend', (req, res) => {
  const recommendations = llmOrchestrator.getRecommendations(req.body.task || req.body.prompt);
  res.json({ success: true, recommendations });
});

app.post('/api/v3/orchestrator/template/:id', (req, res) => {
  try {
    const rendered = llmOrchestrator.useTemplate(req.params.id, req.body.variables || {});
    res.json({ success: true, ...rendered });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/v3/orchestrator/cache/clear', (req, res) => {
  llmOrchestrator.clearCache();
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED INTEGRATIONS API
// ═══════════════════════════════════════════════════════════════════════════

// Rate Limiter API
app.get('/api/v4/rate-limiter/stats', (req, res) => {
  res.json({ success: true, stats: rateLimiter.getStats() });
});

app.post('/api/v4/rate-limiter/reset', (req, res) => {
  if (req.body.key) {
    rateLimiter.reset(req.body.key);
  } else {
    rateLimiter.resetAll();
  }
  res.json({ success: true });
});

// Webhook Verifier API
app.get('/api/v4/webhooks/verify-status', (req, res) => {
  res.json({ 
    success: true, 
    verified: req.webhookVerified || false,
    secretConfigured: !!process.env.WEBHOOK_SECRET
  });
});

// Agent-to-Agent Communication API
app.get('/api/v4/communication/stats', (req, res) => {
  res.json({ success: true, stats: agentCommunicator.getStats() });
});

app.get('/api/v4/communication/agents', (req, res) => {
  const agents = agentCommunicator.getAllAgents().map(a => ({
    id: a.id,
    name: a.name
  }));
  res.json({ success: true, agents });
});

app.post('/api/v4/communication/send', async (req, res) => {
  try {
    const { from, to, message, protocol, options } = req.body;
    const result = await agentCommunicator.sendMessage(from, to, message, { protocol, ...options });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v4/communication/broadcast', async (req, res) => {
  try {
    const { from, message, options } = req.body;
    const result = await agentCommunicator.broadcast(from, message, options);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v4/communication/delegate', async (req, res) => {
  try {
    const { from, to, task, context } = req.body;
    const result = await agentCommunicator.delegate(from, to, task, context);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v4/communication/consensus', async (req, res) => {
  try {
    const { from, proposal, options } = req.body;
    const result = await agentCommunicator.requestConsensus(from, proposal, options);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v4/communication/history', (req, res) => {
  const filters = {
    from: req.query.from,
    to: req.query.to,
    protocol: req.query.protocol,
    limit: parseInt(req.query.limit) || 100
  };
  const history = agentCommunicator.getHistory(filters);
  res.json({ success: true, history });
});

// Redis Cache API
app.get('/api/v4/cache/stats', async (req, res) => {
  const stats = await redisCache.getStats();
  res.json({ success: true, stats });
});

app.post('/api/v4/cache/clear', async (req, res) => {
  await redisCache.clear();
  res.json({ success: true });
});

// Discord Channel API
app.get('/api/v4/channels/discord/status', (req, res) => {
  if (!discordChannel) {
    return res.json({ success: true, configured: false });
  }
  res.json({ success: true, configured: true, status: discordChannel.getStatus() });
});

app.post('/api/v4/channels/discord/send', async (req, res) => {
  if (!discordChannel) {
    return res.status(400).json({ success: false, error: 'Discord channel not configured' });
  }
  try {
    await discordChannel.send(req.body.channelId, req.body.message, req.body.options);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Telegram Channel API
app.get('/api/v4/channels/telegram/status', (req, res) => {
  if (!telegramChannel) {
    return res.json({ success: true, configured: false });
  }
  res.json({ success: true, configured: true, status: telegramChannel.getStatus() });
});

app.post('/api/v4/channels/telegram/send', async (req, res) => {
  if (!telegramChannel) {
    return res.status(400).json({ success: false, error: 'Telegram channel not configured' });
  }
  try {
    await telegramChannel.send(req.body.chatId, req.body.message, req.body.options);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', healthChecker.middleware());
app.get('/api/health', healthChecker.middleware());

app.get('/api/v4/health/stats', (req, res) => {
  res.json({ success: true, stats: healthChecker.getStats() });
});

app.get('/api/v4/health/history', (req, res) => {
  const history = healthChecker.getHistory(parseInt(req.query.limit) || 10);
  res.json({ success: true, history });
});

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST LOGGING API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v4/logs/stats', (req, res) => {
  res.json({ success: true, stats: requestLogger.getStats() });
});

app.get('/api/v4/logs', (req, res) => {
  const logs = requestLogger.getLogs({
    level: req.query.level,
    method: req.query.method,
    status: parseInt(req.query.status),
    userId: req.query.userId,
    since: req.query.since,
    limit: parseInt(req.query.limit) || 100
  });
  res.json({ success: true, logs });
});

app.post('/api/v4/logs/clear', (req, res) => {
  requestLogger.clear();
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET AUTH API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v4/ws-auth/stats', (req, res) => {
  res.json({ success: true, stats: wsAuth.getStats() });
});

app.post('/api/v4/ws-auth/token', (req, res) => {
  const { userId, metadata } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId required' });
  }
  const token = wsAuth.generateToken(userId, metadata);
  res.json({ success: true, token });
});

app.post('/api/v4/ws-auth/revoke', (req, res) => {
  const { tokenId, userId } = req.body;
  if (tokenId) {
    wsAuth.revokeToken(tokenId);
  } else if (userId) {
    wsAuth.revokeUserTokens(userId);
  } else {
    return res.status(400).json({ success: false, error: 'tokenId or userId required' });
  }
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// API KEY MANAGEMENT API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v4/api-keys', (req, res) => {
  const keys = apiKeyManager.getAllKeys();
  res.json({ success: true, keys });
});

app.get('/api/v4/api-keys/stats', (req, res) => {
  res.json({ success: true, stats: apiKeyManager.getStats() });
});

app.post('/api/v4/api-keys', (req, res) => {
  const key = apiKeyManager.generateKey(req.body);
  res.json({ success: true, key: { id: key.id, key: key.key, name: key.name } });
});

app.post('/api/v4/api-keys/:id/rotate', (req, res) => {
  try {
    const newKey = apiKeyManager.rotateKey(req.params.id);
    res.json({ success: true, newKey: { id: newKey.id, key: newKey.key } });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.post('/api/v4/api-keys/:id/deactivate', (req, res) => {
  const key = apiKeyManager.getAllKeys().find(k => k.id === req.params.id);
  if (!key) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }
  apiKeyManager.deactivateKey(key.key);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK PROVIDERS API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v4/webhooks/providers', (req, res) => {
  const status = webhookProviderManager.getAllStatus();
  res.json({ success: true, providers: status });
});

app.get('/api/v4/webhooks/logs', (req, res) => {
  const logs = webhookProviderManager.getAllLogs(parseInt(req.query.limit) || 100);
  res.json({ success: true, logs });
});

app.post('/api/v4/webhooks/process/:provider', async (req, res) => {
  try {
    const result = await webhookProviderManager.processWebhook(
      req.params.provider,
      req.body,
      req.headers
    );
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/v4/webhooks/process', async (req, res) => {
  try {
    const result = await webhookProviderManager.processWebhookAuto(req.body, req.headers);
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE UPLOAD API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v4/files', (req, res) => {
  const files = fileUploadHandler.listFiles({
    mimetype: req.query.type,
    uploadedBy: req.query.userId,
    since: req.query.since,
    limit: parseInt(req.query.limit) || 100
  });
  res.json({ success: true, files });
});

app.get('/api/v4/files/stats', (req, res) => {
  res.json({ success: true, stats: fileUploadHandler.getStats() });
});

app.get('/api/v4/files/:id', (req, res) => {
  const file = fileUploadHandler.getFile(req.params.id);
  if (!file) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  res.json({ success: true, file });
});

app.get('/api/v4/files/:id/download', async (req, res) => {
  try {
    const file = fileUploadHandler.getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const content = await fileUploadHandler.getFileContent(req.params.id);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/v4/files/:id', async (req, res) => {
  try {
    await fileUploadHandler.deleteFile(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v4/files/cleanup', async (req, res) => {
  const maxAge = req.body.maxAge || 86400000; // 24 hours default
  const deleted = await fileUploadHandler.cleanup(maxAge);
  res.json({ success: true, deleted });
});

// ═══════════════════════════════════════════════════════════════════════════
// APP INTEGRATIONS API (10 Common Apps)
// ═══════════════════════════════════════════════════════════════════════════

// Integration Manager
app.get('/api/v5/integrations', (req, res) => {
  const status = integrationManager.getStatusSummary();
  res.json({ success: true, ...status });
});

app.get('/api/v5/integrations/:name/status', (req, res) => {
  const integration = integrationManager.get(req.params.name);
  if (!integration) {
    return res.status(404).json({ success: false, error: 'Integration not found' });
  }
  res.json({ success: true, status: integration.getStatus() });
});

// 1. NOTION API
app.get('/api/v5/notion/pages/:id', async (req, res) => {
  try {
    const result = await notion.getPage(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/notion/pages', async (req, res) => {
  try {
    const result = await notion.createPage(req.body.parent, req.body.properties, req.body.children);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/notion/databases/:id/query', async (req, res) => {
  try {
    const result = await notion.queryDatabase(req.params.id, req.body.filter, req.body.sorts);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/notion/search', async (req, res) => {
  try {
    const result = await notion.search(req.body.query, req.body.filter);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. CANVA API
app.get('/api/v5/canva/designs', async (req, res) => {
  try {
    const result = await canva.listDesigns();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/canva/designs', async (req, res) => {
  try {
    const result = await canva.createDesign(req.body.designType, req.body.properties);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/canva/designs/:id/export', async (req, res) => {
  try {
    const result = await canva.exportDesign(req.params.id, req.body.format, req.body.pages);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. FIGMA API
app.get('/api/v5/figma/files/:key', async (req, res) => {
  try {
    const result = await figma.getFile(req.params.key, req.query.depth);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/figma/files/:key/nodes', async (req, res) => {
  try {
    const ids = req.query.ids.split(',');
    const result = await figma.getFileNodes(req.params.key, ids);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/figma/images/:key', async (req, res) => {
  try {
    const result = await figma.getImages(req.params.key, {
      ids: req.query.ids?.split(','),
      format: req.query.format,
      scale: req.query.scale
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. LINEAR API
app.post('/api/v5/linear/query', async (req, res) => {
  try {
    const result = await linear.query(req.body.query, req.body.variables);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/linear/issues', async (req, res) => {
  try {
    const result = await linear.createIssue(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/linear/issues', async (req, res) => {
  try {
    const result = await linear.listIssues(req.body.filter, req.body.first);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. JIRA API
app.get('/api/v5/jira/issues/:key', async (req, res) => {
  try {
    const result = await jira.getIssue(req.params.key);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/jira/issues', async (req, res) => {
  try {
    const result = await jira.createIssue(
      req.body.projectKey,
      req.body.issueType,
      req.body.summary,
      req.body.description,
      req.body.fields
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/jira/search', async (req, res) => {
  try {
    const result = await jira.searchIssues(req.body.jql, req.body.fields, req.body.startAt, req.body.maxResults);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/jira/issues/:key/transitions', async (req, res) => {
  try {
    await jira.transitionIssue(req.params.key, req.body.transitionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. TRELLO API
app.get('/api/v5/trello/boards/:id', async (req, res) => {
  try {
    const result = await trello.getBoard(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/trello/boards', async (req, res) => {
  try {
    const result = await trello.createBoard(req.body.name, req.body.desc);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/trello/cards', async (req, res) => {
  try {
    const result = await trello.createCard(req.body.name, req.body.listId, req.body.desc);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/trello/boards/:id/cards', async (req, res) => {
  try {
    const result = await trello.getBoardCards(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. AIRTABLE API
app.get('/api/v5/airtable/:base/:table', async (req, res) => {
  try {
    const result = await airtable.listRecords(req.params.base, req.params.table, {
      maxRecords: req.query.maxRecords,
      view: req.query.view
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/airtable/:base/:table', async (req, res) => {
  try {
    const result = await airtable.createRecord(req.params.base, req.params.table, req.body.fields);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/v5/airtable/:base/:table/:id', async (req, res) => {
  try {
    const result = await airtable.updateRecord(req.params.base, req.params.table, req.params.id, req.body.fields);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. GOOGLE WORKSPACE API
app.get('/api/v5/google/docs/:id', async (req, res) => {
  try {
    const result = await google.getDocument(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/google/sheets/:id', async (req, res) => {
  try {
    const result = await google.getSpreadsheet(req.params.id, req.query.ranges?.split(','));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/google/sheets/:id/values/:range', async (req, res) => {
  try {
    const result = await google.getValues(req.params.id, req.params.range);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/google/drive/files', async (req, res) => {
  try {
    const result = await google.listFiles(req.query.q, req.query.pageSize);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. SALESFORCE API
app.get('/api/v5/salesforce/query', async (req, res) => {
  try {
    const result = await salesforce.query(req.query.q);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/salesforce/sobjects/:type/:id', async (req, res) => {
  try {
    const result = await salesforce.get(req.params.type, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/salesforce/sobjects/:type', async (req, res) => {
  try {
    const result = await salesforce.create(req.params.type, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/v5/salesforce/sobjects/:type/:id', async (req, res) => {
  try {
    await salesforce.update(req.params.type, req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. HUBSPOT API
app.get('/api/v5/hubspot/contacts/:id', async (req, res) => {
  try {
    const result = await hubspot.getContact(req.params.id, req.query.properties?.split(','));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/hubspot/contacts', async (req, res) => {
  try {
    const result = await hubspot.listContacts(req.query.properties?.split(','), req.query.limit);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/hubspot/contacts', async (req, res) => {
  try {
    const result = await hubspot.createContact(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/hubspot/deals', async (req, res) => {
  try {
    const result = await hubspot.listDeals(req.query.properties?.split(','), req.query.limit);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/hubspot/deals', async (req, res) => {
  try {
    const result = await hubspot.createDeal(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════

server.listen(CONFIG.port, '0.0.0.0', async () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                       ║');
  console.log('║     ███╗   ██╗███████╗██╗   ██╗██╗  ██╗██╗   ██╗                  ║');
  console.log('║     ████╗  ██║██╔════╝╚██╗ ██╔╝██║  ██║██║   ██║                  ║');
  console.log('║     ██╔██╗ ██║█████╗   ╚████╔╝ ███████║██║   ██║                  ║');
  console.log('║     ██║╚██╗██║██╔══╝    ╚██╔╝  ██╔══██║██║   ██║                  ║');
  console.log('║     ██║ ╚████║███████╗   ██║   ██║  ██║╚██████╔╝                  ║');
  console.log('║     ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝                   ║');
  console.log('║                                                                       ║');
  console.log('║     UNIFIED AI AGENT PLATFORM v1.0 - LOCAL-FIRST                     ║');
  console.log('║                                                                       ║');
console.log('╠═══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  🌐  Dashboard:  http://localhost:${CONFIG.port}                          ║`);
  console.log(`║  📡  WebSocket: ws://localhost:${CONFIG.port}                             ║`);
  console.log(`║  🔌  API:       http://localhost:${CONFIG.port}/api/v2                      ║`);
  console.log('║                                                                       ║');
  console.log('║  ⚙️  PROVIDERS (Load Balanced + Failover):                            ║');
  console.log('║     • Ollama (Local) • OpenAI • Anthropic                            ║');
  console.log('║                                                                       ║');
  console.log('║  🤖 AGENTS (Lifecycle + Messaging + Capabilities):                   ║');
  console.log('║     NEXUS • CODEX • AURORA • GHOST • ORACLE • WRAITH                ║');
  console.log('║     DEBUG • SCRIBE • TESTER • ARCHIVE • SENTINEL                     ║');
  console.log('║                                                                       ║');
  console.log('║  📡 CHANNELS (Multi-channel + Routing + Bridging):                   ║');
  console.log('║     • WebSocket • HTTP/REST • CLI • Slack');
  console.log('║     • Discord (API Token) • Telegram (API Token)                     ║');
  console.log('║                                                                       ║');
  console.log('║  🔧 TOOLS: File • Bash • Web • Search • Code • Git • Docker • DB    ║');
  console.log('║  🔗 INTEGRATIONS: GitHub • Slack • Webhooks • Discord • Telegram     ║');
  console.log('║  🛡️  SECURITY: Rate Limiting • Webhook Verification • JWT Auth      ║');
  console.log('║  💾 PERSISTENCE: SQLite (tasks, sessions, history, workflows)        ║');
  console.log('║  🔄 A2A COMMUNICATION: Request/Response • Broadcast • Delegation    ║');
  console.log('╠═══════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                       ║');
  console.log('║  Commands:                                                           ║');
  console.log('║    /agents     - List all agents                                     ║');
  console.log('║    /providers  - Check provider status                                ║');
  console.log('║    /execute    - Run task on agent                                    ║');
  console.log('║    /ollama     - Check local Ollama status                            ║');
  console.log('║    /discord    - Check Discord status                                 ║');
  console.log('║    /telegram   - Check Telegram status                                ║');
  console.log('║                                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Check Ollama (if healthCheck method exists on new provider system)
  if (state.providerManager) {
    const ollamaProvider = state.providerManager.providers.find(p => p.type === 'local');
    if (ollamaProvider && typeof ollamaProvider.healthCheck === 'function') {
      const ollamaHealth = await ollamaProvider.healthCheck();
      if (ollamaHealth.state === 'HEALTHY') {
        console.log('✅ Ollama online - local models available');
      } else {
        console.log('⚠️  Ollama offline - run "ollama serve" to enable local models');
      }
    }
  }
  
  // Check other providers
  if (providers.opencode.enabled) console.log('✅ OpenCode enabled');
  if (providers.claude.enabled) console.log('✅ Claude Code enabled');
  if (providers.openai.enabled) console.log('✅ OpenAI enabled');
  if (providers.anthropic.enabled) console.log('✅ Anthropic enabled');
  
  // Check channels
  console.log('\n📡 Channel Status:');
  if (discordChannel) console.log('✅ Discord bot connected');
  else console.log('⚠️  Discord not configured (set DISCORD_TOKEN)');
  if (telegramChannel) console.log('✅ Telegram bot connected');
  else console.log('⚠️  Telegram not configured (set TELEGRAM_TOKEN)');
  
  console.log('');
  log('NEXUS Platform started', 'SYSTEM');
});

// Periodic stats broadcast
setInterval(() => {
  state.platform.uptime = Date.now();
  broadcast({ type: 'STATS', platform: state.platform, agents: state.agents });
}, 5000);

// Heartbeat interval
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Export state and providers for use in other modules
export { state, providers };
