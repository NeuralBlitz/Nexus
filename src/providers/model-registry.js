// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE MODEL REGISTRY - 100+ MODELS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Task categories for model selection
 */
const TaskCategory = {
  CODE_GENERATION: 'code_generation',
  CODE_REVIEW: 'code_review',
  CODE_DEBUG: 'code_debug',
  TEXT_GENERATION: 'text_generation',
  ANALYSIS: 'analysis',
  RESEARCH: 'research',
  CREATIVE: 'creative',
  TRANSLATION: 'translation',
  SUMMARIZATION: 'summarization',
  CONVERSATION: 'conversation',
  CLASSIFICATION: 'classification',
  EXTRACTION: 'extraction',
  EMBEDDING: 'embedding',
  VISION: 'vision',
  MATHEMATICS: 'mathematics',
  RETRIEVAL: 'retrieval'
};

/**
 * Model capabilities
 */
const ModelCapability = {
  CHAT: 'chat',
  COMPLETION: 'completion',
  CODE: 'code',
  VISION: 'vision',
  EMBEDDING: 'embedding',
  FUNCTION_CALLING: 'function_calling',
  STREAMING: 'streaming',
  LONG_CONTEXT: 'long_context'
};

/**
 * Complete model registry with 100+ models across all providers
 */
export const ModelRegistry = {
  // ═══════════════════════════════════════════════════════════════════════
  // OPENAI MODELS (15)
  // ═══════════════════════════════════════════════════════════════════════
  'gpt-4o': {
    id: 'gpt-4o', name: 'GPT-4o', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.000005,
    qualityScore: 0.92, avgLatency: 2000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.CREATIVE, TaskCategory.CONVERSATION]
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.00000015,
    qualityScore: 0.82, avgLatency: 800,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.EXTRACTION]
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 4096, costPerToken: 0.00001,
    qualityScore: 0.90, avgLatency: 3000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH, TaskCategory.CREATIVE]
  },
  'gpt-4': {
    id: 'gpt-4', name: 'GPT-4', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING],
    contextWindow: 8192, maxTokens: 4096, costPerToken: 0.00003,
    qualityScore: 0.88, avgLatency: 4000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 16385, maxTokens: 4096, costPerToken: 0.0000005,
    qualityScore: 0.70, avgLatency: 600,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.EXTRACTION, TaskCategory.CODE_GENERATION]
  },
  'o1-preview': {
    id: 'o1-preview', name: 'o1 Preview', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.LONG_CONTEXT],
    contextWindow: 128000, maxTokens: 32768, costPerToken: 0.000015,
    qualityScore: 0.95, avgLatency: 10000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },
  'o1-mini': {
    id: 'o1-mini', name: 'o1 Mini', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.000003,
    qualityScore: 0.88, avgLatency: 5000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_DEBUG, TaskCategory.ANALYSIS]
  },
  'o3-mini': {
    id: 'o3-mini', name: 'o3 Mini', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.LONG_CONTEXT],
    contextWindow: 200000, maxTokens: 100000, costPerToken: 0.000001,
    qualityScore: 0.90, avgLatency: 3000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },
  'text-embedding-3-large': {
    id: 'text-embedding-3-large', name: 'Text Embedding 3 Large', provider: 'openai',
    capabilities: [ModelCapability.EMBEDDING],
    contextWindow: 8191, maxTokens: 0, costPerToken: 0.00000013,
    qualityScore: 0.92, avgLatency: 200,
    categories: [TaskCategory.EMBEDDING]
  },
  'text-embedding-3-small': {
    id: 'text-embedding-3-small', name: 'Text Embedding 3 Small', provider: 'openai',
    capabilities: [ModelCapability.EMBEDDING],
    contextWindow: 8191, maxTokens: 0, costPerToken: 0.00000002,
    qualityScore: 0.85, avgLatency: 100,
    categories: [TaskCategory.EMBEDDING]
  },
  'whisper-1': {
    id: 'whisper-1', name: 'Whisper', provider: 'openai',
    capabilities: [ModelCapability.COMPLETION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.000006,
    qualityScore: 0.88, avgLatency: 2000,
    categories: [TaskCategory.EXTRACTION]
  },
  'dall-e-3': {
    id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai',
    capabilities: [ModelCapability.VISION],
    contextWindow: 4000, maxTokens: 0, costPerToken: 0.00004,
    qualityScore: 0.90, avgLatency: 15000,
    categories: [TaskCategory.CREATIVE]
  },
  'tts-1': {
    id: 'tts-1', name: 'TTS-1', provider: 'openai',
    capabilities: [ModelCapability.COMPLETION],
    contextWindow: 4096, maxTokens: 0, costPerToken: 0.000015,
    qualityScore: 0.85, avgLatency: 1000,
    categories: [TaskCategory.CREATIVE]
  },
  'gpt-4-turbo-2024-04-09': {
    id: 'gpt-4-turbo-2024-04-09', name: 'GPT-4 Turbo 2024', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING],
    contextWindow: 128000, maxTokens: 4096, costPerToken: 0.00001,
    qualityScore: 0.89, avgLatency: 2800,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.CREATIVE]
  },
  'chatgpt-4o-latest': {
    id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest', provider: 'openai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.000005,
    qualityScore: 0.93, avgLatency: 2100,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.CREATIVE]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ANTHROPIC MODELS (6)
  // ═══════════════════════════════════════════════════════════════════════
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 200000, maxTokens: 8192, costPerToken: 0.000003,
    qualityScore: 0.92, avgLatency: 2500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG, TaskCategory.ANALYSIS, TaskCategory.RESEARCH, TaskCategory.CREATIVE]
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.STREAMING],
    contextWindow: 200000, maxTokens: 8192, costPerToken: 0.000001,
    qualityScore: 0.82, avgLatency: 800,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.EXTRACTION, TaskCategory.CODE_GENERATION]
  },
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 200000, maxTokens: 4096, costPerToken: 0.000015,
    qualityScore: 0.94, avgLatency: 5000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH, TaskCategory.CREATIVE, TaskCategory.SUMMARIZATION]
  },
  'claude-3-sonnet-20240229': {
    id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 200000, maxTokens: 4096, costPerToken: 0.000003,
    qualityScore: 0.86, avgLatency: 2000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS, TaskCategory.TRANSLATION]
  },
  'claude-3-haiku-20240307': {
    id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.STREAMING],
    contextWindow: 200000, maxTokens: 4096, costPerToken: 0.00000025,
    qualityScore: 0.78, avgLatency: 600,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.EXTRACTION]
  },
  'claude-4-sonnet': {
    id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', provider: 'anthropic',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 300000, maxTokens: 16384, costPerToken: 0.000004,
    qualityScore: 0.95, avgLatency: 3000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GOOGLE AI MODELS (8)
  // ═══════════════════════════════════════════════════════════════════════
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google-ai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 1048576, maxTokens: 8192, costPerToken: 0.0000001,
    qualityScore: 0.85, avgLatency: 500,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.CLASSIFICATION, TaskCategory.EXTRACTION]
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google-ai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 2097152, maxTokens: 8192, costPerToken: 0.00000125,
    qualityScore: 0.90, avgLatency: 2000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.RESEARCH, TaskCategory.SUMMARIZATION, TaskCategory.CONVERSATION]
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google-ai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 1048576, maxTokens: 8192, costPerToken: 0.0000000375,
    qualityScore: 0.82, avgLatency: 400,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.CLASSIFICATION]
  },
  'gemini-1.0-pro': {
    id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'google-ai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.0000005,
    qualityScore: 0.78, avgLatency: 1000,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.EXTRACTION]
  },
  'gemini-pro-vision': {
    id: 'gemini-pro-vision', name: 'Gemini Pro Vision', provider: 'google-ai',
    capabilities: [ModelCapability.CHAT, ModelCapability.VISION, ModelCapability.STREAMING],
    contextWindow: 16384, maxTokens: 2048, costPerToken: 0.0000005,
    qualityScore: 0.80, avgLatency: 1500,
    categories: [TaskCategory.VISION, TaskCategory.ANALYSIS, TaskCategory.CREATIVE]
  },
  'gemini-2.0-pro': {
    id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'google-ai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 2000000, maxTokens: 32768, costPerToken: 0.0000025,
    qualityScore: 0.93, avgLatency: 3000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH, TaskCategory.CREATIVE]
  },
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'google-ai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 1048576, maxTokens: 8192, costPerToken: 0.00000005,
    qualityScore: 0.75, avgLatency: 300,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.EXTRACTION]
  },
  'imagen-3': {
    id: 'imagen-3', name: 'Imagen 3', provider: 'google-ai',
    capabilities: [ModelCapability.VISION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.00002,
    qualityScore: 0.88, avgLatency: 8000,
    categories: [TaskCategory.CREATIVE]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MISTRAL MODELS (8)
  // ═══════════════════════════════════════════════════════════════════════
  'mistral-large-latest': {
    id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.000004,
    qualityScore: 0.88, avgLatency: 2500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH, TaskCategory.CREATIVE]
  },
  'mistral-medium-latest': {
    id: 'mistral-medium-latest', name: 'Mistral Medium', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.0000027,
    qualityScore: 0.82, avgLatency: 1500,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS]
  },
  'mistral-small-latest': {
    id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.000001,
    qualityScore: 0.75, avgLatency: 600,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.EXTRACTION]
  },
  'mistral-tiny': {
    id: 'mistral-tiny', name: 'Mistral Tiny', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 4096, costPerToken: 0.00000025,
    qualityScore: 0.65, avgLatency: 300,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },
  'open-mistral-nemo': {
    id: 'open-mistral-nemo', name: 'Mistral Nemo', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.0000003,
    qualityScore: 0.72, avgLatency: 400,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION]
  },
  'codestral-latest': {
    id: 'codestral-latest', name: 'Codestral', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.COMPLETION, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.000001,
    qualityScore: 0.85, avgLatency: 1000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG]
  },
  'pixtral-large-latest': {
    id: 'pixtral-large-latest', name: 'Pixtral Large', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.000004,
    qualityScore: 0.87, avgLatency: 2000,
    categories: [TaskCategory.VISION, TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS]
  },
  'ministral-3b-latest': {
    id: 'ministral-3b-latest', name: 'Ministral 3B', provider: 'mistral',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 16384, costPerToken: 0.00000004,
    qualityScore: 0.60, avgLatency: 200,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // XAI (GROK) MODELS (3)
  // ═══════════════════════════════════════════════════════════════════════
  'grok-2-1212': {
    id: 'grok-2-1212', name: 'Grok 2 1212', provider: 'xai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0.000005,
    qualityScore: 0.88, avgLatency: 2000,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.CREATIVE]
  },
  'grok-2-mini': {
    id: 'grok-2-mini', name: 'Grok 2 Mini', provider: 'xai',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0.000001,
    qualityScore: 0.75, avgLatency: 600,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },
  'grok-vision-beta': {
    id: 'grok-vision-beta', name: 'Grok Vision Beta', provider: 'xai',
    capabilities: [ModelCapability.CHAT, ModelCapability.VISION, ModelCapability.STREAMING],
    contextWindow: 8192, maxTokens: 4096, costPerToken: 0.000005,
    qualityScore: 0.80, avgLatency: 2500,
    categories: [TaskCategory.VISION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GROQ MODELS (6)
  // ═══════════════════════════════════════════════════════════════════════
  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 32768, costPerToken: 0.00000059,
    qualityScore: 0.88, avgLatency: 200,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },
  'llama-3.1-70b-versatile': {
    id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', provider: 'groq',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.00000052,
    qualityScore: 0.86, avgLatency: 180,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'llama-3.1-8b-instant': {
    id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0.00000005,
    qualityScore: 0.72, avgLatency: 100,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.CODE_GENERATION]
  },
  'mixtral-8x7b-32768': {
    id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.00000024,
    qualityScore: 0.78, avgLatency: 150,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS]
  },
  'gemma2-9b-it': {
    id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 8192, maxTokens: 8192, costPerToken: 0.0000002,
    qualityScore: 0.70, avgLatency: 100,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },
  'qwen-2.5-72b-instruct': {
    id: 'qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'groq',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.00000059,
    qualityScore: 0.85, avgLatency: 250,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DEEPSEEK MODELS (3)
  // ═══════════════════════════════════════════════════════════════════════
  'deepseek-chat': {
    id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 8192, costPerToken: 0.00000027,
    qualityScore: 0.85, avgLatency: 1500,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },
  'deepseek-coder': {
    id: 'deepseek-coder', name: 'DeepSeek Coder V2', provider: 'deepseek',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.COMPLETION, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 8192, costPerToken: 0.00000014,
    qualityScore: 0.88, avgLatency: 1200,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG]
  },
  'deepseek-r1': {
    id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 128000, maxTokens: 8192, costPerToken: 0.00000055,
    qualityScore: 0.90, avgLatency: 3000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COHERE MODELS (4)
  // ═══════════════════════════════════════════════════════════════════════
  'command-r-plus': {
    id: 'command-r-plus', name: 'Command R+', provider: 'cohere',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 4096, costPerToken: 0.000003,
    qualityScore: 0.82, avgLatency: 2000,
    categories: [TaskCategory.CONVERSATION, TaskCategory.ANALYSIS, TaskCategory.RESEARCH, TaskCategory.RETRIEVAL]
  },
  'command-r': {
    id: 'command-r', name: 'Command R', provider: 'cohere',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 4096, costPerToken: 0.0000005,
    qualityScore: 0.75, avgLatency: 1000,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION, TaskCategory.RETRIEVAL]
  },
  'command-light': {
    id: 'command-light', name: 'Command Light', provider: 'cohere',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 4096, maxTokens: 2048, costPerToken: 0.0000001,
    qualityScore: 0.65, avgLatency: 400,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },
  'embed-v3': {
    id: 'embed-v3', name: 'Embed v3', provider: 'cohere',
    capabilities: [ModelCapability.EMBEDDING],
    contextWindow: 512, maxTokens: 0, costPerToken: 0.0000001,
    qualityScore: 0.88, avgLatency: 150,
    categories: [TaskCategory.EMBEDDING]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CEREBRAS MODELS (3)
  // ═══════════════════════════════════════════════════════════════════════
  'llama3.1-70b': {
    id: 'llama3.1-70b', name: 'Llama 3.1 70B', provider: 'cerebras',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.0000006,
    qualityScore: 0.85, avgLatency: 150,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'llama3.1-8b': {
    id: 'llama3.1-8b', name: 'Llama 3.1 8B', provider: 'cerebras',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0.0000001,
    qualityScore: 0.72, avgLatency: 50,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },
  'llama3.1-405b': {
    id: 'llama3.1-405b', name: 'Llama 3.1 405B', provider: 'cerebras',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.LONG_CONTEXT],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.000003,
    qualityScore: 0.92, avgLatency: 500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SAMBANOVA MODELS (2)
  // ═══════════════════════════════════════════════════════════════════════
  'samba-vapor-405b': {
    id: 'samba-vapor-405b', name: 'Samba Vapor 405B', provider: 'sambanova',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.LONG_CONTEXT],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.000001,
    qualityScore: 0.91, avgLatency: 300,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },
  'samba-nova-8b': {
    id: 'samba-nova-8b', name: 'Samba Nova 8B', provider: 'sambanova',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 8192, maxTokens: 4096, costPerToken: 0.0000001,
    qualityScore: 0.70, avgLatency: 80,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HUGGING FACE MODELS (5)
  // ═══════════════════════════════════════════════════════════════════════
  'meta-llama-3.1-70b-instruct': {
    id: 'meta-llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', provider: 'huggingface',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.0000003,
    qualityScore: 0.85, avgLatency: 1500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'mixtral-8x22b-instruct': {
    id: 'mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'huggingface',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 65536, maxTokens: 8192, costPerToken: 0.0000006,
    qualityScore: 0.83, avgLatency: 2000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'phi-4': {
    id: 'phi-4', name: 'Phi-4', provider: 'huggingface',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 16384, maxTokens: 8192, costPerToken: 0.0000001,
    qualityScore: 0.78, avgLatency: 500,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.MATHEMATICS]
  },
  'mistral-7b-instruct': {
    id: 'mistral-7b-instruct', name: 'Mistral 7B Instruct', provider: 'huggingface',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.00000005,
    qualityScore: 0.68, avgLatency: 300,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },
  'falcon-180b-chat': {
    id: 'falcon-180b-chat', name: 'Falcon 180B Chat', provider: 'huggingface',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 2048, maxTokens: 2048, costPerToken: 0.000001,
    qualityScore: 0.75, avgLatency: 3000,
    categories: [TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TOGETHER AI MODELS (4)
  // ═══════════════════════════════════════════════════════════════════════
  'meta-llama-3.1-405b-instruct': {
    id: 'meta-llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'together',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.LONG_CONTEXT],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.000003,
    qualityScore: 0.92, avgLatency: 4000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.ANALYSIS, TaskCategory.RESEARCH]
  },
  'meta-llama-3.1-70b-instruct': {
    id: 'meta-llama-3.1-70b-together', name: 'Llama 3.1 70B', provider: 'together',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.0000004,
    qualityScore: 0.86, avgLatency: 1500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'qwen2.5-72b-instruct': {
    id: 'qwen2.5-72b-together', name: 'Qwen 2.5 72B', provider: 'together',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.0000004,
    qualityScore: 0.84, avgLatency: 1800,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'dall-e-3-proxy': {
    id: 'dall-e-3-together', name: 'DALL-E 3 (Together)', provider: 'together',
    capabilities: [ModelCapability.VISION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.00004,
    qualityScore: 0.85, avgLatency: 10000,
    categories: [TaskCategory.CREATIVE]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // OLLAMA LOCAL MODELS (10)
  // ═══════════════════════════════════════════════════════════════════════
  'llama3.3': {
    id: 'llama3.3', name: 'Llama 3.3 (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0,
    qualityScore: 0.85, avgLatency: 2000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS],
    tags: ['local', 'free', 'private']
  },
  'llama3.2': {
    id: 'llama3.2', name: 'Llama 3.2 (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0,
    qualityScore: 0.80, avgLatency: 1500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION],
    tags: ['local', 'free', 'private']
  },
  'llama3.1': {
    id: 'llama3.1', name: 'Llama 3.1 (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0,
    qualityScore: 0.82, avgLatency: 1800,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS],
    tags: ['local', 'free', 'private']
  },
  'mistral': {
    id: 'mistral', name: 'Mistral (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0,
    qualityScore: 0.75, avgLatency: 1500,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION],
    tags: ['local', 'free', 'private']
  },
  'mixtral': {
    id: 'mixtral', name: 'Mixtral (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0,
    qualityScore: 0.78, avgLatency: 2000,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS],
    tags: ['local', 'free', 'private']
  },
  'codellama': {
    id: 'codellama', name: 'Code Llama (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.COMPLETION],
    contextWindow: 16384, maxTokens: 4096, costPerToken: 0,
    qualityScore: 0.80, avgLatency: 1800,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG],
    tags: ['local', 'free', 'private', 'code-specialist']
  },
  'phi3': {
    id: 'phi3', name: 'Phi-3 (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 4096, costPerToken: 0,
    qualityScore: 0.70, avgLatency: 500,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION, TaskCategory.CLASSIFICATION],
    tags: ['local', 'free', 'private', 'fast']
  },
  'gemma2': {
    id: 'gemma2', name: 'Gemma 2 (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 8192, maxTokens: 4096, costPerToken: 0,
    qualityScore: 0.72, avgLatency: 600,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION],
    tags: ['local', 'free', 'private']
  },
  'qwen2.5': {
    id: 'qwen2.5', name: 'Qwen 2.5 (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0,
    qualityScore: 0.82, avgLatency: 1200,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS],
    tags: ['local', 'free', 'private']
  },
  'deepseek-coder-v2': {
    id: 'deepseek-coder-v2-local', name: 'DeepSeek Coder V2 (Local)', provider: 'ollama',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.COMPLETION],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0,
    qualityScore: 0.85, avgLatency: 2000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG],
    tags: ['local', 'free', 'private', 'code-specialist']
  },

  // ═══════════════════════════════════════════════════════════════════════
  // STABILITY AI (3)
  // ═══════════════════════════════════════════════════════════════════════
  'stable-diffusion-xl': {
    id: 'stable-diffusion-xl', name: 'Stable Diffusion XL', provider: 'stability',
    capabilities: [ModelCapability.VISION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.00002,
    qualityScore: 0.85, avgLatency: 10000,
    categories: [TaskCategory.CREATIVE]
  },
  'stable-diffusion-3': {
    id: 'stable-diffusion-3', name: 'Stable Diffusion 3', provider: 'stability',
    capabilities: [ModelCapability.VISION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.00003,
    qualityScore: 0.88, avgLatency: 8000,
    categories: [TaskCategory.CREATIVE]
  },
  'sd3-turbo': {
    id: 'sd3-turbo', name: 'SD3 Turbo', provider: 'stability',
    capabilities: [ModelCapability.VISION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.00001,
    qualityScore: 0.80, avgLatency: 3000,
    categories: [TaskCategory.CREATIVE]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // REPLICATE MODELS (3)
  // ═══════════════════════════════════════════════════════════════════════
  'black-forest-labs-flux': {
    id: 'black-forest-labs-flux', name: 'FLUX.1', provider: 'replicate',
    capabilities: [ModelCapability.VISION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.00003,
    qualityScore: 0.90, avgLatency: 8000,
    categories: [TaskCategory.CREATIVE]
  },
  'meta-llama-3.1-405b-instruct': {
    id: 'meta-llama-3.1-405b-replicate', name: 'Llama 3.1 405B (Replicate)', provider: 'replicate',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.000004,
    qualityScore: 0.90, avgLatency: 5000,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.ANALYSIS]
  },
  'midjourney-v6': {
    id: 'midjourney-v6', name: 'Midjourney V6', provider: 'replicate',
    capabilities: [ModelCapability.VISION],
    contextWindow: 0, maxTokens: 0, costPerToken: 0.00004,
    qualityScore: 0.92, avgLatency: 45000,
    categories: [TaskCategory.CREATIVE]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SILICONFLOW (2)
  // ═══════════════════════════════════════════════════════════════════════
  'silicon-qwen-72b': {
    id: 'silicon-qwen-72b', name: 'Qwen 2.5 72B (Silicon)', provider: 'siliconflow',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.0000002,
    qualityScore: 0.83, avgLatency: 800,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION]
  },
  'silicon-deepseek-v2': {
    id: 'silicon-deepseek-v2', name: 'DeepSeek V2.5 (Silicon)', provider: 'siliconflow',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 128000, maxTokens: 8192, costPerToken: 0.0000002,
    qualityScore: 0.84, avgLatency: 900,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FIREWORKS AI (4)
  // ═══════════════════════════════════════════════════════════════════════
  'fireworks-llama-70b': {
    id: 'fireworks-llama-70b', name: 'Llama 3.1 70B (Fireworks)', provider: 'fireworks',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.0000004,
    qualityScore: 0.85, avgLatency: 300,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'fireworks-mixtral-8x22b': {
    id: 'fireworks-mixtral-8x22b', name: 'Mixtral 8x22B (Fireworks)', provider: 'fireworks',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 65536, maxTokens: 8192, costPerToken: 0.0000005,
    qualityScore: 0.82, avgLatency: 400,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION]
  },
  'fireworks-qwen-72b': {
    id: 'fireworks-qwen-72b', name: 'Qwen 2.5 72B (Fireworks)', provider: 'fireworks',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.0000004,
    qualityScore: 0.84, avgLatency: 350,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'fireworks-deepseek-v2': {
    id: 'fireworks-deepseek-v2', name: 'DeepSeek V2 (Fireworks)', provider: 'fireworks',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 128000, maxTokens: 8192, costPerToken: 0.0000003,
    qualityScore: 0.83, avgLatency: 500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PERPLEXITY (3)
  // ═══════════════════════════════════════════════════════════════════════
  'sonar-pro': {
    id: 'sonar-pro', name: 'Perplexity Sonar Pro', provider: 'perplexity',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING, ModelCapability.LONG_CONTEXT],
    contextWindow: 200000, maxTokens: 8192, costPerToken: 0.000005,
    qualityScore: 0.90, avgLatency: 3000,
    categories: [TaskCategory.RESEARCH, TaskCategory.ANALYSIS, TaskCategory.CONVERSATION, TaskCategory.SUMMARIZATION]
  },
  'sonar': {
    id: 'sonar', name: 'Perplexity Sonar', provider: 'perplexity',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 128000, maxTokens: 8192, costPerToken: 0.000001,
    qualityScore: 0.82, avgLatency: 1500,
    categories: [TaskCategory.CONVERSATION, TaskCategory.RESEARCH, TaskCategory.ANALYSIS]
  },
  'sonar-small': {
    id: 'sonar-small', name: 'Perplexity Sonar Small', provider: 'perplexity',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 16384, maxTokens: 4096, costPerToken: 0.0000002,
    qualityScore: 0.72, avgLatency: 600,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CLOUDFLARE WORKERS AI (3)
  // ═══════════════════════════════════════════════════════════════════════
  'cf-llama-3.1-70b': {
    id: 'cf-llama-3.1-70b', name: 'Llama 3.1 70B (Cloudflare)', provider: 'cloudflare',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.000001,
    qualityScore: 0.83, avgLatency: 500,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION]
  },
  'cf-mistral-7b': {
    id: 'cf-mistral-7b', name: 'Mistral 7B (Cloudflare)', provider: 'cloudflare',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.0000001,
    qualityScore: 0.70, avgLatency: 200,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CLASSIFICATION]
  },
  'cf-qwen-1.5-7b': {
    id: 'cf-qwen-1.5-7b', name: 'Qwen 1.5 7B (Cloudflare)', provider: 'cloudflare',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE],
    contextWindow: 32768, maxTokens: 4096, costPerToken: 0.0000001,
    qualityScore: 0.68, avgLatency: 150,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ANYSCALE (3)
  // ═══════════════════════════════════════════════════════════════════════
  'anyscale-mistral-8x7b': {
    id: 'anyscale-mistral-8x7b', name: 'Mixtral 8x7B (Anyscale)', provider: 'anyscale',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 32768, maxTokens: 8192, costPerToken: 0.0000002,
    qualityScore: 0.78, avgLatency: 400,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CODE_GENERATION]
  },
  'anyscale-llama-70b': {
    id: 'anyscale-llama-70b', name: 'Llama 2 70B (Anyscale)', provider: 'anyscale',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 4096, maxTokens: 4096, costPerToken: 0.0000005,
    qualityScore: 0.74, avgLatency: 600,
    categories: [TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'anyscale-codellama-34b': {
    id: 'anyscale-codellama-34b', name: 'CodeLlama 34B (Anyscale)', provider: 'anyscale',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.COMPLETION],
    contextWindow: 16384, maxTokens: 4096, costPerToken: 0.0000005,
    qualityScore: 0.80, avgLatency: 800,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CODE_REVIEW, TaskCategory.CODE_DEBUG]
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ADDITIONAL MODELS (4)
  // ═══════════════════════════════════════════════════════════════════════
  'llama-3.2-90b-vision': {
    id: 'llama-3.2-90b-vision', name: 'Llama 3.2 90B Vision', provider: 'groq',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.VISION, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 8192, costPerToken: 0.0000009,
    qualityScore: 0.87, avgLatency: 350,
    categories: [TaskCategory.VISION, TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION]
  },
  'hermes-3-llama-3.1-70b': {
    id: 'hermes-3-llama-3.1-70b', name: 'Hermes 3 Llama 3.1 70B', provider: 'fireworks',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FUNCTION_CALLING, ModelCapability.STREAMING],
    contextWindow: 131072, maxTokens: 16384, costPerToken: 0.0000004,
    qualityScore: 0.86, avgLatency: 400,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.ANALYSIS]
  },
  'wizardlm-2-8x22b': {
    id: 'wizardlm-2-8x22b', name: 'WizardLM 2 8x22B', provider: 'together',
    capabilities: [ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.STREAMING],
    contextWindow: 65536, maxTokens: 8192, costPerToken: 0.0000005,
    qualityScore: 0.83, avgLatency: 1200,
    categories: [TaskCategory.CODE_GENERATION, TaskCategory.CONVERSATION, TaskCategory.RESEARCH]
  },
  'noromaid-7b': {
    id: 'noromaid-7b', name: 'Noromaid 7B', provider: 'together',
    capabilities: [ModelCapability.CHAT, ModelCapability.STREAMING],
    contextWindow: 8192, maxTokens: 4096, costPerToken: 0.0000001,
    qualityScore: 0.68, avgLatency: 300,
    categories: [TaskCategory.CONVERSATION, TaskCategory.CREATIVE]
  }
};

/**
 * Get all model profiles as ModelProfile-compatible objects
 */
export function getAllModelProfiles() {
  return Object.values(ModelRegistry).map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    capabilities: m.capabilities,
    metrics: {
      avgLatency: m.avgLatency,
      qualityScore: m.qualityScore,
      costPerToken: m.costPerToken
    },
    limits: {
      maxTokens: m.maxTokens,
      contextWindow: m.contextWindow
    },
    supportedCategories: m.categories,
    tags: m.tags || [],
    enabled: true
  }));
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider) {
  return Object.values(ModelRegistry).filter(m => m.provider === provider);
}

