#!/usr/bin/env bash
# STOR-100 mutation check (r:7f8cd4dc): apply each mutation to Header.tsx, run the stor100 test (expect RED),
# restore, run again (expect GREEN). Output -> docs/stor100-shots/mutation.log. Run from the repo root.
set -u
H=src/components/Header.tsx; O=docs/stor100-shots/.orig; LOG=docs/stor100-shots/mutation.log
T=src/__tests__/stor100_home_mobile_showroom_strip.test.tsx
cp $H $O; : > $LOG
run(){ npx vitest run --config ./vitest.config.ts $T 2>&1 | grep -E "Tests +[0-9]|×" ; }
mut(){ name="$1"; shift
  python3 -c 'import sys;p=sys.argv[1];s=open(p).read();a,b=sys.argv[2],sys.argv[3];assert s.count(a)==1,a;open(p,"w").write(s.replace(a,b))' $H "$@"
  { echo "=== MUTATION: $name"; diff $O $H | grep '^[<>]'; echo "--- mutated:"; run; cp $O $H; echo "--- reverted:"; run; echo; } >> $LOG; }
mut "strip text changed" $'>\n        Đan vợt chuẩn quốc tế 30p' $'>\n        Đan vợt chuẩn quốc tế 30 phút'
mut "home padding dropped" "'py-[7px] px-[10px]' : 'py-1.5 px-3'" "'py-1.5 px-3' : 'py-1.5 px-3'"
mut "md:hidden dropped" 'className={`md:hidden bg-ink-primary text-white text-center text-[11.5px]' 'className={`bg-ink-primary text-white text-center text-[11.5px]'
mut "home padding on non-home routes" "'py-[7px] px-[10px]' : 'py-1.5 px-3'" "'py-[7px] px-[10px]' : 'py-[7px] px-[10px]'"
mut "live-dot injected in strip" $'>\n        Đan vợt chuẩn quốc tế 30p' $'>\n        <span className="live-dot" />Đan vợt chuẩn quốc tế 30p'
mut "'mở cửa' injected in header (top bar)" $'Hotline: 097 6007006\n            </a>' $'Hotline: 097 6007006\n            </a>\n            <span className="hidden">Showroom mở cửa</span>'
rm $O
