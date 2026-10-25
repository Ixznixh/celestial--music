import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'Celestial Music',
          short_name: 'Celestial',
          description: 'A mobile-first ad-free music streaming app with an Apple-inspired visual design.',
          theme_color: '#0a0a0c',
          background_color: '#0a0a0c',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait-primary',
          categories: ['music', 'entertainment'],
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
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // App shell only. Media must never be intercepted by the service worker:
          // audio is fetched with HTTP Range requests, and caching partial (206) responses
          // stalls playback and breaks seeking on iOS WebKit. The browser's own media cache
          // handles streaming (including background playback) correctly.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          // Artwork is the one thing worth caching: thumbnails are re-requested on every
          // shelf repaint, so Cache Storage makes them paint instantly and keeps the grid
          // populated offline. Only image hosts and the image proxy match — never the
          // audio proxy (/api/song/:id/audio) or any other API route.
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                [
                  'i.ytimg.com',
                  'img.youtube.com',
                  'ggpht.com',
                  'googleusercontent.com',
                  'images.unsplash.com',
                  'cdn.jiosaavn.com',
                ].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'celestial-artwork-cache',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\/image-proxy/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'celestial-image-proxy-cache',
                expiration: {
                  maxEntries: 400,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
