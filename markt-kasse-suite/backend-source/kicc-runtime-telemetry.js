'use strict';

const os = require('os');
const crypto = require('crypto');

class KiccRuntimeTelemetry {
  constructor({ programId, name, version = null, build = null, intervalMs = 30000 } = {}) {
    if (!programId) throw new Error('programId required');
    this.programId = programId;
    this.name = name || programId;
    this.version = version;
    this.build = build;
    this.intervalMs = Math.max(10000, Number(intervalMs) || 30000);
    this.endpoint = process.env.KICC_PROGRAM_HEARTBEAT_ENDPOINT || '';
    this.flowEndpoint = process.env.KICC_PROGRAM_FLOW_ENDPOINT || '';
    this.authorization = process.env.KICC_PROGRAM_HEARTBEAT_AUTHORIZATION || process.env.KICC_PROGRAM_FLOW_AUTHORIZATION || '';
    this.flowAuthorization = process.env.KICC_PROGRAM_FLOW_AUTHORIZATION || this.authorization;
    this.apikey = process.env.KICC_PROGRAM_HEARTBEAT_APIKEY || process.env.KICC_PROGRAM_FLOW_APIKEY || '';
    this.flowApikey = process.env.KICC_PROGRAM_FLOW_APIKEY || this.apikey;
    this.instanceId = process.env.KICC_INSTANCE_ID || `${os.hostname()}-${process.pid}`;
    this.startedAt = new Date().toISOString();
    this.timer = null;
    this.state = { status: 'ONLINE', errorCount: 0, trafficTx: 0, trafficRx: 0, queueDepth: null, latencyMs: null, message: 'Prozess aktiv' };
  }

  update(patch = {}) {
    Object.assign(this.state, patch);
  }

  heartbeat() {
    return {
      schema: 'kicc.program-heartbeat.v1',
      programId: this.programId,
      instanceId: this.instanceId,
      name: this.name,
      deviceType: 'DESKTOP_SERVICE',
      version: this.version,
      build: this.build,
      status: this.state.status || 'ONLINE',
      measuredAt: new Date().toISOString(),
      latencyMs: Number.isFinite(this.state.latencyMs) ? Math.round(this.state.latencyMs) : null,
      trafficRx: Number.isFinite(this.state.trafficRx) ? this.state.trafficRx : null,
      trafficTx: Number.isFinite(this.state.trafficTx) ? this.state.trafficTx : null,
      queueDepth: Number.isFinite(this.state.queueDepth) ? this.state.queueDepth : null,
      errorCount: Number(this.state.errorCount || 0),
      source: 'KASSE_COMPANION',
      trust: 'SELF_REPORTED',
      message: String(this.state.message || 'Prozess aktiv').slice(0, 240)
    };
  }

  headers(auth = this.authorization, apikey = this.apikey) {
    const headers = { 'content-type': 'application/json', accept: 'application/json', authorization: auth };
    if (apikey) headers.apikey = apikey;
    return headers;
  }

  async send() {
    if (!this.endpoint || !/^https:\/\//i.test(this.endpoint)) return { sent: false, reason: 'REMOTE_NOT_CONFIGURED' };
    if (!this.authorization) return { sent: false, reason: 'AUTH_REQUIRED' };
    const env = {
      schema: 'kicc.remote-program-heartbeat.v1',
      nonce: crypto.randomUUID(),
      sentAt: new Date().toISOString(),
      authState: 'AUTHENTICATED',
      sourceId: this.instanceId,
      heartbeat: this.heartbeat()
    };
    const started = performance.now();
    const response = await fetch(this.endpoint, { method: 'POST', headers: this.headers(), body: JSON.stringify(env) });
    if (!response.ok) throw new Error(`KICC heartbeat HTTP ${response.status}`);
    this.state.latencyMs = performance.now() - started;
    this.state.trafficTx = Number(this.state.trafficTx || 0) + 1;
    return { sent: true, latencyMs: this.state.latencyMs };
  }

  async sendFlow({ sourceId, targetId, flowType = 'OTHER', status = 'OK', eventCount = null, byteCount = null } = {}) {
    if (!this.flowEndpoint || !/^https:\/\//i.test(this.flowEndpoint)) return { sent: false, reason: 'FLOW_NOT_CONFIGURED' };
    if (!this.flowAuthorization) return { sent: false, reason: 'AUTH_REQUIRED' };
    if (!sourceId || !targetId) return { sent: false, reason: 'MISSING_ROUTE' };
    const payload = {
      programId: this.programId,
      instanceId: this.instanceId,
      sourceId: String(sourceId).slice(0, 160),
      targetId: String(targetId).slice(0, 160),
      flowType: String(flowType || 'OTHER').toUpperCase().slice(0, 40),
      eventCount: Number.isFinite(eventCount) && eventCount >= 0 ? Math.round(eventCount) : null,
      byteCount: Number.isFinite(byteCount) && byteCount >= 0 ? Math.round(byteCount) : null,
      status: String(status || 'UNKNOWN').toUpperCase().slice(0, 30),
      measuredAt: new Date().toISOString(),
      nonce: crypto.randomUUID()
    };
    const started = performance.now();
    const response = await fetch(this.flowEndpoint, { method: 'POST', headers: this.headers(this.flowAuthorization, this.flowApikey), body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`KICC flow HTTP ${response.status}`);
    this.state.latencyMs = performance.now() - started;
    return { sent: true, latencyMs: this.state.latencyMs };
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    const tick = () => this.send().catch(err => {
      this.state.errorCount = Number(this.state.errorCount || 0) + 1;
      this.state.status = 'DEGRADED';
      this.state.message = `KICC: ${err.message}`;
    });
    setTimeout(tick, 1500);
    this.timer = setInterval(tick, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { KiccRuntimeTelemetry };
