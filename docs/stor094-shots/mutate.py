# STOR-094 mutation proof (r:7f8cd4dc): per token group, revert the group to its main value -> stor094 RED,
# restore -> stor094 GREEN. Usage from repo root: python3 docs/stor094-shots/mutate.py > docs/stor094-shots/mutation.log
import subprocess, sys

H = 'src/components/Header.tsx'
GROUPS = [
  ('topbar outer', H, [('text-[12px] font-semibold leading-[1.5] py-[8px] px-[24px]', 'text-xs font-semibold leading-[1.5] py-[7px] px-4 md:px-8')]),
  ('topbar inner', H, [('data-testid="topbar-inner" className="max-w-[1280px]', 'data-testid="topbar-inner" className="max-w-7xl')]),
  ('header row', H, [('max-w-7xl md:max-w-[1280px] mx-auto px-[16px] md:px-[24px] py-2 md:py-[16px]', 'max-w-7xl mx-auto px-[16px] md:px-6 lg:px-8 py-2 md:py-4'), ('gap-2 md:gap-[24px]', 'gap-2 md:gap-4')]),
  ('wordmark', H, [('font-display font-black text-[24px] tracking-[-0.03em] text-ink-primary block', 'font-display font-extrabold text-2xl tracking-tight text-gray-900 block')]),
  ('tagline', H, [('font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-secondary mt-[4px]', 'text-[9px] text-gray-400 tracking-widest uppercase font-semibold mt-0.5')]),
  ('search wrap', H, [('md:max-w-[540px] relative', 'md:max-w-xl relative')]),
  ('search box', H, [('border border-ink-primary md:border-[1.5px] rounded-full pl-3.5 pr-1.5 py-1 md:py-[8px] md:pl-[18px] md:pr-[14px] bg-white', 'border border-ink-primary rounded-full pl-3.5 pr-1.5 py-1 bg-white')]),
  ('search input', H, [('text-xs md:text-[14px] font-semibold', 'text-xs md:text-sm font-semibold')]),
  ('search button', H, [('text-xs md:text-[12px] md:leading-[normal] font-bold px-3 md:px-[12px] py-1.5 md:py-[6px]', 'text-xs font-bold px-3 py-1.5')]),
  ('pill copy', H, [('Showroom Hà Nội · Đan vợt lấy ngay 30p', 'Showroom Hà Nội: Đang mở cửa · Đan vợt lấy ngay 30p')]),
  ('live-dot', H, [('\n              Showroom Hà Nội', '\n              <span className="live-dot" />Showroom Hà Nội')]),
  ('placeholder', H, [('placeholder="Tìm vợt Yonex, Lining, cước đan, giày cầu lông..."', 'placeholder="Tìm vợt Astrox 77, Halbertec 9000, cước BG66 Ultimax, giày 4U..."')]),
  ('mobile tokens (row)', H, [('max-w-7xl md:max-w-[1280px] mx-auto px-[16px]', 'md:max-w-[1280px] mx-auto px-[12px]')]),
]
CMD = ['npx', 'vitest', 'run', 'src/__tests__/stor094_home_desktop_header_1440.test.tsx']

def run():
  r = subprocess.run(CMD, capture_output=True, text=True)
  out = r.stdout + r.stderr
  lines = [l for l in out.splitlines() if ' × ' in l or l.strip().startswith('Tests ')]
  return r.returncode, lines

bad = 0
for name, f, reps in GROUPS:
  orig = open(f, encoding='utf-8').read()
  s = orig
  for a, b in reps:
    assert s.count(a) == 1, (name, a)
    s = s.replace(a, b)
  open(f, 'w', encoding='utf-8').write(s)
  try:
    rc, lines = run()
  finally:
    open(f, 'w', encoding='utf-8').write(orig)
  print(f'## {name}: MUTATED -> {"RED" if rc else "GREEN (BAD)"}')
  for l in lines:
    print('   ', l.strip())
  rc2, lines2 = run()
  print(f'## {name}: REVERTED -> {"GREEN" if rc2 == 0 else "RED (BAD)"}')
  for l in lines2:
    print('   ', l.strip())
  bad += (rc == 0) + (rc2 != 0)

print('MUTATION', 'OK' if not bad else f'{bad} BAD')
sys.exit(1 if bad else 0)
