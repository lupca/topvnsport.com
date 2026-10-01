// STOR-011: hồ sơ người bán (pháp lý, liên hệ, cam kết, chi nhánh) là lời của người bán,
// lấy từ MỘT biến build-time VITE_SELLER_PROFILE (JSON). Thiếu trường nào thì không hiện
// mục đó -- không giá trị mặc định. JSON hỏng/sai kiểu thì ném lỗi nêu rõ trường sai.

export const SELLER_PROFILE_ENV = 'VITE_SELLER_PROFILE';

export interface SellerBranch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  schedule?: string;
  city?: string;
  mapEmbedUrl?: string;
}

const STRING_FIELDS = [
  'hotline', 'hotlineHours', 'email', 'address', 'businessLicense', 'tagline', 'footerSlogan',
  'authenticityPolicy', 'warrantyPolicy', 'stringWarrantyPolicy', 'frameWarrantyPolicy',
  'orderWarrantyNote', 'headquartersNote', 'codPolicy', 'storeNote',
] as const;

export type SellerProfile = { [K in (typeof STRING_FIELDS)[number]]?: string } & {
  branches?: SellerBranch[];
};

const BRANCH_REQUIRED = ['id', 'name', 'address'] as const;
const BRANCH_OPTIONAL = ['phone', 'schedule', 'city', 'mapEmbedUrl'] as const;

const fail = (path: string, why: string): never => {
  throw new Error(`${SELLER_PROFILE_ENV}${path ? '.' + path : ''}: ${why}`);
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Chuỗi đã trim; rỗng -> undefined; sai kiểu -> lỗi nêu tên trường.
function readString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return fail(path, 'phải là chuỗi');
  return value.trim() || undefined;
}

function parseBranch(raw: unknown, i: number): SellerBranch {
  const at = `branches[${i}]`;
  if (!isObject(raw)) return fail(at, 'phải là object');
  const known = new Set<string>([...BRANCH_REQUIRED, ...BRANCH_OPTIONAL]);
  for (const key of Object.keys(raw)) if (!known.has(key)) fail(`${at}.${key}`, 'không phải trường hợp lệ');
  const out: Record<string, string> = {};
  for (const key of BRANCH_REQUIRED) {
    const v = readString(raw[key], `${at}.${key}`);
    if (!v) fail(`${at}.${key}`, 'là bắt buộc');
    out[key] = v as string;
  }
  for (const key of BRANCH_OPTIONAL) {
    const v = readString(raw[key], `${at}.${key}`);
    if (v) out[key] = v;
  }
  return out as unknown as SellerBranch;
}

export function parseSellerProfile(raw: string | undefined): SellerProfile {
  if (raw === undefined || raw.trim() === '') return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return fail('', `không phải JSON hợp lệ (${(e as Error).message})`);
  }
  if (!isObject(data)) return fail('', 'phải là JSON object');
  const known = new Set<string>([...STRING_FIELDS, 'branches']);
  for (const key of Object.keys(data)) if (!known.has(key)) fail(key, 'không phải trường hợp lệ');
  const profile: SellerProfile = {};
  for (const key of STRING_FIELDS) {
    const v = readString(data[key], key);
    if (v) profile[key] = v;
  }
  if (data.branches !== undefined) {
    if (!Array.isArray(data.branches)) fail('branches', 'phải là mảng');
    profile.branches = (data.branches as unknown[]).map(parseBranch);
  }
  return profile;
}

// Parse mỗi lần gọi (rẻ) để test đổi được env bằng vi.stubEnv.
export function getSellerProfile(): SellerProfile {
  return parseSellerProfile(import.meta.env.VITE_SELLER_PROFILE as string | undefined);
}
