function createTask(id, duration = 1000, shouldFail = false) {
  return () => new Promise((resolve, reject) => {
    const startedAt = Date.now();
    console.log(`Task ${id} started`);
    setTimeout(() => {
      const finishedAt = Date.now();
      if (shouldFail) {
        console.log(`Task ${id} failed`);
        return reject(new Error(`Task ${id} failed`));
      }
      console.log(`Task ${id} finished`);
      resolve({ id, startedAt, finishedAt, durationMs: finishedAt - startedAt });
    }, duration);
  });
}

function loadTasks() {
  return [
    createTask(1, 1000),
    createTask(2, 1500),
    createTask(3, 500),
    createTask(4, 2000),
  ];
}

function buildTasksFromSpec(spec) {
  if (!spec) return loadTasks();
  if (Array.isArray(spec)) {
    // Array of { id?, duration, fail? }
    return spec.map((t, idx) => createTask(t.id ?? idx + 1, Number(t.duration) || 0, Boolean(t.fail)));
  }
  const { count = 4, min = 200, max = 2000, failAt = [] } = spec;
  const tasks = [];
  const clamp = (n) => Math.max(0, Math.floor(n));
  for (let i = 1; i <= clamp(count); i++) {
    const d = clamp(min) + Math.floor(Math.random() * (clamp(max) - clamp(min) + 1));
    tasks.push(createTask(i, d, failAt.includes(i)));
  }
  return tasks;
}

module.exports = { loadTasks, createTask, buildTasksFromSpec };
