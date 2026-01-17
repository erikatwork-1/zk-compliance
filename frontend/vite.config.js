import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['buffer']
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': '/src',
      buffer: resolve(__dirname, 'node_modules/buffer/')
    }
  },
  define: {
    global: 'globalThis'
  }
});
