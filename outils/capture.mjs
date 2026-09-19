// capture.mjs — Harnais headless : lance le jeu dans Google Chrome en mode
// téléphone (375×812, écran tactile, DPR 2), démarre une course et prend des
// captures dans outils/sorties/. Sert le code SOURCE via Vite en mémoire (pas
// de build), ferme tout à la fin.
//
//   node outils/capture.mjs                → menu + 4 moments de course
//   node outils/capture.mjs nuit village   → scènes ciblées (voir SCENES)
//
// Pilotage : `?debug` expose window.__pote (joueur, jeu, rangées, potes) et
// les touches de debug (P = +1 pote, I = invincible, N = nuit, L = turbo).
// Le préfixe localStorage « jp2 » saute le tutoriel (5 parties déjà jouées).
import { createServer, preview } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
mkdirSync(sorties, { recursive: true });
const demandes = process.argv.slice(2);

// SERVIR=dist : teste le BUILD (dist-pages/, ce qui part en ligne) au lieu des sources.
const surBuild = process.env.SERVIR === "dist";
const serveur = surBuild
  ? await preview({ root: racine, logLevel: "error", build: { outDir: "dist-pages" }, preview: { port: 5198, strictPort: false } })
  : await createServer({ root: racine, logLevel: "error", server: { port: 5199, strictPort: false } });
if (!surBuild) await serveur.listen();
const port = surBuild ? new URL(serveur.resolvedUrls.local[0]).port : serveur.config.server.port;
const url = `http://localhost:${port}/?debug`;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
// ECRAN=petit : iPhone SE / 8 (375×667), le pire cas pour le menu.
const petit = process.env.ECRAN === "petit";
const contexte = await navigateur.newContext({ viewport: { width: 375, height: petit ? 667 : 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.stack || e.message));
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
await page.addInitScript((parties) => {
  localStorage.setItem("jp2Pseudo", "pmc");
  localStorage.setItem("jp2Parties", parties);
  localStorage.setItem("jp2MorceauOuvert", "1");
  localStorage.setItem("jp2PmcSuivi", "1");
}, process.env.PARTIES || "5");
await page.goto(url);
const attendre = (ms) => page.waitForTimeout(ms);
const photo = async (nom) => { await page.screenshot({ path: `${sorties}${nom}.png` }); console.log("  →", `outils/sorties/${nom}.png`); };

await attendre(1800);
await photo(petit ? "00-menu-petit" : "00-menu");
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 15000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 8000 });
await page.keyboard.press("KeyI"); // invincible : la course va au bout des captures
const course = (expr, arg) => page.evaluate(expr, arg);

