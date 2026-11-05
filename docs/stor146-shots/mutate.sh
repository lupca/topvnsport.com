#!/usr/bin/env bash
# STOR-146 mutation check (r:7f8cd4dc), copied from docs/stor148-shots/mutate.sh: remove each guarded class from each
# guarded element, one at a time, run the guarding test (expect RED), restore, run it again (expect GREEN). Two live
# mutations run docs/stor146-shots/measure.cjs instead. Output -> docs/stor146-shots/mutation.log. Run from the repo root.
#   mut  <name> <file> <anchor> <class>            the anchor (count==1 in the file) loses " <class>"
#   sub  <name> <file> <anchor> <replacement>      the anchor (count==1) becomes <replacement>
#   live <name> <file> <anchor> <class> <regex>    like mut, but runs measure.cjs: expect exit 1 and a line matching <regex>
set -u
D=docs/stor146-shots; LOG=$D/mutation.log; T=src/__tests__/stor146_pdp_mobile_tap_text.test.tsx
: > $LOG
run(){ npx vitest run --config ./vitest.config.ts $T 2>&1 | grep -E "Tests +[0-9]|×" ; }
apply(){ python3 -c 'import sys;p,a,b=sys.argv[1:];s=open(p).read();assert s.count(a)==1,a;open(p,"w").write(s.replace(a,b))' "$@"; }
drop(){ python3 -c 'import sys;a,c=sys.argv[1:];assert a.count(" "+c)==1,c;print(a.replace(" "+c,""),end="")' "$1" "$2"; }
sub(){ name="$1"; F="$2"; cp $F $D/.orig; apply $F "$3" "$4" || { cp $D/.orig $F; rm $D/.orig; echo "BAD ANCHOR: $name" | tee -a $LOG; return; }
  { echo "=== MUTATION: $name ($F)"; diff $D/.orig $F | grep '^[<>]'; echo "--- mutated:"; run; cp $D/.orig $F; echo "--- reverted:"; run; echo; } >> $LOG
  rm $D/.orig; }
mut(){ r=$(drop "$3" "$4") || { echo "BAD ANCHOR: $1 $4" | tee -a $LOG; return; }; sub "$1: remove $4" "$2" "$3" "$r"; }
measure(){ node $D/measure.cjs 2>&1; }
live(){ name="$1: remove $4 (live measure.cjs)"; F="$2"; r=$(drop "$3" "$4") || { echo "BAD ANCHOR: $1 $4" | tee -a $LOG; return; }
  cp $F $D/.orig; apply $F "$3" "$r" || { cp $D/.orig $F; rm $D/.orig; echo "BAD ANCHOR: $name" | tee -a $LOG; return; }
  { echo "=== LIVE MUTATION: $name ($F)"; diff $D/.orig $F | grep '^[<>]'; echo "--- mutated:"
    out=$(measure); rc=$?; m=$(echo "$out" | grep -E "$5" | head -3); [ -n "$m" ] && echo "$m" || echo "UNEXPECTED: no line matches $5"; echo "measure exit=$rc"
    cp $D/.orig $F; echo "--- reverted:"
    out=$(measure); rc=$?; echo "$out" | grep -E "^pdp-racket:(details|tech) 390 |failure"; echo "measure exit=$rc"; echo; } >> $LOG
  rm $D/.orig; }

P=src/components/product-detail/ProductPurchaseSection.tsx
mut "back button" $P 'font-medium mb-6 transition max-md:min-h-[44px]"' 'max-md:min-h-[44px]'
mut "brand pill" $P 'shadow-xs max-md:text-sm">' 'max-md:text-sm'
mut "badge pill" $P 'bg-purple-600 text-white font-extrabold uppercase px-2 py-0.5 rounded-sm max-md:text-sm">' 'max-md:text-sm'
mut "characteristics pill" $P 'border-yellow-400 max-md:text-sm">' 'max-md:text-sm'
mut "'Giá bán hiện tại'" $P 'font-bold max-md:text-sm">Giá bán' 'max-md:text-sm'
mut "discount pill" $P 'rounded-full max-md:text-sm">' 'max-md:text-sm'
mut "tier label" $P 'mb-1.5 max-md:text-sm">{tier.name}' 'max-md:text-sm'
TIER='relative text-xs px-3.5 py-2 rounded-lg border font-bold transition max-md:min-h-[44px] max-md:min-w-[44px] max-md:text-sm ${'
for c in 'max-md:min-h-[44px]' 'max-md:min-w-[44px]' 'max-md:text-sm'; do mut "tier option button" $P "$TIER" "$c"; done
HET='font-bold max-md:static max-md:inline-block max-md:ml-1.5 max-md:text-sm">'
for c in 'max-md:static' 'max-md:inline-block' 'max-md:ml-1.5' 'max-md:text-sm'; do mut "'Hết' badge" $P "$HET" "$c"; done
mut "colour label" $P 'mb-1.5 max-md:text-sm">Phối màu' 'max-md:text-sm'
mut "colour row" $P '"flex gap-2 max-md:flex-wrap">' 'max-md:flex-wrap'
COL='`text-xs px-3.5 py-2 rounded-lg border font-bold transition max-md:min-h-[44px] max-md:min-w-[44px] max-md:text-sm ${'
for c in 'max-md:min-h-[44px]' 'max-md:min-w-[44px]' 'max-md:text-sm'; do mut "colour button" $P "$COL" "$c"; done
for c in 'max-md:min-h-[44px]' 'max-md:text-sm'; do
  mut "add-to-cart CTA" $P 'shadow-sm transition max-md:min-h-[44px] max-md:text-sm ${' "$c"
  mut "stores CTA" $P 'justify-center gap-2 max-md:min-h-[44px] max-md:text-sm"' "$c"
