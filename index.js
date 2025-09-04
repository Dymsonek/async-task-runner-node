const express = require('express');
const { runSequential, runParallel, runParallelLimit } = require('./runner');
const { buildTasksFromSpec, loadTasks } = require('./tasks');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

app.post('/run', async (req, res) => {
  let { mode = 'sequential', limit = 2, tasks: tasksSpec, failFast = false, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio } = req.body || {};
  if (!['sequential', 'parallel', 'parallelLimit'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  if (mode === 'parallelLimit') {
    limit = parseInt(limit, 10);
    if (!Number.isInteger(limit) || limit <= 0) {
      return res.status(400).json({ error: 'limit must be a positive integer' });
    }
  }
  if (timeoutMs !== undefined) {
    timeoutMs = parseInt(timeoutMs, 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      return res.status(400).json({ error: 'timeoutMs must be a positive integer' });
    }
  }
  if (retries !== undefined) {
    retries = parseInt(retries, 10);
    if (!Number.isInteger(retries) || retries < 0) {
      return res.status(400).json({ error: 'retries must be a non-negative integer' });
    }
  }
  if (retryDelayMs !== undefined) {
    retryDelayMs = parseInt(retryDelayMs, 10);
    if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0) {
      return res.status(400).json({ error: 'retryDelayMs must be a non-negative integer' });
    }
  }
  if (backoffFactor !== undefined) {
    backoffFactor = Number(backoffFactor);
    if (!Number.isFinite(backoffFactor) || backoffFactor < 1) {
      return res.status(400).json({ error: 'backoffFactor must be a number >= 1' });
    }
  }
  if (jitterRatio !== undefined) {
    jitterRatio = Number(jitterRatio);
    if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) {
      return res.status(400).json({ error: 'jitterRatio must be between 0 and 1' });
    }
  }

  const taskList = tasksSpec ? buildTasksFromSpec(tasksSpec) : loadTasks();

  try {
    let summary;
    if (mode === 'sequential') {
      summary = await runSequential(taskList, { failFast, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio });
    } else if (mode === 'parallel') {
      summary = await runParallel(taskList, { failFast, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio });
    } else if (mode === 'parallelLimit') {
      summary = await runParallelLimit(taskList, limit, { failFast, timeoutMs, retries, retryDelayMs, backoffFactor, jitterRatio });
    }
    res.json({ status: 'completed', ...summary });
  } catch (err) {
    const payload = { error: err.message };
    if (err.summary) payload.summary = err.summary;
    res.status(500).json(payload);
  }
});

app.listen(PORT, () => console.log(`Task runner listening on port ${PORT}`));