/**
 * Get models by capability
 */
export function getModelsByCapability(capability) {
  return Object.values(ModelRegistry).filter(m => m.capabilities.includes(capability));
}

/**
 * Get models by category
 */
export function getModelsByCategory(category) {
  return Object.values(ModelRegistry).filter(m => m.categories.includes(category));
}

/**
 * Search models by name or description
 */
export function searchModels(query) {
  const q = query.toLowerCase();
  return Object.values(ModelRegistry).filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q) ||
    m.provider.toLowerCase().includes(q)
  );
}

/**
 * Get all registered providers
 */
export function getRegisteredProviders() {
  const providers = new Set();
  Object.values(ModelRegistry).forEach(m => providers.add(m.provider));
  return Array.from(providers);
}

/**
 * Get model count statistics
 */
export function getModelStats() {
  const stats = {
    total: Object.keys(ModelRegistry).length,
    byProvider: {},
    byCapability: {},
    freeModels: 0,
    multimodalModels: 0
  };

  for (const model of Object.values(ModelRegistry)) {
    stats.byProvider[model.provider] = (stats.byProvider[model.provider] || 0) + 1;
    for (const cap of model.capabilities) {
      stats.byCapability[cap] = (stats.byCapability[cap] || 0) + 1;
    }
    if (model.costPerToken === 0) stats.freeModels++;
    if (model.capabilities.includes(ModelCapability.VISION)) stats.multimodalModels++;
  }

  return stats;
}

export default {
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
};
