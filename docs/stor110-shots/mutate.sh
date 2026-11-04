#!/usr/bin/env bash
# STOR-110 mutation check (r:7f8cd4dc): apply each mutation, run stor013 (expect RED), restore, run again (expect GREEN).
# Output -> docs/stor110-shots/mutation.log. Run from the repo root.
set -u
D=docs/stor110-shots; LOG=$D/mutation.log; T=src/__tests__/stor013_promo_banner.test.tsx
S=src/features/home/SaleSection.tsx; H=src/features/home/HomePage.tsx
: > $LOG
run(){ npx vitest run --config ./vitest.config.ts $T 2>&1 | grep -E "Tests +[0-9]|×" ; }
mut(){ name="$1"; f="$2"; shift 2; cp $f $D/.orig
  python3 -c 'import sys;p=sys.argv[1];s=open(p).read();a,b=sys.argv[2],sys.argv[3];assert s.count(a)==1,a;open(p,"w").write(s.replace(a,b))' $f "$@"
  { echo "=== MUTATION: $name ($f)"; diff $D/.orig $f | grep '^[<>]'; echo "--- mutated:"; run; cp $D/.orig $f; echo "--- reverted:"; run; echo; } >> $LOG
  rm $D/.orig; }
mut "filter removed" $S 'const list = getPromotedInStock(products);' 'const list = products;'
mut "slice added" $S 'const list = getPromotedInStock(products);' 'const list = getPromotedInStock(products).slice(0, 4);'
mut "re-sorted (reverse)" $S 'const list = getPromotedInStock(products);' 'const list = getPromotedInStock(products).reverse();'
mut "empty guard dropped" $S '  if (list.length === 0) return null;
' ''
mut "max -> min" $S 'Math.max(' 'Math.min('
mut "badge >0 guard dropped" $S '{Number.isFinite(max) && max > 0 && (' '{Number.isFinite(max) && ('
mut "badge isFinite guard dropped" $S '{Number.isFinite(max) && max > 0 && (' '{max > 0 && ('
mut "rendered on productsError" $H 'return <HomeLoadState error={productsError} onRetry={() => dispatch(fetchAppData())} />;' 'return <><SaleSection products={products} onQuickView={() => {}} onAddToCart={() => {}} /><HomeLoadState error={productsError} onRetry={() => dispatch(fetchAppData())} /></>;'
