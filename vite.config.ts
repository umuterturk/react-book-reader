import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Development mode - run the demo app
  if (mode === 'development') {
    return {
      plugins: [react()],
      server: {
        host: true,
        port: 3000,
      },
    };
  }

  // Library build mode
  if (mode === 'lib') {
    return {
      plugins: [
        react(),
        dts({
          include: ['lib'],
          outDir: 'dist',
          rollupTypes: true,
        }),
      ],
      publicDir: false, // Don't copy public folder assets to dist
      build: {
        lib: {
          entry: resolve(__dirname, 'lib/index.ts'),
          name: 'ReactBookReader',
          formats: ['es', 'cjs'],
          fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
          },
        },
        cssCodeSplit: false,
        sourcemap: true,
      },
    };
  }

  // Production mode (default) - build the demo app for GitHub Pages
  return {
    plugins: [react()],
    base: process.env.BASE_URL || '/',
    build: {
      outDir: 'dist',
    },
  };
});
