#!/usr/bin/env bash
# STOR-139: synthetic check of the 3 public API routes the storefront reads.
# One read-only GET per route (no auth, no secrets); prints one line per route:
#   <UTC time> <path> <status> <duration>s
# Exits non-zero if any route is not 200. A curl error or timeout (any non-zero
# curl exit) counts as a failure and is recorded as status 000.
# A 200 may be a CDN-cached copy (Vercel CDN, max-age=60 + stale-while-revalidate=300,
# see CDN_CACHE_CONTROL in api/_catalogProxy.ts), so this can lag an upstream outage.
# Env:
#   BASE_URL             default https://www.topvnsport.com
#   TIMEOUT              curl --max-time per route in seconds, default 15
#   RESULTS_FILE         route lines are appended here, default synthetic-results.txt
#   GITHUB_STEP_SUMMARY  if set (GitHub Actions), route lines are appended there too
set -u

BASE_URL=${BASE_URL:-https://www.topvnsport.com}
TIMEOUT=${TIMEOUT:-15}
RESULTS_FILE=${RESULTS_FILE:-synthetic-results.txt}
failed=0

for path in \
  '/api/pmi/public/products?page=1&limit=100' \
  /api/wms/public/stock \
  /api/pmi/public/voma-categories; do
  out=$(curl -sS -o /dev/null --max-time "$TIMEOUT" -w '%{http_code} %{time_total}' "$BASE_URL$path")
  rc=$?
  read -r status dur <<<"$out"
  [ "$rc" -ne 0 ] && status=000
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $path $status ${dur}s" |
    tee -a "$RESULTS_FILE" ${GITHUB_STEP_SUMMARY:+"$GITHUB_STEP_SUMMARY"}
  [ "$status" != 200 ] && failed=1
done
exit "$failed"
