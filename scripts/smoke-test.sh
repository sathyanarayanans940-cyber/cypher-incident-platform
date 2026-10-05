#!/usr/bin/env bash
set -euo pipefail

echo "Checking Cypher services..."
curl --fail --silent http://localhost:8081/actuator/health >/dev/null
curl --fail --silent http://localhost:5000/health >/dev/null
curl --fail --silent http://localhost:5001/health >/dev/null

login_response=$(curl --fail --silent -H 'Content-Type: application/json' \
  -d '{"email":"admin@cypher.local","password":"changeme"}' \
  http://localhost:8081/api/auth/login)
token=$(printf '%s' "$login_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

curl --fail --silent -H "Authorization: Bearer $token" http://localhost:8081/api/dashboard/stats
printf '\nCypher smoke test passed.\n'
