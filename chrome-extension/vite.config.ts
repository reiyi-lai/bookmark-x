import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        content: 'src/content.ts',
        popup: 'src/popup/index.html',
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  define: {
    'process.env': process.env,
  },
}); 