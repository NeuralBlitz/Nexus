# NEXUS Command Platform v2.0

A comprehensive local-first, unified AI agent orchestration platform with **189+ third-party app integrations**, **100 LLM models across 20 providers**, **58 community plugins**, **30 specialized agents**, and **50 passing tests**.

## Overview

NEXUS Command Platform is a powerful local AI agent system that connects to 189+ external applications through a unified plugin architecture, supports 100 AI models from 20 providers, and includes a full admin dashboard. It supports multi-channel communication, advanced orchestration, and extensive extensibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXUS Command Platform v2.0                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Agents  │  │ Providers│  │ Channels │  │  Memory  │           │
│  │   (30)   │  │  (20/100)│  │   (16)   │  │   (4)    │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └─────────────┴─────────────┴─────────────┘                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    LLM Orchestrator                            │  │
│  │            (100 models, cost tracking, fallback)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│  │Plugins │ │Events  │ │ Queue  │ │Security│ │Sandbox │         │
│  │  (58)  │ │ (100+) │ │  (DAG) │ │ (JWT)  │ │(24 lang)│         │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              189+ Third-Party Integrations                    │  │
│  │  v5-v15: App, More, Enterprise, Social, DevOps, Business,     │  │
│  │  Marketing, IoT, Data, Media, Lifestyle                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Tools + Workflow + Collab                    │  │
│  │     HTTP, DataConverter, Templates, Search, 6 Workflows       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Systems (16)

| System | Description |
|--------|-------------|
| **Agent System** | 30 multi-agent orchestration with task delegation |
| **Provider System** | 20 providers, 100 models with cost tracking |
| **Channel System** | 16 channels (WebSocket, HTTP, CLI, Slack, Discord, Telegram, Email, SMS, Matrix, IRC, XMPP, Ntfy, Pushover, Signal, WebRTC, Webhook) |
| **Memory System** | 4-tier memory (episodic, semantic, procedural, working) with SQLite persistence |
| **Plugin System** | Hot-reloadable plugin architecture with 58 community plugins |
| **Event Bus** | Pub/sub event-driven communication with routing |
| **Task Queue** | DAG-based task orchestration with scheduling |
| **Security System** | JWT auth, RBAC, API keys, audit logging |
| **Code Sandbox** | Secure execution for 24 languages |
| **Knowledge Graph** | Entity relationship management with graph algorithms |
| **Workflow Engine** | 6 built-in workflow templates |
| **LLM Orchestrator** | Multi-provider routing, cost tracking, fallbacks |
| **Monitoring System** | Prometheus metrics, distributed tracing, alerting |
| **Multimodal System** | Image/audio processing + text analysis |
| **Cache System** | Multi-tier caching (L1 Memory + L2 Redis) with LRU |
| **Resilience System** | Circuit breaker, bulkhead, retry, fallback patterns |

## Models (100 Total across 20 Providers)

