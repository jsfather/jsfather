#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUTH_SECRET:?AUTH_SECRET is required}"
: "${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID is required}"
: "${GOOGLE_CLIENT_SECRET:?GOOGLE_CLIENT_SECRET is required}"
: "${AUTH_URL:?AUTH_URL is required; use your public HTTPS origin}"
node /app/migrate.cjs
exec node server.js
