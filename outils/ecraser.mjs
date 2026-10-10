// ecraser.mjs — Une petite bête prise PAR LE DESSUS s'écrase (rebond, aucun
// pote perdu) ; prise de face, elle coûte toujours.
//   node outils/ecraser.mjs
// Vraie course en accéléré : avant chaque petite bête, le joueur est posé en
// l'air au-dessus d'elle, en train de descendre — il doit lui retomber dessus.
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5209, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${serveur.config.server.port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
const res = await page.evaluate(() => {
  const P = window.__pote, PETITES = new Set(["poule", "chat", "chien", "cochon", "mouton"]);
  P.videoDemarrer();
  const faites = new Set(), ecrasees = [], ratees = [];
  while (P.clock.now() < 120 && !P.game.ended && ecrasees.length + ratees.length < 12) {
    while (P.friends.count() < 3) P.friends.join(P.player);
    const v = P.player.v;
    for (let r = Math.floor(v) + 1; r <= v + 3; r++) {
      const row = P.rows.rowAt(r);
      if (row.type !== "statique" || !PETITES.has(row.kind) || faites.has(r)) continue;
      const K = P.rows.KINDS[row.kind], bord = r - K.long / 2 - P.rows.VELO_DEMI;
      if (v < bord - 0.6 || v > bord - 0.2) continue;
      faites.add(r);
      // En l'air au-dessus d'elle, en descente : il va lui retomber dessus.
      P.player.jumpY = K.h + 0.35; P.player.prevJumpY = P.player.jumpY; P.player.jumpVy = -1; P.player.doubled = true;
      const avant = P.friends.count(), n0 = P.chocs().length;
      for (let i = 0; i < 40 && P.chocs().length === n0; i++) P.videoPas(1 / 120);
      const c = P.chocs()[P.chocs().length - 1];
      if (P.chocs().length > n0 && c.r === r && c.dessus && P.friends.count() === avant && P.player.jumpVy > 0) ecrasees.push(row.kind);
      else ratees.push(`${row.kind}@${r} ${P.chocs().length > n0 ? `choc dessus=${c.dessus} potes ${avant}→${P.friends.count()}` : "aucun contact"}`);
    }
    P.videoPas(1 / 60);
  }
  return { ecrasees, ratees };
});
await navigateur.close(); await serveur.close();
for (const r of res.ratees) console.log("  ", r);
verdict(res.ecrasees.length >= 5 && !res.ratees.length && !erreurs.length, `${res.ecrasees.length} petite(s) bête(s) écrasée(s) par le dessus sans perdre de pote (${[...new Set(res.ecrasees)].join(", ")}), ${res.ratees.length} ratée(s), ${erreurs.length} erreur(s) JS`);
