import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置：启用 Vue 插件，构建产物输出到 dist（供 Cloudflare Pages 托管）
export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'dist' },
  // 本地开发：UI 用 vite(5173) 热更新，/api 代理到 wrangler pages dev(8788) 提供 Functions+D1
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8788' }
  }
})
