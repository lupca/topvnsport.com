#!/usr/bin/env bash
# STOR-139: runs scripts/synthetic-check.sh against a local stub server.
# One stub serves every mode; the mode is the first path segment, passed via BASE_URL:
#   ok      all routes 200
#   fail503 stock route answers 503
#   slow    stock route sleeps 5s before sending headers (script TIMEOUT=2)
#   stall   stock route sends 200 headers + 10 of 1000 body bytes, then sleeps 5s
set -u
SCRIPT="$(dirname "$0")/synthetic-check.sh"
TMP=$(mktemp -d)

STUB='
import sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        _, mode, rest = self.path.split("/", 2)
        stock = ("/" + rest).split("?")[0] == "/api/wms/public/stock"
        if stock and mode == "slow":
            time.sleep(5)
        if stock and mode == "fail503":
            self.send_response(503); self.send_header("Content-Length", "0"); self.end_headers(); return
        if stock and mode == "stall":
            self.send_response(200); self.send_header("Content-Length", "1000"); self.end_headers()
            self.wfile.write(b"x" * 10); self.wfile.flush(); time.sleep(5); return
        self.send_response(200); self.send_header("Content-Length", "2"); self.end_headers()
        self.wfile.write(b"{}")

s = ThreadingHTTPServer(("127.0.0.1", 0), H)
s.daemon_threads = True
open(sys.argv[1], "w").write(str(s.server_port))
s.serve_forever()
'
python3 -c "$STUB" "$TMP/port" &
PID=$!
trap 'kill "$PID" 2>/dev/null; rm -rf "$TMP"' EXIT
for _ in $(seq 50); do [ -s "$TMP/port" ] && break; sleep 0.1; done
port=$(cat "$TMP/port")

fails=0
check() { if "${@:2}"; then echo "PASS $1"; else echo "FAIL $1"; fails=1; fi; }
run() {
  : >"$TMP/results"; : >"$TMP/summary"
  BASE_URL="http://127.0.0.1:$port/$1" TIMEOUT=2 RESULTS_FILE="$TMP/results" \
    GITHUB_STEP_SUMMARY="$TMP/summary" bash "$SCRIPT" >/dev/null 2>&1
  rc=$?
  echo "-- $1 (exit $rc)"; sed 's/^/   /' "$TMP/results"
}

run ok
check "ok: exit 0" [ "$rc" -eq 0 ]
check "ok: 3 route lines with 200" [ "$(grep -c ' 200 ' "$TMP/results")" -eq 3 ]
run fail503
check "fail503: exit non-zero" [ "$rc" -ne 0 ]
check "fail503: summary has stock 503" grep -qF '/api/wms/public/stock 503 ' "$TMP/summary"
run slow
check "slow: exit non-zero" [ "$rc" -ne 0 ]
check "slow: results have stock 000" grep -qF '/api/wms/public/stock 000 ' "$TMP/results"
run stall
check "stall: exit non-zero" [ "$rc" -ne 0 ]
check "stall: results have stock 000" grep -qF '/api/wms/public/stock 000 ' "$TMP/results"

[ "$fails" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fails"