### OpenAI (15)
`gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, `o1-preview`, `o1-mini`, `o3-mini`, `text-embedding-3-large`, `text-embedding-3-small`, `whisper-1`, `dall-e-3`, `tts-1`, `gpt-4-turbo-2024-04-09`, `chatgpt-4o-latest`

### Anthropic (6)
`claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`, `claude-4-sonnet`

### Google AI (8)
`gemini-2.0-flash`, `gemini-2.0-pro`, `gemini-2.0-flash-lite`, `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-1.0-pro`, `gemini-pro-vision`, `imagen-3`

### Mistral (8)
`mistral-large`, `mistral-medium`, `mistral-small`, `mistral-tiny`, `open-mistral-nemo`, `codestral`, `pixtral-large`, `ministral-3b`

### Groq (7)
`llama-3.3-70b`, `llama-3.2-90b-vision`, `llama-3.1-70b`, `llama-3.1-8b`, `mixtral-8x7b`, `gemma2-9b-it`, `qwen-2.5-72b`

### Ollama Local (10 - FREE)
`llama3.3`, `llama3.2`, `llama3.1`, `mistral`, `mixtral`, `codellama`, `phi3`, `gemma2`, `qwen2.5`, `deepseek-coder-v2`

### Together AI (5)
`llama-3.1-405b`, `llama-3.1-70b`, `qwen-2.5-72b`, `wizardlm-2-8x22b`, `noromaid-7b`

### Fireworks AI (5)
`llama-70b`, `mixtral-8x22b`, `qwen-72b`, `deepseek-v2`, `hermes-3-70b`

### Others (39)
**Cohere** (4), **HuggingFace** (4), **DeepSeek** (3), **xAI/Grok** (3), **Cerebras** (3), **Replicate** (3), **Perplexity** (3), **Cloudflare** (3), **Anyscale** (3), **Stability AI** (3), **SambaNova** (2), **SiliconFlow** (2)

### Model Capabilities
| Capability | Count |
|------------|-------|
| Chat | 83 |
| Code | 68 |
| Streaming | 65 |
| Vision | 28 |
| Function Calling | 22 |
| Long Context | 13 |
| Embedding | 3 |
| **Free Models** | 10 (Ollama) |

## Core Agents (30 Total)

### Built-in Agents (5)
| Agent | Icon | Role | Description |
|-------|------|------|-------------|
| **NEXUS** | 🔮 | Platform Core | Central coordinator and platform orchestrator |
| **CODEX** | 💻 | Code Architect | Code generation and architecture |
| **DEBUG** | 🐛 | Debugger | Debug and troubleshoot issues |
| **SCRIBE** | 📝 | Documentation | Generate and maintain documentation |
| **TESTER** | 🧪 | Testing | Test and validate code |

### Specialized Agents (25)
| Agent | Role | Agent | Role |
|-------|------|-------|------|
| **ORACLE** | Data Analyst | **ARCHITECT** | System Architect |
| **SCULPTOR** | UI Designer | **FORENSIC** | Digital Forensics |
| **GUARDIAN** | Security Auditor | **QUANTUM** | Quantum Computing |
| **MATHEMATICIAN** | Mathematician | **NEURAL** | ML Engineer |
| **LINGUIST** | Language Expert | **TRANSLATOR** | Multi-Language |
| **CHEF** | Recipe Creator | **DATABASE** | DBA |
| **FITNESS** | Fitness Coach | **API_TESTER** | API Testing |
| **FINANCE** | Financial Advisor | **OPTIMIZER** | Performance |
| **LAWYER** | Legal Assistant | **COMPLIANCE** | Compliance Officer |
| **SCIENTIST** | Research Scientist | **WRITER** | Content Writer |
| **MUSICIAN** | Music Composer | **TEACHER** | Educator |
| **THERAPIST** | Mental Health | **TRAVELER** | Travel Planner |
| **MARKETER** | Marketing | **HR_ASSISTANT** | HR Assistant |
| **PM** | Project Manager | **ACCESSIBILITY** | Accessibility Expert |
| **DATA_ENG** | Data Engineer | **DEVOPS** | DevOps Engineer |

## Communication Channels (16)

| Channel | Type | Description |
|---------|------|-------------|
| **WebSocket** | websocket | Real-time bidirectional communication |
| **HTTP** | http | REST API channel |
| **CLI** | cli | Command-line interface |
| **Slack** | slack | Slack workspace integration |
| **Discord** | discord | Discord server integration |
| **Telegram** | telegram | Telegram bot integration |
| **Email** | email | SMTP/IMAP email integration |
| **SMS** | sms | Twilio SMS messaging |
| **Matrix** | matrix | Matrix protocol (Element, etc.) |
| **IRC** | irc | Internet Relay Chat |
| **XMPP** | xmpp | XMPP/Jabber messaging |
| **Ntfy** | ntfy | Ntfy notifications |
| **Pushover** | pushover | Push notification service |
| **Signal** | signal | Signal messenger integration |
| **WebRTC** | webrtc | WebRTC video/audio/data |
| **Webhook** | webhook | HTTP webhook with retries |

### Message Types (21)
`text`, `command`, `system`, `task`, `result`, `error`, `notification`, `file`, `image`, `audio`, `video`, `location`, `contact`, `sticker`, `reaction`, `thread`, `typing`, `presence`, `ack`, `ping`, `pong`

## Platform Features (26)

### Core Features
| Feature | Description |
|---------|-------------|
| **Rate Limiter** | Request rate limiting with configurable windows |
| **Rate Limiter V2** | Advanced sliding window rate limiting |
| **Audit Logger** | Comprehensive audit logging with event tracking |
| **Scheduler** | Cron-based job scheduling with delayed tasks |
| **Template Engine** | Template rendering with helpers and filters |
| **Analytics** | Event tracking, metrics collection, and dashboards |
| **Backup Manager** | Data backup with compression and encryption |
| **Notification Center** | Multi-channel notifications with subscriptions |

### Data & Processing
| Feature | Description |
|---------|-------------|
| **Data Validation** | Schema builder with type validation |
| **Webhook Manager** | Webhook delivery with retries and signatures |
| **Search Indexing** | Full-text search with fuzzy matching |
| **File Processing** | Image, document, video, and archive processing |
| **Time Series DB** | Time-series data storage and aggregation |
| **Workflow Engine** | Visual workflow orchestration with conditions |

### Resilience & Reliability
| Feature | Description |
|---------|-------------|
| **Retry Handler** | Exponential backoff with jitter and custom conditions |
| **Memoizer** | Function memoization with TTL and size limits |
| **Data Pipeline** | Pluggable stage pipeline with timeout and retries |
| **Distributed Locks** | Distributed locking and leader election |

### Security & Auth
| Feature | Description |
|---------|-------------|
| **Session Manager** | User session management with cookies |
| **OAuth Manager** | OAuth2 provider integration |
| **API Versioning** | API versioning with key management |
| **Feature Flags V2** | Percentage rollout and targeting rules |

### Infrastructure
| Feature | Description |
|---------|-------------|
| **Health Monitor** | System health checks and probes |
| **Caching** | Multi-tier caching with refresh |
| **A/B Testing** | A/B testing and feature rollouts |
| **GraphQL Support** | GraphQL schema and resolvers |

## Code Sandbox (24 Languages)

`JavaScript`, `TypeScript`, `Python`, `Bash`, `Perl`, `Go`, `C`, `C++`, `Ruby`, `PHP`, `Lua`, `Rust`, `Bun`, `R`, `SQL`, `JSON`, `YAML`, `HTML`, `Markdown`, `Java`, `Swift`, `Kotlin`, `Scala`, `Haskell`

## Community Plugins (58)

| Category | Plugins |
|----------|---------|
| **Utilities** | math, math-advanced, calculator, date, random, array, unit, compression, geo, cron |
| **Text Processing** | text, markdown, json, csv, diff, regex, emoji, xml |
| **Security & Encoding** | hash, password, uuid, validator, encoding |
| **Data & Formats** | color, url, svg, chart, qrcode, format |
| **External Services** | translator, weather, calendar, currency |
| **Specialized** | image, timezone, graph, stats |
| **Infrastructure** | ipc, logger, jwt, pagination, semver, throttle, token, idempotency, permission, queue, state, config, storage, events, stream, memoize, pipeline, router, flag, retry, rate-limit, batch |

## New Tools (`src/tools/extended.js`)

| Tool | Description |
|------|-------------|
| **HTTPTool** | HTTP client with retry, timeout, full method support |
| **DataConverter** | JSON, CSV, YAML, XML conversion; flatten/unflatten |
| **TemplateTool** | `{{variable}}` interpolation with conditionals and loops |
| **SearchTool** | Full-text search with inverted index |

## Collaboration Functions

| Function | Description |
|----------|-------------|
| **Collaborate** | Multi-agent parallel task execution |
| **Delegate** | Task delegation between agents |
| **Chain** | Sequential task pipeline |
| **Aggregate** | Result aggregation with voting |
| **Debate** | Multi-round agent debate with judge |
| **ReviewBoard** | Multi-reviewer approval system |
| **RoundRobin** | Round-robin task distribution |
| **Consensus** | Majority voting across agents |
| **Tournament** | Competitive task solving with judge |
| **Pipeline** | Stream data through agent stages |
| **ParallelMap** | Concurrent execution with concurrency control |

## Workflow Templates

| Template | Steps | Description |
|----------|-------|-------------|
| **Code Review** | 4 | Analyze → Security → Performance → Report |
| **Data Pipeline** | 4 | Extract → Validate → Transform → Load |
| **Research** | 4 | Topic1+Topic2+Topic3 → Synthesize |
| **CI/CD** | 4 | Lint → Build → Test → Deploy |
| **Content Creation** | 5 | Research → Outline → Write → Review → Publish |
| **Incident Response** | 5 | Detect → Analyze → Contain → Resolve → Report |

## Integration Packs (189+ Integrations)

### v5 - App Integrations (10)
Notion, Canva, Figma, Linear, Jira, Trello, Airtable, Google Workspace, Salesforce, HubSpot

### v6 - More Integrations (9)
Adobe, AllTrails, Apple Music, Booking.com, Expedia, Instacart, Lovable, OpenTable, Replit

### v7 - Enterprise Integrations (13)
Spotify, Target, TripAdvisor, Zillow, Base44, Botpress, Box, Brand24, Brex, Cloudflare, Cloudinary, Coursera, Dropbox

### v8 - Social Integrations (9)
Twitter, Instagram, WhatsApp, LinkedIn, Telegram Bot, Slack Bot, Discord Bot, Teams Bot, Zoom Bot

### v9 - DevOps Integrations (11)
IONOS, Doppler, Datadog, DigitalOcean, Vercel, HuggingFace, Docker, Prisma, Obsidian, Zube, BuildJet

### v10 - Business Integrations (18)
GoDaddy, Granola, Gusto, Hex, HeyGen, HighLevel, Indeed, CreditKarma, InVideo, JotForm, KhanAcademy, Kraken, LegalZoom, Lona, Netlify, Norton, PayPal, Chime

### v11 - Marketing Integrations (20)
Mailchimp, SendGrid, Twilio, Stripe, Intercom, Freshdesk, Zendesk, ActiveCampaign, ConvertKit, Klaviyo, Mixpanel, Amplitude, Segment, Braze, Clearbit, FullContact, Hunter, Snov.io, ZeroBounce, NeverBounce

### v12 - IoT/Hardware Integrations (10)
PhilipsHue, Wemo, SmartThings, Ring, Nest, Ecobee, Tesla, Control4, Crestron, Lutron

### v13 - Data/Scientific Integrations (20)
WolframAlpha, IBMWatson, Clarifai, DarkSky, Mapbox, OpenWeatherMap, HERE Maps, Algolia, Elasticsearch, Pinecone, Weaviate, Qdrant, Meilisearch, Typesense, WolframCloud, DataRobot, KNIME, RapidMiner, Alteryx, Trifacta

### v14 - Education/Media Integrations (29)
Coursera, Udemy, Skillshare, Duolingo, Quizlet, Codecademy, Datacamp, Pluralsight, Medium, Substack, Ghost, YouTube, Vimeo, Twitch, Spotify, Apple Music, SoundCloud, Pandora, Bandcamp, Discord, Slack, Zoom, MS Teams, Signal, Viber, Line, WeChat

### v15 - Fintech/Healthcare/Lifestyle (30)
Robinhood, Coinbase, Revolut, Wise, Plaid, Stripe Atlas, Fitbit, Garmin, Oura, Whoop, Withings, SleepNumber, Peloton, Calm, Headspace, MyFitnessPal, Strava, Nike Run Club, Zwift, Mindbody, Vagaro, Booker, Square, Lightspeed, Clover, Toast, DoorDash, UberEats, Instacart, TaskRabbit

## API Endpoints

### Core Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status` | System status |
| POST | `/api/chat` | Chat with agents |
| GET | `/api/agents` | List agents |
| GET | `/api/providers` | List providers |
| GET | `/api/channels` | List channels |
| GET | `/api/memory` | Query memory |

