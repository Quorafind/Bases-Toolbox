import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          'vendor-core': ['svelte'],
          'vendor-utils': ['js-yaml', 'luxon', 'parsimmon', 'emoji-regex'],
          'vendor-faker': ['@faker-js/faker'],
          'vendor-leaflet': ['leaflet'],

          // Application chunks
          'dataview-parser': [
            './src/dataview-parser/index.ts',
            './src/dataview-parser/query-parse.ts',
            './src/dataview-parser/transformer.ts',
            './src/dataview-parser/expression-parse.ts',
            './src/dataview-parser/normalize.ts'
          ],
        }
      }
    },
    // Increase chunk size warning limit to 3000kb since faker.js is intentionally large and lazy-loaded
    chunkSizeWarningLimit: 3000
  }
})
