# Incident 2026-11-04 19:45Z: 503s on the storefront's public catalog API (STOR-140)

STOR-140 replaces STOR-136. On 2026-11-04 between 19:45:31Z and 19:47:37Z, topvnsport.com got 503 from
`/api/pmi/public/products?page=1&limit=100`, `/api/wms/public/stock` and `/api/pmi/public/voma-categories`.
Production was only read for this doc: `voma -e prod logs ...` plus the GETs that `scripts/synthetic-check.sh` makes.
Nothing was changed on the gateway, identity or PIM.

## 1. What failed

On each of these requests the VOMA gateway (nginx) answered 503 with a 33-byte body. Each one is preceded by
`upstream timed out (110 ...) ... subrequest: "/catalog_verify"`. That is the gateway's auth subrequest to identity
`POST /internal/catalog-grants/verify`, which checks the catalog-grant Bearer token that `proxyToVoma` attaches.
PIM and WMS never received these requests.

### Storefront 503s

There are six timestamps and seven requests: at 19:46:08 two requests (stock and voma-categories) failed in the same second.

| # | Time (UTC) | Gateway host + path (gateway log) | Vercel path (storefront) | Status | Body | Client (Vercel egress IP) |
|---|---|---|---|---|---|---|
| 1 | 19:45:31.565 | api-pim `/public/products?page=1&limit=100` | `/api/pmi/public/products?page=1&limit=100` | 503 | 33 B | 54.46.13.187 |
| 2 | 19:45:35.654 | api-pim `/public/products?page=1&limit=100` | `/api/pmi/public/products?page=1&limit=100` | 503 | 33 B | 95.40.80.117 |
| 3 | 19:46:06.271 | api-pim `/public/products?page=1&limit=100` | `/api/pmi/public/products?page=1&limit=100` | 503 | 33 B | 54.46.13.187 |
| 4 | 19:46:08.985 | api-wms `/public/stock` | `/api/wms/public/stock` | 503 | 33 B | 95.40.42.147 |
| 5 | 19:46:08.987 | api-pim `/public/voma-categories` | `/api/pmi/public/voma-categories` | 503 | 33 B | 95.40.80.117 |
| 6 | 19:47:34.064 | api-pim `/public/products?page=1&limit=100` | `/api/pmi/public/products?page=1&limit=100` | 503 | 33 B | 54.46.13.187 |
| 7 | 19:47:37.881 | api-pim `/public/products?page=1&limit=100` | `/api/pmi/public/products?page=1&limit=100` | 503 | 33 B | 16.162.55.238 |

How the paths map: `vercel.json` rewrites `/api/pmi/:path*` to `api/pmi/[...path].ts` and `/api/wms/:path*` to
`api/wms/[...path].ts`. Those call `proxyToVoma(req, res, PMI_API_URL | WMS_API_URL)`, which fetches
`${baseUrl}/${segments}`. As a result, gateway `/public/<x>` on host `api-pim.voma.vn` is storefront `/api/pmi/public/<x>`,
and `/public/<x>` on `api-wms.voma.vn` is `/api/wms/public/<x>`. The user agent `node` is the function's `fetch`.

### Unrelated 503s in the same window (out of scope)

The same query also returns three 503s that have nothing to do with the storefront. This doc does not investigate them:

| Time (UTC) | Service | Path | Body | Why it is not the storefront incident |
|---|---|---|---|---|
| 19:41:09.823 | channel-api | `/api/channel/accounts?status=EXPIRING&limit=1` | 92 B | Browser from app.voma.vn (113.185.47.123), not Vercel; channel-api itself answered 503 |
| 19:45:23.196 | channel-api | `/api/channel/sync-jobs?status=FAILED&limit=1` | 92 B | same |
| 19:48:27.183 | invoice-api | `/api/invoice/queue/requests/page?...` | 92 B | Browser from app.voma.vn; invoice-api itself answered 503 |

The differences: the body is 92 bytes, not 33. The client is a browser on the seller app, not a Vercel egress IP with
user agent `node`. The backend service logged the 503 itself, while in the storefront case PIM and WMS never saw the request.

### Re-run: `voma -e prod logs all` (verbatim)

