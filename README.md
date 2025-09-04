# Async Task Runner

A simple Node.js project that demonstrates asynchronous control flow patterns (sequential, parallel, and parallelLimit) with structured results, optional fail-fast behavior, and configurable tasks. No external runtime deps beyond Express for the API and minimist for CLI.

## Features

- Run tasks sequentially, in parallel, or with a limited number of parallel tasks
- Task execution available via REST API or CLI
- Optional per-task timeout (`timeoutMs`) across all modes
- Retries with exponential backoff and jitter (`retries`, `retryDelayMs`, `backoffFactor`, `jitterRatio`)

## Installation

```bash
npm install
```

## Run via API

Start the server:
```bash
npm start
```

Send a POST request:
```bash
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"mode":"parallelLimit", "limit":2, "failFast":false, "timeoutMs":300, "retries":2, "retryDelayMs":100, "backoffFactor":2, "jitterRatio":0.2}'
```

You can also provide custom tasks:

Durations array:
```bash
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"mode":"parallel", "tasks":[{"duration":300},{"duration":500,"fail":true}]}'
```

Generator spec:
```bash
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"mode":"parallelLimit","limit":3, "tasks": {"count":10, "min":50, "max":200, "failAt":[3,7]}, "failFast": true}'
```

## Run via CLI

```bash
node cli.js --mode=parallelLimit --limit=2 --failFast
```

Provide tasks as JSON:
```bash
node cli.js --mode=parallel --tasks='[{"duration":200},{"duration":400,"fail":true}]'
```

Add a timeout for each task:
```bash
node cli.js --mode=parallel --timeoutMs=150
# alias: --timeout=150
```

Enable retries with backoff and jitter:
```bash
node cli.js --mode=parallelLimit --limit=3 \
  --retries=2 --retryDelay=100 --backoff=2 --jitter=0.2
```

## UI

- Start server: `npm start`
- Open `http://localhost:3000/` in your browser
- Configure mode, limit, failFast, and tasks (via generator or JSON)
- Click Run to see a JSON summary and a simple Gantt-like timeline of task execution

## Modes

- `sequential` – Run tasks one by one
- `parallel` – Run all tasks at the same time
- `parallelLimit` – Limit the number of concurrent tasks

## Output

Both API and CLI return a structured summary object:

{
  "mode": "parallelLimit",
  "totalMs": 1234,
  "succeeded": 3,
  "failed": 1,
  "results": [
    { "id": 1, "status": "ok", "startedAt": 1710000000000, "finishedAt": 1710000000500, "durationMs": 500 },
    { "id": 2, "status": "error", "startedAt": ..., "finishedAt": ..., "durationMs": 120, "error": "Task 2 failed" }
  ]
}

If a task exceeds `timeoutMs`, it is marked as an error with `error: "Task N timed out after X ms"`.

If a task fails and `retries > 0`, it will be retried up to `retries` additional attempts. Delays grow by `retryDelayMs * backoffFactor^n` with optional +/- `jitterRatio` randomness. Each result includes `attempts` indicating how many tries were made.

## Testing

Run tests:

```
npm test
```

This uses Node's built-in test runner (`node --test`) when available, and falls back to a minimal test harness in `tests/run-all.js`.
