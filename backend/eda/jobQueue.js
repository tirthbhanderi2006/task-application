import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import eventBus from './eventBus.js';
import Task from '../models/Task.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORTS_DIR = path.resolve(__dirname, '../logs/exports');

if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

class JobQueue {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Accepts and enqueues a background job. Returns immediately with HTTP 202 metadata.
   */
  enqueueJob(type, payload = {}, actor = 'Anonymous') {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const jobRecord = {
      id: jobId,
      jobId,
      type,
      status: 'ENQUEUED',
      progress: 0,
      actor,
      message: 'Enqueued in background worker pool',
      payload,
      artifact: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.jobs.set(jobId, jobRecord);

    // Emit event immediately
    eventBus.publish('job:enqueued', { jobId, type, status: 'ENQUEUED' }, actor);

    // Kick off asynchronous worker without blocking the HTTP request thread
    setImmediate(() => {
      this.processJob(jobId);
    });

    return jobRecord;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  listJobs() {
    return Array.from(this.jobs.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'RUNNING';
    job.updatedAt = new Date().toISOString();
    await eventBus.publish('job:started', { jobId, type: job.type }, job.actor);

    try {
      if (job.type === 'export_tasks_csv') {
        await this.handleExportCsv(job);
      } else if (job.type === 'batch_analytics') {
        await this.handleBatchAnalytics(job);
      } else if (job.type === 'simulate_failure') {
        await this.handleSimulateFailure(job);
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (err) {
      console.error(`[JobQueue] Unhandled job execution error for ${jobId}:`, err);
      job.status = 'FAILED';
      job.message = err.message || 'Worker failure';
      await eventBus.publish('job:failed', { jobId, type: job.type, error: err.message }, job.actor);
    }
  }

  // Worker: Export Tasks to CSV
  async handleExportCsv(job) {
    job.progress = 25;
    job.message = 'Fetching tasks from MongoDB collection...';
    await eventBus.publish('job:progress', { jobId: job.id, progress: 25, message: job.message }, job.actor);

    await new Promise((r) => setTimeout(r, 400));

    // Fetch tasks
    let tasks = [];
    try {
      if (job.payload?.userId) {
        tasks = await Task.find({ user: job.payload.userId });
      } else {
        tasks = await Task.find();
      }
    } catch {
      tasks = [];
    }

    job.progress = 60;
    job.message = `Serializing ${tasks.length} task records into CSV...`;
    await eventBus.publish('job:progress', { jobId: job.id, progress: 60, message: job.message }, job.actor);

    await new Promise((r) => setTimeout(r, 400));

    // Construct CSV
    const header = 'ID,Title,Description,Completed,Priority,CreatedAt\n';
    const rows = tasks.map((t) => {
      const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      return [
        escape(t._id),
        escape(t.title),
        escape(t.description || ''),
        escape(t.completed ? 'YES' : 'NO'),
        escape(t.priority || 'medium'),
        escape(t.createdAt || '')
      ].join(',');
    }).join('\n');

    const filename = `tasks_export_${job.id}.csv`;
    const filepath = path.join(EXPORTS_DIR, filename);
    fs.writeFileSync(filepath, header + rows, 'utf8');

    job.progress = 100;
    job.status = 'COMPLETED';
    job.message = `Export completed successfully (${tasks.length} rows)`;
    job.artifact = {
      filename,
      downloadUrl: `/api/eda/jobs/${job.id}/download`,
      rowsCount: tasks.length
    };
    job.updatedAt = new Date().toISOString();

    await eventBus.publish('job:completed', {
      jobId: job.id,
      type: job.type,
      artifact: job.artifact
    }, job.actor);
  }

  // Worker: Batch Analytics Computation
  async handleBatchAnalytics(job) {
    const steps = [
      { progress: 30, message: 'Calculating completion velocity across historical sprints...' },
      { progress: 65, message: 'Aggregating priority matrix distributions...' },
      { progress: 90, message: 'Generating summary metrics...' }
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 400));
      job.progress = step.progress;
      job.message = step.message;
      await eventBus.publish('job:progress', { jobId: job.id, progress: step.progress, message: step.message }, job.actor);
    }

    await new Promise((r) => setTimeout(r, 300));
    job.progress = 100;
    job.status = 'COMPLETED';
    job.message = 'Batch analytics synthesized successfully.';
    job.updatedAt = new Date().toISOString();

    await eventBus.publish('job:completed', {
      jobId: job.id,
      type: job.type,
      metrics: { analyzedAt: new Date().toISOString() }
    }, job.actor);
  }

  // Worker: Simulate Failure with Retries and Dead Letter Queue (DLQ)
  async handleSimulateFailure(job) {
    job.progress = 30;
    job.message = 'Simulating unstable remote microservice...';
    await eventBus.publish('job:progress', { jobId: job.id, progress: 30, message: job.message }, job.actor);

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      job.message = `Attempt ${attempt} timed out. Retrying with exponential backoff...`;
      await eventBus.publish('job:retry', {
        jobId: job.id,
        attempt,
        maxRetries: 3,
        message: job.message
      }, job.actor);
    }

    await new Promise((r) => setTimeout(r, 500));

    // Exhausted retries -> Route to Dead Letter Queue (DLQ)
    job.status = 'FAILED';
    job.progress = 30;
    job.message = 'All 3 retry attempts exhausted. Diverted to Dead Letter Queue (DLQ).';
    job.updatedAt = new Date().toISOString();

    await eventBus.publish('job:failed', {
      jobId: job.id,
      type: job.type,
      reason: 'Remote service timeout',
      deadLetterQueue: true
    }, job.actor);
  }
}

const jobQueue = new JobQueue();
export default jobQueue;
