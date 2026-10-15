import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true, // Listen on all local IPs
    proxy: {
      // Forward API calls to Spring Boot backend
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Forward WebSocket connections to Spring Boot backend
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  }
})

