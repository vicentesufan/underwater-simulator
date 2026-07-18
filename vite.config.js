import { defineConfig } from 'vite';

// base: './' → rutas relativas, funciona en GitHub Pages (subpath), Netlify, Vercel
// o abriendo dist/ directamente desde el sistema de archivos.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
