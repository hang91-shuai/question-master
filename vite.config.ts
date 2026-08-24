import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署在子路径 /question-master/ 下，需要显式指定 base。
  // 若部署到个人主页仓库（username.github.io）则改成 base: '/'
  base: '/question-master/',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
