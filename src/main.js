import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// 应用入口：挂载根组件并启用路由
createApp(App).use(router).mount('#app')

// 仅在生产环境注册，避免本地热更新被旧缓存干扰。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service Worker 注册失败：', error)
    })
  })
}
