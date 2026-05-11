import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'V4 Traffic Manager',
        short_name: 'V4 Traffic',
        description: 'Gerenciamento de tráfego e métricas de campanhas',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshots/screenshot-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Dashboard V4 Traffic Manager'
          },
          {
            src: '/screenshots/screenshot-mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'V4 Traffic Manager Mobile'
          }
        ]
      },
      workbox: {
        // Only cache static shell assets — NEVER cache API responses
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,

        // HTML navigations always go to network first so deploys roll out instantly
        navigateFallback: null,
        runtimeCaching: [
          {
            // NEVER cache Supabase API — always fresh from network
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ],

        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      
      // Dev options
      devOptions: {
        enabled: false // Disable in dev to avoid issues
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
