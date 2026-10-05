#!/usr/bin/env bash
set -euo pipefail
target="${1:?Pass the existing Cypher project path}"
release="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="$(realpath "$target")"
test "$target" = /home/ubuntu/Cypher || { echo 'Expected /home/ubuntu/Cypher'; exit 1; }
test -f "$target/docker-compose.yml"
test -f "$release/release-files.txt"
mkdir -p "$target/.backups"
backup="$(mktemp -d "$target/.backups/simulation-XXXXXXXX")"
echo "Source backup: $backup"
while IFS= read -r file; do
  case "$file" in /*|*..*|.env|.git/*) echo "Unexpected release path: $file"; exit 1;; esac
  test -f "$release/$file"
  if test -f "$target/$file"; then
    mkdir -p "$backup/$(dirname "$file")"
    cp -p "$target/$file" "$backup/$file"
  fi
  mkdir -p "$target/$(dirname "$file")"
  cp "$release/$file" "$target/$file"
done < "$release/release-files.txt"
cd "$target"
docker compose config --quiet
for service in gateway ai-engine frontend; do
  docker image tag "cypher-$service:latest" "cypher-$service:before-simulation"
done
echo 'Stopping optional services to free memory. Their data volumes are retained.'
docker compose --profile observability --profile reporting stop grafana prometheus reporting
echo 'Compiling the gateway. The existing app stays up during builds.'
COMPOSE_PARALLEL_LIMIT=1 docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml build gateway
COMPOSE_PARALLEL_LIMIT=1 docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml build ai-engine
COMPOSE_PARALLEL_LIMIT=1 docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml build frontend
echo 'Applying the non-destructive priority and event-id migration.'
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/002_simulation.sql
docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml up -d --no-build postgres gateway ai-engine frontend
echo 'Waiting for the frontend and AI health routes.'
for attempt in $(seq 1 36); do
  if curl -fsS --max-time 4 http://127.0.0.1:3000/ai/health; then break; fi
  if test "$attempt" = 36; then docker compose logs --tail=40 gateway ai-engine frontend; exit 1; fi
  sleep 5
done
docker compose ps
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}'
df -h /
echo "Deployment complete. Source backup: $backup"
