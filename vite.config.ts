/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  // GitHub Pages liefert die App unter /<repo>/ aus; der Deploy-Workflow setzt BASE_PATH.
  base: process.env.BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(process.env.APP_COMMIT || 'dev'),
  },
  plugins: [
    react(),
    VitePWA({
      // Neue Versionen werden im Hintergrund geladen; die App fragt dann „Aktualisieren?“.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Endstep – Commander-Tracker',
        short_name: 'Endstep',
        description: 'Commander-Runden tracken und mit jedem Spiel besser werden.',
        lang: 'de',
        display: 'standalone',
        orientation: 'portrait',
        // Startbildschirm passend zum schwarzen App-Icon
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
        // Schrift nur für lateinische Zeichen vorab laden (Deutsch/Englisch), Rest bei Bedarf.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}', '**/nunito-latin-*.woff2'],
        // Quellbild der Icons, wird in der App nicht gebraucht
        globIgnores: ['logo.png'],
        // Kartenbilder von Scryfall nach dem ersten Laden offline verfügbar halten.
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
