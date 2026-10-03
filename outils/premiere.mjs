// premiere.mjs — Parcours du lien `?premiere` (3 octobre 2026) : première
// visite, création de ligue démo, potes fictifs qui arrivent, boost au menu.
//   node outils/premiere.mjs        (ECRAN=petit pour le 375×667)
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
mkdirSync(sorties, { recursive: true });
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5197, strictPort: false } });
await serveur.listen();
const port = serveur.config.server.port;
const petit = process.env.ECRAN === "petit";
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
// Navigateur intégré d'Instagram (5 octobre 2026 : le partage y était muet).
const UA_INSTA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.21.106 (iPhone15,2; iOS 18_0; fr_FR; fr; scale=3.00; 1179x2556; 646427221)";
const contexte = await navigateur.newContext({ viewport: { width: 375, height: petit ? 667 : 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_INSTA });
await contexte.grantPermissions(["clipboard-read", "clipboard-write"], { origin: `http://localhost:${port}` });
// Partage natif : il marche dans Instagram sur iPhone (essayé le 5 octobre
// 2026) et le jeu l'utilise d'abord ; il MANQUE dans Instagram sur Android —
// c'est ce cas-là, celui du tiroir maison, qu'on simule ici.
await contexte.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true }); } catch (e) { /* rien */ } });
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.stack || e.message));
const attendre = (ms) => page.waitForTimeout(ms);
const sfx = petit ? "-petit" : "";
const photo = async (nom) => { await page.screenshot({ path: `${sorties}${nom}${sfx}.png` }); console.log("  →", `outils/sorties/${nom}${sfx}.png`); };
// Un ancien joueur : `?premiere` doit tout effacer.
await page.goto(`http://localhost:${port}/`);
await page.evaluate(() => { localStorage.setItem("jp2Pseudo", "ancien"); localStorage.setItem("jp2Parties", "9"); });
await page.goto(`http://localhost:${port}/?premiere`);
await attendre(700);
await photo("49-premiere-chargement");
await attendre(2600);
console.log("url après chargement :", page.url(), "| pseudo :", await page.inputValue("#pseudo-input"));
await photo("50-premiere-pseudo");
// Clavier : pas d'animation au focus, l'overlay épouse la zone visible
// (simulée ici en réduisant la fenêtre à ce qui reste au-dessus d'un clavier
// d'iPhone), le champ actif reste en vue.
const mesureChamp = (sel) => page.evaluate((sel) => {
  const o = document.getElementById("overlay"), r = document.querySelector(sel).getBoundingClientRect(), ro = o.getBoundingClientRect();
  return { champ: [Math.round(r.top), Math.round(r.bottom)], overlay: [Math.round(ro.top), Math.round(ro.bottom)], visible: r.top >= ro.top && r.bottom <= ro.bottom, clavier: o.classList.contains("clavier"), titre: getComputedStyle(document.getElementById("menu-title")).display, transition: getComputedStyle(o).transitionProperty };
}, sel);
const hauteur = petit ? 667 : 812;
await page.tap("#pseudo-input"); await attendre(60);
console.log("focus pseudo (60 ms) :", JSON.stringify(await mesureChamp("#pseudo-input")));
await page.setViewportSize({ width: 375, height: hauteur - 336 - 44 }); await attendre(400);
await photo("50b-premiere-clavier");
console.log("clavier ouvert, pseudo :", JSON.stringify(await mesureChamp("#pseudo-input")));
await page.tap("#ville-input"); await attendre(300);
await photo("50c-premiere-clavier-ville");
console.log("clavier ouvert, ville :", JSON.stringify(await mesureChamp("#ville-input")));
await page.evaluate(() => document.activeElement.blur());
await page.setViewportSize({ width: 375, height: hauteur }); await attendre(700);
await photo("50d-premiere-clavier-ferme");
console.log("clavier fermé :", JSON.stringify(await mesureChamp("#pseudo-input")), "centre", await page.evaluate(() => getComputedStyle(document.getElementById("overlay")).getPropertyValue("--centre")));
await page.fill("#pseudo-input", "paul");
await page.click("#step1-next"); await attendre(400);
await photo("51a-premiere-cycliste");
console.log("bouton cycliste :", await page.textContent("#play-button"));
await page.click("#play-button"); await attendre(400);
await photo("51-premiere-ligue");
await page.click("#ligue-creer"); await attendre(400);
await photo("52-premiere-creee");
await page.click("#ligue-partager"); await attendre(450);
await photo("52b-partage-tiroir");
console.log("tiroir de partage :", JSON.stringify(await page.evaluate(() => ({
  visible: document.getElementById("partage-sheet").classList.contains("visible"),
  lien: document.getElementById("partage-lien").textContent,
  whatsapp: document.getElementById("partage-whatsapp").href.slice(0, 70),
  sms: document.getElementById("partage-sms").href.slice(0, 40),
  snap: document.getElementById("partage-snap").href.slice(0, 70),
  insta: document.getElementById("credit-insta").href,
}))));
await page.click("#partage-copier"); await attendre(350);
console.log("copie :", await page.textContent("#partage-hint"), "| presse-papiers :", await page.evaluate(() => navigator.clipboard.readText().catch((e) => "ILLISIBLE " + e.message)));
await photo("52c-partage-copie");
await page.click("#partage-fermer"); await attendre(2500);
await photo("53-premiere-arrivee");
await attendre(7000);
await photo("54-premiere-tous");
await page.click("#step2-back"); await attendre(500);
await photo("55-premiere-menu");
console.log("boost :", await page.textContent("#boost-ligue"));
console.log(erreurs.length ? "ERREURS :\n" + erreurs.join("\n") : "aucune erreur JS");
await navigateur.close(); await serveur.close();
