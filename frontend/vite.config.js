/**
 * DirectMarket - Configuracion de Vite
 *
 * Configura el servidor de desarrollo y el build de produccion.
 * RNF-06: el proxy de desarrollo evita problemas de CORS en local.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Alias para importaciones absolutas desde src/
      '@': path.resolve(__dirname, './src')
    }
  },

  server: {
    port: 3000,
    // Proxy para el backend en desarrollo: evita CORS
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: 'dist',
    // Separar vendor chunk para mejor cache en produccion
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'clsx'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod']
        }
      }
    }
  },

  // Variables de entorno con prefijo VITE_ disponibles en el cliente
  envPrefix: 'VITE_'
});
