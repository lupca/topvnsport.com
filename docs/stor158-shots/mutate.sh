#!/usr/bin/env bash
# STOR-158 mutation check (r:7f8cd4dc): for EVERY max-md: token of CatalogFilterDrawer.tsx, on its own line,
# remove that one token, run the guarding test (expect RED), restore the file byte-for-byte, run again (expect GREEN).
# Output -> docs/stor158-shots/mutation.log. Run from the repo root: bash docs/stor158-shots/mutate.sh
set -u -o pipefail
D=docs/stor158-shots; LOG=$D/mutation.log; T=src/__tests__/stor158_filter_drawer_mobile.test.tsx
BK=$(mktemp -d); trap 'rm -rf "$BK"' EXIT
: > $LOG
run(){ npx vitest run --config ./vitest.config.ts $T 2>&1 | grep -E "Tests +[0-9]|×" ; }
# mut <file> <line> <token>: removes " <token>" from that line (the line must contain it exactly once).
mut(){
  F="$1"; L="$2"; TOK="$3"; cp "$F" "$BK/orig"
  python3 - "$F" "$L" "$TOK" <<'PY'
import sys
p, ln, tok = sys.argv[1], int(sys.argv[2]), sys.argv[3]
lines = open(p, encoding='utf-8').read().split('\n')
line = lines[ln - 1]
import re
hits = [m.start() for m in re.finditer(r' ' + re.escape(tok) + r'(?=[ "`\s]|$)', line)]
assert len(hits) == 1, (ln, tok, len(hits))
i = hits[0]
lines[ln - 1] = line[:i] + line[i + len(tok) + 1:]
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
PY
  { echo "=== MUTATION: $F:$L remove $TOK"; diff "$BK/orig" "$F" | grep '^[<>]'; echo "--- mutated:"; run; cp "$BK/orig" "$F"; echo "--- reverted:"; run; echo; } >> $LOG
  cmp -s "$BK/orig" "$F" || { echo "RESTORE FAILED $F" >> $LOG; exit 1; }
}
for F in src/features/catalog/CatalogFilterDrawer.tsx; do
  while IFS=: read -r L REST; do
    for TOK in $(echo "$REST" | grep -o 'max-md:[^ "`]*'); do mut "$F" "$L" "$TOK"; done
  done < <(grep -n 'max-md:' "$F")
done
awk '/^=== MUTATION/{n++; m=0} /^--- mutated:/{m=1; next} /^--- reverted:/{m=2; next} /^ +Tests +[0-9]/{ if(m==1){ if(/failed/) red++; else bad++ } if(m==2){ if(/failed/) bad++; else green++ } } END{bad+=2*n-red-green-bad; print "SUMMARY: " n " mutations, " red+0 " RED after mutation, " green+0 " GREEN after revert, " bad+0 " unexpected"; exit (bad>0)}' $LOG | tee -a $LOG
