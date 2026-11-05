#!/usr/bin/env bash
# STOR-161 mutation check (r:7f8cd4dc): for each NEW max-md: token on the brand checkbox line of CatalogPage.tsx,
# remove that one token, run the guarding test (expect RED), restore the file byte-for-byte, run again (expect GREEN).
# Output -> docs/stor161-shots/mutation.log. Run from the repo root: bash docs/stor161-shots/mutate.sh
set -u -o pipefail
D=docs/stor161-shots; LOG=$D/mutation.log; T=src/__tests__/stor161_filter_checkbox_touch.test.tsx
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
F=src/features/catalog/CatalogPage.tsx
L=$(grep -n 'focus:ring-brand-primary/40 max-md:w-11' "$F" | cut -d: -f1)
[ "$(echo "$L" | wc -w)" = 1 ] || { echo "checkbox line not unique" >> $LOG; exit 1; }
for TOK in max-md:w-11 max-md:h-11; do mut "$F" "$L" "$TOK"; done
awk '/^=== MUTATION/{n++; m=0} /^--- mutated:/{m=1; next} /^--- reverted:/{m=2; next} /^ +Tests +[0-9]/{ if(m==1){ if(/failed/) red++; else bad++ } if(m==2){ if(/failed/) bad++; else green++ } } END{bad+=2*n-red-green-bad; print "SUMMARY: " n " mutations, " red+0 " RED after mutation, " green+0 " GREEN after revert, " bad+0 " unexpected"; exit (bad>0)}' $LOG | tee -a $LOG
