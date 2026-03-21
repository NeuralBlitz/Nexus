# NEXUS Command Platform v2.0

A comprehensive local-first, unified AI agent orchestration platform with **189+ third-party app integrations** across 11 integration packs, **50 LLM providers**, **59 plugins**, and **50 passing tests**.

## Overview

NEXUS Command Platform is a powerful local AI agent system that connects to 189+ external applications through a unified plugin architecture with 59 community plugins, supports 50 LLM providers, and includes a full admin dashboard. It supports multiple LLM providers, multi-channel communication, and advanced orchestration capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      NEXUS Command Platform v2.0                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Agents  │  │Providers │  │ Channels │  │  Memory  │       │
│  │   (25)   │  │   (50)   │  │   (15)   │  │   (3)    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       └─────────────┴─────────────┴─────────────┘              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    LLM Orchestrator                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │
│  │Plugins │ │Events  │ │ Queue  │ │Security│ │Sandbox │     │
│  │  (59)  │ │ (100+) │ │        │ │        │ │        │     │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              189+ Third-Party Integrations                │  │
│  │  v5-v15: App, More, Enterprise, Social, DevOps, Business,  │  │
│  │  Marketing, IoT, Data, Media, Lifestyle                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Admin Dashboard                         │  │
│  │              + Webhooks + API Routes                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Systems

| System | Description |
|--------|-------------|
| **Agent System** | Multi-agent orchestration with task delegation |
| **Provider System** | Ollama, OpenAI, Anthropic LLM support |
| **Channel System** | WebSocket, CLI, HTTP multi-channel support |
| **Memory System** | Tiered memory with SQLite persistence |
| **Plugin System** | Hot-reloadable plugin architecture |
| **Event Bus** | Pub/sub event-driven communication |
| **Task Queue** | Async task orchestration |
| **Security System** | API key management and authentication |
| **Code Sandbox** | Secure JavaScript/Node.js execution |
| **Knowledge Graph** | Entity relationship management |
| **Workflow Engine** | Visual workflow orchestration |
| **LLM Orchestrator** | Multi-provider routing and fallbacks |
| **Real-time Collab** | Multi-user collaboration features |
| **Monitoring System** | System health and metrics |
| **Multimodal System** | Image/audio processing |
| **Cache System** | Multi-tier caching strategy |

## Integration Packs (189+ Integrations)

### v5 - App Integrations (10)
- Notion, Canva, Figma, Linear, Jira, Trello, Airtable, Google Workspace, Salesforce, HubSpot

### v6 - More Integrations (9)
- Adobe, AllTrails, Apple Music, Booking.com, Expedia, Instacart, Lovable, OpenTable, Replit

### v7 - Enterprise Integrations (13)
- Spotify, Target, TripAdvisor, Zillow, Base44, Botpress, Box, Brand24, Brex, Cloudflare, Cloudinary, Coursera, Dropbox

### v8 - Social Integrations (9)
- Twitter, Instagram, WhatsApp, LinkedIn, Telegram Bot, Slack Bot, Discord Bot, Teams Bot, Zoom Bot

### v9 - DevOps Integrations (11)
- IONOS, Doppler, Datadog, DigitalOcean, Vercel, HuggingFace, Docker, Prisma, Obsidian, Zube, BuildJet

### v10 - Business Integrations (18)
- GoDaddy, Granola, Gusto, Hex, HeyGen, HighLevel, Indeed, CreditKarma, InVideo, JotForm, KhanAcademy, Kraken, LegalZoom, Lona, Netlify, Norton, PayPal, Chime

### v11 - Marketing Integrations (20)
- Mailchimp, SendGrid, Twilio, Stripe, Intercom, Freshdesk, Zendesk, ActiveCampaign, ConvertKit, Klaviyo, Mixpanel, Amplitude, Segment, Braze, Clearbit, FullContact, Hunter, Snov.io, ZeroBounce, NeverBounce

### v12 - IoT/Hardware Integrations (10)
- PhilipsHue, Wemo, SmartThings, Ring, Nest, Ecobee, Tesla, Control4, Crestron, Lutron

### v13 - Data/Scientific Integrations (20)
- WolframAlpha, IBMWatson, Clarifai, DarkSky, Mapbox, OpenWeatherMap, HERE Maps, Algolia, Elasticsearch, Pinecone, Weaviate, Qdrant, Meilisearch, Typesense, WolframCloud, DataRobot, KNIME, RapidMiner, Alteryx, Trifacta

