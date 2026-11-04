// Generates the favicon set from public/topvnsport-logo.webp (200x200 source; icon-512 is an upscale).
// Run: node scripts/make-favicons.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pub = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url));
const src = pub('topvnsport-logo.webp');
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const png = (s) => sharp(src).resize(s, s, { fit: 'contain', background: clear }).png().toBuffer();

const [p16, p32, p48, p192, p512] = await Promise.all([16, 32, 48, 192, 512].map(png));
const apple = await sharp(src)
  .resize(180, 180, { fit: 'contain', background: clear })
  .flatten({ background: '#ffffff' })
  .png()
  .toBuffer();

writeFileSync(pub('favicon-48x48.png'), p48);
writeFileSync(pub('apple-touch-icon.png'), apple);
writeFileSync(pub('icon-192.png'), p192);
writeFileSync(pub('icon-512.png'), p512);

// ICO container with PNG payloads (16/32/48)
const imgs = [[16, p16], [32, p32], [48, p48]];
const head = Buffer.alloc(6 + 16 * imgs.length);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(imgs.length, 4);
let offset = head.length;
imgs.forEach(([s, buf], i) => {
  const o = 6 + 16 * i;
  head[o] = s; head[o + 1] = s;
  head.writeUInt16LE(1, o + 4);   // planes
  head.writeUInt16LE(32, o + 6);  // bpp
  head.writeUInt32LE(buf.length, o + 8);
  head.writeUInt32LE(offset, o + 12);
  offset += buf.length;
});
writeFileSync(pub('favicon.ico'), Buffer.concat([head, ...imgs.map(([, b]) => b)]));

const manifest = {
  name: 'TopVNSport',
  short_name: 'TopVNSport',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
  start_url: '/',
  display: 'standalone',
  theme_color: '#ffffff',
  background_color: '#ffffff',
};
writeFileSync(pub('site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
