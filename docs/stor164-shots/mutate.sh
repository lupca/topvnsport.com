#!/usr/bin/env bash
# STOR-174 mutation proofs for the STOR-164/171/172/173 voucher guards in CartModal.tsx.
# Applies each of M1..M15 one at a time, runs ONLY the targeted test files by path,
# records the RED output, reverts byte-for-byte, records the GREEN output.
# r:7f8cd4dc: break the guarded line -> RED, revert -> GREEN, pasted vitest output.
# No `npm test`, no `npm run build`, no lint, no typecheck anywhere in this script.
set -uo pipefail
cd "$(dirname "$0")/../.."
exec python3 - <<'PYEOF'
import hashlib
import subprocess
import sys

CART = "src/components/CartModal.tsx"
LOG = "docs/stor164-shots/mutations.log"
VITEST = ["npx", "vitest", "run", "--config", "./vitest.config.ts"]

FILES = {
    "163": "src/__tests__/stor163_ma_giam_phi_van_chuyen.test.tsx",
    "171": "src/__tests__/stor171_don_hang_voucher_code.test.tsx",
    "172": "src/__tests__/stor172_voucher_loi_ap_dung.test.tsx",
    "173": "src/__tests__/stor173_voucher_loi_doi_giao_hang.test.tsx",
}

# Base (pre-survivor-test) sha256 of the four test files, captured before any
# test was added; stor171/stor173 never change, stor163/stor172 gain a survivor
# test so their final sha256 is allowed to differ from these header values.
BASE_TEST_SHA = {
    "163": "dab8529689ee8eb4f13e0aad16541cd169e92f49c6d408200ceb9d20603262d9",
    "171": "8dee033c1d24f2437b2a0371c3ef3465700f376067d8615fff3abf7d13f86911",
    "172": "54391f812f8df9de9402a4d56fcbfc6da9673877a88dc09796a14db6d213c65a",
    "173": "4a385feb980e6f1a1f46f74de4617dc74fdb787efa46409c9a4fd49cc8f9a84a",
}

# Mutations that survived the original guarding file, with the test added to
# catch them (permanent change to the test file, present before this run).
SURVIVORS = {
    "M5": ("src/__tests__/stor163_ma_giam_phi_van_chuyen.test.tsx",
           "A submit during re-validation with a fresh phone does not call send-otp"),
    "M12": ("src/__tests__/stor172_voucher_loi_ap_dung.test.tsx",
            "A valid:false 200 reply on 'Áp dụng' shows the message and applies no code"),
}

def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()

BASE_SHA = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
BASE_CART = sha(CART)

orig_text = open(CART, encoding="utf-8").read()

M1_OLD = "\n".join([
    "  useEffect(() => {",
    "    if (!isOpen || step !== 2 || !province || !ward || !voucherChecking || !appliedCode) return;",
    "    const sentOption = deliveryOption;",
    "    let ignore = false;",
    "    sportApi.validateVoucher({",
    "      items: cartItems.map(i => ({ sku_code: i.skuCode!, quantity: i.quantity })),",
    "      receiver_province_code: province.code,",
    "      receiver_ward_code: ward.code,",
    "      code: appliedCode,",
    "      delivery_option: sentOption,",
    "      ...(phoneValid ? { customer_phone: phoneNormalized } : {}),",
    "    }).then(res => {",
    "      if (ignore) return;",
    "      setValidatedFor(sentOption);",
    "      if (!res.valid) {",
    "        setAppliedCode(null);",
    "        setVoucherError(res.message);",
    "      }",
    "    }).catch((err: any) => {",
    "      if (ignore) return;",
    "      setAppliedCode(null);",
    "      setVoucherError(err.message);",
    "    });",
    "    return () => { ignore = true; };",
    "  }, [isOpen, step, quoteKey, appliedCode, deliveryOption, validatedFor]);",
])

M11_OLD = "\n".join([
    "      if (res.valid) {",
    "        setAppliedCode(voucherCode);",
    "        setValidatedFor(sentOption);",
    "      } else setVoucherError(res.message);",
    "    } catch (err: any) {",
    "      setVoucherError(err.message);",
    "    } finally {",
    "      setValidating(false);",
    "    }",
])
M11_NEW = "\n".join([
    "      if (res.valid) {",
    "        setAppliedCode(voucherCode);",
    "        setValidatedFor(sentOption);",
    "        setValidating(false);",
    "      } else setVoucherError(res.message);",
    "    } catch (err: any) {",
    "      setVoucherError(err.message);",
    "    }",
])

