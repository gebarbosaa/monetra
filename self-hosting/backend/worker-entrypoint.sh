#!/bin/sh
set -e

export MONETRA_ROLE=worker
exec node --enable-source-maps /app/packages/backend/dist/worker.js
