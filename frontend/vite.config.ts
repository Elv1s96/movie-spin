import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // Проксі на NestJS бекенд — фронт ходить на /api без CORS-проблем.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Завантажені постери роздає бекенд за адресою /uploads/...
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
