import { EventEmitter } from 'events';

/**
 * Event-Driven Architecture (EDA) - Centralized In-Process Pub/Sub Event Bus
 * 
 * Provides decoupled asynchronous communication between route handlers,
 * background workers, telemetry collectors, and real-time SSE streams.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow unlimited listeners for high-cardinality subscribers
    this.setMaxListeners(50);

    // Telemetry and Metrics State
    this.totalEmitted = 0;
    this.totalDurationMs = 0;
    this.notificationsSent = 0;
    this.dlqCount = 0;

    // In-memory bounded event history buffer (last 100 events)
    this.eventHistory = [];

    // Map of topic name to array of subscriber descriptor objects
    this.subscriberRegistry = new Map();

    // Connected Server-Sent Events (SSE) clients
    this.sseClients = new Set();
  }

  /**
   * Subscribe a named handler to an event topic
   */
  subscribe(topic, handler, handlerName = 'anonymous_subscriber') {
    if (!this.subscriberRegistry.has(topic)) {
      this.subscriberRegistry.set(topic, []);
    }
    this.subscriberRegistry.get(topic).push(handlerName);
    this.on(topic, handler);
  }

  /**
   * Publish an event to all subscribers, measure latency, buffer history,
   * and broadcast over SSE.
   */
  async publish(topic, payload = {}, actor = 'System') {
    const startTime = performance.now();
    const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true });

    const event = {
      id: eventId,
      topic,
      payload,
      actor,
      timestamp,
      createdAt: new Date().toISOString()
    };

    // Buffer to in-memory history (keep latest 100)
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > 100) {
      this.eventHistory.pop();
    }

    // Broadcast in real-time to all connected SSE browser clients
    this.broadcastSSE(event);

    // Dispatch locally to registered in-process listeners
    try {
      this.emit(topic, event);
    } catch (err) {
      console.error(`[EventBus] Error executing subscriber for ${topic}:`, err);
    }

    const duration = performance.now() - startTime;
    this.totalEmitted += 1;
    this.totalDurationMs += duration;

    return event;
  }

  /**
   * Register an SSE client response stream
   */
  addSSEClient(res) {
    this.sseClients.add(res);
  }

  /**
   * Unregister an SSE client
   */
  removeSSEClient(res) {
    this.sseClients.delete(res);
  }

  /**
   * Broadcast an event payload to all SSE clients in standard SSE protocol format
   */
  broadcastSSE(event) {
    const dataString = JSON.stringify(event);
    const sseMessage = `id: ${event.id}\nevent: message\ndata: ${dataString}\n\n`;

    for (const client of this.sseClients) {
      try {
        client.write(sseMessage);
      } catch (err) {
        console.error('[EventBus] Error sending SSE to client, dropping:', err.message);
        this.sseClients.delete(client);
      }
    }
  }

  incrementNotifications() {
    this.notificationsSent += 1;
  }

  incrementDlq() {
    this.dlqCount += 1;
  }

  /**
   * Returns telemetry snapshot and topic-to-listener counts
   */
  getTelemetry() {
    const avgDuration = this.totalEmitted > 0
      ? (this.totalDurationMs / this.totalEmitted).toFixed(2)
      : '0.00';

    const subscriberBindings = {};
    for (const [topic, handlers] of this.subscriberRegistry.entries()) {
      subscriberBindings[topic.toUpperCase()] = handlers.length;
    }

    return {
      totalEmitted: this.totalEmitted,
      avgDuration: `${avgDuration} ms`,
      avgDurationMs: parseFloat(avgDuration),
      notificationsSent: this.notificationsSent,
      dlqCount: this.dlqCount,
      activeSseClients: this.sseClients.size,
      subscriberBindings
    };
  }

  getRecentEvents(limit = 20) {
    return this.eventHistory.slice(0, limit);
  }

  clearHistory() {
    this.eventHistory = [];
  }
}

const eventBus = new EventBus();
export default eventBus;