### Knowledge Graph Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge/stats` | Graph statistics |
| POST | `/api/knowledge/nodes` | Add node |
| GET | `/api/knowledge/nodes/:type` | Get nodes by type |
| POST | `/api/knowledge/search` | Search graph |
| POST | `/api/knowledge/path` | Find path between nodes |

### Cache Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cache/stats` | Cache statistics |
| POST | `/api/cache/get` | Get cached value |
| POST | `/api/cache/set` | Set cached value |
| DELETE | `/api/cache/invalidate/:pattern` | Invalidate by pattern |

### Event Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/channels` | List event channels |
| POST | `/api/events/publish` | Publish event |

### Security Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/security/stats` | Security statistics |
| GET | `/api/security/audit` | Query audit log |
| POST | `/api/security/apikeys` | Create API key |

### Workflow Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List workflows + templates |
| POST | `/api/workflows` | Create workflow |
| POST | `/api/workflows/:id/execute` | Execute workflow |

### Text Analysis Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze/sentiment` | Sentiment analysis |
| POST | `/api/analyze/keywords` | Keyword extraction |
| POST | `/api/analyze/entities` | Entity extraction |
| POST | `/api/analyze/language` | Language detection |
| POST | `/api/analyze/statistics` | Text statistics |

### Integration Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v5/*` | App integrations |
| GET | `/api/v6/*` | More integrations |
| GET | `/api/v7/*` | Enterprise integrations |
| GET | `/api/v8/*` | Social integrations |
| GET | `/api/v9/*` | DevOps integrations |
| GET | `/api/v10/*` | Business integrations |
| GET | `/api/v11/*` | Marketing integrations |
| GET | `/api/v12/*` | IoT integrations |
| GET | `/api/v13/*` | Data integrations |
| GET | `/api/v14/*` | Media integrations |
| GET | `/api/v15/*` | Lifestyle integrations |

## Quick Start

```bash
npm install
npm run dev        # Development mode
npm start          # Production mode
```

### Environment Variables
```env
PORT=3005
LOG_LEVEL=info
DB_PATH=./data/nexus.db
OLLAMA_HOST=http://localhost:11434
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
DISCORD_TOKEN=your-token
TELEGRAM_TOKEN=your-token
```

### Testing
```bash
npm test                    # Run all 50 tests
npm run test:integrations   # Integration tests
```

## Statistics

| Metric | Count |
|--------|-------|
| **AI Models** | 100 |
| **AI Providers** | 20 |
| **Agents** | 30 |
| **Channels** | 16 |
| **Plugins** | 58 |
| **Features** | 26 |
| **Integrations** | 189+ |
| **Languages (Sandbox)** | 24 |
| **Workflow Templates** | 6 |
| **Tests** | 50 |

## License

MIT