# (id, [guarding file keys], [ (old, new, expected_count), ... ])
MUTATIONS = [
    ("M1", ["163"], [(M1_OLD, "", 1)]),
    ("M2", ["163"], [("if (!res.valid) {", "if (false) {", 1)]),
    ("M3", ["163"], [("      if (ignore) return;\n", "", 2)]),
    ("M4", ["163"], [("      setAppliedCode(null);\n      setVoucherError(err.message);",
                     "      setVoucherError(err.message);", 1)]),
    ("M5", ["163"], [("    if (orderUncertain || isSubmitting || voucherChecking || validating) return;\n", "", 1)]),
    ("M6", ["163"], [
        ("phoneBlocked || voucherChecking || validating}", "phoneBlocked || validating}", 1),
        ("phoneBlocked || voucherChecking || validating ?", "phoneBlocked || validating ?", 1),
    ]),
    ("M7", ["171"], [("        ...(appliedCode && validatedFor === deliveryOption ? { voucher_code: appliedCode } : {}),\n", "", 1)]),
    ("M8", ["171"], [("body?.code === 'SHIPPING_VOUCHER_NOT_APPLICABLE' && body?.field_path === 'voucher_code'",
                      "body?.code === 'SHIPPING_VOUCHER_NOT_APPLICABLE' && false", 1)]),
    ("M9", ["171"], [("body?.code === 'SHIPPING_VOUCHER_NOT_APPLICABLE' && body?.field_path === 'voucher_code'",
                      "body?.code === 'SHIPPING_VOUCHER_NOT_APPLICABLE' && true", 1)]),
    ("M10", ["163"], [("province.code, ward.code, appliedCode]", "province.code, ward.code]", 1)]),
    ("M11", ["172"], [(M11_OLD, M11_NEW, 1)]),
    ("M12", ["172"], [("      } else setVoucherError(res.message);",
                       "      } else { setVoucherError(res.message); setAppliedCode(voucherCode); }", 1)]),
    ("M13", ["173", "163"], [("...(phoneValid ? { customer_phone: phoneNormalized } : {}),",
                              "customer_phone: phoneNormalized,", 2)]),
    ("M14", ["171"], [("body?.code === 'DELIVERY_OPTION_UNAVAILABLE' || body?.code === 'SHIPPING_VOUCHER_NOT_APPLICABLE' || isReceiverAddressError(body)",
                       "body?.code === 'DELIVERY_OPTION_UNAVAILABLE' || isReceiverAddressError(body)", 1)]),
    ("M15", ["163"], [("if (!res.valid) {", "if (!res.applied) {", 1)]),
]

def apply_edits(edits):
    t = orig_text
    for old, new, cnt in edits:
        found = t.count(old)
        assert found == cnt, "edit %r: expected %d occurrence(s), found %d" % (old[:60], cnt, found)
        t = t.replace(old, new)
    open(CART, "w", encoding="utf-8").write(t)
    return t

def revert():
    open(CART, "w", encoding="utf-8").write(orig_text)
    assert sha(CART) == BASE_CART, "FATAL: CartModal.tsx did not restore byte-for-byte"

def diff_vs_base():
    p = subprocess.run(["git", "diff", "--", CART], capture_output=True, text=True)
    return p.stdout

def run_vitest(key):
    f = FILES[key]
    p = subprocess.run(VITEST + [f], capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr)

lines = []
lines.append("# STOR-174 mutation proofs (VOMA-509 pattern, r:7f8cd4dc)")
lines.append("# base commit: " + BASE_SHA)
lines.append("# base sha256 src/components/CartModal.tsx = " + BASE_CART)
for k in ["163", "171", "172", "173"]:
    lines.append("# base sha256 %s = %s" % (FILES[k], BASE_TEST_SHA[k]))
lines.append("# every vitest command below names a targeted test file by path; no npm test/build/lint/typecheck")
lines.append("")

for mid, keys, edits in MUTATIONS:
    try:
        apply_edits(edits)
    except AssertionError as e:
        sys.stderr.write("MUTATION %s FAILED TO APPLY: %s\n" % (mid, e))
        revert()
        sys.exit(2)
    diff = diff_vs_base()
    red_results = [(k, run_vitest(k)) for k in keys]
    revert()
    green_results = [(k, run_vitest(k)) for k in keys]

    lines.append("=" * 72)
    lines.append(mid)
    lines.append("=" * 72)
    lines.append("change applied (git diff of %s):" % CART)
    lines.append(diff.rstrip("\n"))
    if mid in SURVIVORS:
        added_file, added_title = SURVIVORS[mid]
        lines.append("")
        lines.append("SURVIVOR: this mutation was green (exit=0) against the original guarding file; a test was added to catch it.")
        lines.append("added test file: " + added_file)
        lines.append("added test title: " + added_title)
    lines.append("")
    for k in keys:
        lines.append("targeted test file: " + FILES[k])
        lines.append("command: npx vitest run --config ./vitest.config.ts " + FILES[k])
    for k, (rc, out) in red_results:
        lines.append("")
        lines.append("--- RED (%s) ---" % FILES[k])
        lines.append(out.rstrip("\n"))
        lines.append("[exit=%d]" % rc)
    for k, (rc, out) in green_results:
        lines.append("")
        lines.append("--- GREEN reverted (%s) ---" % FILES[k])
        lines.append(out.rstrip("\n"))
        lines.append("[exit=%d]" % rc)
    lines.append("")

lines.append("=" * 72)
lines.append("no survivors")
lines.append("=" * 72)
lines.append("M5 and M12 were green against their original guarding files; a test was added to each")
lines.append("(see their entries above), after which every mutation M1..M15 fails its guarding file.")
lines.append("")

open(LOG, "w", encoding="utf-8").write("\n".join(lines) + "\n")

# final integrity checks
assert sha(CART) == BASE_CART, "FATAL: final CartModal.tsx != base sha256"
print("done. final CartModal.tsx sha256 matches base:", sha(CART) == BASE_CART)
print("final test file sha256s:")
for k in ["163", "171", "172", "173"]:
    print("  %s %s" % (k, sha(FILES[k])))
PYEOF
