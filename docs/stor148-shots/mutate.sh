#!/usr/bin/env bash
# STOR-148 mutation check (r:7f8cd4dc): remove each guarded max-md: class from each guarded element, one at a time,
# run the guarding test (expect RED), restore, run it again (expect GREEN). Output -> docs/stor148-shots/mutation.log.
# Run from the repo root. mut <name> <file> <anchor> <class>: the anchor (count==1 in the file) loses " <class>".
set -u
D=docs/stor148-shots; LOG=$D/mutation.log; T=src/__tests__/stor148_mobile_target_text.test.tsx
: > $LOG
run(){ npx vitest run --config ./vitest.config.ts $T 2>&1 | grep -E "Tests +[0-9]|×" ; }
mut(){ name="$1"; F="$2"; cp $F $D/.orig
  python3 -c 'import sys;p,a,c=sys.argv[1:];s=open(p).read();assert s.count(a)==1,a;assert a.count(" "+c)==1,c;open(p,"w").write(s.replace(a,a.replace(" "+c,"")))' $F "$3" "$4"
  { echo "=== MUTATION: $name: remove $4 ($F)"; diff $D/.orig $F | grep '^[<>]'; echo "--- mutated:"; run; cp $D/.orig $F; echo "--- reverted:"; run; echo; } >> $LOG
  rm $D/.orig; }

C=src/features/checkout/CheckoutCallbackPage.tsx
BTN='py-3 rounded-xl flex items-center justify-center gap-2 max-md:min-h-[44px] max-md:text-sm"'
S_BTN=$'navigate(\'/\')}\n              className="w-full btn-primary text-xs uppercase tracking-wider '"$BTN"
C_BTN=$'              onClick={() => navigate(\'/catalog\')}\n              className="w-full btn-primary text-xs uppercase tracking-wider '"$BTN"
E_BTN=$'            onClick={() => navigate(\'/catalog\')}\n            className="w-full btn-primary text-xs uppercase tracking-wider '"$BTN"
for c in 'max-md:min-h-[44px]' 'max-md:text-sm'; do
  mut "success button" $C "$S_BTN" "$c"
  mut "cancel button" $C "$C_BTN" "$c"
  mut "error button" $C "$E_BTN" "$c"
done
mut "success order box" $C 'text-gray-700 break-all max-md:text-sm">' 'max-md:text-sm'
mut "cancel order box" $C $'text-gray-700 max-md:text-sm">\n              Mã đơn hàng: <strong className="text-gray-900">' 'max-md:text-sm'
mut "error order box" $C $'text-gray-700 max-md:text-sm">\n            Mã đơn hàng: <strong className="text-rose-600">' 'max-md:text-sm'

S=src/components/StoreLocator.tsx
for c in 'max-md:min-h-[44px]' 'max-md:text-sm'; do
  mut "Chỉ đường link" $S 'border border-white/40 hover:bg-white/10 text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 transition max-md:min-h-[44px] max-md:text-sm"' "$c"
  mut "Gọi điện link (header)" $S 'bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 transition max-md:min-h-[44px] max-md:text-sm"' "$c"
  mut "contact tel link" $S 'rounded-full items-center gap-1.5 transition max-md:min-h-[44px] max-md:text-sm"' "$c"
done
mut "O2O badge" $S 'uppercase tracking-widest max-md:text-sm">' 'max-md:text-sm'
mut "Bản doanh line" $S 'mb-3 font-medium max-md:text-sm">' 'max-md:text-sm'
mut "Hà Nội chip" $S 'border-brand-primary font-bold max-md:text-sm">' 'max-md:text-sm'
mut "branch address" $S 'text-gray-500 mt-1 max-md:text-sm">' 'max-md:text-sm'
mut "branch meta row" $S 'font-mono max-md:text-[14px]">' 'max-md:text-[14px]'
mut "ĐANG CHỌN tag" $S 'tracking-wider max-md:text-[14px]">ĐANG' 'max-md:text-[14px]'
mut "contact paragraph" $S 'text-gray-400 mb-4 max-md:text-sm">' 'max-md:text-sm'

F=src/components/Footer.tsx
mut "Footer TEXT" $F "font-medium text-zinc-200 max-md:text-[14px]';" 'max-md:text-[14px]'
L='hover:underline max-md:inline-flex max-md:items-center max-md:min-h-[44px]`;'
for c in 'max-md:inline-flex' 'max-md:items-center' 'max-md:min-h-[44px]'; do mut "Footer LINK" $F "$L" "$c"; done

mut "TrustBadges description" src/components/TrustBadges.tsx 'font-medium max-md:text-[14px]">' 'max-md:text-[14px]'

A='hover:underline max-md:inline-flex max-md:items-center max-md:min-h-[44px]">Về trang chủ'
for c in 'max-md:inline-flex' 'max-md:items-center' 'max-md:min-h-[44px]'; do mut "404 Về trang chủ" src/App.tsx "$A" "$c"; done

awk '/^--- mutated:/{m=1;next} /^--- reverted:/{m=0;next} /^ +Tests +[0-9]/{ if(m){ if(/failed/) red++; else bad++ } else { if(/failed/) bad++; else green++ } } /^=== MUTATION/{n++} END{print "SUMMARY: " n " mutations, " red " RED after mutation, " green " GREEN after revert, " bad+0 " unexpected"}' $LOG | tee -a $LOG
