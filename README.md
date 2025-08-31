# Async Task Runner

A simple Node.js project that demonstrates asynchronous control flow patterns (sequential, parallel, and parallelLimit) with structured results, optional fail-fast behavior, and configurable tasks. No external runtime deps beyond Express for the API and minimist for CLI.

## Features

- Run tasks sequentially, in parallel, or with a limited number of parallel tasks
- Task execution available via REST API or CLI

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
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"mode":"parallelLimit", "limit":2, "failFast":false}'

You can also provide custom tasks:

Durations array:
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"mode":"parallel", "tasks":[{"duration":300},{"duration":500,"fail":true}]}'

Generator spec:
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"mode":"parallelLimit","limit":3, "tasks": {"count":10, "min":50, "max":200, "failAt":[3,7]}, "failFast": true}'
```

## Run via CLI

```bash
node cli.js --mode=parallelLimit --limit=2 --failFast

Provide tasks as JSON:
node cli.js --mode=parallel --tasks='[{"duration":200},{"duration":400,"fail":true}]'

## UI

- Start server: `npm start`
- Open `http://localhost:3000/` in your browser
- Configure mode, limit, failFast, and tasks (via generator or JSON)
- Click Run to see a JSON summary and a simple Gantt-like timeline of task execution
```

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

## Testing

Run tests:

```
npm test
```

This uses Node's built-in test runner (`node --test`) when available, and falls back to a minimal test harness in `tests/run-all.js`.
