function now() { return Date.now(); }

function okResult(id, startedAt, finishedAt, value) {
  return { id, status: 'ok', startedAt, finishedAt, durationMs: finishedAt - startedAt, value };
}

function errResult(id, startedAt, finishedAt, error) {
  return { id, status: 'error', startedAt, finishedAt, durationMs: finishedAt - startedAt, error: error instanceof Error ? error.message : String(error) };
}

function summarize(mode, results, startedAt) {
  const finishedAt = now();
  const succeeded = results.filter(r => r.status === 'ok').length;
  const failed = results.length - succeeded;
  return { mode, totalMs: finishedAt - startedAt, succeeded, failed, results };
}

/**
 * Runs tasks sequentially with optional failFast behavior.
 * Each task is a function returning a Promise (optionally resolving to a value).
 */
async function runSequential(tasks, options = {}) {
  const { failFast = false } = options;
  const runStarted = now();
  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const startedAt = now();
    try {
      const value = await t();
      results.push(okResult(i + 1, startedAt, now(), value));
    } catch (err) {
      const r = errResult(i + 1, startedAt, now(), err);
      results.push(r);
      if (failFast) {
        // Return partial summary with error results so far
        const summary = summarize('sequential', results, runStarted);
        const e = new Error('Task failed (failFast)');
        e.summary = summary;
        throw e;
      }
    }
  }
  return summarize('sequential', results, runStarted);
}

/**
 * Runs tasks in parallel. If failFast is true, rejects on first error.
 */
async function runParallel(tasks, options = {}) {
  const { failFast = false } = options;
  const runStarted = now();

  if (failFast) {
    // Let Promise.all reject fast; then convert to structured error with partial info
    const startedAts = tasks.map(() => now());
    try {
      const values = await Promise.all(tasks.map((t, i) => t()));
      const results = values.map((v, i) => okResult(i + 1, startedAts[i], now(), v));
      return summarize('parallel', results, runStarted);
    } catch (err) {
      const results = tasks.map((_, i) => ({ id: i + 1, status: 'unknown' }));
      const summary = summarize('parallel', results, runStarted);
      const e = new Error('Task failed (failFast)');
      e.cause = err;
      e.summary = summary;
      throw e;
    }
  }

  const settled = await Promise.allSettled(tasks.map((t) => {
    const startedAt = now();
    return t().then(
      (v) => okResult(undefined, startedAt, now(), v),
      (e) => errResult(undefined, startedAt, now(), e)
    );
  }));

  // Assign ids by index for deterministic ordering
  const results = settled.map((res, i) => {
    const base = res.status === 'fulfilled' ? res.value : res.reason;
    // Ensure our assigned id overrides any id present in base
    return { ...base, id: i + 1 };
  });
  return summarize('parallel', results, runStarted);
}

/**
 * Runs tasks with a concurrency limit.
 */
async function runParallelLimit(tasks, limit, options = {}) {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer');
  const { failFast = false } = options;
  const runStarted = now();
  const results = new Array(tasks.length);

  let index = 0;
  let running = 0;
  let rejectEarly;
  const earlyFailure = failFast ? new Promise((_, reject) => { rejectEarly = reject; }) : null;
  let failed = false;

  return await new Promise(async (resolve, reject) => {
    const maybeDone = () => {
      if (index >= tasks.length && running === 0) {
        resolve(summarize('parallelLimit', results, runStarted));
      }
    };

    const runNext = () => {
      if (failed && failFast) return; // stop scheduling
      while (running < limit && index < tasks.length) {
        const i = index++;
        const startedAt = now();
        running++;
        Promise.resolve()
          .then(() => tasks[i]())
          .then((v) => { results[i] = okResult(i + 1, startedAt, now(), v); })
          .catch((e) => {
            results[i] = errResult(i + 1, startedAt, now(), e);
            if (failFast && !failed) {
              failed = true;
              rejectEarly && rejectEarly(e);
            }
          })
          .finally(() => {
            running--;
            if (!(failed && failFast)) runNext();
            maybeDone();
          });
      }
    };

    runNext();

    if (failFast && earlyFailure) {
      earlyFailure.catch((err) => {
        const e = new Error('Task failed (failFast)');
        e.cause = err;
        e.summary = summarize('parallelLimit', results.filter(Boolean), runStarted);
        reject(e);
      });
    }
  });
}

module.exports = { runSequential, runParallel, runParallelLimit };