```
$ voma -e prod logs all --since '[2026-11-04T19:40:00Z, 2026-11-04T19:50:00Z]' --limit 50 " 503"
2026-11-04T19:41:09.823 channel-api INFO:     10.42.3.242:55736 - "GET /accounts?status=EXPIRING&limit=1 HTTP/1.1" 503 Service Unavailable
2026-11-04T19:41:09.823 gateway 113.185.47.123 - - [04/Nov/2026:19:41:09 +0000] "GET /api/channel/accounts?status=EXPIRING&limit=1 HTTP/1.1" 503 92 "https://app.voma.vn/s/f02a9c68-f656-5597-9f9b-7c8e28e3705d/invoice-operations/reconciler" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36" "113.185.47.123, 10.42.0.222" auth_user=-
2026-11-04T19:45:23.196 channel-api INFO:     10.42.3.242:38294 - "GET /sync-jobs?status=FAILED&limit=1 HTTP/1.1" 503 Service Unavailable
2026-11-04T19:45:23.196 gateway 113.185.47.123 - - [04/Nov/2026:19:45:23 +0000] "GET /api/channel/sync-jobs?status=FAILED&limit=1 HTTP/1.1" 503 92 "https://app.voma.vn/s/f02a9c68-f656-5597-9f9b-7c8e28e3705d/invoices" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36" "113.185.47.123, 10.42.0.222" auth_user=-
2026-11-04T19:45:31.565 gateway 54.46.13.187 - - [04/Nov/2026:19:45:31 +0000] "GET /public/products?page=1&limit=100 HTTP/1.1" 503 33 "-" "node" "54.46.13.187, 10.42.0.222" auth_user=-
2026-11-04T19:45:35.654 gateway 95.40.80.117 - - [04/Nov/2026:19:45:35 +0000] "GET /public/products?page=1&limit=100 HTTP/1.1" 503 33 "-" "node" "95.40.80.117, 10.42.0.222" auth_user=-
2026-11-04T19:46:06.271 gateway 54.46.13.187 - - [04/Nov/2026:19:46:06 +0000] "GET /public/products?page=1&limit=100 HTTP/1.1" 503 33 "-" "node" "54.46.13.187, 10.42.0.222" auth_user=-
2026-11-04T19:46:08.985 gateway 95.40.42.147 - - [04/Nov/2026:19:46:08 +0000] "GET /public/stock HTTP/1.1" 503 33 "-" "node" "95.40.42.147, 10.42.0.222" auth_user=-
2026-11-04T19:46:08.987 gateway 95.40.80.117 - - [04/Nov/2026:19:46:08 +0000] "GET /public/voma-categories HTTP/1.1" 503 33 "-" "node" "95.40.80.117, 10.42.0.222" auth_user=-
2026-11-04T19:47:34.064 gateway 54.46.13.187 - - [04/Nov/2026:19:47:34 +0000] "GET /public/products?page=1&limit=100 HTTP/1.1" 503 33 "-" "node" "54.46.13.187, 10.42.3.27" auth_user=-
2026-11-04T19:47:37.881 gateway 16.162.55.238 - - [04/Nov/2026:19:47:37 +0000] "GET /public/products?page=1&limit=100 HTTP/1.1" 503 33 "-" "node" "16.162.55.238, 10.42.3.27" auth_user=-
2026-11-04T19:48:27.183 invoice-api INFO:     10.42.1.123:48100 - "GET /api/v1/queue/requests/page?seller_id=f02a9c68-f656-5597-9f9b-7c8e28e3705d&in_progress=true&limit=1&offset=0 HTTP/1.1" 503 Service Unavailable
2026-11-04T19:48:27.286 gateway 113.185.47.123 - - [04/Nov/2026:19:48:27 +0000] "GET /api/invoice/queue/requests/page?seller_id=f02a9c68-f656-5597-9f9b-7c8e28e3705d&in_progress=true&limit=1&offset=0 HTTP/1.1" 503 92 "https://app.voma.vn/s/f02a9c68-f656-5597-9f9b-7c8e28e3705d/invoices" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36" "113.185.47.123, 10.42.0.222" auth_user=-
[prod] logs all, last [2026-11-04T19:40:00Z, 2026-11-04T19:50:00Z], newest 50 — older or more: --since 2h --limit 500
```

### Re-run: gateway catalog_verify timeouts (verbatim)

