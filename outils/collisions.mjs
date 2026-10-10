// collisions.mjs — Chaque obstacle percuté coûte bien (5 octobre 2026 : « je
// suis passé au travers du skieur [...] il faut bien que tu vérifies que, si
// je me prends des objets, je meurs »).
//   node outils/collisions.mjs
// Vraie course en accéléré (mode vidéo), joueur qui NE SAUTE JAMAIS, ni
// invincible ni turbo, tutos déjà appris ; on lui redonne des potes au fil de
// l'eau pour qu'il survive. Pour chaque espèce : rencontrées / percutées.
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5187, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  // Espion : chaque appel à la vibration (Android) est noté.
  window.__vibrations = [];
  Object.defineProperty(Navigator.prototype, "vibrate", { value: (m) => { window.__vibrations.push(m); return true; }, configurable: true });
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
const res = await page.evaluate(() => {
  const P = window.__pote;
  P.videoDemarrer();
  const vus = {}, touches = {}, ratees = [], invulnerables = {};
  const dejaVus = new Set(), payes = new Set(), pourquoi = [];
  while (P.clock.now() < 170 && !P.game.ended) {
    // Toujours au moins 3 potes : le joueur survit à tout.
    while (P.friends.count() < 3) P.friends.join(P.player);
    const avant = P.friends.count(), nChocs = P.chocs().length, dernier = P.chocs()[nChocs - 1];
    P.videoPas(1 / 60);
    // Un choc qui a COÛTÉ (des potes en moins) : son obstacle est « payé ».
    const apres = P.chocs();
    if (apres.length && apres[apres.length - 1] !== dernier) {
      if (P.friends.count() < avant) payes.add(apres[apres.length - 1].r);
      else pourquoi.push(`${apres[apres.length - 1].kind}@${Math.round(P.clock.now())}s ${P.game.turbo > 0 ? "turbo" : "autre"}`);
    }
    const v = P.player.v;
    for (let r = Math.floor(v) - 2; r <= Math.floor(v); r++) {
      const row = P.rows.rowAt(r);
      if (row.type === "safe" || dejaVus.has(r)) continue;
      // Franchi : le joueur est passé au-delà de l'obstacle (sa position du moment).
      const c = row.type === "contresens" ? (row.armed ? r + row.v0 - row.vitesse * (P.tMonde() - row.t0) : r) : r;
      const K = P.rows.KINDS[row.kind];
      if (v < c + K.long / 2 + 1) continue;
      dejaVus.add(r);
      vus[row.kind] = (vus[row.kind] || 0) + 1;
      const touche = P.chocs().some((x) => x.r === r);
      // La mouette plane au-dessus de la tête : sans sauter, on passe dessous.
      if (K.aerien) { if (touche) ratees.push(`${row.kind}@${r} TOUCHÉE AU SOL`); continue; }
      if (touche && payes.has(r)) touches[row.kind] = (touches[row.kind] || 0) + 1;
      else if (touche) invulnerables[row.kind] = (invulnerables[row.kind] || 0) + 1;
      else ratees.push(`${row.kind}@${r} t=${P.clock.now().toFixed(1)}`);
    }
  }
  return { vus, touches, invulnerables, pourquoi, ratees: ratees.slice(0, 20), fin: P.clock.now(), vibrationsChoc: window.__vibrations.filter((m) => m === 60).length };
});
console.log("Rencontrés / percutés (et payés) / percutés pendant une invulnérabilité (turbo, bouclier) :");
for (const k of Object.keys(res.vus).sort()) console.log(`  ${k.padEnd(12)} ${res.vus[k]} / ${res.touches[k] || 0} / ${res.invulnerables[k] || 0}`);
console.log(`Traversés SANS choc : ${res.ratees.length}`, res.ratees.join(" · "));
console.log("Chocs sans coût :", res.pourquoi.join(" · "));
console.log(`fin à ${res.fin.toFixed(1)} s`, erreurs.length ? `ERREURS ${erreurs.join(" | ")}` : "");
const payes = Object.values(res.touches).reduce((a, b) => a + b, 0);
console.log(`Vibrations de choc : ${res.vibrationsChoc} pour ${payes} chocs payés`);
verdict(!res.ratees.length && !erreurs.length && res.fin > 160 && res.vibrationsChoc >= payes, `${res.ratees.length} obstacle(s) traversé(s) sans choc, ${res.vibrationsChoc}/${payes} chocs qui vibrent, ${erreurs.length} erreur(s) JS, course jusqu'à ${res.fin.toFixed(0)} s`);
await navigateur.close(); await serveur.close();
