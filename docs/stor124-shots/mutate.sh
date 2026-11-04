#!/usr/bin/env bash
# STOR-124 mutation check (r:7f8cd4dc): remove the /stores link from Footer.tsx, run Footer.test (expect RED), restore, run again (expect GREEN).
# Output -> docs/stor124-shots/mutation.log. Run from the repo root.
set -u
D=docs/stor124-shots; LOG=$D/mutation.log; F=src/components/Footer.tsx; FT=src/__tests__/Footer.test.tsx
: > $LOG
run(){ npx vitest run --config ./vitest.config.ts $FT 2>&1 | grep -E "Tests +[0-9]|×" ; }
L='            <p className={TEXT}><Link to="/stores" className={LINK}>Cửa hàng trải nghiệm</Link></p>'
cp $F $D/.orig
python3 -c 'import sys;p,a=sys.argv[1],sys.argv[2]+"\n";s=open(p).read();assert s.count(a)==1,a;open(p,"w").write(s.replace(a,""))' $F "$L"
{ echo "=== MUTATION: remove the /stores link line ($F) -> $FT"; diff $D/.orig $F | grep '^[<>]'; echo "--- mutated:"; run
  cp $D/.orig $F; echo "--- reverted:"; run; } >> $LOG
rm $D/.orig
