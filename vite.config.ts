import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const single = mode === 'singlefile';
  const artifact = mode === 'artifact'; // Vorschau ohne Service Worker
  return {
    base: './',
    plugins: [
      react(),
      artifact
        ? null
        : single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            workbox: {
              // OCR-Sprachdaten und Programmteile offline verfügbar machen
              globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,traineddata}'],
              maximumFileSizeToCacheInBytes: 16 * 1024 * 1024
            },
            manifest: {
              name: 'Milewyse',
              short_name: 'Milewyse',
              description: 'Wartung, Historie, Belege und Kosten – für jedes Fahrzeug',
              lang: 'de',
              start_url: './',
              display: 'standalone',
              background_color: '#2D62F2',
              theme_color: '#f3f4f6',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
              ]
            }
          })
    ],
    build: { outDir: single ? 'dist-preview' : artifact ? 'dist-artifact' : 'dist' },
    test: { environment: 'node' }
  };
});
