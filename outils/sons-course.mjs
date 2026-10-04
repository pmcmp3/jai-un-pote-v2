// sons-course.mjs — Le journal des bruitages d'une course entière (4 octobre
// 2026, nuit) : vraie course en accéléré (mode vidéo, ?debug), joueur
// invincible qui ne saute jamais (il percute tout : chaque cri sort), et pour
// chaque son joué l'instant de la course, le décor et la position gauche/
// droite. Vérifie aussi qu'aucune erreur ne sort de la page.
//   node outils/sons-course.mjs [graine]
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5193, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.keyboard.press("KeyI"); // invincible : il percute tout, sans mourir
const reel = process.argv.includes("--reel");
// --reel : la course tourne en temps réel (~3 min) — les cadences (klaxons,
// oiseaux, quilles) sont alors celles du jeu, et on relève les i/s.
const res = reel ? await enTempsReel() : await page.evaluate(() => {
  const P = window.__pote;
  window.__journalSons = [];
  P.videoDemarrer();
  const journal = [];
  let vus = 0, pas = 0;
  while (P.clock.now() < 175 && !P.game.ended && pas++ < 20000) {
    P.videoPas(1 / 30);
    const J = window.__journalSons;
    for (; vus < J.length; vus++) {
      const r = Math.round(P.player.v);
      journal.push({ t: Math.round(P.clock.now() * 10) / 10, ...J[vus], biome: P.rows.biomeDe(r), halle: P.rows.halleA(r) === null ? "" : P.rows.typeHalle(P.rows.halleA(r)) });
    }
  }
  return { journal, fin: P.clock.now(), ended: P.game.ended };
});
async function enTempsReel() {
  await page.evaluate(() => { window.__journalSons = []; window.__journalT = []; });
  const journal = [], fps = [];
  let vus = 0;
  for (;;) {
    await page.waitForTimeout(200);
    const e = await page.evaluate(() => {
      const P = window.__pote, J = window.__journalSons, r = Math.round(P.player.v);
      return { t: P.clock.now(), fin: P.game.ended, fps: P.fps(), n: J.length, nouveaux: J.slice(0), biome: P.rows.biomeDe(r), halle: P.rows.halleA(r) === null ? "" : P.rows.typeHalle(P.rows.halleA(r)) };
    });
    for (; vus < e.n; vus++) journal.push({ t: Math.round(e.t * 10) / 10, ...e.nouveaux[vus], biome: e.biome, halle: e.halle });
    if (e.t > 1) fps.push(e.fps);
    if (e.fin || e.t > 175) return { journal, fin: e.t, ended: e.fin, fps };
  }
}
await navigateur.close();
await serveur.close();
if (res.fps) console.log(`i/s : médiane ${res.fps.sort((a, b) => a - b)[Math.floor(res.fps.length / 2)]}, min ${res.fps[0]}`);
const parNom = {};
for (const e of res.journal) parNom[e.nom] = (parNom[e.nom] || []).concat(e.t);
console.log(`Course jusqu'à ${res.fin.toFixed(1)} s (${res.ended ? "terminée" : "interrompue"}), ${res.journal.length} sons joués.`);
for (const [nom, ts] of Object.entries(parNom).sort((a, b) => a[1][0] - b[1][0])) {
  console.log(`  ${nom.padEnd(20)} ×${String(ts.length).padStart(3)}  ${ts.slice(0, 8).map((t) => `${t}s`).join(" ")}${ts.length > 8 ? " …" : ""}`);
}
const horsDecor = res.journal.filter((e) => (["mouette"].includes(e.nom) && e.biome !== "plage") || (["oiseau", "grillon"].includes(e.nom) && e.biome !== "route"));
console.log(horsDecor.length ? `⚠️ hors de leur décor : ${JSON.stringify(horsDecor.slice(0, 5))}` : "Ambiances : toutes dans leur décor.");
console.log(erreurs.length ? `⚠️ erreurs : ${erreurs.slice(0, 5).join(" | ")}` : "Aucune erreur dans la page.");
