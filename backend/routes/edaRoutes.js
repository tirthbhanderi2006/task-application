import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import eventBus from '../eda/eventBus.js';
import jobQueue from '../eda/jobQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORTS_DIR = path.resolve(__dirname, '../logs/exports');

const router = express.Router();

/**
 * GET /api/eda/stream
 * Server-Sent Events (SSE) live domain event stream
 */
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  // Send initial handshake
  const initialPayload = JSON.stringify({
    type: 'STREAM_CONNECTED',
    message: 'Real-time Event-Driven Architecture stream active',
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: true })
  });
  res.write(`id: 0\nevent: message\ndata: ${initialPayload}\n\n`);

  eventBus.addSSEClient(res);

  // Heartbeat keep-alive every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.removeSSEClient(res);
  });
});

/**
 * POST /api/eda/jobs
 * Asynchronously triggers a background worker, immediately returning HTTP 202 Accepted.
 */
router.post('/jobs', (req, res) => {
  const { type = 'export_tasks_csv', payload = {} } = req.body;
  const actor = req.user?.email || req.body.actor || 'Tirth Bhanderi';

  const job = jobQueue.enqueueJob(type, payload, actor);

  return res.status(202).json({
    success: true,
    statusCode: 202,
    jobId: job.id,
    type: job.type,
    status: job.status,
    message: `${type.toUpperCase()} ENQUEUED ASYNCHRONOUSLY!`
  });
});

/**
 * GET /api/eda/jobs
 * List all jobs in the background queue
 */
router.get('/jobs', (req, res) => {
  res.status(200).json({
    jobs: jobQueue.listJobs()
  });
});

/**
 * GET /api/eda/jobs/:id
 * Retrieve status of a single job
 */
router.get('/jobs/:id', (req, res) => {
  const job = jobQueue.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.status(200).json({ job });
});

/**
 * GET /api/eda/jobs/:id/download
 * Download generated artifact (e.g. CSV export)
 */
router.get('/jobs/:id/download', (req, res) => {
  const job = jobQueue.getJob(req.params.id);
  if (!job || !job.artifact) {
    return res.status(404).json({ error: 'Artifact not found for this job' });
  }

  const filePath = path.join(EXPORTS_DIR, job.artifact.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Artifact file does not exist on disk' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${job.artifact.filename}"`);
  res.setHeader('Content-Type', 'text/csv');
  res.download(filePath, job.artifact.filename);
});

/**
 * GET /api/eda/telemetry
 * Real-time stats and subscriber topic listener counts
 */
router.get('/telemetry', (req, res) => {
  res.status(200).json(eventBus.getTelemetry());
});

/**
 * GET /api/eda/events
 * Recent event history buffer
 */
router.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.status(200).json({
    events: eventBus.getRecentEvents(limit)
  });
});

export default router;
