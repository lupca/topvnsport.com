import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {HOME_SEO} from './src/config/seo';

// The bundle CSS blocked the first paint (~0.4 s on throttled mobile): load it without blocking so the
// inline #boot block paints at TTFB. main.tsx holds the first React render until the sheet is applied.
// api/product.ts turns it back into a blocking link on product pages (server-rendered text must be styled).
const deferBundleCss = () => ({
  name: 'defer-bundle-css',
  transformIndexHtml: {
    order: 'post' as const,
    handler: (html: string) => html.replace(
      /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/,
      (_m, href) => `<link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.media='all'" data-deferred-css><noscript><link rel="stylesheet" href="${href}"></noscript>`
    )
  }
});

// Shell <title> = the home title from the one SEO config (api/ replaces it per page; /stores etc. keep it).
const shellTitle = () => ({
  name: 'shell-title',
  transformIndexHtml: (html: string) => html.replace(/<title>[^<]*<\/title>/, () => `<title>${HOME_SEO.title.replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;'))}</title>`)
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), deferBundleCss(), shellTitle()],
    build: {
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
            'ui-vendor': ['lucide-react', 'motion'],
          },
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['@topvnsport/ui-kit', '@topvnsport/api-client'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
