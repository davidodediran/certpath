import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Split vendor code into separate chunks so Rollup processes smaller
    // pieces at a time, which significantly reduces peak memory during the
    // production build on low-RAM machines (e.g. EC2 t2/t3.micro, 1 GB).
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — loaded on every page, cache-friendly
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State management
          'vendor-state': ['zustand'],
          // Icon library (large, rarely changes)
          'vendor-icons': ['lucide-react'],
          // PDF generation (heavy — jsPDF + autoTable)
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // HTTP client
          'vendor-http': ['axios'],
        },
      },
    },
    // Use esbuild minifier (default, much faster + lower RAM than terser)
    minify: 'esbuild',
    // Raise the chunk-size warning threshold (cosmetic — keeps the log clean)
    chunkSizeWarningLimit: 800,
  },
});
