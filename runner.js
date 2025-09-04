function now() { return Date.now(); }

function withTimeout(fn, ms, id) {
  if (!Number.isFinite(ms) || ms <= 0) return fn;
  return () => new Promise((resolve, reject) => {
    let tid;
    const onTimeout = () => {
      const err = new Error(`Task ${id ?? '?'} timed out after ${ms} ms`);
      err.code = 'ETIMEDOUT';
      reject(err);
    };
    tid = setTimeout(onTimeout, ms);
    let p;
    try {
      p = Promise.resolve().then(() => fn());
    } catch (e) {
      clearTimeout(tid);
      reject(e);
      return;
    }
    p.then(
      (v) => { clearTimeout(tid); resolve(v); },
      (e) => { clearTimeout(tid); reject(e); }
    );
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function withRetry(fn, opts = {}, id) {
  const {
    retries = 0,
    retryDelayMs = 100,
    backoffFactor = 2,
    jitterRatio = 0.2,
  } = opts || {};
  return async () => {
    let attempt = 0;
    let delay = Math.max(0, Number(retryDelayMs) || 0);
    while (true) {
      attempt++;
      try {
        const v = await fn();
        return { __attempts: attempt, __value: v };
      } catch (e) {
        if (attempt > retries) {
          try { e.attempts = attempt; } catch (_) {}
          throw e;
        }
        const jr = Math.max(0, Math.min(1, Number(jitterRatio) || 0));
        const jitter = jr ? (Math.random() * 2 - 1) * jr * delay : 0; // +/- jr*delay
        const wait = Math.max(0, Math.floor(delay + jitter));
        await sleep(wait);
        delay = Math.max(0, Math.floor((Number(backoffFactor) || 1) * (delay || retryDelayMs || 0)));
      }
    }
  };
}

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
  const { failFast = false, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio } = options;
  const runStarted = now();
  const taskFns = Array.isArray(tasks)
    ? tasks.map((t, i) => withRetry(withTimeout(t, timeoutMs, i + 1), { retries, retryDelayMs, backoffFactor, jitterRatio }, i + 1))
    : tasks;
  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = taskFns[i];
    const startedAt = now();
    try {
      const out = await t();
      const value = out && Object.prototype.hasOwnProperty.call(out, '__value') ? out.__value : out;
      const attempts = out && Number.isInteger(out.__attempts) ? out.__attempts : 1;
      const r = okResult(i + 1, startedAt, now(), value);
      r.attempts = attempts;
      results.push(r);
    } catch (err) {
      const r = errResult(i + 1, startedAt, now(), err);
      if (Number.isInteger(err?.attempts)) r.attempts = err.attempts;
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
  const { failFast = false, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio } = options;
  const runStarted = now();
  const taskFns = Array.isArray(tasks)
    ? tasks.map((t, i) => withRetry(withTimeout(t, timeoutMs, i + 1), { retries, retryDelayMs, backoffFactor, jitterRatio }, i + 1))
    : tasks;

  if (failFast) {
    // Let Promise.all reject fast; then convert to structured error with partial info
    const startedAts = taskFns.map(() => now());
    try {
      const values = await Promise.all(taskFns.map((t) => t()));
      const results = values.map((out, i) => {
        const value = out && Object.prototype.hasOwnProperty.call(out, '__value') ? out.__value : out;
        const attempts = out && Number.isInteger(out.__attempts) ? out.__attempts : 1;
        const r = okResult(i + 1, startedAts[i], now(), value);
        r.attempts = attempts;
        return r;
      });
      return summarize('parallel', results, runStarted);
    } catch (err) {
      const results = taskFns.map((_, i) => ({ id: i + 1, status: 'unknown' }));
      const summary = summarize('parallel', results, runStarted);
      const e = new Error('Task failed (failFast)');
      e.cause = err;
      e.summary = summary;
      throw e;
    }
  }

  const settled = await Promise.allSettled(taskFns.map((t) => {
    const startedAt = now();
    return t().then(
      (out) => {
        const value = out && Object.prototype.hasOwnProperty.call(out, '__value') ? out.__value : out;
        const attempts = out && Number.isInteger(out.__attempts) ? out.__attempts : 1;
        const r = okResult(undefined, startedAt, now(), value);
        r.attempts = attempts;
        return r;
      },
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
  const { failFast = false, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio } = options;
  const runStarted = now();
  const results = new Array(tasks.length);
  const taskFns = tasks.map((t, i) => withRetry(withTimeout(t, timeoutMs, i + 1), { retries, retryDelayMs, backoffFactor, jitterRatio }, i + 1));

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
          .then(() => taskFns[i]())
          .then((out) => {
            const value = out && Object.prototype.hasOwnProperty.call(out, '__value') ? out.__value : out;
            const attempts = out && Number.isInteger(out.__attempts) ? out.__attempts : 1;
            const r = okResult(i + 1, startedAt, now(), value);
            r.attempts = attempts;
            results[i] = r;
          })
          .catch((e) => {
            const r = errResult(i + 1, startedAt, now(), e);
            if (Number.isInteger(e?.attempts)) r.attempts = e.attempts;
            results[i] = r;
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
