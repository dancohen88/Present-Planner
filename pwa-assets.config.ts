import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Generates every icon size the app needs from public/icon.svg.
// Run after changing the icon: npm run icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Fill the padding around maskable and Apple icons with the icon's own
    // background colour rather than white.
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#a3293d' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#a3293d' },
    },
  },
  images: ['public/icon.svg'],
})
