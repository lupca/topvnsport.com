#!/usr/bin/env bash
# STOR-126 mutation check (r:7f8cd4dc): every whole-report guard in extract.cjs has its own RED and GREEN.
#   phone:           inject '- Hotline 2: 0912345678' into MISSING_FACTS -> exit 1 'selfcheck FAIL phone'; revert -> exit 0
#   email:           inject '- Email: a@b.vn'          into MISSING_FACTS -> exit 1 'selfcheck FAIL email';  revert -> exit 0
#   showroom-hours:  inject '- Showroom mở cửa 08:00-22:00' into MISSING_FACTS -> exit 1 'selfcheck FAIL showroom-hours'; revert -> exit 0
#   ours-measured:   OURS_URL=http://127.0.0.1:9/ -> exit 1 'selfcheck FAIL ours-measured'; same run without OURS_URL -> exit 0
# Each run is a full run (live competitor and topvnsport.com pages). The report sha256 must be unchanged after every RED run.
# Output -> scripts/stor125-footer-research/mutation.log. Run from the repo root. Kills nothing by name; the script kills its own dev server by PID.
set -u
D=scripts/stor125-footer-research; S=$D/extract.cjs; R=docs/stor125-footer-report.md; LOG=$D/mutation.log
TMP=$(mktemp -d); cp "$S" "$TMP/extract.orig"; cp "$R" "$TMP/report.orig"
: > "$LOG"; FAILS=0
sha(){ sha256sum "$1" | cut -d' ' -f1; }
# run <label> [VAR=val ...] -> full run; logs exit code, guard lines, report sha before/after; prints exit code on stdout
run(){
  local label=$1; shift
  local s0 s1 rc
  s0=$(sha "$R")
  env "$@" node "$S" > "$TMP/last.out" 2>&1; rc=$?
  s1=$(sha "$R")
  { echo "--- $label | env: ${*:-(none)} | exit=$rc"
    grep -E 'selfcheck|own footer|report not written|^wrote|dev server pid|killed dev server' "$TMP/last.out"
    echo "report sha256 before=$s0"; echo "report sha256 after =$s1 $([ "$s0" = "$s1" ] && echo '(unchanged)' || echo '(CHANGED)')"
  } >> "$LOG"
  echo "$rc"
}
expect(){ # expect <what> <want-exit> <got-exit> [grep-pattern]
  local what=$1 want=$2 got=$3 pat=${4:-}
  if [ "$got" = "$want" ] && { [ -z "$pat" ] || grep -q -- "$pat" "$TMP/last.out"; }; then echo "OK: $what (exit $got${pat:+, '$pat'})" >> "$LOG"
  else echo "UNEXPECTED: $what (exit $got, want $want${pat:+, '$pat'})" >> "$LOG"; FAILS=$((FAILS+1)); fi
}
mutate(){ # mutate <guard> <anchor line in MISSING_FACTS> <injected line>
  local guard=$1 anchor=$2 inj=$3 rc
  cp "$TMP/extract.orig" "$S"
  python3 -c 'import sys
p,a,i=sys.argv[1],sys.argv[2],sys.argv[3]
s=open(p,encoding="utf-8").read()
assert s.count(a)==1, ("anchor count", s.count(a))
open(p,"w",encoding="utf-8").write(s.replace(a, a+"\n"+i))' "$S" "$anchor" "$inj" || { echo "mutation $guard: anchor not unique" >> "$LOG"; FAILS=$((FAILS+1)); return; }
  { echo "=== MUTATION $guard: diff of $S"; diff "$TMP/extract.orig" "$S"; } >> "$LOG"
  rc=$(run "RED $guard (mutated)"); expect "RED $guard" 1 "$rc" "selfcheck FAIL $guard"
  cp "$TMP/extract.orig" "$S"; cmp -s "$TMP/extract.orig" "$S" && echo "reverted $S ($guard)" >> "$LOG"
  rc=$(run "GREEN $guard (reverted)"); expect "GREEN $guard" 0 "$rc"
}

mutate phone "  '- Email: chủ shop cần cung cấp'," "  '- Hotline 2: 0912345678',"
mutate email "  '- Email: chủ shop cần cung cấp'," "  '- Email: a@b.vn',"
mutate showroom-hours "  '- Link YouTube: chủ shop cần cung cấp'," "  '- Showroom mở cửa 08:00-22:00',"

rc=$(run "RED ours-measured (OURS_URL=http://127.0.0.1:9/)" OURS_URL=http://127.0.0.1:9/); expect "RED ours-measured" 1 "$rc" "selfcheck FAIL ours-measured"
rc=$(run "GREEN ours-measured (no OURS_URL)"); expect "GREEN ours-measured" 0 "$rc"

cmp -s "$TMP/extract.orig" "$S" && echo "final: $S identical to pre-mutation copy" >> "$LOG" || { echo "final: $S DIFFERS from pre-mutation copy" >> "$LOG"; FAILS=$((FAILS+1)); }
echo "SUMMARY: $([ $FAILS = 0 ] && echo 'all 8 expectations met' || echo "$FAILS unexpected")" >> "$LOG"
rm -rf "$TMP"
[ $FAILS = 0 ]
