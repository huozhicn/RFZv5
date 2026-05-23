import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { resolve } from 'path'

const GIT_HASH = (() => {
  try { return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim() }
  catch { return 'unknown' }
})()

export default defineConfig({
  base: '/v5/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(GIT_HASH),
  },
})
