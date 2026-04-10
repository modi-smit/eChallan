import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'], 
      manifest: {
        name: 'Gujarat Oil Depot ERP System',
        short_name: 'GOD eChallan',
        description: 'Gujarat Oil Depot ERP System',
        theme_color: '#0f172a',
        background_color: '#e5e7eb',
        display: 'standalone',
        icons: [
          {
            // 1. The transparent PNG for Windows/Mac Desktop installations
            src: '/desktop-512x512.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any' 
          },
          {
            // 2. The padded dark PNG for Android/iOS mobile cropping
            src: '/pwa-512x512.png', 
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable any' 
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 3000,
  }
})