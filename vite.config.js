import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://azertexe.github.io/dashboard/ — update if the repo is ever renamed.
export default defineConfig({
  base: '/dashboard/',
  plugins: [react()],
})