const SCENES = {
  depart: async () => { await attendre(4500); await photo("01-depart"); },
  potes: async () => { for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP"); await attendre(1800); await photo("02-meute"); },
  obstacles: async () => {
    // Avance jusqu'au premier danger, puis photographie son approche.
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 12; r < 2000; r++) if (p.rows.rowAt(r).type !== "safe") return r; return 0; });
    await course((r) => { window.__pote.player.v = r - 9; }, r);
    await attendre(700); await photo("03-obstacle-approche");
    await attendre(650); await photo("04-obstacle-saut");
  },
  salto: async () => {
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 12; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.type === "statique" && ["fermier", "voiture"].includes(row.kind)) return r; } return 0; });
    await course((r) => { window.__pote.player.v = r - 8; }, r);
    await attendre(500); await photo("05-salto-approche");
  },
  tracteur: async () => {
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 30; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.type === "traverse" && row.kind === "tracteur" && !row.armed) return r; } return 0; });
    await course((r) => { window.__pote.player.v = r - 22; }, r);
    await attendre(1200); await photo("06-tracteur-alerte");
    await attendre(1100); await photo("07-tracteur-visible");
  },
  // Les halles : la rampe, le plancher en l'air, la charpente (20 sept. 2026).
  halle: async () => {
    // La première halle, lue dans le moteur (ses rangées dépendent de la
    // courbe de vitesse : jamais les recopier à la main).
    const d = await course(() => { const p = window.__pote; for (let r = 40; r < 1200; r++) if (p.rows.halleA(r) !== null) return p.rows.halleA(r); return 0; });
    await course((d) => { window.__pote.player.v = d - 6; }, d);
    await attendre(900); await photo("19-halle-approche");
    await course((d) => { window.__pote.player.v = d + 14; }, d);
    await attendre(900); await photo("20-halle-dessus");
  },
  // Choc : la bête percutée bascule (20 septembre 2026).
  choc: async () => {
    for (let i = 0; i < 4; i++) await page.keyboard.press("KeyP");
    await page.keyboard.press("KeyI"); // redevient vulnérable
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 14; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.type === "statique" && ["vache", "cochon", "mouton"].includes(row.kind)) return r; } return 0; });
    await course((r) => { window.__pote.player.v = r - 2.2; }, r);
    await attendre(650); await photo("23-choc");
    await page.keyboard.press("KeyI");
  },
  village: async () => {
    await course(() => { const p = window.__pote; let r = Math.ceil(p.player.v); while (Math.floor(r / 55) % 6 !== 3) r++; p.player.v = r + 20; });
    await attendre(900); await photo("08-village");
  },
  turbo: async () => { await page.keyboard.press("KeyL"); await attendre(600); await photo("09-turbo"); await attendre(5000); },
  nuit: async () => { await page.keyboard.press("KeyN"); await attendre(1500); await photo("10-nuit"); },
  // Le roller (20 septembre 2026) : on l'équipe depuis le menu.
  roller: async () => {
    await course(() => { const sk = JSON.parse(localStorage.getItem("jp2Skin") || "{}"); sk.velo = "roller"; localStorage.setItem("jp2Skin", JSON.stringify(sk)); });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 15000 });
    await photo("21-menu-roller");
    await page.click("#play-button");
    await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 8000 });
    await page.keyboard.press("KeyD");
    await attendre(4200); await photo("22-roller");
    await page.keyboard.press("KeyD");
  },
  // Coût de rendu avec le processeur ralenti 4× (≈ téléphone moyen) : moyenne
  // des temps de frame lus dans l'overlay pendant 4 s, meute complète, plein village.
  perf: async () => {
    const cdp = await contexte.newCDPSession(page);
    for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP");
    await course(() => { const p = window.__pote; let r = Math.ceil(p.player.v); while (Math.floor(r / 55) % 6 !== 3) r++; p.player.v = r + 8; });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const ms = await course(async () => { const t = []; const t0 = performance.now(); let last = t0; await new Promise((ok) => { const f = (n) => { t.push(n - last); last = n; if (n - t0 < 4000) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); }); t.sort((a, b) => a - b); return { moyenne: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.floor(t.length * 0.95)], n: t.length }; });
    // ⚠️ Le Chrome headless plafonne à 30 images/s : l'intervalle ne dit rien.
    // Ce qui compte, c'est le TEMPS DE TRAVAIL par image (perf.frameMs), qui
    // doit rester bien sous 16 ms pour tenir 60 images/s sur un vrai téléphone.
    const travail = await course(async () => { const t = []; for (let i = 0; i < 90; i++) { await new Promise((ok) => requestAnimationFrame(ok)); t.push(window.__pote.frameMs()); } t.sort((a, b) => a - b); return { moy: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.floor(t.length * 0.95)] }; });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    console.log(`  CPU ×4 : travail par image ${travail.moy.toFixed(1)} ms en moyenne, ${travail.p95.toFixed(1)} ms au 95e centile (intervalle ${ms.moyenne.toFixed(1)} ms, plafonné par le headless)`);
  },
  // Tutoriel (lancer avec PARTIES=0) : consigne 1, un tap, consigne 2.
  tuto: async () => {
    await page.keyboard.press("KeyD"); // overlay masqué pour la lisibilité
    await attendre(5200); await photo("12-tuto-1");
    await page.touchscreen.tap(200, 500); await attendre(1400); await photo("13-tuto-2");
    await page.keyboard.press("KeyD");
  },
  // Mort (touche G) : le panneau de seconde chance, puis l'écran de fin.
  fin: async () => {
    await page.keyboard.press("KeyI"); // redevient vulnérable
    await page.keyboard.press("KeyG"); await attendre(1200); await photo("14-seconde-chance");
    await page.click("#revive-decline").catch(() => {}); await attendre(1500); await photo("15-fin");
  },
  // Un salto en plein vol (tap, puis re-tap au sommet), avec la meute.
  saltoVol: async () => {
    await page.keyboard.press("KeyD");
    for (let i = 0; i < 3; i++) await page.keyboard.press("KeyP");
    await attendre(1500);
    await page.keyboard.press("Space"); await attendre(260); await page.keyboard.press("Space"); await attendre(170);
    await photo("16-salto");
    await attendre(420); await photo("17-meute-saute");
    await page.keyboard.press("KeyD");
  },
  // Fantôme injecté (pas de base v2 pour l'instant) : une trace qui roule 1,5 rangée devant.
  fantome: async () => {
    await course(() => { const p = window.__pote; const pts = []; for (let i = 0; i < 1800; i++) { const t = i / 10; pts.push([0, 4.6 * t + 1.5, 0]); } p.injecterFantome(pts, "lea"); });
    await attendre(1500); await photo("18-fantome");
  },
  // Sans l'overlay de debug (touche D), pour juger l'image telle que le joueur la voit.
  propre: async () => { await page.keyboard.press("KeyD"); await attendre(400); await photo("11-propre"); await page.keyboard.press("KeyD"); },
};
const liste = demandes.length ? demandes : Object.keys(SCENES);
for (const nom of liste) { if (SCENES[nom]) await SCENES[nom](); }
const stats = await course(() => ({ v: Math.round(window.__pote.player.v), potes: window.__pote.friends.count(), fps: window.__pote.fps ? window.__pote.fps() : null, erreurs: window.__erreursJeu || [] }));
console.log("État :", JSON.stringify(stats));
if (erreurs.length) console.log("ERREURS :", erreurs.slice(0, 8));
await navigateur.close();
await (surBuild ? serveur.httpServer.close() : serveur.close());