```
$ voma -e prod logs gateway --since '[2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z]' --limit 30 catalog_verify
2026-11-04T19:45:31.565 gateway 2026/11/04 19:45:31 [error] 27#27: *554321 upstream timed out (110: Operation timed out) while reading response header from upstream, client: 54.46.13.187, server: ~^api-pim(\.[a-z0-9-]+)?\.voma\.vn$, request: "GET /public/products?page=1&limit=100 HTTP/1.1", subrequest: "/catalog_verify", upstream: "http://10.43.57.47:8000/internal/catalog-grants/verify", host: "api-pim.voma.vn"
2026-11-04T19:45:35.654 gateway 2026/11/04 19:45:35 [error] 28#28: *554305 upstream timed out (110: Operation timed out) while reading response header from upstream, client: 95.40.80.117, server: ~^api-pim(\.[a-z0-9-]+)?\.voma\.vn$, request: "GET /public/products?page=1&limit=100 HTTP/1.1", subrequest: "/catalog_verify", upstream: "http://10.43.57.47:8000/internal/catalog-grants/verify", host: "api-pim.voma.vn"
2026-11-04T19:46:06.271 gateway 2026/11/04 19:46:06 [error] 29#29: *554545 upstream timed out (110: Operation timed out) while reading response header from upstream, client: 54.46.13.187, server: ~^api-pim(\.[a-z0-9-]+)?\.voma\.vn$, request: "GET /public/products?page=1&limit=100 HTTP/1.1", subrequest: "/catalog_verify", upstream: "http://10.43.57.47:8000/internal/catalog-grants/verify", host: "api-pim.voma.vn"
2026-11-04T19:46:08.987 gateway 2026/11/04 19:46:08 [error] 27#27: *555847 upstream timed out (110: Operation timed out) while reading response header from upstream, client: 95.40.80.117, server: ~^api-pim(\.[a-z0-9-]+)?\.voma\.vn$, request: "GET /public/voma-categories HTTP/1.1", subrequest: "/catalog_verify", upstream: "http://10.43.57.47:8000/internal/catalog-grants/verify", host: "api-pim.voma.vn"
2026-11-04T19:46:08.985 gateway 2026/11/04 19:46:08 [error] 27#27: *554530 upstream timed out (110: Operation timed out) while reading response header from upstream, client: 95.40.42.147, server: ~^api-wms(\.[a-z0-9-]+)?\.voma\.vn$, request: "GET /public/stock HTTP/1.1", subrequest: "/catalog_verify", upstream: "http://10.43.57.47:8000/internal/catalog-grants/verify", host: "api-wms.voma.vn"
2026-11-04T19:47:34.064 gateway 2026/11/04 19:47:34 [error] 26#26: *556053 upstream timed out (110: Operation timed out) while reading response header from upstream, client: 54.46.13.187, server: ~^api-pim(\.[a-z0-9-]+)?\.voma\.vn$, request: "GET /public/products?page=1&limit=100 HTTP/1.1", subrequest: "/catalog_verify", upstream: "http://10.43.57.47:8000/internal/catalog-grants/verify", host: "api-pim.voma.vn"
2026-11-04T19:47:37.881 gateway 2026/11/04 19:47:37 [error] 29#29: *556580 upstream timed out (110: Operation timed out) while reading response header from upstream, client: 16.162.55.238, server: ~^api-pim(\.[a-z0-9-]+)?\.voma\.vn$, request: "GET /public/products?page=1&limit=100 HTTP/1.1", subrequest: "/catalog_verify", upstream: "http://10.43.57.47:8000/internal/catalog-grants/verify", host: "api-pim.voma.vn"
[prod] logs gateway, last [2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z], newest 30 — older or more: --since 2h --limit 500
```

The 7 timeout lines have the same millisecond timestamps as the 7 storefront 503 access lines. The upstream is
`10.43.57.47:8000/internal/catalog-grants/verify`, an in-cluster identity service address.

### Identity, PIM and WMS during the window (verbatim)

Identity logged only 204s, with no 5xx and no error:

