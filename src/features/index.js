export { getRateLimiter, RateLimiter } from './rate-limiter.js';
export { getAuditLogger, AuditLogger } from './audit-logger.js';
export { getScheduler, Scheduler } from './scheduler.js';
export { getTemplateEngine, TemplateEngine, DataExporter, DataImporter, BatchProcessor } from './template-engine.js';
export { getAnalyticsTracker, AnalyticsTracker, getMetricsCollector, MetricsCollector } from './analytics.js';
export { getBackupManager, BackupManager } from './backup-manager.js';
export { getNotificationCenter, NotificationCenter } from './notification-center.js';
export { getSchemaBuilder, SchemaBuilder, DataNormalizer } from './data-validation.js';
export { getWebhookManager, WebhookManager } from './webhook-manager.js';
export { getSearchEngine, SearchEngine } from './search-indexing.js';
export { getAPIVersioning, APIVersioning } from './api-versioning.js';
export { getFileProcessor, FileProcessor, ImageProcessor, DocumentProcessor } from './file-processing.js';
export { getSessionManager, SessionManager } from './session-manager.js';
export { getOAuthManager, OAuth2Manager } from './oauth-manager.js';
export { getTimeSeriesDatabase, TimeSeriesDatabase, Dashboard } from './time-series-db.js';
export { getHealthMonitor, HealthMonitor, ReadinessProbe, LivenessProbe } from './health-monitor.js';
export { getWorkflowEngine, WorkflowEngine } from './workflow-engine.js';
export { getLockManager, DistributedLockManager, Semaphore, LeaderElection } from './distributed-locks.js';
export { getMemoryCache, getTieredCache, MemoryCache, TieredCache } from './caching.js';
export { getABTestManager, ABTestManager, getFeatureManager, FeatureManager } from './ab-testing.js';
export { getGraphQLSchema, GraphQLSchema } from './graphql-support.js';
export {
  RateLimiterV2,
  RetryHandler,
  Memoizer,
  DataPipeline,
  FeatureFlagManagerV2,
  getRateLimiterV2,
  getRetryHandler,
  getMemoizer,
  getFeatureFlagManagerV2
} from './new-features.js';

export const features = [
  'rate-limiter',
  'audit-logger',
  'scheduler',
  'template-engine',
  'analytics',
  'backup-manager',
  'notification-center',
  'data-validation',
  'webhook-manager',
  'search-indexing',
  'api-versioning',
  'file-processing',
  'session-manager',
  'oauth-manager',
  'time-series-db',
  'health-monitor',
  'workflow-engine',
  'distributed-locks',
  'caching',
  'ab-testing',
  'graphql-support',
  'rate-limiter-v2',
  'retry-handler',
  'memoizer',
  'data-pipeline',
  'feature-flags-v2'
];

export const featureCount = features.length;
