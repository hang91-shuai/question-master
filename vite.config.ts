import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // base 由环境变量控制：
  //  - GitHub Pages 子路径部署（默认）：VITE_BASE=/question-master/
  //  - CloudBase 静态托管（根路径）：VITE_BASE=/
  const base = env.VITE_BASE || '/question-master/'
  return {
    plugins: [react()],
    base,
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  }
})
