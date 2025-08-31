// Fallback mini test runner if node --test is unavailable
const assert = require('node:assert/strict');
const { runSequential, runParallel, runParallelLimit } = require('..//runner');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function main() {
  let passed = 0, failed = 0;
  async function run(name, fn) {
    try { await fn(); console.log(`✓ ${name}`); passed++; }
    catch (e) { console.error(`✗ ${name}:`, e.message); failed++; }
  }

  await run('sequential one by one', async () => {
    const stats = { current: 0, max: 0 };
    const tasks = [makeTask(10, stats), makeTask(10, stats), makeTask(10, stats)];
    const summary = await runSequential(tasks);
    assert.equal(summary.succeeded, 3);
    assert.equal(stats.max, 1);
  });

  await run('parallel concurrent', async () => {
    const stats = { current: 0, max: 0 };
    const tasks = [makeTask(20, stats), makeTask(20, stats), makeTask(20, stats)];
    const t0 = Date.now();
    const summary = await runParallel(tasks);
    const elapsed = Date.now() - t0;
    assert.equal(summary.succeeded, 3);
    assert.ok(elapsed < 70);
    assert.ok(stats.max >= 2);
  });

  await run('parallelLimit enforces limit', async () => {
    const stats = { current: 0, max: 0 };
    const tasks = Array.from({ length: 5 }, () => makeTask(10, stats));
    const summary = await runParallelLimit(tasks, 2);
    assert.equal(summary.succeeded, 5);
    assert.equal(stats.max, 2);
  });

  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  if (failed) process.exit(1);
}

main();

