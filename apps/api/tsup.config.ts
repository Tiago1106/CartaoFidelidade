import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  // `@fregues/shared` is TypeScript source, which Node cannot run: it goes inside the bundle.
  noExternal: ['@fregues/shared'],
});
