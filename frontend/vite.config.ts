import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/wise-api': {
        target: 'https://api.wiseapp.live',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wise-api/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      },
      '/wise-files': {
        target: 'https://files.wiseapp.live',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wise-files/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }
    }
  }
})
