import { defineConfig } from "vite";

// Accès LAN pour tester depuis l'iPhone : `npm run dev` sert déjà sur l'IP
// locale. `allowedHosts` autorise un tunnel cloudflared (HTTPS public
// temporaire) — même réglage que le dépôt du premier jeu.
export default defineConfig({
  server: {
    host: true,
    allowedHosts: [".trycloudflare.com"],
  },
});