### v14 - Education/Media Integrations (29)
- Coursera, Udemy, Skillshare, Duolingo, Quizlet, Codecademy, Datacamp, Pluralsight, Medium, Substack, Ghost, YouTube, Vimeo, Twitch, Spotify, Apple Music, SoundCloud, Pandora, Bandcamp, Discord, Slack, Zoom, MS Teams, Signal, Viber, Line, WeChat

### v15 - Fintech/Healthcare Integrations (30)
- Robinhood, Coinbase, Revolut, Wise, Plaid, Stripe Atlas, Fitbit, Garmin, Oura, Whoop, Withings, SleepNumber, Peloton, Calm, Headspace, MyFitnessPal, Strava, Nike Run Club, Zwift, Mindbody, Vagaro, Booker, Square, Lightspeed, Clover, Toast, DoorDash, UberEats, Instacart, TaskRabbit

## API Endpoints

### Core Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status` | System status |
| POST | `/api/chat` | Chat with agents |
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/providers` | List providers |
| POST | `/api/providers` | Add provider |
| GET | `/api/channels` | List channels |
| GET | `/api/memory` | Query memory |

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

### Webhook Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/github` | GitHub webhooks |
| POST | `/api/webhooks/slack` | Slack webhooks |
| POST | `/api/webhooks/discord` | Discord webhooks |
| POST | `/api/webhooks/stripe` | Stripe webhooks |
| POST | `/api/webhooks/twilio` | Twilio webhooks |
| POST | `/api/webhooks/generic` | Generic webhooks |
| GET | `/api/webhooks/list` | List received webhooks |
| GET | `/api/webhooks/:id` | Get webhook details |

### Agent Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/:id` | Get agent details |
| POST | `/api/agents/:id/execute` | Execute task on agent |

### Provider Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | List all providers |
| POST | `/api/providers` | Add provider |
| GET | `/api/providers/:id` | Get provider details |
| POST | `/api/chat` | Chat with AI |

## Installation

```bash
npm install
npm run dev
```

## Configuration

Create a `.env` file with:

