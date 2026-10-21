#!/usr/bin/env bash
# End-to-end smoke test for the containerised stack.
# Usage: ./docker/smoke-test.sh [base_url]
set -uo pipefail

BASE="${1:-http://localhost:8080}"
API="${BASE}/api"
PASS=0; FAIL=0
ok()   { echo "  ✔ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✘ $1"; FAIL=$((FAIL+1)); }
check(){ [ "$1" = "$2" ] && ok "$3" || bad "$3 (expected $2, got $1)"; }

echo "▶ Target: $BASE"

# --- static SPA -----------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/")
check "$code" "200" "SPA index served"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/some/deep/route")
check "$code" "200" "SPA history fallback"

asset=$(curl -s --max-time 15 "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1)
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE$asset")
check "$code" "200" "hashed JS asset served"

# --- auth -----------------------------------------------------------------
EMAIL="smoke_$(date +%s)@taskmanager.io"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"SmokeTest123\"}")
check "$code" "201" "POST /api/auth/register"

TOKEN=$(curl -s --max-time 15 -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SmokeTest123\"}" \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token || ''")
[ -n "$TOKEN" ] && ok "POST /api/auth/login returns a JWT" || bad "POST /api/auth/login returns a JWT"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$API/auth/me" -H "Authorization: Bearer $TOKEN")
check "$code" "200" "GET /api/auth/me"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$API/tasks")
check "$code" "401" "GET /api/tasks without a token is rejected"

# --- tasks ----------------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$API/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke test task","description":"created by smoke-test.sh","priority":"high"}')
check "$code" "201" "POST /api/tasks"

TMP_BODY="$(mktemp)"
hdr1=$(curl -s -D - -o "$TMP_BODY" --max-time 15 "$API/tasks" -H "Authorization: Bearer $TOKEN")
TASK=$(node -pe "JSON.parse(require('fs').readFileSync('$TMP_BODY','utf8')).data[0]._id || ''" 2>/dev/null)
[ -n "$TASK" ] && ok "GET /api/tasks returns the created task" || bad "GET /api/tasks returns the created task"

# The very first read of the list must be a cache MISS, the next one a HIT.
echo "$hdr1" | grep -qi 'X-Cache: MISS' && ok "cache MISS on first read" || bad "cache MISS on first read"

hdr2=$(curl -s -D - -o /dev/null --max-time 15 "$API/tasks" -H "Authorization: Bearer $TOKEN")
echo "$hdr2" | grep -qi 'X-Cache: HIT'  && ok "cache HIT on second read" || bad "cache HIT on second read"
rm -f "$TMP_BODY"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X PUT "$API/tasks/$TASK" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"completed":true}')
check "$code" "200" "PUT /api/tasks/:id"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X DELETE "$API/tasks/$TASK" \
  -H "Authorization: Bearer $TOKEN")
check "$code" "200" "DELETE /api/tasks/:id"

# --- EDA ------------------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$API/eda/jobs" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"type":"export_tasks_csv"}')
check "$code" "202" "POST /api/eda/jobs returns 202 Accepted"

sse=$(timeout 5 curl -sN --max-time 5 "$API/eda/stream" | head -3)
echo "$sse" | grep -q 'STREAM_CONNECTED' && ok "GET /api/eda/stream (SSE) handshakes" || bad "GET /api/eda/stream (SSE) handshakes"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$API/eda/telemetry")
check "$code" "200" "GET /api/eda/telemetry"

# --- direct backend (bypassing nginx) -------------------------------------
DIRECT="${BACKEND_URL:-http://localhost:5000}"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$DIRECT/")
check "$code" "200" "backend reachable directly on $DIRECT"

echo
echo "───────────────────────────────"
echo "  PASSED: $PASS   FAILED: $FAIL"
echo "───────────────────────────────"
[ "$FAIL" -eq 0 ]