done

S=src/components/product-detail/StringingAssistant.tsx
mut "stringing caption" $S 'text-gray-400 max-md:text-sm">Chọn cước' 'max-md:text-sm'
TOG='cursor-pointer max-md:min-h-[44px] max-md:min-w-[44px] max-md:justify-center">'
for c in 'max-md:min-h-[44px]' 'max-md:min-w-[44px]' 'max-md:justify-center'; do mut "toggle label" $S "$TOG" "$c"; done
mut "toggle track" $S 'peer-checked:bg-brand-primary max-md:relative"' 'max-md:relative'
mut "'Bước 1' label" $S 'text-gray-500 max-md:text-sm">Bước 1' 'max-md:text-sm'
mut "string row" $S 'items-center max-md:min-h-[44px] ${' 'max-md:min-h-[44px]'
mut "string name" $S 'text-gray-900 max-md:text-sm">{optionName}' 'max-md:text-sm'
mut "string metadata" $S 'font-mono max-md:text-sm">{metadata}' 'max-md:text-sm'
mut "string price" $S 'text-xs font-extrabold text-brand-primary max-md:text-sm">' 'max-md:text-sm'
mut "'Bước 2' label" $S 'text-gray-500 max-md:text-sm">Bước 2' 'max-md:text-sm'
RNG='appearance-none max-md:h-11 max-md:py-[19px] max-md:bg-clip-content"'
for c in 'max-md:h-11' 'max-md:py-[19px]' 'max-md:bg-clip-content'; do mut "tension range" $S "$RNG" "$c"; done
TICK='px-1 max-md:text-sm max-md:flex-wrap max-md:gap-x-2">'
for c in 'max-md:text-sm' 'max-md:flex-wrap' 'max-md:gap-x-2'; do mut "tension ticks" $S "$TICK" "$c"; done
mut "tension tooltip" $S 'gap-2 max-md:text-sm">' 'max-md:text-sm'

T2=src/components/product-detail/ProductDetailTabs.tsx
mut "tab button" $T2 'shrink-0 text-sm font-bold max-md:min-h-[44px] uppercase' 'max-md:min-h-[44px]'
sub "tab button: text-sm back to text-xs md:text-sm" $T2 'shrink-0 text-sm font-bold' 'shrink-0 text-xs md:text-sm font-bold'
mut "'Điểm nổi bật'" $T2 'text-brand-primary max-md:text-sm">Điểm' 'max-md:text-sm'
mut "details spec heading" $T2 'mb-4 text-brand-primary max-md:text-sm">' 'max-md:text-sm'
mut "details spec rows" $T2 'font-mono max-md:text-sm">' 'max-md:text-sm'
for g in 'Trọng lượng' 'Điểm Cân Bằng' 'Độ Cứng Thân' 'Sức Căng Khung'; do mut "gauge label $g" $T2 "uppercase max-md:text-sm\">$g" 'max-md:text-sm'; done
mut "gauge caption weight" $T2 'text-gray-400 max-md:text-sm">{product.specs.weight}' 'max-md:text-sm'
mut "gauge caption balance" $T2 $'text-gray-400 max-md:text-sm">\n                      {product.specs.balance > 295' 'max-md:text-sm'
mut "gauge caption stiffness" $T2 'text-gray-400 max-md:text-sm">{product.specs.stiffness}' 'max-md:text-sm'
mut "gauge caption tension" $T2 $'text-gray-400 max-md:text-sm">\n                      {`Lên tới' 'max-md:text-sm'
mut "stiffness gauge word" $T2 'truncate leading-none max-md:text-sm">' 'max-md:text-sm'
mut "attribute table head" $T2 'text-xs uppercase max-md:text-sm">' 'max-md:text-sm'
mut "technology name" $T2 'block w-max mb-2 max-md:text-sm">' 'max-md:text-sm'
mut "technology description" $T2 'leading-normal max-md:text-sm">' 'max-md:text-sm'

live "'Hết' badge" $P "$HET" 'max-md:static' 'hetInside=no'
live "stiffness gauge word" $T2 'truncate leading-none max-md:text-sm">' 'max-md:text-sm' '^pdp-racket:tech [0-9]+ targets=[0-9]+ text=[1-9]'

awk '/^--- mutated:/{m=1;next} /^--- reverted:/{m=0;next}
  /^ +Tests +[0-9]/{ if(m){ if(/failed/) red++; else bad++ } else { if(/failed/) bad++; else green++ } }
  /^measure exit=/{ if(m){ if(/=1$/) red++; else bad++ } else { if(/=0$/) green++; else bad++ } }
  /^UNEXPECTED|^BAD ANCHOR/{bad++} /^=== /{n++}
  END{print "SUMMARY: " n " mutations, " red+0 " RED after mutation, " green+0 " GREEN after revert, " bad+0 " unexpected"}' $LOG | tee -a $LOG