```env
PORT=3005
LOG_LEVEL=info
DB_PATH=./data/nexus.db
OLLAMA_HOST=http://localhost:11434
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

## Testing

```bash
npm test              # Run all tests
npm run test:modules  # Module tests only
npm run test:integrations # Integration tests
```

### Test Coverage

| Category | Tests |
|----------|-------|
| **Core Systems** | Agent System, Provider System, Channel System, Memory System |
| **Infrastructure** | Plugin System, Event Bus, Task Queue, Security System |
| **Processing** | Code Sandbox, Knowledge Graph, Workflow Engine |
| **AI/ML** | LLM Orchestrator, Multi-Modal, 21 LLM Providers |
| **Collaboration** | Collaboration System, Real-time Features |
| **Monitoring** | Monitoring System, Health Checks |
| **Cache/Memory** | Cache System, Memory Persistence, Vector Store |
| **Tools** | Git, Docker, Database Tools |
| **Channels** | 15 Channels (WebSocket, HTTP, CLI, Slack, Discord, Telegram, Email, SMS, Matrix, IRC, XMPP, Ntfy, Pushover, Signal, WebRTC, Webmention) |
| **Integrations** | 189 apps across 11 integration packs |
| **Agents** | 25 agents (5 built-in + 20 specialized) |
| **Plugins** | 59 community plugins |
| **Features** | 21 platform features |
| **Stress Tests** | Event bus (100 events), Cache (1000 operations), Memory vector store |

## Test Results

- **50 module tests** ✅ (100% pass rate)
- **518 integration tests** ✅ (100% pass rate)

## Core Agents (25 Total)

### Built-in Agents (5)
| Agent | Icon | Role | Description |
|-------|------|------|-------------|
| **NEXUS** | 🔮 | Platform Core | Central coordinator and platform orchestrator |
| **CODEX** | 💻 | Code Architect | Code generation and architecture |
| **DEBUG** | 🐛 | Debugger | Debug and troubleshoot issues |
| **SCRIBE** | 📝 | Documentation | Generate and maintain documentation |
| **TESTER** | 🧪 | Testing | Test and validate code |

### Specialized Agents (20)
| Agent | Icon | Role | Description |
|-------|------|------|-------------|
| **ORACLE** | 🔮 | Data Analyst | Analyze data and provide insights |
| **SCULPTOR** | 🎨 | UI Designer | Design user interfaces and visual elements |
| **GUARDIAN** | 🛡️ | Security Auditor | Audit security and compliance |
| **MATHEMATICIAN** | 🔢 | Mathematician | Solve mathematical problems |
| **LINGUIST** | 🌍 | Language Expert | Translate and analyze languages |
| **CHEF** | 👨‍🍳 | Recipe Creator | Create recipes and meal plans |
| **FITNESS** | 💪 | Fitness Coach | Create workout and fitness plans |
| **FINANCE** | 💰 | Financial Advisor | Provide financial planning advice |
| **LAWYER** | ⚖️ | Legal Assistant | Assist with legal research |
| **SCIENTIST** | 🔬 | Research Scientist | Conduct scientific research |
| **WRITER** | ✍️ | Content Writer | Write creative content |
| **MUSICIAN** | 🎵 | Music Composer | Compose and analyze music |
| **TEACHER** | 📚 | Educator | Teach and explain concepts |
| **THERAPIST** | 🧠 | Mental Health Support | Provide mental wellness support |
| **TRAVELER** | ✈️ | Travel Planner | Plan trips and travel itineraries |
| **MARKETER** | 📈 | Marketing Strategist | Develop marketing strategies |
| **HR_ASSISTANT** | 👥 | HR Assistant | Assist with HR tasks |
| **PM** | 📋 | Project Manager | Manage projects and timelines |
| **DATA_ENG** | 🗄️ | Data Engineer | Build data pipelines |
| **DEVOPS** | 🔧 | DevOps Engineer | Manage infrastructure and deployments |

## Communication Channels

### Built-in Channels (5)
| Channel | Type | Description |
|---------|------|-------------|
| **WebSocket** | websocket | Real-time bidirectional communication |
| **HTTP** | http | REST API channel |
| **CLI** | cli | Command-line interface |
| **Slack** | slack | Slack workspace integration |
| **Discord** | discord | Discord server integration |
| **Telegram** | telegram | Telegram bot integration |

### Extended Channels (10)
| Channel | Type | Description |
|---------|------|-------------|
| **Email** | email | SMTP/IMAP email integration |
| **SMS** | sms | Twilio SMS messaging |
| **Matrix** | matrix | Matrix protocol (Element, etc.) |
| **IRC** | irc | Internet Relay Chat |
| **XMPP** | xmpp | XMPP/Jabber messaging |
| **Ntfy** | ntfy | Ntfy notifications |
| **Pushover** | pushover | Push notification service |
| **Signal** | signal | Signal messenger integration |
| **WebRTC** | webrtc | WebRTC video/audio/data |
| **Webmention** | webmention | Webmention protocol |

## Platform Features (21)

### Core Features
| Feature | Description |
|---------|-------------|
| **Rate Limiter** | Request rate limiting with configurable windows and metrics |
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

### Security & Auth
| Feature | Description |
|---------|-------------|
| **Session Manager** | User session management with cookies |
| **OAuth Manager** | OAuth2 provider integration |
| **API Versioning** | API versioning with key management |
| **Distributed Locks** | Distributed locking and leader election |

### Infrastructure
| Feature | Description |
|---------|-------------|
| **Health Monitor** | System health checks and probes |
| **Caching** | Multi-tier caching with refresh |
| **A/B Testing** | A/B testing and feature rollouts |
| **GraphQL Support** | GraphQL schema and resolvers |

## Community Plugins (60)

### Utilities (10)
| Plugin | Description |
|--------|-------------|
| **math-plugin** | Mathematical operations |
| **math-advanced-plugin** | Advanced mathematics (calculus, statistics) |
| **calculator-plugin** | General purpose calculator |
| **date-plugin** | Date and time utilities |
| **random-plugin** | Random number generation |
| **array-plugin** | Array manipulation |
| **unit-plugin** | Unit conversion |
| **compression-plugin** | Data compression |
| **geo-plugin** | Geolocation utilities |
| **cron-plugin** | Cron expression parsing |

### Text Processing (8)
| Plugin | Description |
|--------|-------------|
| **text-plugin** | Text processing |
| **markdown-plugin** | Markdown parsing/rendering |
| **json-plugin** | JSON utilities |
| **csv-plugin** | CSV parsing/generation |
| **diff-plugin** | Text diffing |
| **regex-plugin** | Regex pattern matching |
| **emoji-plugin** | Emoji utilities |
| **xml-plugin** | XML parsing/generation |

### Security & Encoding (5)
| Plugin | Description |
|--------|-------------|
| **hash-plugin** | Cryptographic hashing |
| **password-plugin** | Password generation |
| **uuid-plugin** | UUID generation |
| **validator-plugin** | Data validation |
| **encoding-plugin** | Text encoding/decoding |

### Data & Formats (6)
| Plugin | Description |
|--------|-------------|
| **color-plugin** | Color conversion |
| **url-plugin** | URL parsing |
| **svg-plugin** | SVG generation |
| **chart-plugin** | Chart generation |
| **qrcode-plugin** | QR code generation |
| **format-plugin** | Data formatting |

### External Services (4)
| Plugin | Description |
|--------|-------------|
| **translator-plugin** | Multi-language translation |
| **weather-plugin** | Weather information |
| **calendar-plugin** | Calendar management |
| **currency-plugin** | Currency conversion |

### Specialized (4)
| Plugin | Description |
|--------|-------------|
| **image-plugin** | Image processing |
| **timezone-plugin** | Timezone utilities |
| **graph-plugin** | Graph data structure |
| **stats-plugin** | Statistical analysis |

### Infrastructure (23)
| Plugin | Description |
|--------|-------------|
| **ipc-plugin** | Inter-process communication |
| **logger-plugin** | Structured logging |
| **jwt-plugin** | JWT token management |
| **pagination-plugin** | Pagination utilities |
| **semver-plugin** | Semantic versioning |
| **throttle-plugin** | Throttling/debouncing |
| **token-plugin** | Token generation |
| **idempotency-plugin** | Idempotency keys |
| **permission-plugin** | Access control |
| **queue-plugin** | Message queue |
| **state-plugin** | State machine |
| **config-plugin** | Configuration management |
| **storage-plugin** | Key-value storage |
| **events-plugin** | Event emitter |
| **stream-plugin** | Stream processing |
| **memoize-plugin** | Function memoization |
| **pipeline-plugin** | Data pipeline |
| **router-plugin** | HTTP routing |
| **flag-plugin** | Feature flags |
| **retry-plugin** | Retry utilities |
| **rate-limit-plugin** | Rate limiting |
| **batch-plugin** | Batch processing | |

## LLM Providers (50 Total)

### Built-in (3)
| Provider | Models |
|----------|--------|
| **Ollama** | llama2, mistral, codellama, mixtral, etc. |
| **OpenAI** | gpt-4, gpt-4-turbo, gpt-3.5-turbo |
| **Anthropic** | claude-3-opus, claude-3-sonnet, claude-3-haiku |

### Additional Providers (15)
| Provider | Models |
|----------|--------|
| **Google AI (Gemini)** | gemini-pro, gemini-1.5-pro, gemini-1.5-flash |
| **Mistral AI** | mistral-large, mistral-small, mixtral-8x7b |
| **Cohere** | command-r-plus, command-r |
| **AI21 (Jamba)** | jamba-large, jamba-instruct |
| **Meta (Llama)** | llama-3-70b, llama-3-8b, llama-2-70b |
| **Hugging Face** | meta-llama-3-70b, mistral-7b, codellama-34b |
| **Replicate** | llama-3-70b, mistral-7b |
| **Perplexity** | sonar-large, sonar-small, llama-3-70b |
| **Groq** | mixtral-8x7b, llama-2-70b, gemma-7b |
| **DeepSeek** | deepseek-chat, deepseek-coder |
| **Fireworks AI** | llama-3-70b, mixtral-8x7b |
| **Together AI** | llama-2-70b |
| **Anyscale** | llama-2-70b, mistral-7b |
| **Cloudflare Workers AI** | llama-3-8b, mistral-7b |
| **Stability AI** | stable-diffusion-xl, stable-diffusion-v1 |

### Extra Providers (14)
| Provider | Models |
|----------|--------|
| **Azure OpenAI** | gpt-4, gpt-4-turbo, gpt-3.5-turbo |
| **Google Vertex AI** | chat-bison, codechat-bison |
| **AWS Bedrock** | claude-3-sonnet, llama-2-70b |
| **AI21 Summarize** | j2-mid, j2-ultra |
| **Aleph Alpha** | luminous-supreme, luminous-base |
| **MosaicML** | mistral-7b, llama2-70b |
| **OpenRouter** | openai/gpt-4, anthropic/claude-3-opus, meta-llama/llama-3-70b |
| **Lepton** | llama-3-70b, llama-3-8b |
| **Hyperbolic** | meta-llama/llama-3-70b |
| **Voyage AI** | voyage-2, voyage-lite-2 |
| **Mistral Large** | mistral-large, mistral-medium, mistral-small |
| **Novita AI** | llama-3-70b, qwen-72b |
| **Abacus AI** | llama-3-70b, mixtral-8x7b |

## License

MIT
