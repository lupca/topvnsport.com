import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {parseSellerProfile} from './src/config/sellerProfile';

export default defineConfig(({mode}) => {
  // STOR-011: VITE_SELLER_PROFILE hỏng thì `vite build` hỏng, thông báo nêu rõ trường sai.
  parseSellerProfile(loadEnv(mode, process.cwd(), '').VITE_SELLER_PROFILE);
  return {
    plugins: [react(), tailwindcss()],
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
