import eventBus from './eventBus.js';
import cache from '../config/cache.js';

/**
 * Initialize Decoupled Subscribers for Event-Driven Architecture (EDA)
 * 
 * Demonstrates:
 * 1. Non-blocking asynchronous processing
 * 2. Decoupled subscribers (Audit, Notifications, Cache, DLQ)
 * 3. Fault isolation: handler errors do not interrupt other subscribers
 */
export function registerSubscribers() {
  console.log('[EDA] Registering decoupled event subscribers...');

  // --- 1. TASK:CREATED (3 Listeners) ---
  eventBus.subscribe('task:created', (evt) => {
    // 1. Audit Logging
    eventBus.publish('audit:logged', { action: 'TASK_CREATED', task: evt.payload }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('task:created', (evt) => {
    // 2. Cache Invalidation
    const userId = evt.payload?.user;
    if (userId) cache.del(`tasks_${userId}`);
    cache.del('all_tasks');
  }, 'CacheInvalidator');

  eventBus.subscribe('task:created', (evt) => {
    // 3. High Priority Alert Evaluation
    if (evt.payload?.priority === 'high') {
      eventBus.publish('task:high_priority_alert', { task: evt.payload }, evt.actor);
    }
  }, 'PriorityEvaluator');


  // --- 2. TASK:UPDATED (3 Listeners) ---
  eventBus.subscribe('task:updated', (evt) => {
    // 1. Audit Logging
    eventBus.publish('audit:logged', { action: 'TASK_UPDATED', task: evt.payload }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('task:updated', (evt) => {
    // 2. Cache Invalidation
    const userId = evt.payload?.user;
    if (userId) cache.del(`tasks_${userId}`);
    cache.del('all_tasks');
  }, 'CacheInvalidator');

  eventBus.subscribe('task:updated', (evt) => {
    // 3. Live Broadcast Dispatcher
    // Triggers notification if needed
  }, 'LiveBroadcastDispatcher');


  // --- 3. TASK:STATUS_CHANGED (4 Listeners) ---
  eventBus.subscribe('task:status_changed', (evt) => {
    // 1. Audit Logger
    eventBus.publish('audit:logged', { action: 'STATUS_CHANGED', task: evt.payload }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('task:status_changed', (evt) => {
    // 2. Cache Invalidator
    const userId = evt.payload?.user;
    if (userId) cache.del(`tasks_${userId}`);
    cache.del('all_tasks');
  }, 'CacheInvalidator');

  eventBus.subscribe('task:status_changed', (evt) => {
    // 3. Notification Dispatcher
    if (evt.payload?.completed) {
      eventBus.incrementNotifications();
      eventBus.publish('notification:dispatched', {
        type: 'TASK_COMPLETED_NOTIFICATION',
        taskId: evt.payload?._id
      }, evt.actor);
    }
  }, 'NotificationDispatcher');

  eventBus.subscribe('task:status_changed', (evt) => {
    // 4. Analytics Aggregator
  }, 'AnalyticsAggregator');


  // --- 4. TASK:DELETED (3 Listeners) ---
  eventBus.subscribe('task:deleted', (evt) => {
    // 1. Audit Logger
    eventBus.publish('audit:logged', { action: 'TASK_DELETED', taskId: evt.payload?.taskId }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('task:deleted', (evt) => {
    // 2. Cache Invalidator
    const userId = evt.payload?.user;
    if (userId) cache.del(`tasks_${userId}`);
    cache.del('all_tasks');
  }, 'CacheInvalidator');

  eventBus.subscribe('task:deleted', (evt) => {
    // 3. Cleanup Routine
  }, 'CleanupHandler');


  // --- 5. TASK:HIGH_PRIORITY_ALERT (3 Listeners) ---
  eventBus.subscribe('task:high_priority_alert', (evt) => {
    // 1. Audit Logger
    eventBus.publish('audit:logged', { action: 'HIGH_PRIORITY_ALERT', task: evt.payload }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('task:high_priority_alert', (evt) => {
    // 2. Webhook Notification
    eventBus.incrementNotifications();
    eventBus.publish('notification:dispatched', { channel: 'WEBHOOK', payload: evt.payload }, evt.actor);
  }, 'WebhookDispatcher');

  eventBus.subscribe('task:high_priority_alert', (evt) => {
    // 3. Urgent Push Notification
  }, 'PushAlertService');


  // --- 6. USER:REGISTERED (3 Listeners) ---
  eventBus.subscribe('user:registered', (evt) => {
    eventBus.publish('audit:logged', { action: 'USER_REGISTERED', user: evt.payload }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('user:registered', (evt) => {
    eventBus.incrementNotifications();
  }, 'WelcomeEmailService');

  eventBus.subscribe('user:registered', (evt) => {
    // Initialize user profile settings
  }, 'UserProfileInitializer');


  // --- 7. USER:LOGGED_IN (2 Listeners) ---
  eventBus.subscribe('user:logged_in', (evt) => {
    eventBus.publish('audit:logged', { action: 'USER_LOGGED_IN', email: evt.payload?.email }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('user:logged_in', (evt) => {
    // Update last login timestamp
  }, 'SessionTracker');


  // --- 8. JOB:COMPLETED (3 Listeners) ---
  eventBus.subscribe('job:completed', (evt) => {
    eventBus.publish('audit:logged', { action: 'JOB_COMPLETED', job: evt.payload }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('job:completed', (evt) => {
    eventBus.incrementNotifications();
    eventBus.publish('notification:dispatched', { channel: 'JOB_NOTIFICATION', job: evt.payload }, evt.actor);
  }, 'JobNotificationDispatcher');

  eventBus.subscribe('job:completed', (evt) => {
    // Artifact persistence registry
  }, 'ArtifactRegistry');


  // --- 9. JOB:FAILED (2 Listeners) ---
  eventBus.subscribe('job:failed', (evt) => {
    eventBus.publish('audit:logged', { action: 'JOB_FAILED', job: evt.payload }, evt.actor);
  }, 'AuditLogger');

  eventBus.subscribe('job:failed', (evt) => {
    // Dead Letter Queue (DLQ) ingestion
    eventBus.incrementDlq();
    console.warn(`[EDA:DLQ] Job ${evt.payload?.jobId} pushed to Dead Letter Queue.`);
  }, 'DeadLetterQueueHandler');


  // --- 10. JOB:ENQUEUED (1 Listener) ---
  eventBus.subscribe('job:enqueued', (evt) => {
    // Log job admission
  }, 'JobQueueMonitor');


  // --- 11. JOB:STARTED (1 Listener) ---
  eventBus.subscribe('job:started', (evt) => {
    // Track worker allocation
  }, 'WorkerPoolMonitor');


  // --- 12. JOB:PROGRESS (1 Listener) ---
  eventBus.subscribe('job:progress', (evt) => {
    // Track incremental progress
  }, 'ProgressTracker');


  // --- 13. JOB:RETRY (1 Listener) ---
  eventBus.subscribe('job:retry', (evt) => {
    // Track retry telemetry & backoff
  }, 'RetryTelemetryTracker');


  // --- 14. NOTIFICATION:DISPATCHED (1 Listener) ---
  eventBus.subscribe('notification:dispatched', (evt) => {
    // Final notification log
  }, 'NotificationAuditLog');


  // --- 15. AUDIT:LOGGED (1 Listener) ---
  eventBus.subscribe('audit:logged', (evt) => {
    // File/DB persistence for audit trails
  }, 'PersistentAuditWriter');

  console.log('[EDA] Decoupled subscribers successfully bound to all 15 topics.');
}
