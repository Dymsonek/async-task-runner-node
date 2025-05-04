function createTask(id, duration = 1000) {
  return () => new Promise(resolve => {
    console.log(`Task ${id} started`);
    setTimeout(() => {
      console.log(`Task ${id} finished`);
      resolve();
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

module.exports = { loadTasks };
