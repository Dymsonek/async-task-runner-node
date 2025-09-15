// Tests for runner.js using Node's built-in test framework
const test = require('node:test');
const assert = require('node:assert/strict');

const { runSequential, runParallel, runParallelLimit } = require('..//runner');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Helper to create a task that records concurrency
function makeTask(duration, stats, shouldFail = false) {
  return async () => {
    stats.current++;
    stats.max = Math.max(stats.max, stats.current);
    await sleep(duration);
    stats.current--;
    if (shouldFail) throw new Error('boom');
    return duration;
  };
}

test('sequential runs tasks one by one', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = [makeTask(30, stats), makeTask(20, stats), makeTask(10, stats)];
  const summary = await runSequential(tasks);
  assert.equal(summary.succeeded, 3);
  assert.equal(summary.failed, 0);
  assert.equal(stats.max, 1);
});

test('parallel runs tasks concurrently', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = [makeTask(40, stats), makeTask(40, stats), makeTask(40, stats)];
  const start = Date.now();
  const summary = await runParallel(tasks);
  const elapsed = Date.now() - start;
  assert.equal(summary.succeeded, 3);
  assert.ok(elapsed < 100 + 40, 'should be close to the longest task, not sum');
  assert.ok(stats.max >= 2);
});

test('parallel assigns stable sequential ids', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = [makeTask(10, stats), makeTask(5, stats), makeTask(1, stats)];
  const summary = await runParallel(tasks);
  const ids = summary.results.map(r => r.id);
  assert.deepEqual(ids, [1, 2, 3]);
});

test('parallel failFast rejects early', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = [makeTask(10, stats), makeTask(5, stats, true), makeTask(1, stats)];
  await assert.rejects(() => runParallel(tasks, { failFast: true }));
});

test('parallelLimit enforces limit', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = Array.from({ length: 6 }, () => makeTask(30, stats));
  const summary = await runParallelLimit(tasks, 2);
  assert.equal(summary.succeeded, 6);
  assert.equal(stats.max, 2);
});

test('failFast stops early in parallelLimit', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = [makeTask(10, stats), makeTask(10, stats, true), makeTask(10, stats)];
  await assert.rejects(() => runParallelLimit(tasks, 2, { failFast: true }));
});

test('timeout marks long task as error (parallel)', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = [makeTask(30, stats), makeTask(120, stats), makeTask(40, stats)];
  const summary = await runParallel(tasks, { timeoutMs: 60 });
  assert.equal(summary.failed, 1);
  const errs = summary.results.filter(r => r.status === 'error');
  assert.equal(errs.length, 1);
  assert.match(errs[0].error, /timed out/i);
});

test('timeout works in sequential without failing others', async () => {
  const stats = { current: 0, max: 0 };
  const tasks = [makeTask(30, stats), makeTask(100, stats), makeTask(20, stats)];
  const summary = await runSequential(tasks, { timeoutMs: 50, failFast: false });
  assert.equal(summary.succeeded, 2);
  assert.equal(summary.failed, 1);
});

// Helpers for retry testing
function flakyTask(failTimes, duration = 10) {
  let remaining = failTimes;
  return async () => {
    await sleep(duration);
    if (remaining > 0) {
      remaining--;
      throw new Error('boom');
    }
    return 'ok';
  };
}

test('retries eventually succeed and record attempts', async () => {
  const tasks = [flakyTask(2), flakyTask(0), flakyTask(1)];
  const t0 = Date.now();
  const summary = await runParallel(tasks, { retries: 2, retryDelayMs: 10, backoffFactor: 2, jitterRatio: 0 });
  const elapsed = Date.now() - t0;
  assert.equal(summary.failed, 0);
  const attempts = summary.results.map(r => r.attempts);
  assert.deepEqual(attempts, [3, 1, 2]);
  assert.ok(elapsed >= 10 + 20, 'backoff delays applied cumulatively');
});

test('exhausted retries yield error and attempts counted', async () => {
  const tasks = [flakyTask(3)];
  const summary = await runSequential(tasks, { retries: 1, retryDelayMs: 5, backoffFactor: 2, jitterRatio: 0, failFast: false });
  assert.equal(summary.failed, 1);
  assert.equal(summary.results[0].attempts, 2);
});
