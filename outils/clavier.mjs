// clavier.mjs — La carte « Qui es-tu ? » quand le clavier s'ouvre (5 octobre
// 2026, troisième passe : « ça monte d'un seul coup et ça redescend »).
//   node outils/clavier.mjs
// Deux modèles de clavier :
//   iOS (Safari, Instagram) : la page ne change pas de taille, seule la ZONE
//     VISIBLE (visualViewport) rétrécit — simulée ici par un faux
//     visualViewport dont on règle la hauteur et le décalage ;
//   Android : la page elle-même rétrécit (on réduit la fenêtre).
// Pour chaque cas : la trajectoire de la carte (haut du sticker → bas de la
// carte) toutes les 30 ms, puis sa place finale dans la zone visible.
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
mkdirSync(sorties, { recursive: true });
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5192, strictPort: false, hmr: false } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true });

// Mesuré sur la capture iPhone dans Instagram : page 714 px, zone visible 352 px.
// `ecran` : la hauteur de l'écran du téléphone (screen.height), la page étant
// plus courte (barre d'Instagram, de Safari).
const CAS = [
  { nom: "instagram-iphone", modele: "ios", ecran: 812, page: 714, visible: 352 },
  { nom: "instagram-iphone-se", modele: "ios", ecran: 667, page: 603, visible: 299 },
  { nom: "instagram-pro-max", modele: "ios", ecran: 932, page: 834, visible: 446 },
  { nom: "safari-iphone", modele: "ios", ecran: 844, page: 750, visible: 380 },
  { nom: "ios-avec-decalage", modele: "ios", ecran: 812, page: 714, visible: 352, decalage: 40 },
  { nom: "android", modele: "android", ecran: 800, page: 740, visible: 400 },
];
let ok = 0;
for (const cas of CAS) {
  const contexte = await navigateur.newContext({ viewport: { width: 375, height: cas.page }, screen: { width: 375, height: cas.ecran }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  if (cas.modele === "ios") {
    await page.addInitScript(() => {
      const faux = new EventTarget();
      let h = window.innerHeight, off = 0;
      Object.defineProperty(faux, "height", { get: () => h });
      Object.defineProperty(faux, "offsetTop", { get: () => off });
      Object.defineProperty(faux, "width", { get: () => window.innerWidth });
      Object.defineProperty(faux, "scale", { get: () => 1 });
      Object.defineProperty(window, "visualViewport", { get: () => faux, configurable: true });
      window.__clavier = (hh, oo = 0) => { h = hh; off = oo; faux.dispatchEvent(new Event("resize")); };
    });
  }
  await page.goto(`http://localhost:${port}/?premiere`);
  await page.waitForTimeout(3600);
  const mesure = () => page.evaluate(() => {
    const c = document.querySelector('#onboarding .step[data-step="1"]');
    const s = c.querySelector(".panel-header").getBoundingClientRect(), r = c.getBoundingClientRect();
    const vv = window.visualViewport;
    return { haut: Math.round(s.top), bas: Math.round(r.bottom), off: Math.round(vv.offsetTop), V: Math.round(vv.height), titre: getComputedStyle(document.getElementById("menu-title")).display };
  });
  const trajet = [];
  // Ce que l'œil voit : la position dans la ZONE VISIBLE (haut − décalage).
  const suivre = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = await mesure(); trajet.push(m.haut - m.off); await page.waitForTimeout(30); } };
  const avant = await mesure();
  // Le doigt touche le champ : focus, puis le clavier monte (≈ 0,25 s plus tard,
  // iOS annonce la zone visible définitive).
  await page.tap("#pseudo-input");
  await suivre(250);
  if (cas.modele === "ios") await page.evaluate(([v, o]) => window.__clavier(v, o), [cas.visible, cas.decalage || 0]);
  else await page.setViewportSize({ width: 375, height: cas.visible });
  await suivre(600);
  const ouvert = await mesure();
  await page.screenshot({ path: `${sorties}61-clavier-${cas.nom}.png` });
  // Champ suivant : rien ne doit bouger.
  await page.tap("#insta-input");
  await page.waitForTimeout(400);
  const champ2 = await mesure();
  // Fermeture du clavier.
  await page.evaluate(() => document.activeElement.blur());
  if (cas.modele === "ios") await page.evaluate((p) => window.__clavier(p, 0), cas.page);
  else await page.setViewportSize({ width: 375, height: cas.page });
  await page.waitForTimeout(700);
  const ferme = await mesure();
  // Deuxième ouverture : la part du clavier est retenue, plus aucune correction.
  const trajet2Debut = trajet.length;
  await page.tap("#pseudo-input");
  await suivre(250);
  if (cas.modele === "ios") await page.evaluate(([v, o]) => window.__clavier(v, o), [cas.visible, cas.decalage || 0]);
  else await page.setViewportSize({ width: 375, height: cas.visible });
  await suivre(500);
  const rouvert = await mesure();

  const zoneHaut = ouvert.off, zoneBas = ouvert.off + ouvert.V;
  const dedans = ouvert.haut >= zoneHaut && ouvert.bas <= zoneBas;
  const margeH = ouvert.haut - zoneHaut, margeB = zoneBas - ouvert.bas;
  // Aller-retour : la carte monte puis redescend (ou l'inverse) de plus de 6 px.
  const sens = (t) => { let monte = 0, descend = 0; for (let i = 1; i < t.length; i++) { const d = t[i] - t[i - 1]; if (d < 0) monte -= d; else descend += d; } return { monte: Math.round(monte), descend: Math.round(descend) }; };
  const s1 = sens(trajet.slice(0, trajet2Debut)), s2 = sens(trajet.slice(trajet2Debut));
  // Première ouverture : l'estimation du clavier peut laisser un petit
  // « posé » (≤ 12 px) ; la deuxième fois, la hauteur est connue : rien.
  const yoyo = Math.min(s1.monte, s1.descend) > 12 || s2.descend > 2;
  const bon = dedans && !yoyo && Math.abs(margeH - margeB) <= 12 && ferme.titre !== "none" && Math.abs(champ2.haut - ouvert.haut) <= 2 && !erreurs.length;
  if (bon) ok += 1;
  console.log(`${bon ? "OK " : "NON"} ${cas.nom.padEnd(20)} zone ${zoneHaut}–${zoneBas} · carte ${ouvert.haut}–${ouvert.bas} (marges ${margeH} / ${margeB}) · trajet 1 : monte ${s1.monte} px, redescend ${s1.descend} px · 2e fois : monte ${s2.monte}, redescend ${s2.descend} · champ suivant ${champ2.haut - ouvert.haut >= 0 ? "+" : ""}${champ2.haut - ouvert.haut} px · fermé : carte ${ferme.haut}–${ferme.bas}, titre ${ferme.titre}${erreurs.length ? " · ERREURS " + erreurs.join(" | ") : ""}`);
  await contexte.close();
}
verdict(ok === CAS.length, `${ok}/${CAS.length} téléphones : la carte reste en vue sans faire le yoyo`);
await navigateur.close();
await serveur.close();
