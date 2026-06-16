#!/usr/bin/env bash
# Run Spring Boot against CockroachDB (cloud) using credentials from apps/backend-java/.env.local.
# .env.local is gitignored — never commit your credentials.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/apps/backend-java/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example and fill in your CockroachDB credentials." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$ROOT_DIR/apps/backend-java"
exec ./mvnw spring-boot:run "$@"
