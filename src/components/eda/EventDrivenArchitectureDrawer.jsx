import React, { useState, useEffect, useRef } from 'react';
import './EventDrivenArchitectureDrawer.css';
import { API_BASE } from '../../config';

export default function EventDrivenArchitectureDrawer({ isOpen, onClose, userEmail }) {
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'jobs' | 'telemetry'
  const [streamStatus, setStreamStatus] = useState('CONNECTING'); // 'CONNECTED' | 'CONNECTING' | 'OFFLINE'
  const [events, setEvents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [telemetry, setTelemetry] = useState({
    totalEmitted: 0,
    avgDuration: '0.00 ms',
    notificationsSent: 0,
    dlqCount: 0,
    subscriberBindings: {}
  });
  const [bannerMessage, setBannerMessage] = useState(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const eventSourceRef = useRef(null);

  // Connect to SSE stream
  useEffect(() => {
    let es;
    const connectSSE = () => {
      setStreamStatus('CONNECTING');
      try {
        es = new EventSource(`${API_BASE}/api/eda/stream`);
        eventSourceRef.current = es;

        es.onopen = () => {
          setStreamStatus('CONNECTED');
        };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'STREAM_CONNECTED') return;

            setEvents((prev) => {
              if (prev.some((item) => item.id === data.id)) return prev;
              return [data, ...prev].slice(0, 50);
            });

            if (data.topic && data.topic.startsWith('job:')) {
              fetchJobs();
            }
            fetchTelemetry();
          } catch (err) {
            console.error('SSE JSON parse error:', err);
          }
        };

        es.onerror = () => {
          setStreamStatus('OFFLINE');
        };
      } catch (err) {
        setStreamStatus('OFFLINE');
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/eda/jobs`);
      if (res.ok) {
        const json = await res.json();
        setJobs(json.jobs || []);
      }
    } catch {
      // offline fallback
    }
  };

  const fetchTelemetry = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/eda/telemetry`);
      if (res.ok) {
        const json = await res.json();
        setTelemetry(json);
      }
    } catch {
      // offline fallback
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchTelemetry();
    const interval = setInterval(() => {
      fetchJobs();
      fetchTelemetry();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerJob = async (type) => {
    setIsTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/eda/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          actor: userEmail || 'Tirth Bhanderi'
        })
      });

      if (res.status === 202) {
        const json = await res.json();
        setBannerMessage(`HTTP 202 Accepted: ${type.toUpperCase()} enqueued asynchronously!`);
        fetchJobs();
        fetchTelemetry();
      }
    } catch (err) {
      console.error('Error triggering job:', err);
    } finally {
      setIsTriggering(false);
    }
  };

  if (!isOpen) return null;

  const getTopicBadgeClass = (topic) => {
    const t = (topic || '').toLowerCase();
    if (t.includes('progress')) return 'badge-progress';
    if (t.includes('started')) return 'badge-started';
    if (t.includes('retry')) return 'badge-retry';
    if (t.includes('completed')) return 'badge-completed';
    if (t.includes('failed')) return 'badge-failed';
    if (t.includes('status')) return 'badge-status';
    if (t.includes('alert')) return 'badge-alert';
    return 'badge-default';
  };

  return (
    <div className="eda-drawer-overlay" onClick={onClose}>
      <aside
        className="eda-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        aria-label="Event-Driven Architecture Panel"
      >
        {/* Drawer Header */}
        <div className="eda-header">
          <div className="eda-title-container">
            <h2 className="eda-title">
              <span className="eda-title-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </span>
              Event-Driven Architecture (EDA)
            </h2>
            <div className="eda-meta-row">
              <span className="eda-subtitle">
                Decoupled Pub/Sub • Async Jobs • Real-Time SSE
              </span>
              <span className={`eda-stream-badge ${streamStatus.toLowerCase()}`}>
                <span className="badge-dot"></span>
                Stream: {streamStatus}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="eda-close-btn"
            onClick={onClose}
            aria-label="Close EDA drawer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <nav className="eda-tabs-nav" aria-label="EDA Navigation Tabs">
          <button
            type="button"
            className={`eda-tab-btn ${activeTab === 'stream' ? 'active' : ''}`}
            onClick={() => setActiveTab('stream')}
          >
            Live Stream ({events.length})
          </button>
          <button
            type="button"
            className={`eda-tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            Async Jobs (HTTP 202)
          </button>
          <button
            type="button"
            className={`eda-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            Telemetry & Stats
          </button>
        </nav>

        {/* Banner Alert for HTTP 202 */}
        {bannerMessage && (
          <div className="eda-banner-alert">
            <span className="eda-banner-check">✓</span> {bannerMessage}
          </div>
        )}

        {/* Tab Contents */}
        <div className="eda-content-body">
          {/* TAB 1: LIVE STREAM */}
          {activeTab === 'stream' && (
            <div className="eda-tab-pane">
              <div className="eda-pane-subtitle">Real-Time Server-Sent Events</div>
              {events.length === 0 ? (
                <div className="eda-empty-stream-box">
                  <div className="eda-empty-title">Waiting for events...</div>
                  <div className="eda-empty-desc">
                    Create, update, toggle, or delete a task on the dashboard to view real-time domain events!
                  </div>
                </div>
              ) : (
                <div className="eda-event-list">
                  {events.map((evt) => (
                    <div key={evt.id} className="eda-event-card">
                      <div className="eda-event-top">
                        <span className={`eda-topic-badge ${getTopicBadgeClass(evt.topic)}`}>
                          {evt.topic}
                        </span>
                        <span className="eda-event-time">{evt.timestamp}</span>
                      </div>
                      <div className="eda-event-body">
                        {evt.payload?.message ||
                          (evt.topic.includes('task')
                            ? `Task: "${evt.payload?.title || evt.payload?.taskId || 'Task'}"`
                            : evt.payload?.jobId
                            ? `Job: ${evt.payload?.jobId}`
                            : JSON.stringify(evt.payload))}
                      </div>
                      <div className="eda-event-footer">
                        <span>ID: {evt.id}</span>
                        <span>Actor: {evt.actor || 'System'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASYNC JOBS */}
          {activeTab === 'jobs' && (
            <div className="eda-tab-pane">
              <div className="eda-trigger-box">
                <div className="eda-trigger-title">Trigger Background Jobs (HTTP 202 Accepted)</div>
                <p className="eda-trigger-desc">
                  Offloads computational, analytical, or export operations to asynchronous background workers without blocking the main HTTP thread.
                </p>
                <div className="eda-action-buttons-row">
                  <button
                    type="button"
                    className="eda-job-btn btn-export"
                    disabled={isTriggering}
                    onClick={() => handleTriggerJob('export_tasks_csv')}
                  >
                    ⚡ Export CSV (Async 202)
                  </button>
                  <button
                    type="button"
                    className="eda-job-btn btn-analytics"
                    disabled={isTriggering}
                    onClick={() => handleTriggerJob('batch_analytics')}
                  >
                    📊 Batch Analytics
                  </button>
                  <button
                    type="button"
                    className="eda-job-btn btn-failure"
                    disabled={isTriggering}
                    onClick={() => handleTriggerJob('simulate_failure')}
                  >
                    ⚠️ Test Retries & DLQ
                  </button>
                </div>
              </div>

              <div className="eda-queue-header">Background Job Queue & Workers</div>
              <div className="eda-jobs-list">
                {jobs.length === 0 ? (
                  <div className="eda-empty-jobs-card">
                    No jobs enqueued yet. Click a button above to run asynchronous background work.
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} className="eda-job-card">
                      <div className="eda-job-header">
                        <span className="eda-job-name">{job.type}</span>
                        <span className={`eda-job-status-badge status-${job.status.toLowerCase()}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="eda-job-message">{job.message}</div>
                      <div className="eda-progress-container">
                        <div
                          className={`eda-progress-bar status-${job.status.toLowerCase()}`}
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                      {job.artifact && (
                        <div className="eda-artifact-row">
                          <span className="eda-artifact-meta">
                            {job.artifact.filename} ({job.artifact.rowsCount} rows)
                          </span>
                          <a
                            href={`${API_BASE}${job.artifact.downloadUrl}`}
                            download={job.artifact.filename}
                            className="eda-download-btn"
                          >
                            ⬇ Download Artifact
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TELEMETRY & STATS */}
          {activeTab === 'telemetry' && (
            <div className="eda-tab-pane">
              <div className="eda-stats-quad">
                <div className="eda-stat-box box-emitted">
                  <div className="eda-stat-label">Total Emitted</div>
                  <div className="eda-stat-val">{telemetry.totalEmitted}</div>
                </div>
                <div className="eda-stat-box box-duration">
                  <div className="eda-stat-label">Avg Duration</div>
                  <div className="eda-stat-val">{telemetry.avgDuration}</div>
                </div>
                <div className="eda-stat-box box-notifications">
                  <div className="eda-stat-label">Notifications</div>
                  <div className="eda-stat-val">{telemetry.notificationsSent}</div>
                </div>
                <div className="eda-stat-box box-dlq">
                  <div className="eda-stat-label">DLQ Count</div>
                  <div className="eda-stat-val">{telemetry.dlqCount}</div>
                </div>
              </div>

              <div className="eda-bindings-section">
                <div className="eda-bindings-header">Subscriber Topic Bindings</div>
                <div className="eda-bindings-grid">
                  {Object.entries(telemetry.subscriberBindings || {}).map(([topic, count]) => (
                    <div key={topic} className="eda-binding-item">
                      <span className="eda-binding-topic">{topic}</span>
                      <span className="eda-binding-badge">
                        {count} {count === 1 ? 'listener' : 'listeners'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="eda-architecture-note">
                <div className="eda-note-heading">How It Works: Decoupled Architecture</div>
                <ol className="eda-note-list">
                  <li>
                    <strong>1. Non-Blocking Ingestion:</strong> API routes save essential data and emit events (<code>eventBus.publish()</code>) before instantly returning <code>201 Created</code> or <code>202 Accepted</code> to the client.
                  </li>
                  <li>
                    <strong>2. Decoupled Subscribers:</strong> Audit Logging (<code>ActivityLog</code>), Notifications (Email/Webhook), and In-Memory Cache Invalidation process concurrently in the background.
                  </li>
                  <li>
                    <strong>3. Fault Isolation:</strong> If a downstream notification worker fails, the primary API request and remaining workers remain completely unaffected.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
