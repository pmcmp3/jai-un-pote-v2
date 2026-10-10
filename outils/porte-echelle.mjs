// porte-echelle.mjs — L'échelle de la porte album / abonnement, vérifiée dans
// le VRAI jeu pour chaque état (5 octobre 2026) :
//   node outils/porte-echelle.mjs
// Pour chaque cas : localStorage posé, une course lancée, puis ce que la porte
// demanderait pour CONTINUER et pour REJOUER (screens.niveauConversionCourant).
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5195, strictPort: false, hmr: false } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });

// [parties DÉJÀ jouées, album ajouté, abonné] → attendu pendant la course qui démarre.
const CAS = [
  [0, false, false, "partie 1, rien fait", "continuer:presave rejouer:presave"],
  [0, true, false, "partie 1, album ajouté (déjà crash)", "continuer:libre rejouer:suivre"],
  [0, true, true, "partie 1, tout fait", "continuer:libre rejouer:libre"],
  [1, true, false, "partie 2", "continuer:libre rejouer:libre"],
  [2, true, false, "partie 3, pas abonné", "continuer:suivre rejouer:suivre"],
  [2, true, true, "partie 3, abonné", "continuer:libre rejouer:libre"],
  [5, false, true, "partie 6, abonné", "continuer:libre rejouer:libre"],
];
let ok = 0;
for (const [parties, album, suivi, nom, attendu] of CAS) {
  const contexte = await navigateur.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await contexte.newPage();
  await page.addInitScript(([parties, album, suivi]) => {
    if (sessionStorage.getItem("pose")) return;
    sessionStorage.setItem("pose", "1");
    localStorage.clear();
    localStorage.setItem("jp2Pseudo", "test"); localStorage.setItem("jp2LigueVue", "1");
    localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}');
    localStorage.setItem("jp2Parties", String(parties));
    if (album) localStorage.setItem("jp2MorceauOuvert", "1");
    if (suivi) localStorage.setItem("jp2PmcSuivi", "1");
  }, [parties, album, suivi]);
  await page.goto(`http://localhost:${port}/?debug`);
  await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
  await page.click("#play-button");
  await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
  const c = await page.evaluate(() => window.__pote.conversion());
  const m = /rejouer:(\w+) continuer:(\w+) partie:(\d+)/.exec(c);
  const lu = `continuer:${m[2]} rejouer:${m[1]}`;
  const bon = lu === attendu;
  if (bon) ok += 1;
  console.log(`${bon ? "OK " : "NON"} ${nom.padEnd(38)} → ${lu}${bon ? "" : `   (attendu ${attendu})`}`);
  await contexte.close();
}
console.log(`${ok}/${CAS.length} cas conformes`);
await navigateur.close();
await serveur.close();
