
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],

      manifest: {
        id: '/',
        name: 'VEDIC VIMSHOTTARI',
        short_name: 'VEDIC VIMSHOTTARI',
        description: 'Your application description.',
        theme_color: '#0B1324',
        background_color: '#070B14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',

        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}',
        ],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },

      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },

  assetsInclude: [
    '**/*.wasm',
  ],

  optimizeDeps: {
    exclude: [
      '@swisseph/browser',
    ],
  },

  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
