import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace 'REPO_NAME' below with your actual GitHub repository name.
  // Example: If your repo URL is github.com/username/christmas-card, this should be '/christmas-card/'
  base: '/christmas-tree-webapp/', 
})