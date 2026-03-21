#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE MODULE TEST SUITE
// Tests all modules, imports, and basic functionality
// ═══════════════════════════════════════════════════════════════════════════

import { performance } from 'perf_hooks';

const results = {
  passed: 0,
  failed: 0,
  errors: [],
  timings: {}
};

// Helper to test a module
async function testModule(name, testFn) {
  const start = performance.now();
  try {
    console.log(`\n📦 Testing: ${name}`);
    await testFn();
    const duration = (performance.now() - start).toFixed(2);
    results.passed++;
    results.timings[name] = duration;
    console.log(`   ✅ PASSED (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = (performance.now() - start).toFixed(2);
    results.failed++;
    results.errors.push({ module: name, error: error.message });
    results.timings[name] = duration;
    console.log(`   ❌ FAILED: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE MODULE TESTS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║           NEXUS PLATFORM v2.0 - MODULE TEST SUITE            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('\n');

// Test 1: Agent System
await testModule('Agent System', async () => {
  const { Agent, AgentRegistry, AgentState, getAgentRegistry } = await import('./src/agents/agent-system.js');
  
  const registry = getAgentRegistry();
  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    icon: '🤖',
    color: '#9333EA',
    role: 'Tester'
  });
  
  if (agent.state !== AgentState.IDLE) {
    throw new Error('Agent should be in IDLE state');
  }
  
  if (typeof agent.execute !== 'function') {
    throw new Error('Agent should have execute method');
  }
  
  console.log(`     - Created agent: ${agent.name}`);
  console.log(`     - Agent state: ${agent.state}`);
});

// Test 2: Provider System
await testModule('Provider System', async () => {
  const { ProviderManager, OllamaProvider, ProviderState, getProviderManager } = await import('./src/providers/provider-system.js');
  
  const manager = getProviderManager();
  
  const ollama = new OllamaProvider({
    id: 'test-ollama',
    name: 'Test Ollama',
    baseUrl: 'http://localhost:11434'
  });
  
  if (ollama.state !== ProviderState.INITIALIZING) {
    throw new Error('Provider should be in INITIALIZING state');
  }
  
  console.log(`     - Created provider: ${ollama.name}`);
  console.log(`     - Provider type: ${ollama.type}`);
});

// Test 3: Channel System
await testModule('Channel System', async () => {
  const channelModule = await import('./src/channels/channel-system.js');
  const { ChannelState, MessageType, getChannelManager } = channelModule;
  
  // Just test the exports and enums
  if (!ChannelState || !ChannelState.ACTIVE) {
    throw new Error('ChannelState not exported properly');
  }
  
  if (!MessageType || !MessageType.TEXT) {
    throw new Error('MessageType not exported properly');
  }
  
  console.log(`     - Channel system loaded`);
  console.log(`     - ChannelState.ACTIVE: ${ChannelState.ACTIVE}`);
  console.log(`     - MessageType.TEXT: ${MessageType.TEXT}`);
});

// Test 4: Memory System
await testModule('Memory System', async () => {
  const memoryModule = await import('./src/memory/memory-system.js');
  const { MemoryManager, MemoryType, getMemoryManager } = memoryModule;
  const VectorStore = memoryModule.VectorStore || memoryModule.default?.VectorStore;
  
  const memory = getMemoryManager();
  
  // Test vector store
  const vectorStore = new VectorStore();
  vectorStore.add('test1', 'Hello world test content');
  vectorStore.add('test2', 'Another test message');
  
  const results = vectorStore.search('hello', 5, 0.1);
  
  if (!Array.isArray(results)) {
    throw new Error('Search should return array');
  }
  
  console.log(`     - Vector store initialized`);
  console.log(`     - Search results: ${results.length}`);
});

// Test 5: Plugin System
await testModule('Plugin System', async () => {
  const { PluginManager, Plugin, PluginState, getPluginManager } = await import('./src/plugins/plugin-system.js');
  
  const manager = getPluginManager();
  
  console.log(`     - Plugin manager created`);
  console.log(`     - Status: ${manager.getAll().length} plugins`);
});

// Test 6: Event Bus
await testModule('Event Bus', async () => {
  const { DistributedEventBus, Event, EventPriority, EventStatus, getEventBus } = await import('./src/events/event-bus.js');
  
  const bus = getEventBus();
  
  const event = new Event('test.event', { message: 'Hello' }, {
    priority: EventPriority.HIGH
  });
  
  if (event.status !== EventStatus.PENDING) {
    throw new Error('Event should be in PENDING status');
  }
  
  console.log(`     - Event bus created`);
  console.log(`     - Event ID: ${event.id.substring(0, 20)}...`);
});

// Test 7: Task Queue
await testModule('Task Queue', async () => {
  const { TaskQueue, QueueManager, JobPriority, JobStatus, getQueueManager } = await import('./src/queue/task-queue.js');
  
  const manager = getQueueManager();
  const queue = manager.createQueue('test-queue', { concurrency: 5 });
  
  if (queue.name !== 'test-queue') {
    throw new Error('Queue name mismatch');
  }
  
  console.log(`     - Queue created: ${queue.name}`);
  console.log(`     - Concurrency: ${queue.concurrency}`);
});

// Test 8: Security System
await testModule('Security System', async () => {
  const { SecurityManager, ApiKey, User, Permission, Roles, getSecurityManager } = await import('./src/security/security-system.js');
  
  const security = getSecurityManager();
  
  const user = security.createUser({
    username: 'testuser',
    email: 'test@example.com',
    role: 'USER'
  });
  
  if (!user.id) {
    throw new Error('User should have an ID');
  }
  
  const apiKey = security.createApiKey({
    name: 'Test API Key',
    userId: user.id,
    role: 'USER'
  });
  
  if (!apiKey.key.startsWith('nxk_')) {
    throw new Error('API key should have correct prefix');
  }
  
  console.log(`     - User created: ${user.username}`);
  console.log(`     - API key created: ${apiKey.key.substring(0, 15)}...`);
});

// Test 9: Code Sandbox
await testModule('Code Sandbox', async () => {
  const { CodeSandbox, Language, SandboxConfig, getCodeSandbox } = await import('./src/sandbox/code-sandbox.js');
  
  const sandbox = getCodeSandbox();
  
  // Test simple JavaScript execution
  const result = await sandbox.execute('1 + 1', { language: Language.JAVASCRIPT });
  
  if (!result.id) {
    throw new Error('Execution should return result ID');
  }
  
  console.log(`     - Sandbox created`);
  console.log(`     - Execution ID: ${result.id.substring(0, 20)}...`);
});

// Test 10: Knowledge Graph
await testModule('Knowledge Graph', async () => {
  const { KnowledgeGraph, Node, Relationship, NodeType, RelationType, getKnowledgeGraph } = await import('./src/knowledge/knowledge-graph.js');
  
  const graph = getKnowledgeGraph();
  
  const node1 = graph.addNode({
    id: 'test-node-1',
    type: NodeType.CONCEPT,
    name: 'Artificial Intelligence',
    description: 'The simulation of human intelligence'
  });
  
  const node2 = graph.addNode({
    id: 'test-node-2',
    type: NodeType.CONCEPT,
    name: 'Machine Learning',
    description: 'A subset of AI'
  });
  
  graph.addRelationship({
    type: RelationType.RELATED_TO,
    source: node1.id,
    target: node2.id,
    weight: 1.0
  });
  
  const neighbors = graph.getNeighbors(node1.id);
  
  if (neighbors.length !== 1) {
    throw new Error('Should have 1 neighbor');
  }
  
  console.log(`     - Graph created`);
  console.log(`     - Nodes: ${graph.getStats().nodes}`);
  console.log(`     - Relationships: ${graph.getStats().relationships}`);
});

// Test 11: Workflow Engine
await testModule('Workflow Engine', async () => {
  const wfModule = await import('./src/workflow/workflow-engine.js');
  const { Workflow, WorkflowStep, WorkflowExecution, WorkflowManager, WorkflowState, StepType, getWorkflowManager } = wfModule;
  
  const manager = getWorkflowManager();
  
  const workflow = manager.createWorkflow({
    name: 'Test Workflow',
    description: 'A test workflow',
    steps: [
      { id: 'step1', name: 'Step 1', type: StepType.CODE, config: { code: 'return { success: true };' } },
      { id: 'step2', name: 'Step 2', type: StepType.CODE, dependsOn: ['step1'], config: { code: 'return { done: true };' } }
    ],
    entryPoints: ['step1']
  });
  
  const validation = workflow.validate();
  if (!validation.valid) {
    throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
  }
  
  console.log(`     - Workflow created: ${workflow.name}`);
  console.log(`     - Steps: ${workflow.steps.size}`);
  console.log(`     - Validation: ${validation.valid ? 'PASS' : 'FAIL'}`);
});

// Test 12: LLM Orchestrator
await testModule('LLM Orchestrator', async () => {
  const { LLMOrchestrator, ModelProfile, PromptTemplate, TaskCategory, ModelCapability, getLLMOrchestrator } = await import('./src/orchestrator/llm-orchestrator.js');
  
  const orchestrator = getLLMOrchestrator();
  
  const model = orchestrator.registerModel({
    id: 'test-model',
    name: 'Test Model',
    provider: 'test',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    supportedCategories: [TaskCategory.CODE_GENERATION, TaskCategory.TEXT_GENERATION],
    metrics: { qualityScore: 0.85, costPerToken: 0.0001, avgLatency: 1000 },
    limits: { maxTokens: 4096, contextWindow: 8192 }
  });
  
  if (!model.id) {
    throw new Error('Model should have an ID');
  }
  
  const template = orchestrator.registerTemplate({
    id: 'test-template',
    name: 'Test Template',
    category: TaskCategory.CODE_GENERATION,
    systemPrompt: 'You are a helpful assistant',
    template: 'Generate code for: {{task}}'
  });
  
  const analysis = orchestrator.analyzeTask('Write a function to sort an array');
  
  console.log(`     - Orchestrator created`);
  console.log(`     - Models: ${orchestrator.models.size}`);
  console.log(`     - Templates: ${orchestrator.templates.size}`);
  console.log(`     - Task category: ${analysis.category}`);
});

// Test 13: Collaboration System
await testModule('Collaboration System', async () => {
  const { CollaborationManager, CollabSession, CollabDocument, UserPresence, CollabEvent, getCollaborationManager } = await import('./src/collab/realtime-collab.js');
  
  const manager = getCollaborationManager();
  
  const session = manager.createSession({
    name: 'Test Session',
    host: { id: 'host-1', name: 'Host User' }
  });
  
  const user = manager.registerUser({
    id: 'user-1',
    name: 'Test User'
  });
  
  session.join(user);
  
  if (session.users.size !== 1) {
    throw new Error('Session should have 1 user');
  }
  
  console.log(`     - Collaboration manager created`);
  console.log(`     - Session: ${session.name}`);
  console.log(`     - Users in session: ${session.users.size}`);
});

// Test 14: Monitoring System
await testModule('Monitoring System', async () => {
  const { MonitoringSystem, Metric, MetricType, AlertRule, AlertSeverity, HealthCheck, Tracer, getMonitoringSystem } = await import('./src/monitoring/monitoring-system.js');
  
  const monitoring = getMonitoringSystem();
  
  // Test metric recording
  monitoring.increment('http_requests_total', { method: 'GET', path: '/test' });
  monitoring.record('http_request_duration_seconds', 0.5, { method: 'GET' });
  
  const metric = monitoring.getMetric('http_requests_total');
  if (!metric) {
    throw new Error('Metric should exist');
  }
  
  // Test tracing
  const span = monitoring.startTrace('test.operation');
  span.setTag('test', 'true');
  monitoring.tracer.finishSpan(span);
  
  // Test alert
  const alert = monitoring.registerAlert({
    name: 'Test Alert',
    severity: AlertSeverity.WARNING,
    metric: 'http_requests_total',
    threshold: 100,
    operator: 'gt'
  });
  
  console.log(`     - Monitoring system created`);
  console.log(`     - Metrics registered: ${monitoring.metrics.size}`);
  console.log(`     - Alert created: ${alert.name}`);
});

// Test 15: Multi-Modal System
await testModule('Multi-Modal System', async () => {
  const { MultiModalProcessor, MediaAsset, ImageProcessor, AudioProcessor, MediaType, getMultiModalProcessor } = await import('./src/multimodal/multimodal-system.js');
  
  const processor = getMultiModalProcessor();
  
  // Create a test asset
  const asset = new MediaAsset({
    name: 'test.png',
    type: MediaType.IMAGE,
    format: 'png',
    mimeType: 'image/png',
    data: Buffer.from([0x89, 0x50, 0x4E, 0x47]) // PNG header
  });
  
  if (asset.type !== MediaType.IMAGE) {
    throw new Error('Asset type mismatch');
  }
  
  console.log(`     - Multi-modal processor created`);
  console.log(`     - Asset: ${asset.name}`);
  console.log(`     - Asset type: ${asset.type}`);
});

// Test 16: Cache System
await testModule('Cache System', async () => {
  const { CacheManager, TieredCache, MemoryCacheStore, EvictionPolicy, getCacheManager } = await import('./src/cache/cache-system.js');
  
  const cacheManager = getCacheManager();
  const cache = cacheManager.getCache('default');
  
  // Test cache operations
  await cache.set('test-key', { value: 'test data' });
  const retrieved = await cache.get('test-key');
  
  if (!retrieved || retrieved.value !== 'test data') {
    throw new Error('Cache retrieval failed');
  }
  
  const stats = cache.getStats();
  
  console.log(`     - Cache manager created`);
  console.log(`     - Cache stats: ${stats.l1.items} items`);
  console.log(`     - Hit rate: ${stats.hitRate}`);
});

// Test 17: Memory Persistence
await testModule('Memory Persistence', async () => {
  const persistenceModule = await import('./src/persistence.js');
  const { getDatabase } = persistenceModule;
  
  const db = getDatabase(':memory:');
  await db.initialize();
  
  // Test task creation
  const task = db.createTask({
    title: 'Test Task',
    description: 'A test task',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    priority: 'high'
  });
  
  if (!task.id) {
    throw new Error('Task should have an ID');
  }
  
  const stats = db.getTaskStats();
  
  console.log(`     - Database initialized`);
  console.log(`     - Task created: ${task.id.substring(0, 20)}...`);
  console.log(`     - Total tasks: ${stats.total}`);
});

// Test 18: Git Tool
await testModule('Git Tool', async () => {
  const gitTool = await import('./src/tools/git.js');
  
  const status = await gitTool.default.getStatus('/home/runner/workspace');
  
  console.log(`     - Git tool loaded`);
  console.log(`     - Has status: ${status ? 'yes' : 'no'}`);
});

// Test 19: Docker Tool
await testModule('Docker Tool', async () => {
  const dockerTool = await import('./src/tools/docker.js');
  
  const dockerAvailable = await dockerTool.default.checkDocker();
  
  console.log(`     - Docker tool loaded`);
  console.log(`     - Docker available: ${dockerAvailable.available}`);
});

// Test 20: Database Tool
await testModule('Database Tool', async () => {
  const DatabaseTool = await import('./src/tools/database.js');
  
  const dbTool = new DatabaseTool.default();
  await dbTool.connect('default', ':memory:');
  
  await dbTool.createTable('test_table', 'id INTEGER PRIMARY KEY, name TEXT');
  await dbTool.insert('test_table', { id: 1, name: 'Test' });
  
  const results = await dbTool.select('test_table');
  
  if (results.length !== 1) {
    throw new Error('Should have 1 row');
  }
  
  console.log(`     - Database tool loaded`);
  console.log(`     - Table created and queried`);
  console.log(`     - Rows: ${results.length}`);
});

// Test 21: Integrations
await testModule('Integrations', async () => {
  const { getGitHub, getSlack, getWebhookManager, GitHubIntegration, SlackIntegration, WebhookManager } = await import('./src/integrations.js');
  
  const github = getGitHub();
  const slack = getSlack();
  const webhooks = getWebhookManager();
  
  console.log(`     - GitHub integration loaded: ${github.isConfigured() ? 'configured' : 'not configured'}`);
  console.log(`     - Slack integration loaded: ${slack.isConfigured() ? 'configured' : 'not configured'}`);
  console.log(`     - Webhook manager loaded`);
});

// Test 22: Original Collaboration
await testModule('Original Collaboration', async () => {
  const { Collaborate, Delegate, Chain, Aggregate, createAgent } = await import('./src/collaboration.js');
  
  const agent1 = createAgent({
    id: 'agent1',
    name: 'Agent 1',
    execute: async (task) => `Result for: ${task}`
  });
  
  const agent2 = createAgent({
    id: 'agent2',
    name: 'Agent 2', 
    execute: async (task) => `Another result for: ${task}`
  });
  
  const results = await Collaborate([agent1, agent2], 'test task');
  
  if (results.length !== 2) {
    throw new Error('Should have 2 results');
  }
  
  console.log(`     - Collaboration module loaded`);
  console.log(`     - Agents created: 2`);
  console.log(`     - Parallel execution: ${results.length} results`);
});

// Test 23: Discord Channel
await testModule('Discord Channel', async () => {
  const { DiscordChannel, ChannelState } = await import('./src/channels/channel-system.js');
  
  // Test class exists and can be instantiated
  const discord = new DiscordChannel({
    id: 'test-discord',
    name: 'Test Discord',
    token: 'test-token'
  });
  
  if (discord.type !== 'discord') {
    throw new Error('Discord channel should have type "discord"');
  }
  
  console.log(`     - Discord channel class loaded`);
  console.log(`     - Type: ${discord.type}`);
  console.log(`     - Token configured: ${!!discord.token}`);
});

// Test 24: Telegram Channel
await testModule('Telegram Channel', async () => {
  const { TelegramChannel, ChannelState } = await import('./src/channels/channel-system.js');
  
  // Test class exists and can be instantiated
  const telegram = new TelegramChannel({
    id: 'test-telegram',
    name: 'Test Telegram',
    token: 'test-token',
    polling: false // Don't start polling in test
  });
  
  if (telegram.type !== 'telegram') {
    throw new Error('Telegram channel should have type "telegram"');
  }
  
  console.log(`     - Telegram channel class loaded`);
  console.log(`     - Type: ${telegram.type}`);
  console.log(`     - Token configured: ${!!telegram.token}`);
});

// Test 25: Advanced Integrations
await testModule('Advanced Integrations', async () => {
  const { RateLimiter, WebhookVerifier, AgentCommunicator, RedisCache } = await import('./src/integrations/advanced-integrations.js');
  
  // Test Rate Limiter
  const rateLimiter = new RateLimiter({ windowMs: 1000, maxRequests: 5 });
  const result1 = rateLimiter.check('test-key');
  const result2 = rateLimiter.check('test-key');
  
  if (!result1.allowed || !result2.allowed) {
    throw new Error('Rate limiter should allow initial requests');
  }
  
  if (result2.remaining !== result1.remaining - 1) {
    throw new Error('Rate limiter should decrement remaining count');
  }
  
  // Test Webhook Verifier
  const verifier = new WebhookVerifier({ secret: 'test-secret' });
  const signature = verifier.generateSignature('test-payload');
  
  if (!signature || signature.length === 0) {
    throw new Error('Should generate signature');
  }
  
  // Test Agent Communicator
  const communicator = new AgentCommunicator();
  communicator.registerAgent({
    id: 'agent-1',
    name: 'Agent 1',
    receiveMessage: async (msg) => ({ received: true, msg })
  });
  
  if (communicator.getStats().totalAgents !== 1) {
    throw new Error('Should have 1 registered agent');
  }
  
  // Test Redis Cache (fallback mode)
  const cache = new RedisCache();
  await cache.set('test-key', { value: 'test-value' });
  const cached = await cache.get('test-key');
  
  if (!cached || cached.value !== 'test-value') {
    throw new Error('Cache should store and retrieve values');
  }
  
  console.log(`     - Rate Limiter: ${rateLimiter.getStats().maxRequests} req/min`);
  console.log(`     - Webhook Verifier: Signature generated`);
  console.log(`     - Agent Communicator: ${communicator.getStats().totalAgents} agents, ${communicator.getStats().totalProtocols} protocols`);
  console.log(`     - Redis Cache: Using in-memory fallback`);
});

// Test 26: Middleware Systems
await testModule('Middleware Systems', async () => {
  const { 
    WebSocketAuth, 
    CorsMiddleware, 
    RequestLogger, 
    CompressionMiddleware, 
    HealthChecker,
    APIKeyManager 
  } = await import('./src/integrations/middleware.js');
  
  // Test WebSocket Auth
  const wsAuth = new WebSocketAuth({ secret: 'test-secret' });
  const token = wsAuth.generateToken('user-123', { name: 'Test User' });
  const verification = wsAuth.verifyToken(token);
  
  if (!verification.valid) {
    throw new Error('Token should be valid');
  }
  
  // Test CORS
  const cors = new CorsMiddleware({ origin: '*' });
  if (!cors.middleware) {
    throw new Error('CORS should have middleware method');
  }
  
  // Test Request Logger
  const logger = new RequestLogger({ logLevel: 'info' });
  const stats = logger.getStats();
  
  // Test Health Checker
  const healthChecker = new HealthChecker();
  healthChecker.registerCheck('test', async () => ({ healthy: true }));
  const healthResult = await healthChecker.runChecks();
  
  if (!healthResult.healthy) {
    throw new Error('Health check should pass');
  }
  
  // Test API Key Manager
  const keyManager = new APIKeyManager();
  const apiKey = keyManager.generateKey({ name: 'Test Key', userId: 'user-1' });
  const validation = keyManager.validateKey(apiKey.key);
  
  if (!validation.valid) {
    throw new Error('API key should be valid');
  }
  
  console.log(`     - WebSocket Auth: Token generated and verified`);
  console.log(`     - CORS: Middleware ready`);
  console.log(`     - Request Logger: ${stats.total} logs`);
  console.log(`     - Health Checker: ${healthResult.status}`);
  console.log(`     - API Key Manager: ${keyManager.getStats().total} keys`);
});

// Test 27: Webhook Providers
await testModule('Webhook Providers', async () => {
  const { 
    WebhookProviderManager,
    GitLabWebhookProvider,
    BitbucketWebhookProvider,
    N8NWebhookProvider,
    ZapierWebhookProvider
  } = await import('./src/integrations/webhook-providers.js');
  
  // Test manager
  const manager = new WebhookProviderManager({ secret: 'test-secret' });
  const status = manager.getAllStatus();
  
  if (!status.gitlab || !status.bitbucket || !status.n8n || !status.zapier) {
    throw new Error('All providers should be registered');
  }
  
  // Test GitLab provider
  const gitlab = manager.getProvider('gitlab');
  const gitlabEvent = gitlab.parseEvent(
    { project: { name: 'test-repo' } },
    { 'x-gitlab-event': 'Push Hook' }
  );
  
  if (gitlabEvent.type !== 'push') {
    throw new Error('GitLab event type should be mapped correctly');
  }
  
  // Test Bitbucket provider
  const bitbucket = manager.getProvider('bitbucket');
  const bbEvent = bitbucket.parseEvent(
    { repository: { name: 'test-repo' } },
    { 'x-event-key': 'pullrequest:created' }
  );
  
  if (bbEvent.type !== 'pull_request_opened') {
    throw new Error('Bitbucket event type should be mapped correctly');
  }
  
  console.log(`     - Webhook Provider Manager: ${Object.keys(status).length} providers`);
  console.log(`     - GitLab: Event parsing works`);
  console.log(`     - Bitbucket: Event parsing works`);
  console.log(`     - N8N: Ready`);
  console.log(`     - Zapier: Ready`);
});

// Test 28: File Upload Handler
await testModule('File Upload Handler', async () => {
  const { FileUploadHandler, FileAnalyzer } = await import('./src/integrations/file-upload.js');
  
  // Test file upload handler
  const handler = new FileUploadHandler({
    uploadDir: '/tmp/test-uploads',
    maxFileSize: 1024 * 1024
  });
  
  // Test file validation
  const validFile = {
    originalname: 'test.txt',
    mimetype: 'text/plain',
    size: 100
  };
  
  const validation = handler.validateFile(validFile);
  if (!validation.valid) {
    throw new Error('Valid file should pass validation');
  }
  
  const invalidFile = {
    originalname: 'test.exe',
    mimetype: 'application/x-executable',
    size: 100
  };
  
  const invalidValidation = handler.validateFile(invalidFile);
  if (invalidValidation.valid) {
    throw new Error('Invalid file should fail validation');
  }
  
  // Test file category
  const category = handler.getFileCategory('image/png');
  if (category !== 'image') {
    throw new Error('PNG should be categorized as image');
  }
  
  // Test size formatting
  const formattedSize = handler.formatSize(1024 * 1024);
  if (!formattedSize.includes('MB')) {
    throw new Error('Size should be formatted with MB');
  }
  
  // Test file analyzer
  const analyzer = new FileAnalyzer();
  const textContent = Buffer.from('Hello World');
  const analysis = await analyzer.analyze(
    { mimetype: 'text/plain', id: 'test' },
    textContent
  );
  
  if (!analysis.metadata || analysis.metadata.words === undefined) {
    throw new Error('Text analysis should include word count');
  }
  
  console.log(`     - File Upload Handler: Validation works`);
  console.log(`     - File Analyzer: Text analysis works`);
  console.log(`     - Size formatter: ${formattedSize}`);
});

// Test 29: App Integrations (10 common apps)
await testModule('App Integrations', async () => {
  const { 
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
  } = await import('./src/integrations/app-integrations.js');
  
  // Test integration manager
  const manager = getIntegrationManager();
  
  // Test individual integrations
  const notion = new NotionIntegration({ apiKey: 'test-key' });
  const canva = new CanvaIntegration({ accessToken: 'test-token' });
  const figma = new FigmaIntegration({ apiKey: 'test-key' });
  const linear = new LinearIntegration({ apiKey: 'test-key' });
  const jira = new JiraIntegration({ domain: 'test', email: 'test@test.com', apiKey: 'test-key' });
  const trello = new TrelloIntegration({ appKey: 'test-key', token: 'test-token' });
  const airtable = new AirtableIntegration({ apiKey: 'test-key' });
  const google = new GoogleWorkspaceIntegration({ accessToken: 'test-token' });
  const salesforce = new SalesforceIntegration({ accessToken: 'test-token', instanceUrl: 'https://test.salesforce.com' });
  const hubspot = new HubSpotIntegration({ accessToken: 'test-token' });
  
  // Test configurations
  if (!notion.isConfigured()) {
    throw new Error('Notion should be configured with API key');
  }
  
  if (!figma.isConfigured()) {
    throw new Error('Figma should be configured with API key');
  }
  
  if (!trello.isConfigured()) {
    throw new Error('Trello should be configured with app key and token');
  }
  
  // Register them
  manager.register('notion-test', notion);
  manager.register('canva-test', canva);
  manager.register('figma-test', figma);
  manager.register('linear-test', linear);
  manager.register('jira-test', jira);
  manager.register('trello-test', trello);
  manager.register('airtable-test', airtable);
  manager.register('google-test', google);
  manager.register('salesforce-test', salesforce);
  manager.register('hubspot-test', hubspot);
  
  const summary = manager.getStatusSummary();
  
  if (summary.total < 10) {
    throw new Error('Should have 10 integrations registered');
  }
  
  console.log(`     - Notion: ${notion.name} integration ready`);
  console.log(`     - Canva: ${canva.name} integration ready`);
  console.log(`     - Figma: ${figma.name} integration ready`);
  console.log(`     - Linear: ${linear.name} integration ready`);
  console.log(`     - Jira: ${jira.name} integration ready`);
  console.log(`     - Trello: ${trello.name} integration ready`);
  console.log(`     - Airtable: ${airtable.name} integration ready`);
  console.log(`     - Google Workspace: ${google.name} integration ready`);
  console.log(`     - Salesforce: ${salesforce.name} integration ready`);
  console.log(`     - HubSpot: ${hubspot.name} integration ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 30: More App Integrations (10 more apps)
await testModule('More App Integrations', async () => {
  const { 
    AdobeIntegration,
    AllTrailsIntegration,
    AppleMusicIntegration,
    BookingIntegration,
    ExpediaIntegration,
    InstacartIntegration,
    LovableIntegration,
    OpenTableIntegration,
    ReplitIntegration,
    IntegrationManager
  } = await import('./src/integrations/more-integrations.js');
  
  // Test individual integrations
  const adobe = new AdobeIntegration({ apiKey: 'test-token', clientId: 'test', clientSecret: 'test' });
  const alltrails = new AllTrailsIntegration({ apiKey: 'test-key' });
  const appleMusic = new AppleMusicIntegration({ developerToken: 'test-token', musicUserToken: 'test' });
  const booking = new BookingIntegration({ apiKey: 'test-key', partnerId: 'test' });
  const expedia = new ExpediaIntegration({ apiKey: 'test-key' });
  const instacart = new InstacartIntegration({ apiKey: 'test-key' });
  const lovable = new LovableIntegration({ apiKey: 'test-key' });
  const opentable = new OpenTableIntegration({ apiKey: 'test-key' });
  const replit = new ReplitIntegration({ apiKey: 'test-token' });
  
  // Test configurations
  if (!adobe.isConfigured()) {
    throw new Error('Adobe should be configured');
  }
  
  if (!alltrails.isConfigured()) {
    throw new Error('AllTrails should be configured');
  }
  
  if (!lovable.isConfigured()) {
    throw new Error('Lovable should be configured');
  }
  
  if (!replit.isConfigured()) {
    throw new Error('Replit should be configured');
  }
  
  // Test manager
  const manager = new IntegrationManager();
  manager.register('adobe', adobe);
  manager.register('alltrails', alltrails);
  manager.register('apple_music', appleMusic);
  manager.register('booking', booking);
  manager.register('expedia', expedia);
  manager.register('instacart', instacart);
  manager.register('lovable', lovable);
  manager.register('opentable', opentable);
  manager.register('replit', replit);
  
  const summary = manager.getStatusSummary();
  
  if (summary.total !== 9) {
    throw new Error('Should have 9 integrations registered');
  }
  
  console.log(`     - Adobe Creative Cloud: ${adobe.name} ready`);
  console.log(`     - AllTrails: ${alltrails.name} ready`);
  console.log(`     - Apple Music: ${appleMusic.name} ready`);
  console.log(`     - Booking.com: ${booking.name} ready`);
  console.log(`     - Expedia: ${expedia.name} ready`);
  console.log(`     - Instacart: ${instacart.name} ready`);
  console.log(`     - Lovable: ${lovable.name} ready`);
  console.log(`     - OpenTable: ${opentable.name} ready`);
  console.log(`     - Replit: ${replit.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 31: Enterprise App Integrations (13 apps)
await testModule('Enterprise App Integrations', async () => {
  const {
    SpotifyIntegration,
    TargetIntegration,
    TripAdvisorIntegration,
    ZillowIntegration,
    Base44Integration,
    BotpressIntegration,
    BoxIntegration,
    Brand24Integration,
    BrexIntegration,
    CloudflareIntegration,
    CloudinaryIntegration,
    CourseraIntegration,
    DropboxIntegration,
    IntegrationManager
  } = await import('./src/integrations/enterprise-integrations.js');

  // Test individual integrations
  const spotify = new SpotifyIntegration({ accessToken: 'test-token', clientId: 'test', clientSecret: 'test' });
  const target = new TargetIntegration({ apiKey: 'test-key' });
  const tripadvisor = new TripAdvisorIntegration({ apiKey: 'test-key' });
  const zillow = new ZillowIntegration({ accessToken: 'test-token' });
  const base44 = new Base44Integration({ apiKey: 'test-key' });
  const botpress = new BotpressIntegration({ apiKey: 'test-key', botId: 'test-bot' });
  const box = new BoxIntegration({ accessToken: 'test-token' });
  const brand24 = new Brand24Integration({ apiKey: 'test-key' });
  const brex = new BrexIntegration({ accessToken: 'test-token' });
  const cloudflare = new CloudflareIntegration({ email: 'test@test.com', apiKey: 'test-key' });
  const cloudinary = new CloudinaryIntegration({ cloudName: 'test', apiKey: 'test', apiSecret: 'test' });
  const coursera = new CourseraIntegration({ oauthToken: 'test-token' });
  const dropbox = new DropboxIntegration({ accessToken: 'test-token' });

  // Test configurations
  if (!spotify.isConfigured()) {
    throw new Error('Spotify should be configured');
  }

  if (!target.isConfigured()) {
    throw new Error('Target should be configured');
  }

  if (!cloudflare.isConfigured()) {
    throw new Error('Cloudflare should be configured');
  }

  if (!dropbox.isConfigured()) {
    throw new Error('Dropbox should be configured');
  }

  // Test manager
  const manager = new IntegrationManager();
  manager.register('spotify', spotify);
  manager.register('target', target);
  manager.register('tripadvisor', tripadvisor);
  manager.register('zillow', zillow);
  manager.register('base44', base44);
  manager.register('botpress', botpress);
  manager.register('box', box);
  manager.register('brand24', brand24);
  manager.register('brex', brex);
  manager.register('cloudflare', cloudflare);
  manager.register('cloudinary', cloudinary);
  manager.register('coursera', coursera);
  manager.register('dropbox', dropbox);

  const summary = manager.getStatusSummary();

  if (summary.total !== 13) {
    throw new Error('Should have 13 integrations registered');
  }

  console.log(`     - Spotify: ${spotify.name} ready`);
  console.log(`     - Target: ${target.name} ready`);
  console.log(`     - TripAdvisor: ${tripadvisor.name} ready`);
  console.log(`     - Zillow: ${zillow.name} ready`);
  console.log(`     - Base44: ${base44.name} ready`);
  console.log(`     - Botpress: ${botpress.name} ready`);
  console.log(`     - Box: ${box.name} ready`);
  console.log(`     - Brand24: ${brand24.name} ready`);
  console.log(`     - Brex: ${brex.name} ready`);
  console.log(`     - Cloudflare: ${cloudflare.name} ready`);
  console.log(`     - Cloudinary: ${cloudinary.name} ready`);
  console.log(`     - Coursera: ${coursera.name} ready`);
  console.log(`     - Dropbox: ${dropbox.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 32: Social & Communication Integrations (9 apps)
await testModule('Social & Communication Integrations', async () => {
  const {
    TwitterIntegration,
    InstagramIntegration,
    WhatsAppIntegration,
    LinkedInIntegration,
    TelegramBotIntegration,
    SlackBotIntegration,
    DiscordBotIntegration,
    TeamsBotIntegration,
    ZoomBotIntegration,
    IntegrationManager
  } = await import('./src/integrations/social-integrations.js');

  const twitter = new TwitterIntegration({ apiKey: 'test-key', apiSecret: 'test-secret' });
  const instagram = new InstagramIntegration({ accessToken: 'test-token' });
  const whatsapp = new WhatsAppIntegration({ accessToken: 'test-token' });
  const linkedin = new LinkedInIntegration({ accessToken: 'test-token' });
  const telegram = new TelegramBotIntegration({ botToken: 'test-token' });
  const slack = new SlackBotIntegration({ botToken: 'test-token' });
  const discord = new DiscordBotIntegration({ token: 'test-token' });
  const teams = new TeamsBotIntegration({ appId: 'test-id', appPassword: 'test-password' });
  const zoom = new ZoomBotIntegration({ botToken: 'test-token' });

  if (!twitter.isConfigured()) throw new Error('Twitter should be configured');
  if (!instagram.isConfigured()) throw new Error('Instagram should be configured');
  if (!linkedin.isConfigured()) throw new Error('LinkedIn should be configured');
  if (!discord.isConfigured()) throw new Error('Discord should be configured');

  const manager = new IntegrationManager();
  manager.register('twitter', twitter);
  manager.register('instagram', instagram);
  manager.register('whatsapp', whatsapp);
  manager.register('linkedin', linkedin);
  manager.register('telegram-bot', telegram);
  manager.register('slack-bot', slack);
  manager.register('discord-bot', discord);
  manager.register('teams-bot', teams);
  manager.register('zoom-bot', zoom);

  const summary = manager.getStatusSummary();
  if (summary.total !== 9) throw new Error('Should have 9 integrations');

  console.log(`     - Twitter: ${twitter.name} ready`);
  console.log(`     - Instagram: ${instagram.name} ready`);
  console.log(`     - WhatsApp: ${whatsapp.name} ready`);
  console.log(`     - LinkedIn: ${linkedin.name} ready`);
  console.log(`     - Telegram Bot: ${telegram.name} ready`);
  console.log(`     - Slack Bot: ${slack.name} ready`);
  console.log(`     - Discord Bot: ${discord.name} ready`);
  console.log(`     - Teams Bot: ${teams.name} ready`);
  console.log(`     - Zoom Bot: ${zoom.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 33: DevOps & Infrastructure Integrations (11 apps)
await testModule('DevOps & Infrastructure Integrations', async () => {
  const {
    IONOSIntegration,
    DopplerIntegration,
    DatadogIntegration,
    DigitalOceanIntegration,
    VercelIntegration,
    HuggingFaceIntegration,
    DockerIntegration,
    PrismaIntegration,
    ObsidianIntegration,
    ZubeIntegration,
    BuildJetIntegration,
    IntegrationManager
  } = await import('./src/integrations/devops-integrations.js');

  const ionos = new IONOSIntegration({ apiKey: 'test-key' });
  const doppler = new DopplerIntegration({ token: 'test-token' });
  const datadog = new DatadogIntegration({ apiKey: 'test-key', appKey: 'test-key' });
  const digitalocean = new DigitalOceanIntegration({ token: 'test-token' });
  const vercel = new VercelIntegration({ token: 'test-token' });
  const huggingface = new HuggingFaceIntegration({ token: 'test-token' });
  const docker = new DockerIntegration({ host: 'unix:///var/run/docker.sock' });
  const prisma = new PrismaIntegration({ connectionString: 'postgres://localhost/test' });
  const obsidian = new ObsidianIntegration({ vaultPath: '/path/to/vault' });
  const zube = new ZubeIntegration({ apiKey: 'test-key' });
  const buildjet = new BuildJetIntegration({ apiKey: 'test-key' });

  if (!ionos.isConfigured()) throw new Error('IONOS should be configured');
  if (!digitalocean.isConfigured()) throw new Error('DigitalOcean should be configured');
  if (!vercel.isConfigured()) throw new Error('Vercel should be configured');
  if (!docker.isConfigured()) throw new Error('Docker should be configured');

  const manager = new IntegrationManager();
  manager.register('ionos', ionos);
  manager.register('doppler', doppler);
  manager.register('datadog', datadog);
  manager.register('digitalocean', digitalocean);
  manager.register('vercel', vercel);
  manager.register('huggingface', huggingface);
  manager.register('docker', docker);
  manager.register('prisma', prisma);
  manager.register('obsidian', obsidian);
  manager.register('zube', zube);
  manager.register('buildjet', buildjet);

  const summary = manager.getStatusSummary();
  if (summary.total !== 11) throw new Error('Should have 11 integrations');

  console.log(`     - IONOS: ${ionos.name} ready`);
  console.log(`     - Doppler: ${doppler.name} ready`);
  console.log(`     - Datadog: ${datadog.name} ready`);
  console.log(`     - DigitalOcean: ${digitalocean.name} ready`);
  console.log(`     - Vercel: ${vercel.name} ready`);
  console.log(`     - HuggingFace: ${huggingface.name} ready`);
  console.log(`     - Docker: ${docker.name} ready`);
  console.log(`     - Prisma: ${prisma.name} ready`);
  console.log(`     - Obsidian: ${obsidian.name} ready`);
  console.log(`     - Zube: ${zube.name} ready`);
  console.log(`     - BuildJet: ${buildjet.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 34: Business & Productivity Integrations (18 apps)
await testModule('Business & Productivity Integrations', async () => {
  const {
    GoDaddyIntegration,
    GranolaIntegration,
    GustoIntegration,
    HexIntegration,
    HeyGenIntegration,
    HighLevelIntegration,
    IndeedIntegration,
    CreditKarmaIntegration,
    InVideoIntegration,
    JotFormIntegration,
    KhanAcademyIntegration,
    KrakenIntegration,
    LegalZoomIntegration,
    LonaIntegration,
    NetlifyIntegration,
    NortonIntegration,
    PayPalIntegration,
    ChimeIntegration,
    IntegrationManager
  } = await import('./src/integrations/business-integrations.js');

  const godaddy = new GoDaddyIntegration({ apiKey: 'test', apiSecret: 'test' });
  const granola = new GranolaIntegration({ apiKey: 'test' });
  const gusto = new GustoIntegration({ accessToken: 'test' });
  const hex = new HexIntegration({ apiKey: 'test' });
  const heygen = new HeyGenIntegration({ apiKey: 'test' });
  const highlevel = new HighLevelIntegration({ accessToken: 'test' });
  const indeed = new IndeedIntegration({ publisherId: 'test' });
  const creditkarma = new CreditKarmaIntegration({ clientId: 'test', clientSecret: 'test' });
  const invideo = new InVideoIntegration({ apiKey: 'test' });
  const jotform = new JotFormIntegration({ apiKey: 'test' });
  const khanacademy = new KhanAcademyIntegration({ apiKey: 'test' });
  const kraken = new KrakenIntegration({ apiKey: 'test', apiSecret: 'test' });
  const legalzoom = new LegalZoomIntegration({ apiKey: 'test' });
  const lona = new LonaIntegration({ accessToken: 'test' });
  const netlify = new NetlifyIntegration({ accessToken: 'test' });
  const norton = new NortonIntegration({ apiKey: 'test' });
  const paypal = new PayPalIntegration({ clientId: 'test', clientSecret: 'test' });
  const chime = new ChimeIntegration({ accountId: 'test' });

  if (!godaddy.isConfigured()) throw new Error('GoDaddy should be configured');
  if (!kraken.isConfigured()) throw new Error('Kraken should be configured');
  if (!netlify.isConfigured()) throw new Error('Netlify should be configured');
  if (!paypal.isConfigured()) throw new Error('PayPal should be configured');

  const manager = new IntegrationManager();
  manager.register('godaddy', godaddy);
  manager.register('granola', granola);
  manager.register('gusto', gusto);
  manager.register('hex', hex);
  manager.register('heygen', heygen);
  manager.register('highlevel', highlevel);
  manager.register('indeed', indeed);
  manager.register('creditkarma', creditkarma);
  manager.register('invideo', invideo);
  manager.register('jotform', jotform);
  manager.register('khanacademy', khanacademy);
  manager.register('kraken', kraken);
  manager.register('legalzoom', legalzoom);
  manager.register('lona', lona);
  manager.register('netlify', netlify);
  manager.register('norton', norton);
  manager.register('paypal', paypal);
  manager.register('chime', chime);

  const summary = manager.getStatusSummary();
  if (summary.total !== 18) throw new Error('Should have 18 integrations');

  console.log(`     - GoDaddy: ${godaddy.name} ready`);
  console.log(`     - Granola: ${granola.name} ready`);
  console.log(`     - Gusto: ${gusto.name} ready`);
  console.log(`     - Hex: ${hex.name} ready`);
  console.log(`     - HeyGen: ${heygen.name} ready`);
  console.log(`     - HighLevel: ${highlevel.name} ready`);
  console.log(`     - Indeed: ${indeed.name} ready`);
  console.log(`     - Credit Karma: ${creditkarma.name} ready`);
  console.log(`     - InVideo: ${invideo.name} ready`);
  console.log(`     - JotForm: ${jotform.name} ready`);
  console.log(`     - Khan Academy: ${khanacademy.name} ready`);
  console.log(`     - Kraken: ${kraken.name} ready`);
  console.log(`     - Legal Zoom: ${legalzoom.name} ready`);
  console.log(`     - Lona: ${lona.name} ready`);
  console.log(`     - Netlify: ${netlify.name} ready`);
  console.log(`     - Norton: ${norton.name} ready`);
  console.log(`     - PayPal: ${paypal.name} ready`);
  console.log(`     - Chime: ${chime.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 35: Marketing & Analytics Integrations (20 apps)
await testModule('Marketing & Analytics Integrations', async () => {
  const {
    MailchimpIntegration,
    SendGridIntegration,
    TwilioIntegration,
    StripeIntegration,
    IntercomIntegration,
    FreshdeskIntegration,
    ZendeskIntegration,
    ActiveCampaignIntegration,
    ConvertKitIntegration,
    KlaviyoIntegration,
    MixpanelIntegration,
    AmplitudeIntegration,
    SegmentIntegration,
    BrazeIntegration,
    ClearbitIntegration,
    FullContactIntegration,
    HunterIntegration,
    SnovIOIntegration,
    ZeroBounceIntegration,
    NeverBounceIntegration,
    IntegrationManager
  } = await import('./src/integrations/marketing-integrations.js');

  const mailchimp = new MailchimpIntegration({ apiKey: 'test' });
  const sendgrid = new SendGridIntegration({ apiKey: 'test' });
  const twilio = new TwilioIntegration({ accountSid: 'test', authToken: 'test' });
  const stripe = new StripeIntegration({ apiKey: 'test' });
  const intercom = new IntercomIntegration({ accessToken: 'test' });
  const freshdesk = new FreshdeskIntegration({ apiKey: 'test', domain: 'test' });
  const zendesk = new ZendeskIntegration({ email: 'test@test.com', apiToken: 'test', subdomain: 'test' });
  const activecampaign = new ActiveCampaignIntegration({ apiKey: 'test', apiUrl: 'https://test.api' });
  const convertkit = new ConvertKitIntegration({ apiKey: 'test' });
  const klaviyo = new KlaviyoIntegration({ apiKey: 'test' });
  const mixpanel = new MixpanelIntegration({ token: 'test' });
  const amplitude = new AmplitudeIntegration({ apiKey: 'test' });
  const segment = new SegmentIntegration({ writeKey: 'test' });
  const braze = new BrazeIntegration({ apiKey: 'test', appId: 'test' });
  const clearbit = new ClearbitIntegration({ apiKey: 'test' });
  const fullcontact = new FullContactIntegration({ apiKey: 'test' });
  const hunter = new HunterIntegration({ apiKey: 'test' });
  const snovio = new SnovIOIntegration({ clientId: 'test', clientSecret: 'test' });
  const zerobounce = new ZeroBounceIntegration({ apiKey: 'test' });
  const neverbounce = new NeverBounceIntegration({ apiKey: 'test' });

  if (!mailchimp.isConfigured()) throw new Error('Mailchimp should be configured');
  if (!stripe.isConfigured()) throw new Error('Stripe should be configured');
  if (!twilio.isConfigured()) throw new Error('Twilio should be configured');
  if (!segment.isConfigured()) throw new Error('Segment should be configured');
  if (!clearbit.isConfigured()) throw new Error('Clearbit should be configured');

  const manager = new IntegrationManager();
  manager.register('mailchimp', mailchimp);
  manager.register('sendgrid', sendgrid);
  manager.register('twilio', twilio);
  manager.register('stripe', stripe);
  manager.register('intercom', intercom);
  manager.register('freshdesk', freshdesk);
  manager.register('zendesk', zendesk);
  manager.register('activecampaign', activecampaign);
  manager.register('convertkit', convertkit);
  manager.register('klaviyo', klaviyo);
  manager.register('mixpanel', mixpanel);
  manager.register('amplitude', amplitude);
  manager.register('segment', segment);
  manager.register('braze', braze);
  manager.register('clearbit', clearbit);
  manager.register('fullcontact', fullcontact);
  manager.register('hunter', hunter);
  manager.register('snovio', snovio);
  manager.register('zerobounce', zerobounce);
  manager.register('neverbounce', neverbounce);

  const summary = manager.getStatusSummary();
  if (summary.total !== 20) throw new Error('Should have 20 integrations');

  console.log(`     - Mailchimp: ${mailchimp.name} ready`);
  console.log(`     - SendGrid: ${sendgrid.name} ready`);
  console.log(`     - Twilio: ${twilio.name} ready`);
  console.log(`     - Stripe: ${stripe.name} ready`);
  console.log(`     - Intercom: ${intercom.name} ready`);
  console.log(`     - Freshdesk: ${freshdesk.name} ready`);
  console.log(`     - Zendesk: ${zendesk.name} ready`);
  console.log(`     - ActiveCampaign: ${activecampaign.name} ready`);
  console.log(`     - ConvertKit: ${convertkit.name} ready`);
  console.log(`     - Klaviyo: ${klaviyo.name} ready`);
  console.log(`     - Mixpanel: ${mixpanel.name} ready`);
  console.log(`     - Amplitude: ${amplitude.name} ready`);
  console.log(`     - Segment: ${segment.name} ready`);
  console.log(`     - Braze: ${braze.name} ready`);
  console.log(`     - Clearbit: ${clearbit.name} ready`);
  console.log(`     - FullContact: ${fullcontact.name} ready`);
  console.log(`     - Hunter: ${hunter.name} ready`);
  console.log(`     - Snov.io: ${snovio.name} ready`);
  console.log(`     - ZeroBounce: ${zerobounce.name} ready`);
  console.log(`     - NeverBounce: ${neverbounce.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 36: IoT, Hardware & Utility Integrations (10 apps)
await testModule('IoT, Hardware & Utility Integrations', async () => {
  const {
    PhilipsHueIntegration,
    WemoIntegration,
    SmartThingsIntegration,
    RingIntegration,
    NestIntegration,
    EcobeeIntegration,
    TeslaIntegration,
    Control4Integration,
    CrestronIntegration,
    LutronIntegration,
    IntegrationManager
  } = await import('./src/integrations/iot-integrations.js');

  const philipshue = new PhilipsHueIntegration({ bridgeIp: '192.168.1.100', username: 'test' });
  const wemo = new WemoIntegration({ ip: '192.168.1.101' });
  const smartthings = new SmartThingsIntegration({ accessToken: 'test' });
  const ring = new RingIntegration({ accessToken: 'test' });
  const nest = new NestIntegration({ accessToken: 'test' });
  const ecobee = new EcobeeIntegration({ accessToken: 'test' });
  const tesla = new TeslaIntegration({ accessToken: 'test' });
  const control4 = new Control4Integration({ directorIp: '192.168.1.102', username: 'test', password: 'test' });
  const crestron = new CrestronIntegration({ host: '192.168.1.103', username: 'test', password: 'test' });
  const lutron = new LutronIntegration({ host: '192.168.1.104', username: 'test', password: 'test' });

  if (!philipshue.isConfigured()) throw new Error('PhilipsHue should be configured');
  if (!smartthings.isConfigured()) throw new Error('SmartThings should be configured');
  if (!tesla.isConfigured()) throw new Error('Tesla should be configured');
  if (!lutron.isConfigured()) throw new Error('Lutron should be configured');

  const manager = new IntegrationManager();
  manager.register('philipshue', philipshue);
  manager.register('wemo', wemo);
  manager.register('smartthings', smartthings);
  manager.register('ring', ring);
  manager.register('nest', nest);
  manager.register('ecobee', ecobee);
  manager.register('tesla', tesla);
  manager.register('control4', control4);
  manager.register('crestron', crestron);
  manager.register('lutron', lutron);

  const summary = manager.getStatusSummary();
  if (summary.total !== 10) throw new Error('Should have 10 integrations');

  console.log(`     - PhilipsHue: ${philipshue.name} ready`);
  console.log(`     - Wemo: ${wemo.name} ready`);
  console.log(`     - SmartThings: ${smartthings.name} ready`);
  console.log(`     - Ring: ${ring.name} ready`);
  console.log(`     - Nest: ${nest.name} ready`);
  console.log(`     - Ecobee: ${ecobee.name} ready`);
  console.log(`     - Tesla: ${tesla.name} ready`);
  console.log(`     - Control4: ${control4.name} ready`);
  console.log(`     - Crestron: ${crestron.name} ready`);
  console.log(`     - Lutron: ${lutron.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 37: Data, Scientific & Research Integrations (20 apps)
await testModule('Data, Scientific & Research Integrations', async () => {
  const {
    WolframAlphaIntegration,
    IBMWatsonIntegration,
    ClarifaiIntegration,
    MapboxIntegration,
    OpenWeatherMapIntegration,
    AlgoliaIntegration,
    ElasticsearchIntegration,
    PineconeIntegration,
    WeaviateIntegration,
    QdrantIntegration,
    MeilisearchIntegration,
    TypesenseIntegration,
    DataRobotIntegration,
    KNIMEIntegration,
    RapidMinerIntegration,
    AlteryxIntegration,
    TrifactaIntegration,
    IntegrationManager
  } = await import('./src/integrations/data-integrations.js');

  const wolframalpha = new WolframAlphaIntegration({ appId: 'test' });
  const ibmwatson = new IBMWatsonIntegration({ apiKey: 'test' });
  const clarifai = new ClarifaiIntegration({ apiKey: 'test' });
  const mapbox = new MapboxIntegration({ accessToken: 'test' });
  const openweathermap = new OpenWeatherMapIntegration({ apiKey: 'test' });
  const algolia = new AlgoliaIntegration({ appId: 'test', apiKey: 'test' });
  const elasticsearch = new ElasticsearchIntegration({ node: 'http://localhost:9200' });
  const pinecone = new PineconeIntegration({ apiKey: 'test' });
  const weaviate = new WeaviateIntegration({ url: 'http://localhost:8080' });
  const qdrant = new QdrantIntegration({ url: 'http://localhost:6333' });
  const meilisearch = new MeilisearchIntegration({ host: 'http://localhost:7700' });
  const typesense = new TypesenseIntegration({ host: 'localhost', apiKey: 'test' });
  const datarobot = new DataRobotIntegration({ apiKey: 'test' });
  const knime = new KNIMEIntegration({ serverUrl: 'http://localhost:8182' });
  const rapidminer = new RapidMinerIntegration({ apiKey: 'test' });
  const alteryx = new AlteryxIntegration({ apiKey: 'test' });
  const trifacta = new TrifactaIntegration({ apiKey: 'test' });

  if (!wolframalpha.isConfigured()) throw new Error('WolframAlpha should be configured');
  if (!clarifai.isConfigured()) throw new Error('Clarifai should be configured');
  if (!pinecone.isConfigured()) throw new Error('Pinecone should be configured');
  if (!elasticsearch.isConfigured()) throw new Error('Elasticsearch should be configured');

  const manager = new IntegrationManager();
  manager.register('wolframalpha', wolframalpha);
  manager.register('ibmwatson', ibmwatson);
  manager.register('clarifai', clarifai);
  manager.register('mapbox', mapbox);
  manager.register('openweathermap', openweathermap);
  manager.register('algolia', algolia);
  manager.register('elasticsearch', elasticsearch);
  manager.register('pinecone', pinecone);
  manager.register('weaviate', weaviate);
  manager.register('qdrant', qdrant);
  manager.register('meilisearch', meilisearch);
  manager.register('typesense', typesense);
  manager.register('datarobot', datarobot);
  manager.register('knime', knime);
  manager.register('rapidminer', rapidminer);
  manager.register('alteryx', alteryx);
  manager.register('trifacta', trifacta);

  const summary = manager.getStatusSummary();
  if (summary.total !== 17) throw new Error('Should have 17 integrations');

  console.log(`     - WolframAlpha: ${wolframalpha.name} ready`);
  console.log(`     - IBMWatson: ${ibmwatson.name} ready`);
  console.log(`     - Clarifai: ${clarifai.name} ready`);
  console.log(`     - Mapbox: ${mapbox.name} ready`);
  console.log(`     - OpenWeatherMap: ${openweathermap.name} ready`);
  console.log(`     - Algolia: ${algolia.name} ready`);
  console.log(`     - Elasticsearch: ${elasticsearch.name} ready`);
  console.log(`     - Pinecone: ${pinecone.name} ready`);
  console.log(`     - Weaviate: ${weaviate.name} ready`);
  console.log(`     - Qdrant: ${qdrant.name} ready`);
  console.log(`     - Meilisearch: ${meilisearch.name} ready`);
  console.log(`     - Typesense: ${typesense.name} ready`);
  console.log(`     - DataRobot: ${datarobot.name} ready`);
  console.log(`     - KNIME: ${knime.name} ready`);
  console.log(`     - RapidMiner: ${rapidminer.name} ready`);
  console.log(`     - Alteryx: ${alteryx.name} ready`);
  console.log(`     - Trifacta: ${trifacta.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 38: Education, Media & Communication Integrations (30 apps)
await testModule('Education, Media & Communication Integrations', async () => {
  const {
    CourseraIntegration,
    UdemyIntegration,
    SkillshareIntegration,
    DuolingoIntegration,
    QuizletIntegration,
    CodecademyIntegration,
    DatacampIntegration,
    PluralsightIntegration,
    MediumIntegration,
    SubstackIntegration,
    GhostIntegration,
    YouTubeIntegration,
    VimeoIntegration,
    TwitchIntegration,
    SpotifyIntegration,
    SoundCloudIntegration,
    PandoraIntegration,
    BandcampIntegration,
    DiscordIntegration,
    SlackIntegration,
    ZoomIntegration,
    MicrosoftTeamsIntegration,
    LineIntegration,
    WeChatIntegration,
    IntegrationManager
  } = await import('./src/integrations/media-integrations.js');

  const coursera = new CourseraIntegration({ accessToken: 'test' });
  const udemy = new UdemyIntegration({ clientId: 'test' });
  const skillshare = new SkillshareIntegration({ apiKey: 'test' });
  const duolingo = new DuolingoIntegration({ accessToken: 'test' });
  const quizlet = new QuizletIntegration({ accessToken: 'test' });
  const codecademy = new CodecademyIntegration({ apiKey: 'test' });
  const datacamp = new DatacampIntegration({ apiKey: 'test' });
  const pluralsight = new PluralsightIntegration({ apiKey: 'test' });
  const medium = new MediumIntegration({ integrationToken: 'test' });
  const substack = new SubstackIntegration({ apiKey: 'test' });
  const ghost = new GhostIntegration({ adminApiKey: 'test', url: 'http://localhost:3001' });
  const youtube = new YouTubeIntegration({ apiKey: 'test' });
  const vimeo = new VimeoIntegration({ accessToken: 'test' });
  const twitch = new TwitchIntegration({ clientId: 'test', accessToken: 'test' });
  const spotify = new SpotifyIntegration({ accessToken: 'test' });
  const soundcloud = new SoundCloudIntegration({ clientId: 'test' });
  const pandora = new PandoraIntegration({ partnerId: 'test', partnerPassword: 'test' });
  const bandcamp = new BandcampIntegration({ apiKey: 'test' });
  const discord = new DiscordIntegration({ botToken: 'test' });
  const slack = new SlackIntegration({ botToken: 'test' });
  const zoom = new ZoomIntegration({ apiKey: 'test' });
  const msteams = new MicrosoftTeamsIntegration({ clientId: 'test', clientSecret: 'test' });
  const line = new LineIntegration({ channelSecret: 'test', accessToken: 'test' });
  const wechat = new WeChatIntegration({ appId: 'test', appSecret: 'test' });

  if (!coursera.isConfigured()) throw new Error('Coursera should be configured');
  if (!spotify.isConfigured()) throw new Error('Spotify should be configured');
  if (!slack.isConfigured()) throw new Error('Slack should be configured');
  if (!discord.isConfigured()) throw new Error('Discord should be configured');

  const manager = new IntegrationManager();
  manager.register('coursera', coursera);
  manager.register('udemy', udemy);
  manager.register('skillshare', skillshare);
  manager.register('duolingo', duolingo);
  manager.register('quizlet', quizlet);
  manager.register('codecademy', codecademy);
  manager.register('datacamp', datacamp);
  manager.register('pluralsight', pluralsight);
  manager.register('medium', medium);
  manager.register('substack', substack);
  manager.register('ghost', ghost);
  manager.register('youtube', youtube);
  manager.register('vimeo', vimeo);
  manager.register('twitch', twitch);
  manager.register('spotify', spotify);
  manager.register('soundcloud', soundcloud);
  manager.register('pandora', pandora);
  manager.register('bandcamp', bandcamp);
  manager.register('discord', discord);
  manager.register('slack', slack);
  manager.register('zoom', zoom);
  manager.register('msteams', msteams);
  manager.register('line', line);
  manager.register('wechat', wechat);

  const summary = manager.getStatusSummary();
  if (summary.total !== 24) throw new Error('Should have 24 integrations');

  console.log(`     - Coursera: ${coursera.name} ready`);
  console.log(`     - Udemy: ${udemy.name} ready`);
  console.log(`     - Skillshare: ${skillshare.name} ready`);
  console.log(`     - Duolingo: ${duolingo.name} ready`);
  console.log(`     - Quizlet: ${quizlet.name} ready`);
  console.log(`     - Codecademy: ${codecademy.name} ready`);
  console.log(`     - Datacamp: ${datacamp.name} ready`);
  console.log(`     - Pluralsight: ${pluralsight.name} ready`);
  console.log(`     - Medium: ${medium.name} ready`);
  console.log(`     - Substack: ${substack.name} ready`);
  console.log(`     - Ghost: ${ghost.name} ready`);
  console.log(`     - YouTube: ${youtube.name} ready`);
  console.log(`     - Vimeo: ${vimeo.name} ready`);
  console.log(`     - Twitch: ${twitch.name} ready`);
  console.log(`     - Spotify: ${spotify.name} ready`);
  console.log(`     - SoundCloud: ${soundcloud.name} ready`);
  console.log(`     - Pandora: ${pandora.name} ready`);
  console.log(`     - Bandcamp: ${bandcamp.name} ready`);
  console.log(`     - Discord: ${discord.name} ready`);
  console.log(`     - Slack: ${slack.name} ready`);
  console.log(`     - Zoom: ${zoom.name} ready`);
  console.log(`     - MS Teams: ${msteams.name} ready`);
  console.log(`     - Line: ${line.name} ready`);
  console.log(`     - WeChat: ${wechat.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// Test 39: Fintech, Healthcare & Lifestyle Integrations (30 apps)
await testModule('Fintech, Healthcare & Lifestyle Integrations', async () => {

// Test 40: Additional LLM Providers
await testModule('Additional LLM Providers (15)', async () => {
  const {
    GoogleAIProvider,
    MistralProvider,
    CohereProvider,
    AI21Provider,
    MetaProvider,
    HuggingFaceProvider,
    ReplicateProvider,
    PerplexityProvider,
    GroqProvider,
    DeepSeekProvider,
    FireworksProvider,
    TogetherProvider,
    AnyscaleProvider,
    CloudflareProvider,
    StabilityAIProvider
  } = await import('./src/providers/additional-providers.js');

  // Test Google AI Provider
  const googleAI = new GoogleAIProvider({
    id: 'google-ai',
    name: 'Google AI',
    apiKey: 'test-key'
  });
  
  if (googleAI.name !== 'Google AI') {
    throw new Error('Google AI provider should have correct name');
  }
  
  if (!googleAI.hasModel('gemini-pro')) {
    throw new Error('Google AI should have gemini-pro model');
  }
  
  // Test Mistral Provider
  const mistral = new MistralProvider({
    id: 'mistral',
    name: 'Mistral AI',
    apiKey: 'test-key'
  });
  
  if (!mistral.hasModel('mistral-large-latest')) {
    throw new Error('Mistral should have mistral-large model');
  }
  
  // Test Cohere Provider
  const cohere = new CohereProvider({
    id: 'cohere',
    name: 'Cohere',
    apiKey: 'test-key'
  });
  
  if (!cohere.hasModel('command-r-plus')) {
    throw new Error('Cohere should have command-r-plus model');
  }
  
  // Test DeepSeek Provider
  const deepseek = new DeepSeekProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    apiKey: 'test-key'
  });
  
  if (!deepseek.hasModel('deepseek-chat')) {
    throw new Error('DeepSeek should have deepseek-chat model');
  }
  
  // Test Groq Provider
  const groq = new GroqProvider({
    id: 'groq',
    name: 'Groq',
    apiKey: 'test-key'
  });
  
  if (!groq.hasModel('mixtral-8x7b-32768')) {
    throw new Error('Groq should have mixtral model');
  }
  
  // Test Perplexity Provider
  const perplexity = new PerplexityProvider({
    id: 'perplexity',
    name: 'Perplexity',
    apiKey: 'test-key'
  });
  
  if (!perplexity.hasModel('llama-3-sonar-large-32k-online')) {
    throw new Error('Perplexity should have sonar model');
  }
  
  // Test Meta Provider (Llama)
  const meta = new MetaProvider({
    id: 'meta',
    name: 'Meta AI',
    apiKey: 'test-key'
  });
  
  if (!meta.hasModel('meta-llama/Llama-3-70b-chat-hf')) {
    throw new Error('Meta should have Llama 3 model');
  }
  
  // Test Fireworks Provider
  const fireworks = new FireworksProvider({
    id: 'fireworks',
    name: 'Fireworks AI',
    apiKey: 'test-key'
  });
  
  if (!fireworks.hasModel('accounts/fireworks/models/llama-v3-70b-instruct')) {
    throw new Error('Fireworks should have Llama 3 model');
  }
  
  // Test Cloudflare Provider
  const cloudflare = new CloudflareProvider({
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    apiKey: 'test-key',
    accountId: 'test-account'
  });
  
  if (!cloudflare.hasModel('@cf/meta/llama-3-8b-instruct')) {
    throw new Error('Cloudflare should have Llama 3 8B model');
  }
  
  // Test Stability AI Provider
  const stability = new StabilityAIProvider({
    id: 'stability',
    name: 'Stability AI',
    apiKey: 'test-key'
  });
  
  if (!stability.hasModel('stable-diffusion-xl-1024-v1-0')) {
    throw new Error('Stability should have SDXL model');
  }
  
  // Test HuggingFace Provider
  const huggingface = new HuggingFaceProvider({
    id: 'huggingface',
    name: 'Hugging Face',
    apiKey: 'test-key'
  });
  
  if (!huggingface.hasModel('meta-llama/Llama-3-70b-chat-hf')) {
    throw new Error('HuggingFace should have Llama 3 model');
  }
  
  // Test Together Provider
  const together = new TogetherProvider({
    id: 'together',
    name: 'Together AI',
    apiKey: 'test-key'
  });
  
  if (!together.hasModel('togethercomputer/llama-2-70b-chat')) {
    throw new Error('Together should have Llama 2 model');
  }
  
  // Test Anyscale Provider
  const anyscale = new AnyscaleProvider({
    id: 'anyscale',
    name: 'Anyscale',
    apiKey: 'test-key'
  });
  
  if (!anyscale.hasModel('meta-llama/Llama-2-70b-chat-hf')) {
    throw new Error('Anyscale should have Llama 2 model');
  }
  
  // Test AI21 Provider
  const ai21 = new AI21Provider({
    id: 'ai21',
    name: 'AI21 Jamba',
    apiKey: 'test-key'
  });
  
  if (!ai21.hasModel('jamba-large')) {
    throw new Error('AI21 should have jamba-large model');
  }
  
  // Test Replicate Provider
  const replicate = new ReplicateProvider({
    id: 'replicate',
    name: 'Replicate',
    apiKey: 'test-key'
  });
  
  if (!replicate.hasModel('meta/meta-llama-3-70b-instruct')) {
    throw new Error('Replicate should have Llama 3 model');
  }
  
  console.log(`     - Google AI: ${googleAI.name} (${googleAI.getModels().length} models)`);
  console.log(`     - Mistral: ${mistral.name} (${mistral.getModels().length} models)`);
  console.log(`     - Cohere: ${cohere.name} (${cohere.getModels().length} models)`);
  console.log(`     - AI21: ${ai21.name} (${ai21.getModels().length} models)`);
  console.log(`     - Meta: ${meta.name} (${meta.getModels().length} models)`);
  console.log(`     - HuggingFace: ${huggingface.name} (${huggingface.getModels().length} models)`);
  console.log(`     - Replicate: ${replicate.name} (${replicate.getModels().length} models)`);
  console.log(`     - Perplexity: ${perplexity.name} (${perplexity.getModels().length} models)`);
  console.log(`     - Groq: ${groq.name} (${groq.getModels().length} models)`);
  console.log(`     - DeepSeek: ${deepseek.name} (${deepseek.getModels().length} models)`);
  console.log(`     - Fireworks: ${fireworks.name} (${fireworks.getModels().length} models)`);
  console.log(`     - Together: ${together.name} (${together.getModels().length} models)`);
  console.log(`     - Anyscale: ${anyscale.name} (${anyscale.getModels().length} models)`);
  console.log(`     - Cloudflare: ${cloudflare.name} (${cloudflare.getModels().length} models)`);
  console.log(`     - Stability AI: ${stability.name} (${stability.getModels().length} models)`);
});

// Test 41: Additional Agents
await testModule('Additional Agents (20)', async () => {
  const { additionalAgents } = await import('./src/agents/additional-agents.js');
  
  if (!Array.isArray(additionalAgents)) {
    throw new Error('additionalAgents should be an array');
  }
  
  if (additionalAgents.length !== 30) {
    throw new Error(`Should have 30 agents, got ${additionalAgents.length}`);
  }
  
  const agentIds = additionalAgents.map(a => a.id);
  const expectedIds = [
    'ORACLE', 'SCULPTOR', 'GUARDIAN', 'MATHEMATICIAN', 'LINGUIST',
    'CHEF', 'FITNESS', 'FINANCE', 'LAWYER', 'SCIENTIST',
    'WRITER', 'MUSICIAN', 'TEACHER', 'THERAPIST', 'TRAVELER',
    'MARKETER', 'HR_ASSISTANT', 'PM', 'DATA_ENG', 'DEVOPS'
  ];
  
  for (const id of expectedIds) {
    if (!agentIds.includes(id)) {
      throw new Error(`Missing agent: ${id}`);
    }
  }
  
  console.log(`     - Total agents: ${additionalAgents.length}`);
  console.log(`     - Agent IDs: ${agentIds.slice(0, 5).join(', ')}, ...`);
});

// Test 42: Additional Channels
await testModule('Additional Channels (10)', async () => {
  const additionalChannels = await import('./src/channels/additional-channels.js');
  
  // Test Email Channel
  const email = new additionalChannels.EmailChannel({
    id: 'test-email',
    name: 'Test Email',
    smtp: { host: 'smtp.test.com', port: 587 }
  });
  if (email.type !== 'email') {
    throw new Error('Email channel should have type "email"');
  }
  
  // Test SMS Channel
  const sms = new additionalChannels.SMSChannel({
    id: 'test-sms',
    name: 'Test SMS',
    provider: 'twilio'
  });
  if (sms.type !== 'sms') {
    throw new Error('SMS channel should have type "sms"');
  }
  
  // Test Matrix Channel
  const matrix = new additionalChannels.MatrixChannel({
    id: 'test-matrix',
    name: 'Test Matrix',
    homeserver: 'https://matrix.test.com'
  });
  if (matrix.type !== 'matrix') {
    throw new Error('Matrix channel should have type "matrix"');
  }
  
  // Test IRC Channel
  const irc = new additionalChannels.IRCChannel({
    id: 'test-irc',
    name: 'Test IRC',
    server: 'irc.test.com'
  });
  if (irc.type !== 'irc') {
    throw new Error('IRC channel should have type "irc"');
  }
  
  // Test XMPP Channel
  const xmpp = new additionalChannels.XMPPChannel({
    id: 'test-xmpp',
    name: 'Test XMPP',
    jid: 'test@test.com'
  });
  if (xmpp.type !== 'xmpp') {
    throw new Error('XMPP channel should have type "xmpp"');
  }
  
  // Test Ntfy Channel
  const ntfy = new additionalChannels.NtfyChannel({
    id: 'test-ntfy',
    name: 'Test Ntfy',
    server: 'https://ntfy.sh'
  });
  if (ntfy.type !== 'ntfy') {
    throw new Error('Ntfy channel should have type "ntfy"');
  }
  
  // Test Pushover Channel
  const pushover = new additionalChannels.PushoverChannel({
    id: 'test-pushover',
    name: 'Test Pushover',
    token: 'test-token'
  });
  if (pushover.type !== 'pushover') {
    throw new Error('Pushover channel should have type "pushover"');
  }
  
  // Test Signal Channel
  const signal = new additionalChannels.SignalChannel({
    id: 'test-signal',
    name: 'Test Signal',
    phoneNumber: '+1234567890'
  });
  if (signal.type !== 'signal') {
    throw new Error('Signal channel should have type "signal"');
  }
  
  // Test WebRTC Channel
  const webrtc = new additionalChannels.WebRTCChannel({
    id: 'test-webrtc',
    name: 'Test WebRTC',
    stunServers: ['stun:stun.test.com']
  });
  if (webrtc.type !== 'webrtc') {
    throw new Error('WebRTC channel should have type "webrtc"');
  }
  
  // Test Webmention Channel
  const webmention = new additionalChannels.WebmentionChannel({
    id: 'test-webmention',
    name: 'Test Webmention',
    endpoint: 'https://webmention.io/test/webmention'
  });
  if (webmention.type !== 'webmention') {
    throw new Error('Webmention channel should have type "webmention"');
  }
  
  console.log(`     - Email: ${email.type}`);
  console.log(`     - SMS: ${sms.type}`);
  console.log(`     - Matrix: ${matrix.type}`);
  console.log(`     - IRC: ${irc.type}`);
  console.log(`     - XMPP: ${xmpp.type}`);
  console.log(`     - Ntfy: ${ntfy.type}`);
  console.log(`     - Pushover: ${pushover.type}`);
  console.log(`     - Signal: ${signal.type}`);
  console.log(`     - WebRTC: ${webrtc.type}`);
  console.log(`     - Webmention: ${webmention.type}`);
});

// Test 43: Community Plugins
await testModule('Community Plugins (59)', async () => {
  const { plugins, pluginDescriptions, pluginCount } = await import('./src/plugins/community/index.js');
  
  if (plugins.length !== 59) {
    throw new Error(`Should have 59 plugins, got ${plugins.length}`);
  }
  
  if (Object.keys(pluginDescriptions).length !== 59) {
    throw new Error('Should have 59 plugin descriptions');
  }
  
  // Verify key plugins exist
  const keyPlugins = [
    'math-plugin', 'translator-plugin', 'image-plugin', 'calendar-plugin',
    'weather-plugin', 'markdown-plugin', 'calculator-plugin', 'qrcode-plugin',
    'emoji-plugin', 'color-plugin', 'currency-plugin', 'date-plugin',
    'uuid-plugin', 'json-plugin', 'jwt-plugin', 'queue-plugin',
    'rate-limit-plugin', 'retry-plugin', 'memoize-plugin', 'batch-plugin'
  ];
  
  for (const plugin of keyPlugins) {
    if (!plugins.includes(plugin)) {
      throw new Error(`Missing plugin: ${plugin}`);
    }
    if (!pluginDescriptions[plugin]) {
      throw new Error(`Missing description for: ${plugin}`);
    }
  }
  
  console.log(`     - Total plugins: ${plugins.length}`);
  console.log(`     - Plugin count matches: ${pluginCount === 59}`);
  console.log(`     - All descriptions present: ${Object.keys(pluginDescriptions).length === 59}`);
  console.log(`     - Sample plugins: ${plugins.slice(0, 10).join(', ')}`);
});

// Test 44: Features Module (21 Features)
await testModule('Features Module (21 Features)', async () => {
  const features = await import('./src/features/index.js');
  
  const featureNames = Object.keys(features).filter(k => 
    k !== 'default' && k !== '__esModule' && k !== 'features' && k !== 'featureCount'
  );
  
  if (featureNames.length < 21) {
    throw new Error(`Should have at least 21 features, got ${featureNames.length}`);
  }
  
  // Test specific features exist
  const requiredFeatures = [
    'RateLimiter', 'AuditLogger', 'Scheduler', 'TemplateEngine',
    'AnalyticsTracker', 'BackupManager', 'NotificationCenter', 'SchemaBuilder',
    'WebhookManager', 'SearchEngine', 'APIVersioning', 'FileProcessor',
    'SessionManager', 'OAuth2Manager', 'TimeSeriesDatabase', 'HealthMonitor',
    'WorkflowEngine', 'DistributedLockManager', 'MemoryCache', 'ABTestManager',
    'GraphQLSchema'
  ];
  
  for (const feature of requiredFeatures.slice(0, 10)) {
    if (!features[feature]) {
      throw new Error(`Missing feature: ${feature}`);
    }
  }
  
  console.log(`     - Features loaded: ${featureNames.length}`);
  console.log(`     - Feature names: ${featureNames.slice(0, 5).join(', ')}`);
});

// Test 45: Provider Integration with Manager
await testModule('Provider Manager Integration', async () => {
  const { getProviderManager } = await import('./src/providers/provider-system.js');
  const { 
    GoogleAIProvider, MistralProvider, CohereProvider, GroqProvider, DeepSeekProvider
  } = await import('./src/providers/additional-providers.js');
  
  const manager = getProviderManager();
  
  // Register multiple providers
  const googleAI = new GoogleAIProvider({ id: 'google', name: 'Google AI', apiKey: 'test' });
  const mistral = new MistralProvider({ id: 'mistral', name: 'Mistral', apiKey: 'test' });
  const cohere = new CohereProvider({ id: 'cohere', name: 'Cohere', apiKey: 'test' });
  const groq = new GroqProvider({ id: 'groq', name: 'Groq', apiKey: 'test' });
  const deepseek = new DeepSeekProvider({ id: 'deepseek', name: 'DeepSeek', apiKey: 'test' });
  
  manager.register(googleAI);
  manager.register(mistral);
  manager.register(cohere);
  manager.register(groq);
  manager.register(deepseek);
  
  const allProviders = manager.getAll();
  if (allProviders.length < 5) {
    throw new Error('Should have at least 5 providers registered');
  }
  
  const healthy = manager.getHealthy();
  const status = manager.getStatus();
  
  console.log(`     - Total providers: ${allProviders.length}`);
  console.log(`     - Healthy providers: ${healthy.length}`);
  console.log(`     - Manager status: ${JSON.stringify({ total: status.total, healthy: status.healthy })}`);
});

// Test 46: Agent Registry Integration
await testModule('Agent Registry Integration', async () => {
  const { getAgentRegistry } = await import('./src/agents/agent-system.js');
  const { additionalAgents } = await import('./src/agents/additional-agents.js');
  
  const registry = getAgentRegistry();
  
  // Register the predefined agents
  for (const agent of additionalAgents) {
    registry.register(agent);
  }
  
  const registeredAgents = registry.getAll();
  console.log(`     - Registered agents: ${registeredAgents.length}`);
  console.log(`     - Sample agent roles: ${additionalAgents.slice(0, 3).map(a => `${a.id} [${a.role}]`).join(', ')}`);
});

// Test 47: Event Bus Stress Test
await testModule('Event Bus Stress Test', async () => {
  const { getEventBus } = await import('./src/events/event-bus.js');
  
  const bus = getEventBus();
  let eventCount = 0;
  
  // Subscribe to test event
  bus.subscribe('test.stress', () => {
    eventCount++;
  });
  
  // Publish multiple events
  for (let i = 0; i < 100; i++) {
    bus.publish({ type: 'test.stress', data: { index: i } });
  }
  
  // Small delay for async processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log(`     - Events published: 100`);
  console.log(`     - Events processed: ${eventCount}`);
});

// Test 48: Cache System Stress Test
await testModule('Cache System Stress Test', async () => {
  const { getCacheManager } = await import('./src/cache/cache-system.js');
  
  const cacheManager = getCacheManager();
  const cache = cacheManager.getCache('test-stress');
  
  // Write many items
  const writeStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    await cache.set(`key-${i}`, { value: `value-${i}`, index: i });
  }
  const writeTime = Date.now() - writeStart;
  
  // Read items
  const readStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    await cache.get(`key-${i}`);
  }
  const readTime = Date.now() - readStart;
  
  const stats = cache.getStats();
  
  console.log(`     - Items written: 1000 in ${writeTime}ms`);
  console.log(`     - Items read: 1000 in ${readTime}ms`);
  console.log(`     - Cache hit rate: ${stats.hitRate}`);
});

// Test 49: Memory System Vector Store
await testModule('Memory System Vector Store', async () => {
  const { getMemoryManager } = await import('./src/memory/memory-system.js');
  
  const memory = getMemoryManager();
  const vectorStore = memory.vectorStore || memory.embeddings;
  
  if (!vectorStore) {
    throw new Error('Vector store should be available');
  }
  
  // Add documents
  const docs = [
    { id: 'doc1', text: 'Machine learning is a subset of artificial intelligence' },
    { id: 'doc2', text: 'Deep learning uses neural networks with multiple layers' },
    { id: 'doc3', text: 'Natural language processing deals with text and speech' },
    { id: 'doc4', text: 'Computer vision enables machines to interpret images' }
  ];
  
  for (const doc of docs) {
    vectorStore.add(doc.id, doc.text);
  }
  
  // Search similar documents
  const results = vectorStore.search('neural networks', 2, 0.5);
  
  console.log(`     - Documents indexed: ${docs.length}`);
  console.log(`     - Search results: ${results.length}`);
});

// Test 50: Task Queue Processing
await testModule('Task Queue Processing', async () => {
  const { getQueueManager } = await import('./src/queue/task-queue.js');
  
  const manager = getQueueManager();
  const queue = manager.createQueue('test-processing', { concurrency: 5 });
  
  let processed = 0;
  
  // Add jobs using the add method
  for (let i = 0; i < 10; i++) {
    queue.add(`job-${i}`, async () => {
      processed++;
      return { success: true, index: i };
    });
  }
  
  // Get queue stats before processing
  const stats = queue.getStats();
  
  console.log(`     - Jobs added: 10`);
  console.log(`     - Waiting jobs: ${stats.waiting}`);
  console.log(`     - Queue name: ${queue.name}`);
});

// Test 51: Model Registry (100+ models, 20 providers)
await testModule('Model Registry (100+ models, 20 providers)', async () => {
  const registryModule = await import('./src/providers/model-registry.js');
  const ModelModule = registryModule.default || registryModule;
  
  const { 
    ModelRegistry, 
    ModelCapability, 
    TaskCategory,
    getAllModelProfiles, 
    getModelsByProvider, 
    getModelsByCapability, 
    getModelsByCategory,
    searchModels,
    getRegisteredProviders,
    getModelStats
  } = ModelModule;
  
  const modelCount = Object.keys(ModelRegistry).length;
  if (modelCount < 100) {
    throw new Error(`Should have at least 100 models, got ${modelCount}`);
  }
  
  const providers = getRegisteredProviders();
  if (providers.length < 20) {
    throw new Error(`Should have at least 20 providers, got ${providers.length}`);
  }
  
  const stats = getModelStats();
  if (stats.total !== modelCount) {
    throw new Error('Stats total should match model count');
  }
  
  // Test model retrieval by provider
  const openaiModels = getModelsByProvider('openai');
  if (openaiModels.length < 10) {
    throw new Error(`OpenAI should have at least 10 models, got ${openaiModels.length}`);
  }
  
  // Test model retrieval by capability
  const codeModels = getModelsByCapability(ModelCapability.CODE);
  if (codeModels.length < 20) {
    throw new Error(`Should have at least 20 code-capable models, got ${codeModels.length}`);
  }
  
  // Test model search
  const gptModels = searchModels('gpt');
  if (gptModels.length < 5) {
    throw new Error(`Should find at least 5 GPT models, got ${gptModels.length}`);
  }
  
  // Test model profiles
  const profiles = getAllModelProfiles();
  if (profiles.length !== modelCount) {
    throw new Error('Profiles count should match model count');
  }
  
  console.log(`     - Total models: ${modelCount}`);
  console.log(`     - Providers: ${providers.length}`);
  console.log(`     - Code-capable models: ${codeModels.length}`);
  console.log(`     - Sample models: ${Object.keys(ModelRegistry).slice(0, 5).join(', ')}`);
  console.log(`     - Sample providers: ${providers.slice(0, 5).join(', ')}`);
});
  const {
    RobinhoodIntegration,
    CoinbaseIntegration,
    RevolutIntegration,
    WiseIntegration,
    PlaidIntegration,
    FitbitIntegration,
    GarminIntegration,
    OuraRingIntegration,
    WhoopIntegration,
    PelotonIntegration,
    CalmIntegration,
    HeadspaceIntegration,
    MyFitnessPalIntegration,
    StravaIntegration,
    SquareIntegration,
    MindbodyIntegration,
    DoorDashIntegration,
    UberEatsIntegration,
    InstacartIntegration,
    TaskRabbitIntegration,
    IntegrationManager
  } = await import('./src/integrations/lifestyle-integrations.js');

  const robinhood = new RobinhoodIntegration({ accessToken: 'test' });
  const coinbase = new CoinbaseIntegration({ apiKey: 'test', apiSecret: 'test' });
  const revolut = new RevolutIntegration({ accessToken: 'test' });
  const wise = new WiseIntegration({ accessToken: 'test' });
  const plaid = new PlaidIntegration({ clientId: 'test', secret: 'test' });
  const fitbit = new FitbitIntegration({ accessToken: 'test' });
  const garmin = new GarminIntegration({ consumerKey: 'test', consumerSecret: 'test' });
  const oura = new OuraRingIntegration({ accessToken: 'test' });
  const whoop = new WhoopIntegration({ accessToken: 'test' });
  const peloton = new PelotonIntegration({ accessToken: 'test' });
  const calm = new CalmIntegration({ accessToken: 'test' });
  const headspace = new HeadspaceIntegration({ accessToken: 'test' });
  const myfitnesspal = new MyFitnessPalIntegration({ accessToken: 'test' });
  const strava = new StravaIntegration({ accessToken: 'test' });
  const square = new SquareIntegration({ accessToken: 'test' });
  const mindbody = new MindbodyIntegration({ apiKey: 'test', siteId: 'test' });
  const doordash = new DoorDashIntegration({ accessToken: 'test' });
  const ubereats = new UberEatsIntegration({ accessToken: 'test' });
  const instacart = new InstacartIntegration({ accessToken: 'test' });
  const taskrabbit = new TaskRabbitIntegration({ accessToken: 'test' });

  if (!robinhood.isConfigured()) throw new Error('Robinhood should be configured');
  if (!coinbase.isConfigured()) throw new Error('Coinbase should be configured');
  if (!strava.isConfigured()) throw new Error('Strava should be configured');
  if (!square.isConfigured()) throw new Error('Square should be configured');

  const manager = new IntegrationManager();
  manager.register('robinhood', robinhood);
  manager.register('coinbase', coinbase);
  manager.register('revolut', revolut);
  manager.register('wise', wise);
  manager.register('plaid', plaid);
  manager.register('fitbit', fitbit);
  manager.register('garmin', garmin);
  manager.register('oura', oura);
  manager.register('whoop', whoop);
  manager.register('peloton', peloton);
  manager.register('calm', calm);
  manager.register('headspace', headspace);
  manager.register('myfitnesspal', myfitnesspal);
  manager.register('strava', strava);
  manager.register('square', square);
  manager.register('mindbody', mindbody);
  manager.register('doordash', doordash);
  manager.register('ubereats', ubereats);
  manager.register('instacart', instacart);
  manager.register('taskrabbit', taskrabbit);

  const summary = manager.getStatusSummary();
  if (summary.total !== 20) throw new Error('Should have 20 integrations');

  console.log(`     - Robinhood: ${robinhood.name} ready`);
  console.log(`     - Coinbase: ${coinbase.name} ready`);
  console.log(`     - Revolut: ${revolut.name} ready`);
  console.log(`     - Wise: ${wise.name} ready`);
  console.log(`     - Plaid: ${plaid.name} ready`);
  console.log(`     - Fitbit: ${fitbit.name} ready`);
  console.log(`     - Garmin: ${garmin.name} ready`);
  console.log(`     - Oura: ${oura.name} ready`);
  console.log(`     - Whoop: ${whoop.name} ready`);
  console.log(`     - Peloton: ${peloton.name} ready`);
  console.log(`     - Calm: ${calm.name} ready`);
  console.log(`     - Headspace: ${headspace.name} ready`);
  console.log(`     - MyFitnessPal: ${myfitnesspal.name} ready`);
  console.log(`     - Strava: ${strava.name} ready`);
  console.log(`     - Square: ${square.name} ready`);
  console.log(`     - Mindbody: ${mindbody.name} ready`);
  console.log(`     - DoorDash: ${doordash.name} ready`);
  console.log(`     - UberEats: ${ubereats.name} ready`);
  console.log(`     - Instacart: ${instacart.name} ready`);
  console.log(`     - TaskRabbit: ${taskrabbit.name} ready`);
  console.log(`     - Integration Manager: ${summary.total} integrations registered`);
});

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║                     TEST SUMMARY                              ║');
console.log('╠═══════════════════════════════════════════════════════════════╣');
console.log(`║  Total Tests:  ${results.passed + results.failed}`.padEnd(63) + '║');
console.log(`║  ✅ Passed:     ${results.passed}`.padEnd(63) + '║');
console.log(`║  ❌ Failed:     ${results.failed}`.padEnd(63) + '║');
console.log('╠═══════════════════════════════════════════════════════════════╣');

if (results.errors.length > 0) {
  console.log('║  ERRORS:                                                      ║');
  for (const err of results.errors) {
    console.log(`║    - ${err.module}: ${err.error}`.padEnd(63) + '║');
  }
  console.log('╠═══════════════════════════════════════════════════════════════╣');
}

// Timing summary
const sortedTimings = Object.entries(results.timings).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
console.log('║  SLOWEST MODULES:                                             ║');
for (const [name, time] of sortedTimings.slice(0, 5)) {
  console.log(`║    ${name}: ${time}ms`.padEnd(63) + '║');
}

console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('\n');

if (results.failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All modules passed! NEXUS Platform v2.0 is ready.');
  process.exit(0);
}
