import { SITE_ORIGIN } from './sitemap.js';

const ROBOTS_TXT = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /api/',
  'Disallow: /checkout/',
  `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
].join('\n') + '\n';

export default async function handler(req: any, res: any) {
  if (req?.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).send('Method Not Allowed');
    return;
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
  res.status(200).send(ROBOTS_TXT);
}