```
$ voma -e prod logs identity --since '[2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z]' --limit 50 catalog-grants/verify
2026-11-04T19:45:29.820 identity-api INFO:     10.42.3.242:57714 - "POST /internal/catalog-grants/verify HTTP/1.0" 204 No Content
2026-11-04T19:45:33.893 identity-api INFO:     10.42.1.123:52736 - "POST /internal/catalog-grants/verify HTTP/1.0" 204 No Content
2026-11-04T19:46:18.158 identity-api INFO:     10.42.3.242:47970 - "POST /internal/catalog-grants/verify HTTP/1.0" 204 No Content
2026-11-04T19:47:31.925 identity-api INFO:     10.42.1.123:36576 - "POST /internal/catalog-grants/verify HTTP/1.0" 204 No Content
2026-11-04T19:47:36.175 identity-api INFO:     10.42.3.242:54366 - "POST /internal/catalog-grants/verify HTTP/1.0" 204 No Content
[prod] logs identity, last [2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z], newest 50 — older or more: --since 2h --limit 500
```

PIM and WMS never saw a 503. PIM served 200s for `/public/` reads in the same window:

```
$ voma -e prod logs pim --since '[2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z]' --limit 50 " 503"
[prod] no log lines: namespace voma-prod, pim, last [2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z], matching:  503
$ voma -e prod logs wms --since '[2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z]' --limit 50 " 503"
[prod] no log lines: namespace voma-prod, wms, last [2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z], matching:  503
$ voma -e prod logs pim --since '[2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z]' --limit 50 /public/
2026-11-04T19:45:33.961 pim-api INFO:     10.42.3.242:47014 - "GET /public/voma-categories HTTP/1.0" 200 OK
2026-11-04T19:45:58.285 pim-api INFO:     10.42.3.242:53464 - "GET /public/products?page=1&limit=100 HTTP/1.0" 200 OK
2026-11-04T19:46:20.222 pim-api INFO:     10.42.3.242:58636 - "GET /public/voma-categories HTTP/1.0" 200 OK
2026-11-04T19:47:36.725 pim-api INFO:     10.42.3.242:56160 - "GET /public/voma-categories HTTP/1.0" 200 OK
[prod] logs pim, last [2026-11-04T19:45:20Z, 2026-11-04T19:47:40Z], newest 50 — older or more: --since 2h --limit 500
```

### How often: 29 catalog_verify 503s in 3 days

The window is `[2026-11-01T22:00:00Z, 2026-11-04T22:00:00Z]`:

- `voma -e prod logs gateway --since '<window>' --limit 500 catalog_verify "timed out"` returns **29**
  `subrequest: "/catalog_verify"` timeout lines. By day: 11-01: 2, 11-02: 10, 11-03: 2, 11-04: 15. By path:
  `/public/products` 15, `/public/products/551` 2, `/public/stock` 8, `/public/voma-categories` 4.
- `voma -e prod logs gateway --since '<window>' --limit 500 " 503 33"` returns **30** 33-byte 503 lines, all on `/public/`.
  29 of them line up with a catalog_verify timeout. The remaining one has a different cause and is out of scope here:
  `2026-11-04T16:17:23.081 ... upstream prematurely closed connection while reading response header from upstream, ...
  request: "GET /public/products?page=1&limit=100 HTTP/1.1", upstream: "http://10.43.99.133:8000/public/products?page=1&limit=100"`.
  That is PIM itself, not the catalog_verify subrequest.

## 2. What the logs prove, and what they do not

- **Proven:** the gateway's `catalog_verify` auth subrequest to identity timed out (nginx error 110 while reading the
  response header), and the gateway then answered the storefront with 503 / 33 bytes. Prod logs prove only that the
  subrequest timed out. They do not show the timeout value.
- **The 2s timeout is unconfirmed.** The only source for "2s" is a scratch copy of the gateway config (mtime 2026-10-27,
  not a git repository). Nothing shows that this copy matches the config running in prod.
- **Why identity stalled is unexplained.** Identity logged only `204 No Content` for `/internal/catalog-grants/verify`
  in the window, with no error and no 5xx. No request id links an identity 204 line to a particular gateway timeout,
  and the logs do not show why the gateway got no response header in time. One timing observation, recorded as an
  observation only: the 204 lines at 19:45:29.820 and 19:45:33.893 come about 1.7 s before the timeout lines at
  19:45:31.565 and 19:45:35.654, and there is no identity line near the 19:46:06 and 19:46:08 timeouts. This doc does
  not attribute a cause.

## 3. Ruled-out causes

- **Storefront proxy (`api/_catalogProxy.ts`):** `proxyToVoma` has no 503 branch. It produces only 405 (non-GET),
  500 (`proxy_misconfigured`) and 502 (`upstream_unreachable`, fetch threw). Every other status is passed through
  from upstream unchanged. The gateway access log shows the 503 / 33 B being produced at the gateway, and PIM and
  WMS never logged the requests. The 503 therefore came from VOMA, not from the proxy.
