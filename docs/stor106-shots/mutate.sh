#!/usr/bin/env bash
# STOR-106 mutation check (r:7f8cd4dc): bẻ từng dòng được bảo vệ (logo, src, alt, TVN, cuộn, chuyển động, lọc),
# chạy test mới (phải ĐỎ), khôi phục từ bản sao (không dùng git checkout vì thay đổi chưa commit), chạy lại (phải XANH).
# Ra: docs/stor106-shots/mutation.log. Chạy từ gốc repo. Thoát khác 0 nếu có đột biến sống sót hoặc bản gốc không xanh.
set -u
H=src/components/Header.tsx; P=src/features/home/HomePage.tsx; LOGO=public/topvnsport-logo.webp
D=docs/stor106-shots; LOG=$D/mutation.log; T=src/__tests__/stor106_logo_pill_scroll.test.tsx
TMP=$(mktemp -d); cp $H $TMP/H; cp $P $TMP/P; cp $LOGO $TMP/logo
CDN='https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp'
: > $LOG; red=0; survived=0; notgreen=0
run(){ npx vitest run --config ./vitest.config.ts $T 2>&1 | grep -E "^ +Tests +[0-9]|^ +(×|✗)|FAIL " | head -12; }
restore(){ cp $TMP/H $H; cp $TMP/P $P; cp $TMP/logo $LOGO; }
check(){ # $1 = tên; chạy bản đột biến rồi bản khôi phục, ghi log
  { echo "=== MUTATION: $1"; echo "--- mutated:"; } >> $LOG
  out=$(run); echo "$out" >> $LOG
  if echo "$out" | grep -q "failed"; then red=$((red+1)); echo "=> RED (đúng mong đợi)" >> $LOG; else survived=$((survived+1)); echo "=> SURVIVED (SAI: test vẫn xanh)" >> $LOG; fi
  restore; echo "--- reverted:" >> $LOG
  out=$(run); echo "$out" >> $LOG
  if echo "$out" | grep -q "failed" || ! echo "$out" | grep -q "passed"; then notgreen=$((notgreen+1)); echo "=> KHÔNG XANH (SAI)" >> $LOG; else echo "=> GREEN (đúng mong đợi)" >> $LOG; fi
  echo >> $LOG; }
mut(){ name="$1"; f="$2"
  python3 -c 'import sys;p=sys.argv[1];s=open(p).read();a,b=sys.argv[2],sys.argv[3];assert s.count(a)==1,("không khớp đúng 1 lần",a);open(p,"w").write(s.replace(a,b))' "$f" "$3" "$4" || { echo "mutation '$name' không áp dụng được"; exit 2; }
  { echo; diff $TMP/$([ "$f" = "$H" ] && echo H || echo P) $f | grep '^[<>]'; } > $TMP/diff; { echo "=== DIFF: $name"; cat $TMP/diff; } >> $LOG
  check "$name"; }

DESK='<img src={LOGO_SRC} alt="TopVNSport Logo" className="w-[44px] h-[44px] rounded-[6px] object-cover shrink-0" />'
MOB='<img src={LOGO_SRC} alt="TopVNSport Logo" className="inline-block w-6 h-6 rounded-md object-cover align-middle mr-1.5" />'
DRW='<img src={LOGO_SRC} alt="TopVNSport Logo" className="w-7 h-7 rounded-md object-cover border border-gray-200 bg-white" />'
# logo: bỏ ảnh ở từng chỗ
mut "logo desktop bị xóa" $H "$DESK" ''
mut "logo mobile bị xóa" $H "$MOB" ''
mut "logo ngăn kéo bị xóa" $H "$DRW" ''
# alt sai ở từng chỗ
mut "alt desktop = Logo" $H "$DESK" "${DESK/alt=\"TopVNSport Logo\"/alt=\"Logo\"}"
mut "alt mobile = Logo" $H "$MOB" "${MOB/alt=\"TopVNSport Logo\"/alt=\"Logo\"}"
mut "alt ngăn kéo = Logo" $H "$DRW" "${DRW/alt=\"TopVNSport Logo\"/alt=\"Logo\"}"
# src: CDN Shopee ở từng chỗ
mut "src desktop = CDN Shopee" $H "$DESK" "${DESK/src=\{LOGO_SRC\}/src=\"$CDN\"}"
mut "src mobile = CDN Shopee" $H "$MOB" "${MOB/src=\{LOGO_SRC\}/src=\"$CDN\"}"
mut "src ngăn kéo = CDN Shopee" $H "$DRW" "${DRW/src=\{LOGO_SRC\}/src=\"$CDN\"}"
mut "hằng LOGO_SRC = CDN Shopee" $H "const LOGO_SRC = '/topvnsport-logo.webp';" "const LOGO_SRC = '$CDN';"
mut "ô chữ TVN quay lại" $H "$DESK" '<div className="w-[44px] h-[44px] shrink-0">TVN</div>'
# file logo biến mất
{ echo "=== MUTATION: file public/topvnsport-logo.webp bị xóa"; echo "--- mutated:"; } >> $LOG
rm $LOGO; out=$(run); echo "$out" >> $LOG
if echo "$out" | grep -q "failed"; then red=$((red+1)); echo "=> RED (đúng mong đợi)" >> $LOG; else survived=$((survived+1)); echo "=> SURVIVED (SAI)" >> $LOG; fi
restore; echo "--- reverted:" >> $LOG; out=$(run); echo "$out" >> $LOG
if echo "$out" | grep -q "failed"; then notgreen=$((notgreen+1)); echo "=> KHÔNG XANH (SAI)" >> $LOG; else echo "=> GREEN (đúng mong đợi)" >> $LOG; fi; echo >> $LOG
# cuộn / chuyển động / lọc
mut "không gọi scrollIntoView" $P "    shelfRef.current!.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });" "    void reduce;"
mut "cuộn nhầm phần tử (body)" $P "shelfRef.current!.scrollIntoView(" "document.body.scrollIntoView("
mut "nhánh giảm chuyển động bị đảo" $P "reduce ? 'auto' : 'smooth'" "reduce ? 'smooth' : 'auto'"
mut "luôn smooth (bỏ nhánh giảm chuyển động)" $P "behavior: reduce ? 'auto' : 'smooth'" "behavior: 'smooth'"
mut "luôn auto (bỏ nhánh smooth)" $P "behavior: reduce ? 'auto' : 'smooth'" "behavior: 'auto'"
mut "hỏi sai media query" $P "'(prefers-reduced-motion: reduce)'" "'(prefers-reduced-motion: no-preference)'"
mut "bỏ setSelectedCategory" $P "    setSelectedCategory(code);
    const reduce" "    const reduce"
mut "onClick không nối pickCategory" $P "onClick={() => pickCategory(chip.code)}" "onClick={() => setSelectedCategory(chip.code)}"
mut "cuộn ngay khi tải trang" $P "<section ref={shelfRef} data-testid=\"instock-shelf\"" "<section ref={el => { shelfRef.current = el; el?.scrollIntoView(); }} data-testid=\"instock-shelf\""
restore
echo "TỔNG: $red đột biến ĐỎ, $survived sống sót, $notgreen lần khôi phục không xanh" | tee -a $LOG
rm -rf $TMP
[ $survived -eq 0 ] && [ $notgreen -eq 0 ]
