const express = require('express');
const bodyParser = require('body-parser');
const { runSequential, runParallel, runParallelLimit } = require('./runner');
const tasks = require('./tasks');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.post('/run', async (req, res) => {
  const { mode = 'sequential', limit = 2 } = req.body;
  const taskList = tasks.loadTasks();

  try {
    if (mode === 'sequential') {
      await runSequential(taskList);
    } else if (mode === 'parallel') {
      await runParallel(taskList);
    } else if (mode === 'parallelLimit') {
      await runParallelLimit(taskList, limit);
    } else {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    res.json({ status: 'completed', mode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Task runner listening on port ${PORT}`));
