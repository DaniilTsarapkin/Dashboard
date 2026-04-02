#!/bin/bash

cleanup() {
  kill $BACKEND_PID 2>/dev/null
  exit 0
}

trap cleanup INT TERM

cd "$(dirname "$0")"

uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

cd frontend && npm run dev &
FRONTEND_PID=$!

wait
