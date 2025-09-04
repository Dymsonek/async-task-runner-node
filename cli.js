const { runSequential, runParallel, runParallelLimit } = require('./runner');
const { buildTasksFromSpec, loadTasks } = require('./tasks');
const minimist = require('minimist');

(async () => {
  const argv = minimist(process.argv.slice(2));
  const mode = argv.mode || 'sequential';
  const limit = parseInt(argv.limit ?? 2, 10);
  const failFast = Boolean(argv.failFast || argv['fail-fast']);
  const timeoutMs = argv.timeoutMs !== undefined ? parseInt(argv.timeoutMs, 10)
                    : (argv.timeout !== undefined ? parseInt(argv.timeout, 10) : undefined);
  const retries = argv.retries !== undefined ? parseInt(argv.retries, 10) : undefined;
  const retryDelayMs = argv.retryDelayMs !== undefined ? parseInt(argv.retryDelayMs, 10)
                      : (argv.retryDelay !== undefined ? parseInt(argv.retryDelay, 10) : undefined);
  const backoffFactor = argv.backoffFactor !== undefined ? Number(argv.backoffFactor)
                        : (argv.backoff !== undefined ? Number(argv.backoff) : undefined);
  const jitterRatio = argv.jitterRatio !== undefined ? Number(argv.jitterRatio)
                      : (argv.jitter !== undefined ? Number(argv.jitter) : undefined);
  // Build tasks from CLI if provided: --tasks='[{"duration":500},{"duration":1000,"fail":true}]'
  let tasksSpec = argv.tasks;
  try {
    if (typeof tasksSpec === 'string') tasksSpec = JSON.parse(tasksSpec);
  } catch (_) {
    console.error('Invalid JSON for --tasks');
    process.exit(1);
  }
  const taskList = tasksSpec ? buildTasksFromSpec(tasksSpec) : loadTasks();

  try {
    if (mode === 'sequential') {
      const summary = await runSequential(taskList, { failFast, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio });
      console.log(JSON.stringify(summary, null, 2));
    } else if (mode === 'parallel') {
      const summary = await runParallel(taskList, { failFast, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio });
      console.log(JSON.stringify(summary, null, 2));
    } else if (mode === 'parallelLimit') {
      if (!Number.isInteger(limit) || limit <= 0) {
        console.error('Error: --limit must be a positive integer');
        process.exit(1);
      }
      const summary = await runParallelLimit(taskList, limit, { failFast, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio });
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.error('Invalid mode');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error running tasks:', err.message);
    if (err.summary) {
      console.error(JSON.stringify(err.summary, null, 2));
    }
    process.exit(1);
  }
})();
