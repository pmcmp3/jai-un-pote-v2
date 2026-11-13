// video.mjs — Extrait vidéo 9:16 d'une course, pour TikTok / Reels (5 octobre
// 2026 : « un extrait vidéo d'une personne qui joue entre les biomes, format
// 9:16 [...] une vidéo de 15 secondes, un petit peu intense, avec le personnage
// qui roule avec ses potes »).
//
//   node outils/video.mjs <nom> <début_s> [durée_s=15] [jetpack]
//   ex. node outils/video.mjs montagne 41 15
//
// Chrome headless en 360×640 CSS × 3 = 1080×1920. La simulation et l'horloge
// avancent À LA MAIN, image par image (window.__pote.videoPas) : 30 images
// par seconde nettes, quel que soit le temps de capture. Un pilote
// automatique saute « juste » (la même règle que le joueur idéal de
// mesurer.mjs), cinq potes roulent avec lui. ffmpeg assemble les images et
// l'extrait du morceau qui joue À CET INSTANT de la course.
// Sortie : outils/sorties/video-<nom>.mp4
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { installerPilote } from "./pilote.mjs";

const [nom = "extrait", debutArg = "41", dureeArg = "15", option = ""] = process.argv.slice(2);
const DEBUT = Number(debutArg), DUREE = Number(dureeArg), FPS = 30;
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
const images = `${sorties}video-${nom}-images/`;
rmSync(images, { recursive: true, force: true });
mkdirSync(images, { recursive: true });

// Sans rechargement à chaud : un fichier modifié pendant le tournage
// rechargerait la page en pleine prise.
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5196, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.stack || e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]');
  localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2Insta", "pmc.mp3");
  localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}');
  localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug&dpr=3${option === "jetpack" ? "&jetpack" : ""}`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.keyboard.press("KeyI");                       // invincible : rien ne casse la prise
for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP"); // cinq potes
await page.keyboard.press("KeyD");                       // pas de calque de debug à l'image

// Pilote automatique : la règle du joueur idéal (outils/pilote.mjs).
await page.evaluate(installerPilote);

// En place : horloge à la main, puis avance rapide jusqu'au début de l'extrait.
await page.evaluate(() => window.__pote.videoDemarrer());
if (option === "jetpack") {
  const r = await page.evaluate(() => window.__pote.forcerJetpack());
  console.log("jetpack posé en rangée", r);
}
await page.evaluate((t) => window.__pote.videoAvance(t), DEBUT);
const position = await page.evaluate(() => window.__pote.positionMorceau());
console.log(`extrait « ${nom} » : course ${DEBUT} s → ${DEBUT + DUREE} s, morceau à ${position.toFixed(2)} s`);

const n = Math.round(DUREE * FPS);
for (let i = 0; i < n; i++) {
  await page.evaluate((dt) => window.__pote.videoPas(dt), 1 / FPS);
  await page.screenshot({ path: `${images}${String(i).padStart(4, "0")}.jpg`, type: "jpeg", quality: 93 });
  if (i % 60 === 0) console.log(`  image ${i}/${n}`);
}
const etat = await page.evaluate(() => ({ potes: window.__pote.friends.count(), v: window.__pote.player.v.toFixed(0), pieces: window.__pote.game.points }));
console.log("fin :", JSON.stringify(etat), erreurs.length ? `ERREURS ${erreurs.join(" | ")}` : "aucune erreur JS");
await navigateur.close();
await serveur.close();

const sortie = `${sorties}video-${nom}.mp4`;
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-framerate", String(FPS), "-i", `${images}%04d.jpg`,
  "-ss", position.toFixed(3), "-t", String(DUREE), "-i", `${racine}public/assets/jai-un-pote.mp3`,
  "-map", "0:v", "-map", "1:a",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow", "-r", String(FPS),
  "-c:a", "aac", "-b:a", "192k", "-af", `afade=t=in:d=0.4,afade=t=out:st=${(DUREE - 0.8).toFixed(2)}:d=0.8`,
  "-movflags", "+faststart", "-shortest", sortie,
], { stdio: "inherit" });
rmSync(images, { recursive: true, force: true });
console.log("→", sortie);
// La même SANS SON (4 octobre 2026) : sur Instagram, le titre se pose depuis
// la bibliothèque musicale (« J'ai un pote », PMC) pour que le Reel rejoigne la
// page du son — un son importé avec la vidéo créerait un « audio original » à part.
const muette = sortie.replace(/\.mp4$/, "-sans-son.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", sortie, "-an", "-c:v", "copy", "-movflags", "+faststart", muette], { stdio: "inherit" });
console.log("→", muette);
