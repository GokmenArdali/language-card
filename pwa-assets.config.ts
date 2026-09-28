import { defineConfig } from '@vite-pwa/assets-generator/config'

// Logo tam kare ve kendi arka planına sahip; iOS ve maskable ikonlar
// kenar boşluğu olmadan üretilir (içerik güvenli bölgenin içinde).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/logo.svg'],
})
