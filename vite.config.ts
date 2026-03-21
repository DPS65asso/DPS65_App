
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement depuis .env (sans préfixe obligatoire VITE_)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    // Polyfill pour process.env.API_KEY requis par le composant AI
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || '')
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        devOptions: {
          enabled: true, // IMPORTANT: Active le SW en mode dev/preview pour éviter les crashs
          type: 'module',
        },
        includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'DPS65 - Suivi de Victimes',
          short_name: 'DPS65',
          description: 'Application de sécurité civile pour le suivi des victimes, des soins et du devenir.',
          theme_color: '#f8fafc',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
              // Cache pour les tuiles de cartes (OSM & OpenTopoMap)
              {
                urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'osm-tiles',
                  expiration: {
                    maxEntries: 1000,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 jours
                  }
                }
              },
              {
                urlPattern: /^https:\/\/[a-c]\.tile\.opentopomap\.org\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'opentopo-tiles',
                  expiration: {
                    maxEntries: 1000,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 jours
                  }
                }
              },
              // Cache pour CDN fonts/styles
              {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'google-fonts-cache',
                    expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                    cacheableResponse: { statuses: [0, 200] }
                  }
              },
              {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'gstatic-fonts-cache',
                    expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                    cacheableResponse: { statuses: [0, 200] }
                  }
              },
              {
                  urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'tailwind-cdn-cache',
                    expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
                    cacheableResponse: { statuses: [0, 200] }
                  }
              }
          ]
        }
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
          output: {
              manualChunks: {
                  'leaflet-vendor': ['leaflet', 'react-leaflet'],
                  'pdf-vendor': ['jspdf', 'jspdf-autotable'],
                  'scanner-vendor': ['html5-qrcode', 'qrcode'],
                  'ai-vendor': ['@google/genai']
              }
          }
      }
    },
    server: {
      port: 3000,
      host: true
    }
  };
});
