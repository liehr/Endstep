/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  // GitHub Pages serves the app under /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(process.env.APP_COMMIT || 'dev'),
  },
  plugins: [
    react(),
    VitePWA({
      // New versions are loaded in the background; the app then asks "Update?".
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Endstep – Commander tracker',
        short_name: 'Endstep',
        description: 'Track your Commander games and get better with every game.',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        // Splash screen to match the black app icon
        background_color: '#000000',
        theme_color: '#0b1f14',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the font only for Latin characters (English/German), the rest on demand.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}', '**/nunito-latin-*.woff2'],
        // Source image for the icons, not needed in the app
        globIgnores: ['logo.png'],
        // Keep Scryfall card images available offline after the first load.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://cards.scryfall.io',
            handler: 'CacheFirst',
            options: {
              cacheName: 'scryfall-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
