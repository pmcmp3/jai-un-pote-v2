// alertes.mjs — Combien de temps le panneau « attention » reste à l'écran
// (5 octobre 2026 : « il faut qu'il reste à la limite 2-3 secondes à l'écran,
// mais pas 5 [...] j'ai tout le temps le panneau attention sur la droite »).
//   node outils/alertes.mjs [début_s=40] [fin_s=170]
// Vraie course en accéléré (mode vidéo, pilote automatique, 30 images/s) :
// pour chaque véhicule, combien de secondes son panneau est resté affiché,
// et sur toute la tranche, la part du temps où un panneau est à l'écran.
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
const [debutArg = "40", finArg = "170"] = process.argv.slice(2);
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5190, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.keyboard.press("KeyI");
const res = await page.evaluate(([debut, fin]) => {
  const P = window.__pote;
  const st = { plan: null, tenir: false, double: false, appuye: false };
  const presser = () => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); st.appuye = true; };
  const lacher = () => { if (st.appuye) window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" })); st.appuye = false; };
  window.__pilote = () => {
    const pl = P.player, R = P.rows, C = window.CONFIG;
    if (st.plan && pl.auSol && pl.jumpVy <= 0 && st.plan.parti) { st.plan = null; lacher(); }
    if (!st.plan && pl.auSol) {
      const vit = P.vitesse();
      for (let r = Math.floor(pl.v) + 1; r <= Math.floor(pl.v) + 14; r++) {
        const row = R.rowAt(r);
        if (row.type === "safe") continue;
        const type = R.familleDe(row.kind);
        if (r - pl.v <= vit * R.montee(type)) { st.plan = { type, parti: false }; presser(); st.tenir = type !== "tap"; if (!st.tenir) lacher(); st.double = false; }
        break;
      }
    } else if (st.plan) {
      if (pl.jumpY > R.solAt(pl.v) + 0.05) st.plan.parti = true;
      if (st.tenir && pl.tHaut >= C.sautTenueMaxS) { lacher(); st.tenir = false; }
      if (st.plan.type === "double" && !st.double && st.plan.parti && pl.jumpVy <= 0) { lacher(); presser(); lacher(); st.double = true; }
    }
  };
  P.videoDemarrer();
  P.videoAvance(debut);
  P.suivreAlertes();
  let images = 0, avecPanneau = 0;
  const somme = () => P.alertes().reduce((a, e) => a + e.alerte, 0);
  while (P.clock.now() < fin && !P.game.ended) {
    const avant = somme();
    P.videoPas(1 / 30);
    images += 1;
    if (somme() > avant) avecPanneau += 1;
  }
  const parVehicule = P.alertes().filter((e) => e.alerte > 0).map((e) => ({ kind: e.kind, s: e.alerte / 30, vu: e.vu / 30 }));
  return { images, avecPanneau, parVehicule };
}, [Number(debutArg), Number(finArg)]);
const duree = res.images / 30;
const moy = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log(`Tranche ${debutArg}–${finArg} s : panneau à l'écran ${(res.avecPanneau / 30).toFixed(1)} s sur ${duree.toFixed(1)} s (${Math.round((100 * res.avecPanneau) / Math.max(1, res.images))} %)`);
console.log(`Par véhicule : ${res.parVehicule.length} panneaux, ${moy(res.parVehicule.map((e) => e.s)).toFixed(2)} s en moyenne, max ${Math.max(0, ...res.parVehicule.map((e) => e.s)).toFixed(2)} s`);
const parKind = {};
for (const e of res.parVehicule) (parKind[e.kind] = parKind[e.kind] || []).push(e.s);
console.log("  " + Object.entries(parKind).map(([k, a]) => `${k} ${a.length}× ${moy(a).toFixed(1)} s`).join(" · "));
await navigateur.close(); await serveur.close();
