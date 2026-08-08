import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Accessible depuis le tailnet, pas seulement en local : c'est par là que
    // l'iPhone atteint l'application en développement.
    host: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
