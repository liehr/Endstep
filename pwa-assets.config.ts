import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// App-Icons aus public/logo.png erzeugen: `npm run generate-icons`
// Das Motiv füllt das ganze Quadrat, deshalb ohne zusätzlichen Rand.
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
