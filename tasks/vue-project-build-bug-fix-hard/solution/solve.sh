#!/bin/bash
# Reference solution for vue-crm build error level 4 task
# This script demonstrates how to fix the injected errors

cd /workspace/vue-crm

# Fix 1: Correct the vite plugin order and remove incorrect base path
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/tinymce/skins',
          dest: 'assets/tinymce'
        }
      ]
    }),
    vue(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    host: true,
  },
})
EOF

# Install dependencies if needed
npm install

# Start the dev server
npm run dev &

# Wait for server to start
sleep 10

# The agent would then need to:
# 0. Fix bugs
# 1. Open http://localhost:xxxx/ or http://localhost:xxxx/my-crm-app/ in browser
# 2. Verify Dashboard shows "Vue Demo V3"
# 3. Extract Total Growth: 2,324
# 4. Write results to /workspace/answer_file.txt
