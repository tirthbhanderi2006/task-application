# Practical 10: Asynchronous Processing with Event-Driven Architecture (EDA)

**Course:** Advanced Web Development Frameworks (ITUE301)  
**Course Outcomes / Program Outcomes:** CO1 / PO3, PO5  
**Student Name:** Tirth Bhanderi  
**Enrollment No:** D25AIML081  
**Branch:** Artificial Intelligence & Machine Learning (CSPIT)  
**Date:** October 20, 2026  

---

## 1. Objective

To implement an enterprise-grade **Event-Driven Architecture (EDA)** and **Asynchronous Processing Pipeline** in a Node.js/Express and MongoDB REST API backend with React frontend integration, incorporating:
1. An in-process **Decoupled Pub/Sub Event Bus** (`EventEmitter`) with topic-based subscriber isolation.
2. Real-time unidirectional streaming via **Server-Sent Events (SSE)**.
3. Non-blocking asynchronous background job workers responding immediately with **HTTP 202 Accepted**.
4. Resilient background execution with retry logic, exponential backoff, and **Dead Letter Queue (DLQ)** fault isolation.
5. Real-time telemetry, subscriber bindings monitoring, and audit trails.

---

## 2. Architecture & Theoretical Concepts

### 2.1 The Need for Asynchronous Processing
In traditional synchronous request-response lifecycles, heavy operations (such as batch CSV exports, complex analytics, and external webhooks) block the Node.js event loop or tie up HTTP connections, resulting in:
- High response latencies (seconds to minutes).
- Client-side gateway timeouts (`HTTP 504 Gateway Timeout`).
- Database socket pool exhaustion.
- Cascading thread starvation under concurrent loads.

By adopting **Event-Driven Architecture (EDA)** with **`HTTP 202 Accepted`**:
1. **Instant Client Acknowledgement:** The server immediately returns `HTTP 202 Accepted` with a job ticket identifier (`jobId`), liberating the HTTP socket within milliseconds (< 5 ms).
2. **Decoupled Subscribers:** Downstream concerns (audit logging, cache invalidation, notification dispatchers, metrics aggregation) execute independently in parallel.
3. **Fault Isolation:** Failures in background tasks or third-party webhooks do not fail the primary user transaction.
4. **Reactive Push via SSE:** The browser establishes a single persistent HTTP connection (`text/event-stream`), receiving push notifications of domain events as state transitions occur without inefficient polling.

### 2.2 System Architecture Diagram

