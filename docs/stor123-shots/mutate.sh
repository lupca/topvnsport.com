#!/usr/bin/env bash
# STOR-123 mutation check (r:7f8cd4dc): apply each mutation to Footer.tsx, run the guarding test (expect RED), restore, run again (expect GREEN).
# Output -> docs/stor123-shots/mutation.log. Run from the repo root.
set -u
D=docs/stor123-shots; LOG=$D/mutation.log; F=src/components/Footer.tsx
FT=src/__tests__/Footer.test.tsx; NB=src/__tests__/stor112_khong_chu_noi_bo.test.tsx
: > $LOG
run(){ npx vitest run --config ./vitest.config.ts $1 2>&1 | grep -E "Tests +[0-9]|×" ; }
mut(){ name="$1"; t="$2"; shift 2; cp $F $D/.orig
  python3 -c 'import sys;p=sys.argv[1];s=open(p).read();a,b=sys.argv[2],sys.argv[3];assert s.count(a)==1,a;open(p,"w").write(s.replace(a,b))' $F "$@"
  { echo "=== MUTATION: $name ($F) -> $t"; diff $D/.orig $F | grep '^[<>]'; echo "--- mutated:"; run $t; cp $D/.orig $F; echo "--- reverted:"; run $t; echo; } >> $LOG
  rm $D/.orig; }
# Column 3 anchor: injected lines are not links, so only the text guards can catch them.
A='Cấu hình cước đan trực tuyến</Link></li>'
mut "internal word 'hệ thống'" $NB 'Đại lý uỷ quyền Yonex Sunrise.</p>' 'Đại lý uỷ quyền Yonex Sunrise.</p><p className={TEXT}>Hệ thống cửa hàng trải nghiệm</p>'
mut "placeholder phone 0981.234.567" $FT "$A" "$A<li>Tư vấn: 0981.234.567</li>"
mut "example.com" $FT "$A" "$A<li>www.example.com</li>"
mut "lorem" $FT "$A" "$A<li>Lorem ipsum dolor sit amet</li>"
mut "invented address line (ngõ)" $FT "$A" "$A<li>Số 12, ngõ 34, phố Mẫu, Quận Mẫu, Hà Nội</li>"
mut "second hotline" $FT "$A" "$A<li>Hotline 2: 0900 000 000</li>"
