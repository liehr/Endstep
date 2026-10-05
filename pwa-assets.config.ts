import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// App-Icons aus public/logo.svg erzeugen: `npm run generate-icons`
const background = '#0f2e1d'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/logo.svg'],
})
