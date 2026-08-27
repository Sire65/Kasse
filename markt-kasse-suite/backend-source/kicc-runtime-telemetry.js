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
    this.authorization = process.env.KICC_PROGRAM_HEARTBEAT_AUTHORIZATION || '';
    this.apikey = process.env.KICC_PROGRAM_HEARTBEAT_APIKEY || '';
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
    const headers = { 'content-type': 'application/json', accept: 'application/json', authorization: this.authorization };
    if (this.apikey) headers.apikey = this.apikey;
    const started = performance.now();
    const response = await fetch(this.endpoint, { method: 'POST', headers, body: JSON.stringify(env) });
    if (!response.ok) throw new Error(`KICC heartbeat HTTP ${response.status}`);
    this.state.latencyMs = performance.now() - started;
    this.state.trafficTx = Number(this.state.trafficTx || 0) + 1;
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
