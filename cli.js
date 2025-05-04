const { runSequential, runParallel, runParallelLimit } = require('./runner');
const tasks = require('./tasks');
const minimist = require('minimist');

(async () => {
  const argv = minimist(process.argv.slice(2));
  const mode = argv.mode || 'sequential';
  const limit = parseInt(argv.limit || 2, 10);
  const taskList = tasks.loadTasks();

  try {
    if (mode === 'sequential') {
      await runSequential(taskList);
    } else if (mode === 'parallel') {
      await runParallel(taskList);
    } else if (mode === 'parallelLimit') {
      await runParallelLimit(taskList, limit);
    } else {
      console.error('Invalid mode');
      process.exit(1);
    }
    console.log(`Tasks completed in '${mode}' mode.`);
  } catch (err) {
    console.error('Error running tasks:', err);
    process.exit(1);
  }
})();
