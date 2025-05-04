async function runSequential(tasks) {
  for (const task of tasks) {
    await task();
  }
}

async function runParallel(tasks) {
  await Promise.all(tasks.map(task => task()));
}

async function runParallelLimit(tasks, limit) {
  let index = 0;
  let running = [];

  const enqueue = async () => {
    if (index >= tasks.length) return;

    const task = tasks[index++];
    const p = task().finally(() => {
      running.splice(running.indexOf(p), 1);
    });
    running.push(p)
    if (running.length >= limit) {
      await Promise.race(running);
    }
    await enqueue();
  }

  await enqueue();
  await Promise.all(running);
}

module.exports = { runSequential, runParallel, runParallelLimit }
