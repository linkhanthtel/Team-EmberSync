import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { aiPlugin } from './server/ai.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loads ANTHROPIC_API_KEY from .env.local (server-side only; never exposed via import.meta.env).
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), aiPlugin(env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)],
  }
})
