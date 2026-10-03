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
const contexte = await navigateur.newContext({ viewport: { width: 375, height: petit ? 667 : 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
await page.focus("#pseudo-input"); await attendre(60);
console.log("focus pseudo (60 ms) :", JSON.stringify(await mesureChamp("#pseudo-input")));
await page.setViewportSize({ width: 375, height: hauteur - 336 - 44 }); await attendre(400);
await photo("50b-premiere-clavier");
console.log("clavier ouvert, pseudo :", JSON.stringify(await mesureChamp("#pseudo-input")));
await page.focus("#ville-input"); await attendre(300);
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
await page.click("#ligue-partager"); await attendre(2500);
await photo("53-premiere-arrivee");
await attendre(7000);
await photo("54-premiere-tous");
await page.click("#step2-back"); await attendre(500);
await photo("55-premiere-menu");
console.log("boost :", await page.textContent("#boost-ligue"));
console.log(erreurs.length ? "ERREURS :\n" + erreurs.join("\n") : "aucune erreur JS");
await navigateur.close(); await serveur.close();
