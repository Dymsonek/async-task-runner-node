const express = require('express');
const { runSequential, runParallel, runParallelLimit } = require('./runner');
const { buildTasksFromSpec, loadTasks } = require('./tasks');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/run', async (req, res) => {
  let { mode = 'sequential', limit = 2, tasks: tasksSpec, failFast = false } = req.body || {};
  if (!['sequential', 'parallel', 'parallelLimit'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  if (mode === 'parallelLimit') {
    limit = parseInt(limit, 10);
    if (!Number.isInteger(limit) || limit <= 0) {
      return res.status(400).json({ error: 'limit must be a positive integer' });
    }
  }

  const taskList = tasksSpec ? buildTasksFromSpec(tasksSpec) : loadTasks();

  try {
    let summary;
    if (mode === 'sequential') {
      summary = await runSequential(taskList, { failFast });
    } else if (mode === 'parallel') {
      summary = await runParallel(taskList, { failFast });
    } else if (mode === 'parallelLimit') {
      summary = await runParallelLimit(taskList, limit, { failFast });
    }
    res.json({ status: 'completed', ...summary });
  } catch (err) {
    const payload = { error: err.message };
    if (err.summary) payload.summary = err.summary;
    res.status(500).json(payload);
  }
});

app.listen(PORT, () => console.log(`Task runner listening on port ${PORT}`));
