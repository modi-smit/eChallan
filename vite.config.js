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
        name: 'GOD eChallan',
        short_name: 'GOD eChallan',
        description: 'Gujarat Oil Depot ERP System',
        theme_color: '#0f172a',
        background_color: '#e5e7eb',
        display: 'standalone',
        icons: [
          {
            // 1. Windows / Desktop Shortcut Icon
            // Windows looks for 'any' to create standard square/transparent shortcuts.
            src: '/desktop-512x512.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any' 
          },
          {
            // 2. Android / Mobile Home Screen Icon
            // Android prioritizes 'maskable' to fit its adaptive app icons.
            // Notice: 'any' is removed so Windows ignores this file.
            src: '/pwa-512x512.png', 
            sizes: '512x512',
            type: 'image/png', // FIXED: This was previously image/svg+xml
            purpose: 'maskable' 
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 3000,
  }
})