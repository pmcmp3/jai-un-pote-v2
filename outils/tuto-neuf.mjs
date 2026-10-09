// tuto-neuf.mjs — Un joueur NEUF (aucun tuto vu) : chaque tuto tombe-t-il sur
// la route dégagée (rows.degagerTutos), sans rien juste avant ? (4 octobre
// 2026, nuit : « quand tu mets un tutoriel, il ne faut pas que tu mettes un
// autre obstacle avant »). Course en accéléré, pilote qui suit les consignes.
//   node outils/tuto-neuf.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5199, strictPort: false, hmr: false } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 } })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
await page.addInitScript(() => {
  if (sessionStorage.getItem("pose")) return;
  sessionStorage.setItem("pose", "1");
  localStorage.clear();
  localStorage.setItem("jp2Pseudo", "neuf"); localStorage.setItem("jp2LigueVue", "1"); localStorage.setItem("jp2Parties", "3");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
// Invincible : un choc ailleurs ouvrirait la seconde chance, qui GÈLE
// l'horloge — la boucle accélérée ne finirait jamais.
await page.keyboard.press("KeyI");
const res = await page.evaluate(() => {
  const P = window.__pote, R = P.rows;
  const tutos = P.tutos();
  P.videoDemarrer();
  const vus = [], rates = [], obst = (row) => row.type === "statique" || row.type === "traverse" || row.type === "contresens";
  let dernier = null, pas = 0;
  const appui = (bas) => window.dispatchEvent(new KeyboardEvent(bas ? "keydown" : "keyup", { code: "Space" }));
  while (P.clock.now() < 45 && pas++ < 6000 && !P.game.ended) {
    const c = P.conseil();
    if (c.r !== null && c.r !== dernier) {
      dernier = c.r;
      let avant = null;
      for (let q = c.r - 1; q > 0; q--) if (obst(R.rowAt(q)) || P.tombes && false) { avant = q; break; }
      vus.push({ r: c.r, famille: c.famille, kind: R.rowAt(c.r).kind, t: +P.tMonde().toFixed(1), reserve: P.tutos().includes(c.r), ecartAvant: avant === null ? null : c.r - avant });
    }
    // Le pilote suit la consigne : tape quand on attend, re-tape au sommet.
    if (c.r !== null && (c.phase === "attente" || c.phase === "approche") && P.player.auSol) { appui(true); if (c.famille === "tap") appui(false); }
    if (c.r !== null && c.phase === "enl_air" && c.famille === "double" && P.player.jumpVy <= 0 && !P.player.doubled) { appui(false); appui(true); appui(false); }
    if (c.r !== null && c.phase === "enl_air" && c.famille === "haut") { /* on tient */ }
    if (c.r === null) appui(false);
    // Une rangée réservée qu'on dépasse sans tuto : pourquoi ?
    for (const r of P.tutos()) {
      if (P.player.v > r + 1 && P.player.prevV <= r + 1 && !vus.some((x) => x.r === r)) {
        const row = R.rowAt(r);
        rates.push({ r, kind: row.kind, type: row.type, armed: !!row.armed, t: +P.tMonde().toFixed(1), projo: P.projo(), conseil: c.r, appris: localStorage.getItem("jp2-appris"), vus: localStorage.getItem("jp2-conseils-vus") });
      }
    }
    P.videoAvance(P.clock.now() + 1 / 60);
  }
  return { rates, tutos: tutos.map((r) => `${r}:${R.rowAt(r).kind}(${R.familleDe(R.rowAt(r).kind)})`), vus, chocs: P.chocs().map((x) => `${x.kind || x.k || "?"}@${(x.t || 0).toFixed ? (x.t || 0).toFixed(1) : x.t}`) };
});
console.log("tutos réservés (rangées) :", res.tutos.join(", "));
for (const v of res.vus) console.log(`  tuto ${v.famille.padEnd(6)} sur ${v.kind.padEnd(10)} rangée ${v.r} à ${v.t} s · ${v.reserve ? "route dégagée" : "PAS SUR LA RANGÉE RÉSERVÉE"} · obstacle précédent ${v.ecartAvant === null ? "aucun" : v.ecartAvant + " rangées avant"}`);
for (const x of res.rates) console.log("  RATÉ", JSON.stringify(x));
console.log("chocs pendant ces 45 s :", res.chocs.length ? res.chocs.join(" · ") : "aucun");
console.log(erreurs.length ? `ERREURS : ${erreurs.join(" | ")}` : "aucune erreur JS");
const horsReserve = res.vus.filter((v) => !v.reserve).length;
verdict(res.vus.length > 0 && !horsReserve && !res.rates.length && !erreurs.length, `${res.vus.length} tuto(s) vus, ${horsReserve} hors de la route dégagée, ${res.rates.length} raté(s), ${erreurs.length} erreur(s) JS`);
await navigateur.close();
await serveur.close();
