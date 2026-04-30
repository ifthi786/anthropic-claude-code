import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // Proxy Anthropic API calls to avoid CORS in dev.
  // The SDK uses dangerouslyAllowBrowser:true as a fallback when this proxy is absent.
  server: {
    proxy: {
      '/api/anthropic': {
        target:      'https://api.anthropic.com',
        changeOrigin: true,
        rewrite:     path => path.replace(/^\/api\/anthropic/, ''),
      },
    },
  },
})
