import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'livekit-client'], alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: { environment: 'node', include: ['__tests__/**/*.test.tsx'] },
});
