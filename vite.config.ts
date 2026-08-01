
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
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        devOptions: {
          enabled: false,
          suppressWarnings: true
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
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest,json}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        }
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
          output: {
              manualChunks: {
                  'leaflet-vendor': ['leaflet', 'react-leaflet'],
                  'pdf-vendor': ['jspdf', 'jspdf-autotable'],
                  'scanner-vendor': ['html5-qrcode', 'qrcode'],
                  'ai-vendor': ['@google/genai'],
                  'lucide-vendor': ['lucide-react']
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
