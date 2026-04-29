import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Força IPv4 para evitar AggregateError (Happy Eyeballs) no Windows
      // quando `localhost` resolve para ::1 e 127.0.0.1.
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
