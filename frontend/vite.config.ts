import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Mirrors the "paths" entry in tsconfig.app.json. Both are required: tsc
  // resolves @/ for typecheck, Vite resolves it for the bundle.
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
