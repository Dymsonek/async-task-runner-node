const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('..//server');
const skipHttp = process.env.ALLOW_HTTP_TESTS !== '1';

test('GET /health returns ok', { skip: skipHttp }, async (t) => {
  const app = createApp();
  let server;
  try {
    server = app.listen(0);
  } catch (e) {
    if (e && e.code === 'EPERM') { t.skip('listen not permitted'); return; }
    throw e;
  }
  await new Promise(r => server.once('listening', r));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.uptime === 'number');
    assert.ok(typeof body.pid === 'number');
    assert.ok(typeof body.version === 'string');
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('POST /run returns summary', { skip: skipHttp }, async (t) => {
  const app = createApp();
  let server;
  try {
    server = app.listen(0);
  } catch (e) {
    if (e && e.code === 'EPERM') { t.skip('listen not permitted'); return; }
    throw e;
  }
  await new Promise(r => server.once('listening', r));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const payload = { mode: 'parallel', tasks: { count: 3, min: 5, max: 10 } };
    const res = await fetch(`${base}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'completed');
    assert.equal(body.mode, 'parallel');
    assert.ok(Array.isArray(body.results));
    assert.equal(body.results.length, 3);
  } finally {
    await new Promise(r => server.close(r));
  }
});