- **Rate limit:** the gateway's rate limit answers 429, not 503. The gateway logged zero 429s in 19:40–19:50:
  ```
  $ voma -e prod logs gateway --since '[2026-11-04T19:40:00Z, 2026-11-04T19:50:00Z]' --limit 50 " 429 "
  [prod] no log lines: namespace voma-prod, gateway, last [2026-11-04T19:40:00Z, 2026-11-04T19:50:00Z], matching:  429 
  ```
  Each of the 7 storefront 503s also has its own catalog_verify upstream-timeout error line at the same millisecond,
  and a rate-limit rejection would not produce one.
- **Region:** `vercel.json` already pins `"regions": ["hkg1"]` (STOR-012), the nearest Vercel region. The hop that
  failed is gateway → identity inside the cluster (`10.43.57.47:8000`), and the Vercel function's region does not
  touch that hop.

## 4. Follow-up for the VOMA owner (gateway / identity)

Production config is not changed by this task. These are for whoever owns the VOMA gateway and identity:

1. **`proxy_cache_use_stale` on the `/catalog_verify` location.** Cache a successful verify (204) per token for a
   short TTL and serve it stale on `error timeout`, so that a slow identity does not fail public catalog reads.
2. **Timeout and latency.** First read the timeout actually live in prod. The 2s figure is unconfirmed, and the
   config should be put under git. Then either raise the catalog_verify read timeout or bring identity's verify
   latency under it.
3. **Find why identity did not answer in time.** This is unexplained (section 2): the gateway timed out while
   identity logged 204s. This needs identity-side timing, for example request duration in the access log.
4. The single `upstream prematurely closed connection` 503 from PIM at 2026-11-04T16:17:23 is a separate issue.

## 5. Vercel function logs: attempted, not available here

```
$ command -v vercel
(no output; exit=1)
$ vercel logs https://www.topvnsport.com
timeout: failed to execute process: No such file or directory (os error 2)
exit=127
$ npx --no-install vercel logs https://www.topvnsport.com
npm error npx canceled due to missing packages and no YES option: ["vercel@65.11.0"]
npm error A complete log of this run can be found in: /home/pny/.npm/_logs/2026-11-04T22_28_51_772Z-debug-0.log
exit=1
```

The Vercel CLI is not installed in this environment: `vercel` is not on PATH, and npx would have to download
vercel@65.11.0. I did not install it, so the function-side view of 19:45–19:48 comes from the gateway logs only. Someone with Vercel access can run
`vercel logs <deployment-url>` for that window to confirm what the function returned.

## 6. Storefront change: separate proxy stale-if-error CDN cache

From the Vercel docs, https://vercel.com/docs/caching/cache-control-headers, section `stale-if-error` (quoted
verbatim):

> When you set the `stale-if-error` HTTP Cache-Control extension, the CDN serves a stale response when an error is
> encountered instead of returning the error to the client. Examples of errors are: 500 Internal Server Error, a
> network failure, or a DNS error.

and, on the header this proxy uses:

> `Vercel-CDN-Cache-Control` is exclusive to Vercel and has top priority, whether it's defined in a Vercel Function
> response or a `vercel.json` file.

What changed in `api/_catalogProxy.ts`:

- New `export const PROXY_CDN_CACHE_CONTROL = 'max-age=60, stale-while-revalidate=300, stale-if-error=600'`. It is
  used only on `proxyToVoma`'s upstream-200 branch, as `Vercel-CDN-Cache-Control`. The browser still gets
  `public, max-age=0, must-revalidate`.
- `CDN_CACHE_CONTROL` (`'max-age=60, stale-while-revalidate=300'`) is unchanged. `api/product.ts` uses it, and
  `stor035_oms_admin_units_quote_proxy.test.ts` asserts its literal.
- Every non-200 from `proxyToVoma` stays `Cache-Control: no-store` with no `Vercel-CDN-Cache-Control`. That covers
  passthrough statuses such as 503, plus 405, 500 and 502. A 503 stays a 503: there is no fallback that turns an error
  into a 200 or an empty body, and load errors still show on the page (spec a4f6975e).
- Normal staleness stays at about 360s (60s fresh + 300s stale-while-revalidate). On an upstream error, the CDN may
  additionally serve the last good copy for up to 600s (spec 2c964b2b).

