import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui': ['lucide-react', 'react-hot-toast'],
          'utils': ['date-fns', 'xlsx'],
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  preview: {
    allowedHosts: 'all',
    host: '0.0.0.0',
    port: 3000
  },
  server: {
    allowedHosts: 'all',
    host: '0.0.0.0',
    port: 3000
  }
})
