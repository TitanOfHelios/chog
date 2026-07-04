import { defineConfig } from 'vite';

export default defineConfig({
  // Tek .env dosyasını kökten (client/'ın bir üstünden) okumak için.
  envDir: '../',
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
});
