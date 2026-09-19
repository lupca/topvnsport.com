// Self-check: chay that handler da build, voi fetch duoc stub.
// node api/_catalogProxy.test.mjs   (sau khi `npx vercel build`)
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FUNC = pathToFileURL(
  resolve(import.meta.dirname, '../.vercel/output/functions/api/pmi/[...path].func/api/pmi/[...path].js'),
).href;

process.env.PMI_API_URL = 'https://api-pim.voma.vn/api/v1/site';
process.env.STOREFRONT_SELLER_ID = 'seller-1';
process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-1': 'tok_abc' });

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  return {
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '{"items":[]}',
  };
};

const { default: handler } = await import(FUNC);

function fakeRes() {
  const res = { statusCode: null, headers: {}, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  res.send = (b) => ((res.body = b), res);
  res.setHeader = (k, v) => (res.headers[k] = v);
  return res;
}

// 1. Multi-segment: path tu rewrite phai thanh path upstream, va khong duoc forward `path`
{
  const res = fakeRes();
  await handler(
    {
      method: 'GET',
      query: { path: 'public/products' },
      url: '/api/pmi/[...path]?path=public/products&limit=1',
    },
    res,
  );
  assert.equal(calls.at(-1).url, 'https://api-pim.voma.vn/api/v1/site/public/products?limit=1');
  assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer tok_abc');
  assert.equal(res.statusCode, 200);
}

// 2. Dang mang (route 1-segment cua builder dung `...path`) van chay
{
  const res = fakeRes();
  await handler(
    { method: 'GET', query: { path: ['public', 'categories'] }, url: '/api/pmi/[...path]?path=public/categories' },
    res,
  );
  assert.equal(calls.at(-1).url, 'https://api-pim.voma.vn/api/v1/site/public/categories');
}

// 3. Khong co query nao khac -> khong dinh dau `?`
{
  const res = fakeRes();
  await handler({ method: 'GET', query: { path: 'public/stock' }, url: '/api/pmi/[...path]?path=public/stock' }, res);
  assert.equal(calls.at(-1).url, 'https://api-pim.voma.vn/api/v1/site/public/stock');
}

// 4. Non-GET van bi tu choi truoc moi thu khac
{
  const before = calls.length;
  const res = fakeRes();
  await handler({ method: 'POST', query: { path: 'public/products' }, url: '/api/pmi/[...path]?path=public/products' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(calls.length, before, 'khong duoc goi upstream');
}

console.log('ALL CHECKS PASSED');
