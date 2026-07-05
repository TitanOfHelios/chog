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
  // "three" paketinin exports/ana giriş noktası bazı ortamlarda (ör. Termux/
  // Android üzerinde npm install yarım kalırsa) esbuild'in ilk tarama
  // aşamasında (dep-scan) çözülemiyor ve "Failed to resolve entry for
  // package three" hatası veriyor. optimizeDeps.include ile Vite'ı bu
  // paketi baştan, açıkça ön-paketlemeye zorluyoruz; bu genelde sorunu
  // çözer. Asıl kalıcı çözüm yine de client/node_modules'ü temiz şekilde
  // yeniden kurmaktır (bkz. README "Sorun giderme" bölümü).
  optimizeDeps: {
    include: ['three'],
  },
});
