// Proves the producer-verbatim fixtures against OMS cd53022 text.
// node --experimental-strip-types scripts/stor163-walk/check-fixtures.mjs [oms-path]
import { execFileSync } from 'node:child_process';
import { deepStrictEqual } from 'node:assert';
import * as fx from '../../src/__tests__/fixtures/shippingQuote.ts';

const oms = process.argv[2] || '/data/projects/voma/voma-oms';
const show = (p) => execFileSync('git', ['-C', oms, 'show', `cd53022:${p}`], { encoding: 'utf8' });
const py = show('backend/tests/test_shipping_voucher_quote.py');
const cap = show('docs/evidence/oms-218/captures.md');

// Join the adjacent string literals inside `NAME = json.loads( ... )`.
const pyJson = (name) => {
  const m = py.match(new RegExp(`${name} = json\\.loads\\(\\n([\\s\\S]*?)\\n\\)\\n`));
  return JSON.parse(m[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith("'")).map((l) => l.slice(1, -1)).join(''));
};
// `### V1 ` with trailing space so V1 does not match V10-V13.
const capture = (id, key) => {
  const sec = cap.split('### ').find((s) => s.startsWith(`${id} `));
  return JSON.parse(sec.match(new RegExp(`^${key}\\s+(.*)$`, 'm'))[1]);
};

const checks = {
  QUOTE_V_Q3: pyJson('WIRED_QUOTE_200'),
  QUOTE_V_TWO_AUTO: pyJson('TWO_AUTO_QUOTE_200'),
  VALIDATE_V1: capture('V1', 'RESPONSE'),
  VALIDATE_V2: capture('V2', 'RESPONSE'),
  VALIDATE_V5: capture('V5', 'RESPONSE'),
  VALIDATE_V7: capture('V7', 'RESPONSE'),
  ERR_VALIDATE_V8: capture('V8', 'RESPONSE'),
  VALIDATE_V1_REQUEST: capture('V1', 'REQUEST'),
  VALIDATE_V2_REQUEST: capture('V2', 'REQUEST'),
};
for (const [name, want] of Object.entries(checks)) {
  try {
    deepStrictEqual(fx[name], want);
    console.log(`OK ${name}`);
  } catch (e) {
    console.log(`DIFF ${name}\n${e.message}`);
    process.exitCode = 1;
  }
}
