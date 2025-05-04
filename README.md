# Async Task Runner

A simple Node.js project that demonstrates asynchronous control flow patterns (sequential, parallel, and parallelLimit) using callbacks, promises, and async/await.

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
node index.js
```

Send a POST request:
```bash
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"mode":"parallelLimit", "limit":2}'
```

## Run via CLI

```bash
node cli.js --mode=parallelLimit --limit=2
```

## Modes

- `sequential` – Run tasks one by one
- `parallel` – Run all tasks at the same time
- `parallelLimit` – Limit the number of concurrent tasks