**Unverified:** whether the Vercel CDN actually serves the stale copy when *our function* returns 503 is not known
until a post-landing probe. Our function's 503 carries `Cache-Control: no-store`, and the docs' examples list only
500, network failure and DNS error. To verify after landing and deploying from main: wait for the next gateway
catalog_verify 503 to a Vercel egress IP (section 1 query), then check whether `scripts/synthetic-check.sh` / the
synthetic workflow got 200 or 503 for the same route at the same minute. A 200 together with the gateway 503 means
stale was served. A 503 means it was not.

Guarded by `src/__tests__/stor012_proxy_cache.test.ts`. The test imports `proxyToVoma` and `PROXY_CDN_CACHE_CONTROL`
from `api/_catalogProxy`, asserts the literal, asserts that a 200 carries it, and asserts that 404/500/401/503 keep
their status with `no-store` and no CDN header. Each guarded line was mutation-checked RED, then reverted to GREEN.

## 7. Prior art

- **STOR-137** (landed): the storefront client retries transient 5xx, network errors and timeouts on the
  catalog/stock/categories GETs (`fetchWithRetry`, `RETRY_DELAYS_MS = [1000, 2000]` in
  `src/services/sport-api/index.ts`), with single-flight. It landed after this incident (2026-11-04 21:49Z).
- **STOR-139** (landed): `scripts/synthetic-check.sh` does one GET per route and exits non-zero on non-200.
  `.github/workflows/synthetic-public-api.yml` runs it every 5 minutes on main.

## 8. The 30-minute probe

No new probe script. The 30-minute probe is `bash scripts/synthetic-check.sh` run every 5 minutes for 30 minutes:

```
for i in 1 2 3 4 5 6 7; do bash scripts/synthetic-check.sh; [ $i -lt 7 ] && sleep 300; done
```

If you run it in the background, record `$!` and stop it with `kill <that PID>` only, never `pkill -f` / `killall`
(r:0b30a607). Set `RESULTS_FILE=/tmp/...` so the run does not leave `synthetic-results.txt` in the checkout. Do not
dispatch the synthetic workflow from a branch (r:3fc96ba6); its scheduled run on main already covers the 5-minute cadence.

A real short run (3 runs, 5 minutes apart, local bash against production, 2026-11-04 after the incident):

```
$ nohup bash -c 'for i in 1 2 3; do echo "### run $i start $(date -u +%FT%TZ)"; RESULTS_FILE=/tmp/stor140/synthetic-results.txt bash scripts/synthetic-check.sh; echo "### run $i exit=$?"; [ $i -lt 3 ] && sleep 300; done' > /tmp/stor140/probe.log 2>&1 &
### run 1 start 2026-11-04T22:29:12Z
2026-11-04T22:29:15Z /api/pmi/public/products?page=1&limit=100 200 2.121422s
2026-11-04T22:29:16Z /api/wms/public/stock 200 1.442102s
2026-11-04T22:29:17Z /api/pmi/public/voma-categories 200 0.592026s
### run 1 exit=0
### run 2 start 2026-11-04T22:34:17Z
2026-11-04T22:34:17Z /api/pmi/public/products?page=1&limit=100 200 0.536763s
2026-11-04T22:34:18Z /api/wms/public/stock 200 0.467210s
2026-11-04T22:34:18Z /api/pmi/public/voma-categories 200 0.178245s
### run 2 exit=0
### run 3 start 2026-11-04T22:39:18Z
2026-11-04T22:39:18Z /api/pmi/public/products?page=1&limit=100 200 0.329217s
2026-11-04T22:39:19Z /api/wms/public/stock 200 0.229071s
2026-11-04T22:39:19Z /api/pmi/public/voma-categories 200 0.170809s
### run 3 exit=0
```

Note on `scripts/synthetic-check.sh:7`: the comment there (`A 200 may be a CDN-cached copy (Vercel CDN, max-age=60 +
stale-while-revalidate=300, see CDN_CACHE_CONTROL in api/_catalogProxy.ts)`) names the old constant. The proxy routes
now send `PROXY_CDN_CACHE_CONTROL`, so the stale-if-error window can also hide an upstream outage from this check for
up to 600s, if stale-if-error works on a function 503. The comment is deliberately left as is, because it is outside
this diff. Fix it in a follow-up.
