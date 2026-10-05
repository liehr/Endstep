import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generate app icons from public/logo.png: `npm run generate-icons`
// The artwork fills the whole square, so no extra padding.
const resizeOptions = { background: '#000000' }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0, resizeOptions },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions },
  },
  images: ['public/logo.png'],
})