```
[Client (React Browser)] ───────────► POST /api/eda/jobs (Trigger Export/Analytics)
         │                                       │
         │ ◄─── HTTP 202 Accepted (Job Enqueued) ┘
         │
         ├───► GET /api/eda/stream (SSE Connection) ◄──┐
         │                                             │
         ▼                                             │ Push Events
┌──────────────────────────────────────────────────────┴──────────────────────┐
│                            Node.js Express Server                           │
│                                                                             │
│  ┌───────────────────────┐            ┌──────────────────────────────────┐  │
│  │   Job Queue Manager   │ ─────────► │         EDA Event Bus            │  │
│  │  - export_tasks_csv   │            │   (EventEmitter Pub/Sub Core)    │  │
│  │  - batch_analytics    │            └────────────────┬─────────────────┘  │
│  │  - simulate_failure   │                             │                     │
│  └───────────────────────┘                             │ Dispatches to:      │
│                                                        ▼                     │
│             ┌──────────────────────────────────────────────────────┐        │
│             │                Decoupled Subscribers                 │        │
│             │  ├── Audit Logger (Persists audit records)           │        │
│             │  ├── Cache Invalidator (Clears node-cache keys)     │        │
│             │  ├── Notification Dispatcher (Webhooks / Alerts)     │        │
│             │  ├── Dead Letter Queue (DLQ) (Catches failed jobs)   │        │
│             │  └── SSE Broadcaster (Streams to connected clients)  │        │
│             └──────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Details

### 3.1 Centralized Event Bus (`backend/eda/eventBus.js`)

A resilient singleton event bus built on Node's native `EventEmitter`:
- **`publish(topic, payload, actor)`**: Enriches events with unique UUIDs (`EVT-<timestamp>-<hash>`), measures handler execution duration in milliseconds, tracks telemetry, appends to the in-memory circular history buffer, and broadcasts over active SSE client sockets.
- **`subscribe(topic, handler, name)`**: Decouples subscribers from topic producers with error containment.
- **`getTelemetry()`**: Returns cumulative metrics including `totalEmitted`, `avgDuration`, `notificationsSent`, `dlqCount`, and subscriber listener bindings.

```javascript
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.totalEmitted = 0;
    this.totalDurationMs = 0;
    this.notificationsSent = 0;
    this.dlqCount = 0;
    this.eventHistory = [];
    this.subscriberRegistry = new Map();
    this.sseClients = new Set();
  }

  async publish(topic, payload = {}, actor = 'System') {
    const startTime = performance.now();
    const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true });

    const event = { id: eventId, topic, payload, actor, timestamp, createdAt: new Date().toISOString() };
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > 100) this.eventHistory.pop();

    this.broadcastSSE(event);
    this.emit(topic, event);

    const duration = performance.now() - startTime;
    this.totalEmitted += 1;
    this.totalDurationMs += duration;
    return event;
  }
}
```

### 3.2 Decoupled Subscriber Bindings (`backend/eda/subscribers.js`)

All 15 domain topics are registered with decoupled listeners:
- **`task:created` / `task:updated` / `task:deleted`**: Bound to Audit Logger, Cache Invalidation (`cache.del()`), and live dispatchers.
- **`task:status_changed`**: Bound to Audit Logger, Cache Invalidator, Notification Dispatcher, and Analytics Aggregator (4 listeners).
- **`task:high_priority_alert`**: Triggers Webhook Dispatcher and urgent notifications.
- **`job:completed`**: Bound to Audit Logger, Artifact Registry, and Notification Dispatcher.
- **`job:failed`**: Bound to Audit Logger and **Dead Letter Queue (DLQ)** handler.
- **`job:enqueued`**, **`job:started`**, **`job:progress`**, **`job:retry`**, **`notification:dispatched`**, **`audit:logged`**: Instrumented for fine-grained workflow monitoring.

### 3.3 Asynchronous Job Queue & Workers (`backend/eda/jobQueue.js`)

Accepts incoming job requests, generates a `jobId`, queues the record, and immediately fires asynchronous workers via `setImmediate`:
- **`export_tasks_csv`**: Reads tasks from MongoDB, serializes documents into RFC 4180 CSV format, writes `tasks_export_<jobId>.csv` to disk, emits `job:started`, `job:progress` (25%, 60%), and `job:completed` (100%) with artifact metadata.
- **`batch_analytics`**: Asynchronously aggregates completion velocity, priority breakdown, and sprint completion percentages with multi-stage progress reporting.
- **`simulate_failure` (Test Retries & DLQ)**: Simulates an unstable downstream microservice:
  - Attempt 1: Fails → Emits `job:retry` (Attempt 1 timed out).
  - Attempt 2: Fails → Emits `job:retry` (Attempt 2 timed out).
  - Attempt 3: Exhausts retry limit → Diverts job to **Dead Letter Queue (DLQ)**, updates DLQ count, and marks status as `FAILED`.

### 3.4 Real-Time Server-Sent Events (SSE) Route (`backend/routes/edaRoutes.js`)

```javascript
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  eventBus.addSSEClient(res);

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.removeSSEClient(res);
  });
});
```

---

## 4. Visual Evidence & Screenshots

All screenshots were captured directly from the running web application:

### Figure 1: Tasks Page with EDA Action Button & Live Metrics
*Demonstrates the portfolio-themed Task Management System showing 6 seeded tasks, the backend status bar, live clock, 4 overview statistic cards (Total: 6, Pending: 5, Completed: 1, High Priority: 4), and the `⚡ EVENT STREAM & ASYNC JOBS` button with a pulsing green connection indicator:*
![Figure 1: Tasks Page with EDA Trigger Button](screenshots/practical10_01_tasks_page_eda_button.png)

### Figure 2: Event-Driven Architecture Drawer on Live Stream Tab (Waiting for Events)
*Demonstrates the EDA sliding drawer opened in the portfolio design system. The SSE stream is actively connected (`Stream: CONNECTED` with live status dot), showing the empty state waiting for domain events:*
![Figure 2: Live Stream Tab Waiting for Events](screenshots/practical10_02_eda_drawer_live_stream_waiting.png)

### Figure 3: Async Jobs Tab (HTTP 202 Accepted, Background Workers & DLQ)
*Demonstrates asynchronous background jobs triggered via HTTP 202 Accepted. The CSV export completed with 100% progress and a `⬇ Download Artifact` button, while `simulate_failure` exhausted 3 retries and was routed to the Dead Letter Queue (`FAILED`):*
![Figure 3: Async Jobs Tab with Completed CSV and DLQ Failure](screenshots/practical10_03_async_jobs_http202_completed_dlq.png)

### Figure 4: Live Stream Tab Populated with Real-Time Domain Events
*Demonstrates the live Server-Sent Events stream populated with real-time domain events (`job:started`, `job:progress`, `job:retry`, `job:failed`, `audit:logged`) complete with event IDs, timestamps, and actor identifiers:*
![Figure 4: Populated Live Domain Event Stream](screenshots/practical10_04_live_stream_populated_events.png)

### Figure 5: Telemetry & Stats Tab with Quad Metrics and Subscriber Bindings
*Demonstrates the real-time telemetry dashboard displaying Total Emitted (14), Average Handler Duration (0.87 ms), Notifications Sent (1), and Dead Letter Queue Count (1), alongside the subscriber topic bindings grid:*
![Figure 5: Telemetry Quad Metrics and Subscriber Topic Bindings](screenshots/practical10_05_telemetry_stats_subscriber_bindings.png)

### Figure 6: Telemetry Scrolled View with Architecture Explanations
*Demonstrates the scrolled view of the Telemetry tab displaying remaining topic listeners and the "How It Works: Decoupled Architecture" notes explaining non-blocking ingestion, decoupled subscribers, and fault isolation:*
![Figure 6: Telemetry Scrolled View and Architecture Callout](screenshots/practical10_06_telemetry_how_it_works_scrolled.png)

---

## 5. Key Questions & Conceptual Analysis

### Q1: Why is asynchronous processing essential for long-running operations like CSV exports, and how does `HTTP 202 Accepted` prevent client-side HTTP timeouts?
* **Problem with Synchronous Processing:**
  When a client requests a resource that takes multiple seconds or minutes to generate (e.g. exporting 100,000 tasks to CSV or synthesizing analytics), a synchronous handler blocks the HTTP connection. Browsers, load balancers, and reverse proxies (such as Nginx or AWS ALB) enforce strict request timeout thresholds (typically 30–60 seconds). If the generation exceeds this window, the proxy terminates the socket with an `HTTP 504 Gateway Timeout`, even if the database is still processing.
* **The HTTP 202 Solution:**
  `HTTP 202 Accepted` is the standard status code indicating that a request has been accepted for processing, but processing has not yet completed. The server immediately returns a receipt payload containing a `jobId` and status URI within milliseconds. The client can subsequently listen for push updates via Server-Sent Events (SSE) or query `GET /api/eda/jobs/:id` for progress, completely decoupling processing duration from HTTP socket lifespans.

### Q2: What is the architectural difference between synchronous request-response vs. decoupled event-driven pub/sub, and how does pub/sub provide fault isolation?
* **Synchronous Coupling:**
  In a monolithic controller, creating a task requires synchronously executing:
  ```
  saveToMongo() ➔ writeAuditLog() ➔ sendEmailNotification() ➔ invalidateCache() ➔ returnResponse()
  ```
  If the email SMTP server times out or throws an unhandled exception, the entire request fails, the user receives an error screen, and the transaction is compromised, even though the task was already saved to the database.
* **Decoupled Pub/Sub:**
  With pub/sub, the controller only performs the core atomic action and publishes an event:
  ```
  saveToMongo() ➔ eventBus.publish('task:created', task) ➔ return 201 Created
  ```
  Subscribers (AuditLogger, EmailNotifier, CacheInvalidator) execute independently. If the EmailNotifier throws an error, the event loop catches the exception inside the isolated subscriber without interrupting other listeners or affecting the user's HTTP response (**Fault Isolation**).

### Q3: Why is a Dead Letter Queue (DLQ) critical in enterprise background job processing, and what would happen without it?
* **Purpose of a Dead Letter Queue (DLQ):**
  A Dead Letter Queue is a specialized holding queue for messages or background jobs that cannot be successfully processed after a predetermined number of retry attempts (e.g., due to corrupt data, schema mismatches, or downstream service outages).
* **Consequences of Not Having a DLQ:**
  1. **Poison Pill Messages:** A single malformed job that crashes its worker will be continuously retried indefinitely, creating a CPU consumption loop that starves valid jobs.
  2. **Worker Starvation:** Unhandled errors cause worker pools to get stuck on permanently broken payloads.
  3. **Silent Data Loss:** If failed jobs are simply discarded without logging, administrators have no forensic visibility into lost transactions.
  The DLQ intercepts failed jobs, records failure diagnostics, alerts engineers via telemetry, and allows manual inspection or reprocessing once the root cause is resolved.

---

## 6. Reflection & Troubleshooting Log

| Symptom / Challenge | Root Cause | Solution Implemented |
|---|---|---|
| **`401 Unauthorized` on `/api/tasks` during frontend load** | `fetchTasks` initially used hardcoded headers without attaching the JWT Bearer token from `localStorage`. | Updated `fetchTasks` in `TaskManager.jsx` to utilize `getHeaders()`, automatically injecting `Authorization: Bearer <token>` into all API requests. |
| **SSE connection dropped on idle network** | Proxies and browsers terminate inactive HTTP connections after 30–60 seconds of silence. | Implemented a 20-second heartbeat ping (`: ping\n\n`) in `backend/routes/edaRoutes.js` to keep the connection socket alive indefinitely. |
| **In-memory event buffer overflow** | High event emission volume could cause unbounded memory growth in the Node.js process heap. | Designed `EventBus` with a circular buffer strategy, automatically pruning history to maintain a strict bound of the last 100 events. |
| **DLQ job retry timing** | Instant retries overwhelmed unstable workers without giving downstream services time to recover. | Implemented artificial exponential delays (500 ms) between retries before final routing to the Dead Letter Queue. |

---

## 7. Deliverables & Verification Checklist

- [x] **Event Bus Singleton implemented** (`backend/eda/eventBus.js`) with pub/sub, telemetry, and SSE broadcast.
- [x] **Decoupled Subscribers registered** (`backend/eda/subscribers.js`) across 15 topics matching specifications.
- [x] **Asynchronous Job Queue implemented** (`backend/eda/jobQueue.js`) with CSV Export, Batch Analytics, and Retry/DLQ simulation.
- [x] **Express EDA Router mounted** (`backend/routes/edaRoutes.js`) with `/stream`, `/jobs`, `/jobs/:id/download`, and `/telemetry`.
- [x] **React EDA Drawer built** (`src/components/eda/EventDrivenArchitectureDrawer.jsx`) strictly aligned with the portfolio theme.
- [x] **All 6 Figures captured as high-resolution screenshots** in `docs/screenshots/` matching the curriculum structure.
- [x] **Theoretical concepts and Key Questions fully analyzed** covering non-blocking ingestion, pub/sub, and DLQ patterns.
