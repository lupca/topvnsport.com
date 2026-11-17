// Page-weight budget, run after `npm run build` (CI step "Performance budget").
//   node scripts/check-budget.mjs          check dist/ against perf-budget.json (exit 1 on a breach)
//   node scripts/check-budget.mjs --print  print today's values (to raise a ceiling: edit perf-budget.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const gz = (file) => zlib.gzipSync(fs.readFileSync(path.join(dist, file)), { level: 9 }).length;
const hrefs = (re) => [...shell.matchAll(re)].map((m) => m[1]);

// JS every page downloads before React starts: the entry and what it imports at load (modulepreload links).
const entry = shell.match(/<script type="module"[^>]*\bsrc="([^"]+)"/)?.[1];
if (!entry) throw new Error('shell has no module entry script');
const landing = new Set([entry, ...hrefs(/<link rel="modulepreload"[^>]*\bhref="([^"]+)"/g)]);
const jsGz = (files) => [...new Set(files)].reduce((n, f) => n + gz(f.replace(/^\//, '')), 0);

// Requests that hold the first paint: stylesheets that are not deferred, and scripts that are neither module, async nor defer
// (<noscript> is not read: it only applies without JavaScript).
const live = shell.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
const blocking =
  [...live.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].filter((m) => !/\bmedia="print"/.test(m[0])).length +
  [...live.matchAll(/<script\b[^>]*>/g)].filter((m) => /\bsrc=/.test(m[0]) && !/\btype="module"|\basync\b|\bdefer\b/.test(m[0])).length;

// Third-party stylesheets (Google Fonts) may be used but never hold the first paint: every one must be present in its
// deferred form (media="print" + onload, with a <noscript> copy). A missing or blocking Google link fails the budget.
const thirdParty = [...live.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="(?:https?:)?\/\/[^"]+"[^>]*>/g)].map((m) => m[0]);
const googleLinks = thirdParty.filter((l) => /fonts\.googleapis\.com/.test(l));
const googleDeferred = googleLinks.length === 1 && /\bmedia="print"/.test(googleLinks[0]) && /\bonload="this\.media='all'"/.test(googleLinks[0]) &&
  /<noscript>\s*<link\b[^>]*fonts\.googleapis\.com[^>]*>\s*<\/noscript>/.test(shell);

const actual = {
  'landing-js-gzip-bytes': jsGz([...landing]),
  'shell-html-bytes': Buffer.byteLength(shell),
  'render-blocking-requests': blocking,
};

if (process.argv.includes('--print')) {
  console.log(JSON.stringify(actual, null, 2));
  process.exit(0);
}

const ceiling = JSON.parse(fs.readFileSync(path.join(root, 'perf-budget.json'), 'utf8'));
const failures = [];
const check = (name, value, max) => { if (value > max) failures.push(`${name}: ${value} > ceiling ${max}`); else console.log(`ok  ${name}: ${value} <= ${max}`); };
check('landing JS gzip', actual['landing-js-gzip-bytes'], ceiling['landing-js-gzip-bytes']);
check('shell HTML bytes', actual['shell-html-bytes'], ceiling['shell-html-bytes']);
check('render-blocking requests in the shell', actual['render-blocking-requests'], ceiling['render-blocking-requests']);
if (!googleDeferred) failures.push('the Google Fonts stylesheet must be in the shell exactly once, deferred (media="print" + onload) with a <noscript> copy');
else console.log('ok  Google Fonts stylesheet present and deferred');

if (failures.length) {
  console.error(`\nPerformance budget breached:\n- ${failures.join('\n- ')}\n\nIf the growth is intended, raise that ceiling in perf-budget.json (run with --print for today's values) and say why in the PR.`);
  process.exit(1);
}
