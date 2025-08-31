const { runSequential, runParallel, runParallelLimit } = require('./runner');
const { buildTasksFromSpec, loadTasks } = require('./tasks');
const minimist = require('minimist');

(async () => {
  const argv = minimist(process.argv.slice(2));
  const mode = argv.mode || 'sequential';
  const limit = parseInt(argv.limit ?? 2, 10);
  const failFast = Boolean(argv.failFast || argv['fail-fast']);
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
      const summary = await runSequential(taskList, { failFast });
      console.log(JSON.stringify(summary, null, 2));
    } else if (mode === 'parallel') {
      const summary = await runParallel(taskList, { failFast });
      console.log(JSON.stringify(summary, null, 2));
    } else if (mode === 'parallelLimit') {
      if (!Number.isInteger(limit) || limit <= 0) {
        console.error('Error: --limit must be a positive integer');
        process.exit(1);
      }
      const summary = await runParallelLimit(taskList, limit, { failFast });
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
