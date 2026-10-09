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
import { verdict } from "./verdict.mjs";

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
const url = `http://localhost:${port}/?debug${process.env.DEMO ? "&demo" : ""}`;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
// ECRAN=petit : iPhone SE / 8 (375×667), le pire cas pour le menu.
const petit = process.env.ECRAN === "petit";
const i16 = process.env.ECRAN === "i16";
const contexte = await navigateur.newContext({ viewport: { width: i16 ? 393 : 375, height: petit ? 667 : i16 ? 852 : 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.stack || e.message));
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
await page.addInitScript(([parties, neuf, genre, velo]) => {
  if (genre || velo) localStorage.setItem("jp2Skin", JSON.stringify({ genre: genre || "homme", velo: velo || "vtt" }));
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); // pas de conseil hors des scènes qui le testent
  localStorage.setItem("jp2Pseudo", "pmc");
  localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}'); // projecteurs : seulement dans la scène qui les teste
  localStorage.setItem("jp2Parties", parties);
  if (!neuf) { localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1"); }
}, [process.env.PARTIES || "5", process.env.NEUF === "1", process.env.GENRE || "", process.env.VELO || ""]);
await page.goto(url);
const attendre = (ms) => page.waitForTimeout(ms);
const photo = async (nom) => { await page.screenshot({ path: `${sorties}${nom}.png` }); console.log("  →", `outils/sorties/${nom}.png`); };

await attendre(1800);
await photo(petit ? "00-menu-petit" : "00-menu");
if (demandes.includes("menus")) {
  await page.click("#step3-profil"); await attendre(500); await photo("40-menu-profil");
  await page.click("#step1-next"); await attendre(500); await photo("41-menu-ligue");
  await page.click("#step2-next"); await attendre(500);
}
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 15000 });
await page.click("#play-button");
if (process.env.EXPL) { await attendre(2200); await photo("05-explication"); await attendre(4000); await photo("05b-explication"); await attendre(4800); await photo("05c-explication"); await attendre(5000); await photo("05d-explication"); await attendre(450); await photo("05e-explication"); }
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 20000 });
await page.keyboard.press("KeyI"); // invincible : la course va au bout des captures
const course = (expr, arg) => page.evaluate(expr, arg);

const SCENES = {
  decompte: async () => { await page.keyboard.press("KeyD"); await attendre(250); await photo("00b-decompte"); await page.keyboard.press("KeyD"); },
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
    await page.keyboard.press("KeyD");
    await course((d) => { window.__pote.player.v = d - 6; }, d);
    await attendre(900); await photo("19-halle-approche");
    await course((d) => { window.__pote.player.v = d + 3; }, d);
    await attendre(500); await photo("19b-halle-rampe");
    await course((d) => { window.__pote.player.v = d + 14; }, d);
    await attendre(900); await photo("20-halle-dessus");
    for (let i = 0; i < 4; i++) await page.keyboard.press("KeyP");
    await course((d) => { const p = window.__pote; p.player.v = d + 33.5; p.player.jumpY = p.rows.solAt(p.player.v); }, d);
    await attendre(1300); await photo("20b-halle-descente");
    await page.keyboard.press("KeyD");
  },
  // Les trois bâtiments (3 octobre 2026) : marché, bowling, gare.
  batiments: async () => {
    const ds = await course(() => { const p = window.__pote, out = []; for (let r = 40; r < 1500; r++) { const d = p.rows.halleA(r); if (d !== null && !out.includes(d)) out.push(d); } return out; });
    await page.keyboard.press("KeyD");
    for (const d of ds) {
      const type = await course((d) => window.__pote.rows.typeHalle(d), d);
      await course((d) => { const p = window.__pote; p.player.v = d + 14; p.player.jumpY = p.rows.solAt(p.player.v); }, d);
      await attendre(900); await photo(`47-batiment-${type}`);
      await course((d) => { const p = window.__pote; p.player.v = d - 5; p.player.jumpY = 0; }, d);
      await attendre(700); await photo(`47-batiment-${type}-entree`);
    }
    await page.keyboard.press("KeyD");
  },
  // Le TER qui entre en gare et les quilles qui tombent (4 octobre 2026, nuit).
  train: async () => {
    const d = await course(() => { const p = window.__pote; for (let r = 40; r < 1500; r++) { const d = p.rows.halleA(r); if (d !== null && p.rows.typeHalle(d) === "gare") return d; } return 0; });
    await attendre(3500); // le menu finit de s'effacer
    for (const k of (process.env.TRAIN_K || "3,6,9,14,22").split(",").map(Number)) {
      await course(([d, k]) => { const p = window.__pote; p.player.v = d + k; p.player.prevV = p.player.v; p.player.jumpY = p.rows.solAt(p.player.v); p.player.prevJumpY = p.player.jumpY; }, [d, k]);
      await attendre(60); await photo(`60-train-${k < 0 ? "m" + -k : k}`);
    }
  },
  quilles: async () => {
    const d = await course(() => { const p = window.__pote; for (let r = 40; r < 1500; r++) { const d = p.rows.halleA(r); if (d !== null && p.rows.typeHalle(d) === "bowling") return d; } return 0; });
    await course((d) => { const p = window.__pote; p.player.v = d + 15; p.player.jumpY = p.rows.solAt(p.player.v); }, d);
    for (let i = 0; i < 3; i++) { await attendre(380); await photo(`61-quilles-${i}`); }
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
  // Panneau de commune (4 octobre 2026, nuit : +50 %) : joueur posé 5 rangées avant.
  panneau: async () => {
    await course(() => { const p = window.__pote; let r = Math.ceil(p.player.v) + 30; while (r % 45 !== 20) r++; p.player.v = r - 5; p.player.prevV = r - 5; });
    await attendre(500); await photo("08b-panneau");
  },
  turbo: async () => { await page.keyboard.press("KeyL"); await attendre(300); await photo("09-turbo"); await attendre(5000); },
  nuit: async () => { await page.keyboard.press("KeyN"); await attendre(1500); await photo("10-nuit"); },
  // Le roller (20 septembre 2026) : on l'équipe depuis le menu.
  roller: async () => {
    await course(() => { const sk = JSON.parse(localStorage.getItem("jp2Skin") || "{}"); sk.velo = "roller"; localStorage.setItem("jp2Skin", JSON.stringify(sk)); });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 15000 });
    await photo("21-menu-roller");
    await page.click("#play-button");
    await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 20000 });
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
  // Auto-audit du tuto contextuel : chaque famille, bon geste, sans toucher de pote.
  audit: async () => {
    await page.keyboard.press("KeyI"); // vulnérable : l'obstacle expliqué ne doit PAS coûter de pote
    for (let i = 0; i < 3; i++) await page.keyboard.press("KeyP");
    await attendre(600);
    const res = [];
    for (const fam of ["tap", "haut", "double"]) {
      await course((f) => { const tous = ["tap", "haut", "double"]; localStorage.setItem("jp2-appris", JSON.stringify(tous.filter((x) => x !== f))); }, fam);
      const cible = await course((f) => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 30; r < 4000; r++) { const row = p.rows.rowAt(r); if (row.type !== "safe" && p.rows.familleDe(row.kind) === f) return { r, kind: row.kind, type: row.type }; } return null; }, fam);
      if (!cible) { res.push({ fam, erreur: "aucun obstacle" }); continue; }
      await course((r) => { const p = window.__pote.player; p.v = r - 18; p.prevV = p.v; }, cible.r);
      const avant = await course(() => window.__pote.friends.count());
      let c = null;
      for (let k = 0; k < 90; k++) { await attendre(100); c = await course(() => window.__pote.conseil()); if (c.phase === "attente" && c.ralenti < 0.05) break; }
      const declenche = c.phase === "attente";
      const figeV1 = await course(() => window.__pote.player.v); await attendre(800); const figeV2 = await course(() => window.__pote.player.v);
      if (fam === "tap") await page.keyboard.press("Space");
      else if (fam === "haut") { await page.keyboard.down("Space"); await attendre(1500); await page.keyboard.up("Space"); }
      else { await page.keyboard.press("Space"); await attendre(600); await page.keyboard.press("Space"); }
      const apres = await course(() => window.__pote.conseil());
      await attendre(2500);
      const fin = await course((r) => ({ v: window.__pote.player.v, potes: window.__pote.friends.count(), appris: localStorage.getItem("jp2-appris"), c: window.__pote.conseil() }), cible.r);
      res.push({ chocs: await course(() => window.__pote.chocs()) });
      res.push({ fam, kind: cible.kind, type: cible.type, declenche, avanceEnRalenti: +(figeV2 - figeV1).toFixed(2), phaseApresGeste: apres.phase, depasse: fin.v > cible.r, potesAvant: avant, potesApres: fin.potes, appris: fin.appris.includes(fam), ralentiFin: +fin.c.ralenti.toFixed(2) });
    }
    console.log("AUDIT", JSON.stringify(res, null, 1));
    // Pause pendant un ralenti, puis reprise.
    await course(() => localStorage.setItem("jp2-appris", "[]"));
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 30; r < 4000; r++) if (p.rows.rowAt(r).type === "statique") return r; return 0; });
    await course((r) => { const p = window.__pote.player; p.v = r - 18; p.prevV = p.v; }, r);
    for (let k = 0; k < 40; k++) { await attendre(100); if ((await course(() => window.__pote.conseil())).phase === "attente") break; }
    await page.keyboard.press("Escape"); await attendre(700); await photo("60-pause-ralenti");
    await page.keyboard.press("Escape"); await attendre(700);
    console.log("PAUSE→REPRISE", JSON.stringify(await course(() => window.__pote.conseil())));
    await photo("61-reprise-ralenti");
    // Perf par saison (l'hiver a 70 flocons).
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("KeyS"); await attendre(400);
      const t = await course(async () => { const t = []; for (let i = 0; i < 60; i++) { await new Promise((ok) => requestAnimationFrame(ok)); t.push(window.__pote.frameMs()); } t.sort((a, b) => a - b); return +t[Math.floor(t.length * 0.95)].toFixed(2); });
      console.log("PERF saison", i, "p95 ms", t);
    }
  },
  // Sans l'overlay debug, en hiver puis en été, devant une poule.
  propreSaison: async () => {
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 20; r < 3000; r++) if (p.rows.rowAt(r).kind === "poule") return r; return 0; });
    await course((r) => { const p = window.__pote.player; p.v = r - 6; p.prevV = p.v; }, r);
    await page.keyboard.press("KeyS"); await page.keyboard.press("KeyS"); await page.keyboard.press("KeyS"); await page.keyboard.press("KeyS");
    await page.keyboard.press("KeyD"); await attendre(500); await photo("70-hiver-poule");
    await page.keyboard.press("KeyD"); await page.keyboard.press("KeyS"); await page.keyboard.press("KeyS"); await page.keyboard.press("KeyD"); await attendre(400); await photo("71-ete");
  },
  // Gros moutons et fermier, puis la nuit (acteurs éclairés).
  betes: async () => {
    for (const k of ["mouton", "fermier", "costard"]) {
      const r = await course((k) => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 10; r < 4000; r++) if (p.rows.rowAt(r).kind === k) return r; return 0; }, k);
      await course((r) => { const p = window.__pote.player; p.v = r - 5; p.prevV = p.v; }, r);
      await page.keyboard.press("KeyD"); await attendre(250); await photo(`80-${k}`); await page.keyboard.press("KeyD");
    }
    await page.keyboard.press("KeyN"); await attendre(1600);
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 10; r < 4000; r++) if (p.rows.rowAt(r).type === "statique") return r; return 0; });
    await course((r) => { const p = window.__pote.player; p.v = r - 5; p.prevV = p.v; }, r);
    await page.keyboard.press("KeyD"); await attendre(250); await photo("81-nuit-bete"); await page.keyboard.press("KeyD");
  },
  // Tap PENDANT l'approche : le temps doit repartir tout de suite, le saut partir seul.
  tapTot: async () => {
    await page.keyboard.press("KeyI");
    await course(() => localStorage.setItem("jp2-appris", '["haut","double"]'));
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 30; r < 4000; r++) { const row = p.rows.rowAt(r); if (row.type === "statique" && p.rows.familleDe(row.kind) === "tap") return r; } return 0; });
    await course((r) => { const p = window.__pote.player; p.v = r - 18; p.prevV = p.v; }, r);
    let c; for (let k = 0; k < 200; k++) { await attendre(40); c = await course(() => window.__pote.conseil()); if (c.phase === "approche" && c.ralenti < 0.5) break; }
    console.log("VU", JSON.stringify(c), await course(() => window.__pote.player.v), r);
    await page.keyboard.press("Space");
    const trace = course(async () => { const out = []; for (let i = 0; i < 90; i++) { await new Promise((ok) => requestAnimationFrame(ok)); const p = window.__pote.player; out.push([+p.v.toFixed(2), +p.jumpY.toFixed(2), window.__pote.conseil().phase]); } return out; });
    await attendre(250);
    const apres = await course(() => window.__pote.conseil());
    console.log("TRACE", JSON.stringify((await trace).filter((x, i) => i % 3 === 0)));
    await attendre(2000);
    console.log("TAPTOT", JSON.stringify({ avant: c.ralenti.toFixed(2), apres250ms: apres.ralenti.toFixed(2), chocs: await course(() => window.__pote.chocs()), appris: await course(() => localStorage.getItem("jp2-appris")) }));
  },
  // Fin du morceau avec un record et 5 potes (touche F).
  finRecord: async () => {
    for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP");
    await attendre(3000); await page.keyboard.press("KeyF"); await attendre(3000); await photo("16-fin-record");
  },
  // Rouler sur une voiture garée : double saut, atterrir sur le toit, rouler.
  toitVoiture: async () => {
    await page.keyboard.press("KeyI");
    for (let i = 0; i < 3; i++) await page.keyboard.press("KeyP");
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 25; r < 4000; r++) if (p.rows.rowAt(r).kind === "voiture") return r; return 0; });
    await course((r) => { const p = window.__pote.player; p.v = r - 7; p.prevV = p.v; localStorage.setItem("jp2-appris", '["tap","haut","double"]'); }, r);
    const trace = course(async (r) => {
      const out = []; let saute = false, lache = 0;
      for (let i = 0; i < 200; i++) {
        await new Promise((ok) => requestAnimationFrame(ok));
        const p = window.__pote.player;
        if (!saute && r - p.v < 2.4) { saute = true; window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); lache = i + 20; }
        if (saute && i === lache) window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
        if (Math.abs(p.v - r) < 2.5) out.push([+(p.v - r).toFixed(2), +p.jumpY.toFixed(2)]);
      }
      return out;
    }, r);
    const t = await trace;
    console.log("TOIT", JSON.stringify(t.filter((x, i) => i % 4 === 0)), JSON.stringify(await course(() => window.__pote.chocs())));
  },
  // Ligne d'arrivée posée devant le joueur (debug), pour la voir.
  arrivee: async () => {
    await page.keyboard.press("KeyI");
    await attendre(1500); await photo("06-tape");
    await course(() => { const p = window.__pote; p.game.arriveeR = p.player.v + 6; });
    await page.keyboard.press("KeyD"); await attendre(150); await photo("90-arrivee"); await page.keyboard.press("KeyD");
  },
  // Saisons forcées (touche S) : printemps, été, automne, hiver.
  saisons: async () => {
    for (const nom of ["printemps", "ete", "automne", "hiver"]) { await page.keyboard.press("KeyS"); await attendre(900); await photo(`50-saison-${nom}`); }
  },
  // Tuto contextuel : familles oubliées, on se pose avant le premier obstacle.
  conseil: async () => {
    await course(() => localStorage.removeItem("jp2-appris"));
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 20; r < 2000; r++) if (p.rows.rowAt(r).type === "statique") return r; return 0; });
    await course((r) => { window.__pote.player.v = r - 12; }, r);
    await attendre(1500); console.log("  conseil", JSON.stringify(await course(() => window.__pote.conseil()))); await photo("51-conseil");
    await page.touchscreen.tap(200, 500); await attendre(300); console.log("  après tap", JSON.stringify(await course(() => window.__pote.conseil())));
    await attendre(900); await photo("52-conseil-apres");
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
  // La poule jetée (27 septembre 2026) : le fermier face au joueur, puis la poule qui court.
  poule: async () => {
    await page.keyboard.press("KeyD");
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 20; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.kind === "poulejetee" && !row.armed) return r; } return 0; });
    await course((r) => { window.__pote.player.v = r - 12; }, r);
    await attendre(450); await photo("24-poule-fermier");
    await attendre(900); await photo("25-poule-jetee");
    await page.keyboard.press("KeyD");
  },
  // La voiture en face (plus lente, montable) : l'alerte, puis la voiture.
  enface: async () => {
    await page.keyboard.press("KeyD");
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 40; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.type === "contresens" && row.kind === "contresens" && !row.armed) return r; } return 0; });
    await course((r) => { window.__pote.player.v = r - 30; }, r);
    await attendre(1800); await photo("26-enface-alerte");
    await course((r) => { const p = window.__pote; const row = p.rows.rowAt(r); p.player.v = Math.max(p.player.v, r - 9); }, r);
    await attendre(250); await photo("27-enface-visible");
    await page.keyboard.press("KeyD");
  },
  // Voiture garée sur la route, vue de près.
  voiture: async () => {
    await page.keyboard.press("KeyD");
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 12; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.type === "statique" && row.kind === "voiture") return r; } return 0; });
    await course((r) => { window.__pote.player.v = r - 6; }, r);
    await attendre(300); await photo("28-voiture");
    await page.keyboard.press("KeyD");
  },
  // Ligne d'arrivée franchie EN PLEIN SAUT (5 octobre 2026 : « la gravité
  // n'agit plus sur mon personnage ») : il doit retomber.
  arriveeSaut: async () => {
    await attendre(1500);
    await page.keyboard.down("Space"); await attendre(180); await page.keyboard.up("Space");
    await attendre(120);
    const enLair = await course(() => window.__pote.player.jumpY);
    await page.keyboard.press("KeyF");
    const hauteurs = [];
    for (let k = 0; k < 12; k++) { await attendre(120); hauteurs.push((await course(() => window.__pote.player.jumpY)).toFixed(2)); }
    console.log(`ARRIVÉE EN SAUT : en l'air à ${enLair.toFixed(2)} u, puis ${hauteurs.join(" → ")}`);
  },
  // Menu « Mon cycliste » atteint depuis l'écran de fin (bouton Menu).
  menuFin: async () => {
    await page.keyboard.press("KeyF"); await attendre(700); await photo("29-termine");
    await attendre(1600); await photo("30-fin");
    // (Un tap d'une scène précédente a pu ouvrir le tiroir de partage.)
    await course(() => { if (document.getElementById("partage-sheet").classList.contains("visible")) document.getElementById("partage-fermer").click(); });
    await attendre(350);
    await page.click("#end-menu"); await attendre(800); await photo("31-menu-apres");
  },
  // Boîtes de collision contre dessins (27 septembre 2026 : « vérifiez bien la
  // hitbox de tous les éléments ») : pour chaque espèce, l'enveloppe de ce qui
  // est DESSINÉ, comparée à la boîte qui sert aux collisions (rows.KINDS).
  hitbox: async () => {
    const t = await course(async () => {
      const scene = await import("/src/scene.js"), props = await import("/src/props.js"), rows = await import("/src/rows.js");
      const out = [];
      for (const [k, K] of Object.entries(rows.KINDS)) {
        // Les personnages 2D (costard, fermier, baigneur) se peignent en
        // pixels d'écran : la mesure en boîtes ne les voit pas.
        let b;
        try {
          b = scene.mesurerModele((c) => {
            if (K.traverse) props.drawCrosser(c, k, 0, 0, -1, 0);
            else if (k === "poulejetee") props.drawPouleJetee(c, 0, 0, 0);
            else if (k === "contresens") props.drawVoiture(c, K, 0, 0, -1, 0);
            else if (k === "pieton") props.drawPieton(c, K, 0, 0, 0, 0);
            else if (k === "skieur") props.drawSkieur(c, K, 0, 0, 0);
            else props.drawStatic(c, k, 0, 0, 0);
          });
        } catch (e) { out.push(`${k.padEnd(11)} (dessin 2D, non mesuré)`); continue; }
        const longDessin = K.traverse ? b.u1 - b.u0 : b.v1 - b.v0;
        out.push(`${k.padEnd(11)} dessin : long ${longDessin.toFixed(2)} h ${b.h1.toFixed(2)}  |  collision : long ${(K.traverse ? K.long : K.long).toFixed(2)} (barre ${(K.traverse ? K.larg : K.long).toFixed(2)}) h ${K.h.toFixed(2)}`);
      }
      return out;
    });
    console.log(t.join("\n"));
  },
  // GALERIE des modèles 3D (28 septembre 2026, « refais une repasse de tous
  // les éléments 3D qui ont trop de soucis ») : chaque modèle dessiné par le
  // vrai moteur, en grand, à gauche / au centre / à droite de la caméra (les
  // faces vues changent selon le côté), plus le décor des biomes.
  galerie: async () => {
    const planches = [
      ["poule", "chat", "chien"], ["mouton", "botte", "cochon"], ["vache", "fermier", "voiture"],
      ["tracteur"], ["tracteurProche"], ["contresens"], ["poulejetee"], ["riders"],
      ["decor:ble:10"], ["decor:village:135"], ["decor:villageSud:355"], ["decor:foret:230"], ["halle"],
    ];
    for (let i = 0; i < planches.length; i++) {
      const noms = planches[i];
      await course(async (noms) => {
        const scene = await import("/src/scene.js"), props = await import("/src/props.js"), rows = await import("/src/rows.js");
        const { drawRider } = await import("/src/voxrider.js");
        const { PALETTES } = await import("/src/rider.js");
        let cv = document.getElementById("galerie");
        if (!cv) { cv = document.createElement("canvas"); cv.id = "galerie"; cv.style.cssText = "position:fixed;left:0;top:0;width:375px;height:300px;z-index:999;background:#fff"; document.body.appendChild(cv); }
        const W = 750, H = 600;
        cv.width = W * 2; cv.height = H * 2;
        const c = cv.getContext("2d");
        c.setTransform(2, 0, 0, 2, 0, 0);
        c.scale(0.5, 0.5); // 750×600 logiques dans 375×300 CSS
        c.setTransform(1, 0, 0, 1, 0, 0);
        scene.setViewport(W * 2, H * 2);
        scene.setJoueurX(0.5);
        const nom = noms[0];
        const decor = nom.startsWith("decor:") ? nom.split(":") : null;
        scene.setCamera(decor ? Number(decor[2]) : nom === "halle" ? 20 : 0);
        scene.setDecorTime(1);
        // Zoom ×ZOOM autour du bord de la route (les modèles font ~50 px sinon).
        const ZOOM = decor || nom === "halle" ? 1 : 2.2;
        const o = scene.project(0, scene.getVCentre(), 1.2);
        c.translate(W, H * 1.15); c.scale(ZOOM, ZOOM); c.translate(-o.x, -o.y);
        scene.renderGround(c, null);
        const items = [];
        const vc = scene.getVCentre();
        if (decor) {
          const { from, to } = scene.rowRange();
          for (let r = from; r <= to; r++) for (const it of scene.rowDecor(c, r, false)) items.push(it);
        } else if (nom === "halle") {
          const geo = { haut: rows.HALLE_HAUT, montee: 7, plat: 26, descente: 7, total: rows.HALLE_ROWS };
          items.push({ d: scene.depth(1.7, 10), draw: () => scene.drawHalle(c, 10, geo, -99, 99, "fond") });
          items.push({ d: scene.depth(-1.5, 10), draw: () => scene.drawHalle(c, 10, geo, -99, 99, "devant") });
          items.push({ d: scene.depth(0, 20), draw: () => drawRider(c, 0, 20, rows.HALLE_HAUT, PALETTES.pmc, 1, 1, 0) });
        } else {
          const pos = [-2.6, 0, 2.6];
          noms.forEach((n, k) => {
            for (const dv of noms.length === 1 ? pos : [pos[k]]) {
              const v = vc + dv;
              const K = rows.KINDS[n];
              if (n === "tracteur") items.push({ d: scene.depth(3, v), draw: () => props.drawCrosser(c, "tracteur", 3, v, -1, 1) });
              else if (n === "tracteurProche") items.push({ d: scene.depth(0, v), draw: () => props.drawCrosser(c, "tracteur", 0, v, -1, 1) });
              else if (n === "contresens") items.push({ d: scene.depth(0, v), draw: () => props.drawVoiture(c, K, 0, v, -1, 1) });
              else if (n === "poulejetee") { items.push({ d: scene.depth(0, v), draw: () => props.drawPouleJetee(c, 0, v, 1) }); items.push({ d: scene.depth(1.65, v + 1.2), draw: () => props.drawLanceurFace(c, 1.65, v + 1.2, 1, dv < 0 ? null : 0.2) }); }
              else if (n === "riders") { const P = [PALETTES.pmc, { ...PALETTES.pmc, velo: "grandbi" }, { ...PALETTES.pmc, velo: "roller" }][pos.indexOf(dv)]; items.push({ d: scene.depth(0, v), draw: () => drawRider(c, 0, v, 0, P, 1, 1, 0) }); }
              else items.push({ d: scene.depth(0, v), draw: () => props.drawStatic(c, n, 0, v, 1) });
            }
          });
        }
        items.sort((a, b) => b.d - a.d);
        for (const it of items) it.draw();
        scene.setViewport(innerWidth, innerHeight);
      }, noms);
      const el = await page.$("#galerie");
      await el.screenshot({ path: `${sorties}g${String(i).padStart(2, "0")}-${noms.join("-").replace(/:/g, "_")}.png` });
    }
    console.log("  → galerie : outils/sorties/g*.png");
    await course(() => document.getElementById("galerie").remove());
  },
  // Les HUMAINS (4 octobre 2026, nuit : peaux, gabarits, âges, liseré) : une
  // planche par famille, dessinée par le vrai moteur sur un fond donné (sable
  // pour juger le contraste « humains clairs sur fond clair »).
  humains: async () => {
    const planches = [
      ["pieton", "#8a8a90", [11, 12, 13, 14, 15, 16]], ["pieton", "#ead7a8", [21, 22, 23, 24, 25, 26], true],
      ["pieton", "#8a8a90", [31, 32, 33, 34, 35, 36]], ["costard", "#8a8a90", [41, 42, 43, 44]],
      ["fermier", "#c9b58a", [51, 52, 53, 54]], ["baigneur", "#ead7a8", [61, 62, 63, 64]], ["skieur", "#eef3f8", [71, 72, 73]],
    ];
    for (let i = 0; i < planches.length; i++) {
      await course(async ([kind, fond, graines, plage]) => {
        const scene = await import("/src/scene.js"), props = await import("/src/props.js"), rows = await import("/src/rows.js");
        let cv = document.getElementById("galerie");
        if (!cv) { cv = document.createElement("canvas"); cv.id = "galerie"; cv.style.cssText = "position:fixed;left:0;top:0;width:375px;height:300px;z-index:999;background:#fff"; document.body.appendChild(cv); }
        const W = 750, H = 600;
        cv.width = W * 2; cv.height = H * 2;
        const c = cv.getContext("2d");
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = fond; c.fillRect(0, 0, W * 2, H * 2);
        scene.setViewport(W * 2, H * 2); scene.setJoueurX(0.5); scene.setCamera(0); scene.setDecorTime(1);
        const ZOOM = 1.9, ecart = graines.length > 4 ? 1.25 : 1.6;
        const o = scene.project(0, scene.getVCentre(), 1.0);
        c.translate(W, H * 1.1); c.scale(ZOOM, ZOOM); c.translate(-o.x, -o.y);
        const K = rows.KINDS[kind], vc = scene.getVCentre();
        const items = graines.map((g, k) => {
          const v = vc + (k - (graines.length - 1) / 2) * ecart;
          return { d: scene.depth(0, v), draw: () => kind === "pieton" ? props.drawPieton(c, K, 0, v, 0.3 + k, g, !!plage)
            : kind === "skieur" ? props.drawSkieur(c, K, 0, v, 0.3 + k, g) : props.drawStatic(c, kind, 0, v, 0.3 + k, g) };
        });
        items.sort((a, b) => b.d - a.d);
        for (const it of items) it.draw();
        scene.setViewport(innerWidth, innerHeight);
      }, planches[i]);
      const el = await page.$("#galerie");
      await el.screenshot({ path: `${sorties}h${String(i).padStart(2, "0")}-${planches[i][0]}.png` });
    }
    console.log("  → humains : outils/sorties/h*.png");
    await course(() => document.getElementById("galerie").remove());
  },
  // Atterrir sur le toit d'une voiture garée (28 septembre 2026) : on lâche le
  // cycliste au-dessus du toit en pleine chute, il doit s'y poser, pas passer au travers.
  toit: async () => {
    const r = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 14; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.type === "statique" && row.kind === "voiture") return r; } return 0; });
    const res = await course(async (r) => {
      const p = window.__pote;
      p.player.v = r - 1.6; p.player.prevV = p.player.v; p.player.jumpY = 2.6; p.player.prevJumpY = 2.6; p.player.jumpVy = -9; p.player.auSol = false;
      const hs = [];
      for (let i = 0; i < 12; i++) { await new Promise((ok) => setTimeout(ok, 40)); hs.push(p.player.jumpY.toFixed(2)); }
      return { hs, pertes: p.game.sansFaute };
    }, r);
    console.log("  hauteurs après la chute :", res.hs.join(" "), "· sans faute :", res.pertes);
    await photo("32-toit");
  },
  // La descente de la halle : le cycliste doit coller au plancher (plus de
  // décollage d'un cheveu une image sur deux).
  descente: async () => {
    const res = await course(async () => {
      const p = window.__pote;
      let d = 0; for (let r = 40; r < 1200; r++) if (p.rows.halleA(r) !== null) { d = p.rows.halleA(r); break; }
      p.player.v = d + 7 + 26 - 2; p.player.jumpY = p.rows.solAt(p.player.v); p.player.prevJumpY = p.player.jumpY; p.player.jumpVy = 0; p.player.auSol = true;
      let air = 0, n = 0;
      await new Promise((ok) => { const f = () => { n++; if (p.player.jumpY - p.rows.solAt(p.player.v) > 0.01) air++; if (p.player.v < d + 42) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
      return { air, n };
    });
    console.log(`  descente : ${res.air} images en l'air sur ${res.n}`);
  },
  // Projecteurs (3 octobre 2026) : brique de lait et premier triangle, une fois chacun.
  projo: async () => {
    await course(() => localStorage.removeItem("jp2-conseils-vus"));
    const vus = new Set();
    for (let i = 0; i < 160 && vus.size < 2; i++) {
      const t = await course(() => window.__pote.projo());
      if (t && !vus.has(t)) { vus.add(t); await attendre(700); await photo(`45-projo-${t}`); await page.mouse.click(180, 400); }
      await attendre(500);
    }
    console.log("projecteurs vus :", [...vus].join(", ") || "aucun");
  },
  // Véhicules (3 octobre 2026) : tracteur dans le sens du joueur, car scolaire en face.
  vehicules: async () => {
    const vus = new Set();
    for (let i = 0; i < 2600 && vus.size < 3; i++) {
      const k = await course(() => {
        const P = window.__pote, v = P.player.v;
        for (let r = Math.floor(v) + 1; r < v + 30; r++) {
          const row = P.rows.rowAt(r);
          if (row.type === "contresens" && row.armed && (row.kind === "bus" || row.kind === "tracteur" || row.kind === "chasseneige")) {
            const o = P.rows.contresensAt ? null : null;
            const centre = r + row.v0 - row.vitesse * (P.tMonde() - row.t0);
            if (centre > v + 3.5 && centre < v + 8) return row.kind;
          }
        }
        return null;
      });
      if (k && !vus.has(k)) { vus.add(k); await photo(`46-vehicule-${k}`); }
      await attendre(60);
    }
    console.log("véhicules vus :", [...vus].join(", ") || "aucun");
    console.log(await course(() => { const P = window.__pote, out = []; for (let r = 0; r < P.player.v + 40; r++) { const row = P.rows.rowAt(r); if (row.type !== "safe") out.push(r + ":" + row.kind + (row.armed ? "*" : "")); } return out.join(" "); }));
  },
  // Potes et véhicules (4 octobre 2026) : le joueur saute « parfaitement »
  // (pilote automatique ci-dessous), on compte les images où un pote est DANS
  // une voiture en face, un car ou un tracteur sans être au-dessus.
  potesVehicules: async () => {
    await page.keyboard.press("KeyI");
    for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP");
    await course(() => {
      const P = window.__pote; P.clips = 0; P.clipsDetail = []; P.touchesJoueur = new Set(); P.clipsPar = new Map();
      // Un véhicule « traversé » : pote dans sa boîte, plus bas que son toit.
      const dedans = (v, y, r, row, o) => Math.abs(v - o.v) < P.rows.demiLongueurRoute(row.kind) + P.rows.VELO_DEMI - 0.15 && y < P.rows.hauteurAFranchir(row.kind) - 0.1;
      const boucle = () => {
        const tm = P.tMonde();
        for (let r = Math.floor(P.player.v) - 10; r < P.player.v + 10; r++) {
          const row = P.rows.rowAt(r);
          if (row.type !== "contresens" || !row.armed) continue;
          const o = P.rows.contresensAt(r, row, tm); if (!o) continue;
          if (dedans(P.player.v, P.player.jumpY, r, row, o)) P.touchesJoueur.add(r);
          for (const m of P.friends.members()) if (dedans(m.v, m.jumpY, r, row, o)) P.clipsPar.set(r, row.kind);
        }
        requestAnimationFrame(boucle);
      };
      boucle();
    });
    const t0 = Date.now(); let tenueJusqua = 0, attendApex = false, doubleA = 0;
    while (Date.now() - t0 < 70000) {
      const e = await course(() => {
        const P = window.__pote, tm = P.tMonde(), v = P.player.v, sp = P.vitesse();
        let best = null;
        for (let r = Math.floor(v); r < v + 40; r++) {
          const row = P.rows.rowAt(r); let c = null, vit = 0;
          if (row.type === "statique") c = r;
          else if (row.type === "contresens" && row.armed) { const o = P.rows.contresensAt(r, row, tm); if (o) { c = o.v; vit = row.vitesse; } }
          if (c === null || c < v) continue;
          const t = (c - v) / Math.max(0.5, sp + vit), f = P.rows.familleDe(row.kind);
          if (!best || t < best.t) best = { t, f, m: P.rows.montee(f) };
        }
        return { best, auSol: P.player.auSol, vy: P.player.jumpVy, doubled: P.player.doubled, fin: P.game.ended };
      });
      if (e.fin) break;
      const maintenant = Date.now();
      if (tenueJusqua && maintenant >= tenueJusqua) { await page.keyboard.up("Space"); tenueJusqua = 0; }
      if (attendApex && !doubleA && !e.auSol && e.vy <= 0 && !e.doubled) { await page.keyboard.press("Space"); attendApex = false; }
      // IMPARFAIT=1 : un joueur humain — appui plus ou moins long, double saut
      // plus ou moins tôt, départ un peu en avance ou en retard.
      const imparfait = process.env.IMPARFAIT === "1";
      const avance = imparfait ? (Math.random() - 0.4) * 0.12 : 0;
      if (e.auSol && e.best && e.best.t <= e.best.m + 0.03 + avance && !tenueJusqua) {
        if (e.best.f === "tap") await page.keyboard.press("Space");
        else { await page.keyboard.down("Space"); tenueJusqua = maintenant + (imparfait ? 60 + Math.random() * 260 : 300); attendApex = e.best.f === "double"; if (imparfait) doubleA = maintenant + 120 + Math.random() * 380; }
      }
      if (imparfait && attendApex && doubleA && maintenant >= doubleA && !e.auSol && !e.doubled) { await page.keyboard.press("Space"); attendApex = false; doubleA = 0; }
      await attendre(8);
    }
    const res = await course(() => { const P = window.__pote; const potesSeuls = [...P.clipsPar].filter(([r]) => !P.touchesJoueur.has(r)); return { vehiculesRatesParLeJoueur: P.touchesJoueur.size, vehiculesTraversesParUnPoteAlorsQueLeJoueurEstPasse: potesSeuls.length, detail: potesSeuls.slice(0, 10).map(([r, k]) => k + "@" + r), v: Math.round(P.player.v) }; });
    console.log("POTES DANS UN VÉHICULE (images) :", JSON.stringify(res));
  },
  // Tuto « reste appuyé » avec un appui TROP TÔT et long (4 octobre 2026 :
  // « je suis resté appuyé, il a fait un double saut tout seul »).
  tutoHaut: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 }); // fin du décompte
    for (const essai of [0, 1, 2]) {
      await course(() => { localStorage.setItem("jp2-appris", '["tap","double"]'); localStorage.removeItem("jp2-conseils-vus"); localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}'); });
      const cible = await course(() => { const p = window.__pote; for (let r = Math.ceil(p.player.v) + 30; r < 4000; r++) { const row = p.rows.rowAt(r); if (row.type === "statique" && p.rows.familleDe(row.kind) === "haut") return { r, kind: row.kind }; } return null; });
      await course((r) => { const p = window.__pote.player; p.v = r - 18; p.prevV = p.v; }, cible.r);
      let c = null;
      for (let k = 0; k < 400; k++) { await attendre(20); c = await course(() => window.__pote.conseil()); if (c.phase === "approche") break; }
      if (!c || c.phase !== "approche") console.log("DEBUG", JSON.stringify(await course((r) => ({ now: window.__pote.clock.now(), fin: window.__pote.game.ended, sp: window.__pote.vitesse(), v: window.__pote.player.v, r, auSol: window.__pote.player.auSol, conseil: window.__pote.conseil(), appris: localStorage.getItem("jp2-appris"), vus: localStorage.getItem("jp2-conseils-vus"), projo: window.__pote.projo() }), cible.r)));
      await page.keyboard.down("Space");
      let double = false, maxY = 0;
      for (let k = 0; k < 60; k++) { await attendre(40); const e = await course(() => ({ d: window.__pote.player.doubled, y: window.__pote.player.jumpY, v: window.__pote.player.v })); double = double || e.d; maxY = Math.max(maxY, e.y); }
      await page.keyboard.up("Space");
      await attendre(800);
      const fin = await course((r) => ({ passe: window.__pote.player.v > r + 2, appris: localStorage.getItem("jp2-appris") }), cible.r);
      console.log("TUTO HAUT essai", essai, JSON.stringify({ kind: cible.kind, phaseDepart: c && c.phase, doubleSautToutSeul: double, hauteurMax: +maxY.toFixed(2), ...fin }));
    }
  },
  // Plafond des halles (4 octobre 2026) : double saut sur le plancher, la
  // tête doit rester sous le toit.
  plafond: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 });
    const d = await course(() => { const p = window.__pote; for (let r = 40; r < 1500; r++) if (p.rows.halleA(r) !== null) return p.rows.halleA(r); return 0; });
    await course((d) => { const p = window.__pote; p.player.v = d + 12; p.player.prevV = p.player.v; p.player.jumpY = p.rows.solAt(p.player.v); }, d);
    await attendre(300);
    await page.keyboard.down("Space"); await attendre(250); await page.keyboard.up("Space"); await attendre(150); await page.keyboard.press("Space");
    let maxY = 0;
    for (let k = 0; k < 30; k++) { await attendre(25); maxY = Math.max(maxY, await course(() => window.__pote.player.jumpY)); if (k === 8) await photo("48-plafond-halle"); }
    console.log("PLAFOND : hauteur max des roues", maxY.toFixed(2), "· plafond", await course((d) => window.__pote.rows.plafondA(d + 20), d));
  },
  // HUD (5 octobre 2026) : points, barre du morceau, potes + multiplicateur.
  hud: async () => {
    // Les touches de debug ne marchent que calque AFFICHÉ : on l'allume pour
    // agir, on l'éteint pour la photo.
    await page.keyboard.press("KeyD");
    await attendre(2500); await photo("59-hud-seul");
    await page.keyboard.press("KeyD");
    for (let i = 0; i < 2; i++) await page.keyboard.press("KeyP");
    await page.keyboard.press("KeyD");
    await attendre(2500); await photo("59b-hud-potes");
    await page.keyboard.press("KeyD"); await page.keyboard.press("KeyL"); await page.keyboard.press("KeyD");
    await attendre(600); await photo("59c-hud-turbo");
    await page.keyboard.press("KeyD"); await page.keyboard.press("KeyN"); await page.keyboard.press("KeyD");
    await attendre(5000); await photo("59d-hud-nuit");
    // Sur la plage (ciel violet) : texte blanc.
    const rp = await course(() => { const p = window.__pote; for (let r = 300; r < 3000; r++) if (p.rows.enPlage(r)) return r; return 0; });
    await course(([t, v]) => { const p = window.__pote; p.clock.jumpBy(t - p.clock.now()); p.player.v = v; p.player.prevV = v; p.player.jumpY = 0; }, [150, rp + 12]);
    await attendre(4500); await photo("59e-hud-plage");
    await page.keyboard.press("KeyD");
  },
  // PORTE de conversion (5 octobre 2026) : à lancer avec NEUF=1 PARTIES=0.
  // CONTINUER → abonnement ; REJOUER après la 1re partie → album.
  porte: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 });
    const texte = () => course(() => ({ titre: document.getElementById("gate-title").textContent, sticker: document.getElementById("gate-eyebrow").textContent, conv: window.__pote && document.getElementById("debug-overlay") ? "" : "" }));
    await page.keyboard.press("KeyG"); await attendre(900); await photo("58-porte-mort");
    await page.click("#revive-cta"); await attendre(600); await photo("58b-porte-continuer");
    console.log("PORTE continuer :", JSON.stringify(await texte()));
    await page.click("#gate-later"); await attendre(500);
    await page.click("#revive-replay"); await attendre(600); await photo("58c-porte-rejouer");
    console.log("PORTE rejouer (après la partie", await course(() => localStorage.getItem("jp2Parties")), ") :", JSON.stringify(await texte()));
  },
  // PAUSE (5 octobre 2026 : « quand j'ai mis pause, le chasse-neige avait
  // continué d'avancer ») : l'horloge du monde doit rester gelée, et la
  // course rester calée sur le morceau après la reprise.
  pause: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 });
    await attendre(1500);
    const avant = await course(() => ({ t: window.__pote.clock.now(), v: window.__pote.player.v }));
    await page.click("#pause-button"); await attendre(3500);
    const pendant = await course(() => ({ t: window.__pote.clock.now(), v: window.__pote.player.v }));
    await page.click("#resume-button"); await attendre(2000);
    const apres = await course(() => ({ t: window.__pote.clock.now(), v: window.__pote.player.v, debug: document.getElementById("debug-overlay") ? document.getElementById("debug-overlay").textContent.slice(0, 200) : "" }));
    console.log("PAUSE horloge", avant.t.toFixed(2), "→ pendant 3,5 s de pause", pendant.t.toFixed(2), "→ 2 s après reprise", apres.t.toFixed(2), "| v", avant.v.toFixed(1), pendant.v.toFixed(1), apres.v.toFixed(1));
  },
  // JETPACK (5 octobre 2026) : forcé, joueur posé juste avant, on tient pour
  // voler, on relâche, on retient — la meute doit suivre la trajectoire.
  jetpack: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 });
    await page.keyboard.press("KeyD");
    for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP");
    const r = await course(() => window.__pote.forcerJetpack());
    await course((r) => { const p = window.__pote; p.player.v = r - 14; p.player.prevV = p.player.v; p.player.jumpY = 0; }, r);
    await page.waitForFunction(() => window.__pote.jetpack().pris, null, { timeout: 10000 });
    await attendre(150); await photo("57-jetpack-pris");
    await page.keyboard.down("Space"); await attendre(1400); await photo("57b-jetpack-monte");
    await attendre(900); await photo("57c-jetpack-haut");
    await page.keyboard.up("Space"); await attendre(700); await photo("57d-jetpack-plane");
    await page.keyboard.down("Space"); await attendre(1500); await photo("57e-jetpack-pieces");
    await attendre(1500); await page.keyboard.up("Space");
    await attendre(4500); await photo("57f-jetpack-fin");
    console.log("JETPACK", JSON.stringify(await course(() => window.__pote.jetpack())), "· hauteur", await course(() => window.__pote.player.jumpY.toFixed(2)));
    await page.keyboard.press("KeyD");
  },
  // La plage de fin au coucher du soleil (5 octobre 2026) : horloge avancée à
  // ~150 s (nuit, saison, soleil bas), joueur posé à l'entrée de la plage.
  plage: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 });
    await page.keyboard.press("KeyD");
    const r0 = await course(() => { const p = window.__pote; for (let r = 300; r < 3000; r++) if (p.rows.enPlage(r)) return r; return 0; });
    for (const [t, dv, nom] of [[146, -16, "56-plage-arrivee"], [150, 12, "56b-plage"], [160, 60, "56c-plage-fin"]]) {
      await course(([t, v]) => { const p = window.__pote; p.clock.jumpBy(t - p.clock.now()); p.player.v = v; p.player.prevV = v; p.player.jumpY = p.rows.solAt(v); }, [t, r0 + dv]);
      await attendre(2600); await photo(nom);
    }
    console.log("PLAGE à partir de la rangée", r0);
    await page.keyboard.press("KeyD");
  },
  // PIÉTONS et BAIGNEURS (5 octobre 2026) : vraie course en accéléré (mode
  // vidéo + pilote automatique), photos aux moments où ils sont à l'écran.
  pietons: async () => {
    await page.keyboard.press("KeyD");
    await course(() => {
      const st = { plan: null, tenir: false, double: false, appuye: false };
      const presser = () => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); st.appuye = true; };
      const lacher = () => { if (st.appuye) window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" })); st.appuye = false; };
      window.__pilote = () => {
        const P = window.__pote, pl = P.player, R = P.rows, C = window.CONFIG;
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
      window.__pote.videoDemarrer();
    });
    // Le premier groupe d'au moins 3 piétons, un piéton sur la plage, un baigneur.
    const cibles = await course(() => {
      const P = window.__pote, o = {};
      let debut = null, n = 0, dernier = -99;
      for (let r = 100; r < 3000; r++) {
        const k = P.rows.rowAt(r).kind;
        if (k === "pieton") { if (r - dernier > 16) { debut = r; n = 0; } n += 1; dernier = r; if (n >= 3 && !o.groupe) o.groupe = debut; if (P.rows.enPlage(r) && !o.plage) o.plage = r; }
        if (k === "baigneur" && !o.baigneur) o.baigneur = r;
        if (k === "buggy" && !o.buggy) o.buggy = r;
      }
      return o;
    });
    console.log("PIÉTONS", JSON.stringify(cibles));
    const allerA = (r, avance) => course(([r, avance]) => { const P = window.__pote; let g = 0; while (P.player.v < r - avance && g++ < 40000) window.__pote.videoAvance(P.clock.now() + 0.25); return P.player.v; }, [r, avance]);
    const ordre = [["groupe", "60-pietons-groupe"], ["plage", "60b-pietons-plage"], ["baigneur", "60c-baigneur"], ["buggy", "60d-buggy"]].filter(([c]) => cibles[c]).sort((a, b) => cibles[a[0]] - cibles[b[0]]);
    for (const [cle, nom] of ordre) {
      if (await course(() => window.__pote.player.v) > cibles[cle] - 4) continue;
      await allerA(cibles[cle], 9);
      for (let k = 0; k < 3; k++) {
        await course(() => window.__pote.videoPas(1 / 30)); await photo(`${nom}-${k}`);
        console.log(`  ${nom}-${k} devant :`, await course(() => { const P = window.__pote, v = P.player.v, out = []; for (let r = Math.floor(v); r < v + 45; r++) { const row = P.rows.rowAt(r); if (row.type !== "safe") out.push(`${r - Math.floor(v)}:${row.kind}${row.armed ? "*" : ""}`); } return out.join(" "); }));
        await course(() => window.__pote.videoPas(0.32));
      }
    }
    await page.keyboard.press("KeyD");
  },
  // Montagne à bosses et bouchon de fin (4 octobre 2026).
  montagne: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 });
    const d = await course(() => { const p = window.__pote; for (let r = 300; r < 3000; r++) if (p.rows.bosseA(r) !== null) return p.rows.bosseA(r); return 0; });
    await page.keyboard.press("KeyD");
    for (let i = 0; i < 4; i++) { await page.keyboard.press("KeyS"); await attendre(60); } // hiver forcé
    const aller = (v) => course((v) => { const p = window.__pote; p.player.v = v; p.player.prevV = v; p.player.jumpY = p.rows.solAt(v); p.player.jumpVy = 0; }, v);
    for (const [dv, nom] of [[-16, "49-montagne-approche"], [12, "49b-montagne-montee"], [40, "49c-montagne-sommet"], [64, "49c2-montagne-descente"]]) {
      await aller(d + dv);
      await attendre(1200); await photo(nom);
    }
    // Le chasse-neige et le gros bonhomme de neige sur la route.
    const trouve = await course(() => { const p = window.__pote, o = {}; for (let r = 300; r < 3000; r++) { const row = p.rows.rowAt(r); if (!o[row.kind] && (row.kind === "chasseneige" || row.kind === "bonhomme" || row.kind === "skieur")) o[row.kind] = r; } return o; });
    console.log("MONTAGNE premiers", JSON.stringify(trouve), "· sol", JSON.stringify(await course((t) => Object.fromEntries(Object.entries(t).map(([k, r]) => [k, window.__pote.rows.solAt(r).toFixed(2)])), trouve)));
    if (trouve.bonhomme) { await aller(trouve.bonhomme - 7); await attendre(400); await photo("49f-bonhomme"); }
    if (trouve.skieur) {
      await aller(trouve.skieur - 26);
      for (let k = 0; k < 3; k++) { await attendre(800); await photo(`49h-skieur-${k}`); }
    }
    if (trouve.chasseneige) {
      await aller(trouve.chasseneige - 30);
      for (let k = 0; k < 4; k++) { await attendre(900); await photo(`49g-chasseneige-${k}`); }
    }
    const rb = await course(() => { const p = window.__pote; for (let r = 300; r < 3000; r++) { const row = p.rows.rowAt(r); if (row.bouchon) return r; } return 0; });
    await course((rb) => { const p = window.__pote; p.player.v = rb - 7; p.player.prevV = p.player.v; p.player.jumpY = 0; }, rb);
    await attendre(300); await photo("49d-bouchon");
    await course((rb) => { const p = window.__pote; p.player.v = rb + 3.5; p.player.prevV = p.player.v; p.player.jumpY = 1.49; p.player.jumpVy = 0; }, rb);
    await attendre(250); await photo("49e-bouchon-toit");
    console.log("BOUCHON rangée", rb, "· hauteur après", await course(() => window.__pote.player.jumpY.toFixed(2)));
    await page.keyboard.press("KeyD");
  },
  // Panneaux « attention » sans véhicule (4 octobre 2026 : « je suis descendu
  // de la gare, il y a eu attention, et il n'y a pas eu d'obstacle »).
  alertes: async () => {
    await page.waitForFunction(() => window.__pote.player.v > 2, null, { timeout: 15000 });
    await course(() => window.__pote.suivreAlertes());
    for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP");
    await attendre(Number(process.env.DUREE || 90) * 1000);
    const a = await course(() => window.__pote.alertes());
    const vFin = await course(() => window.__pote.player.v);
    const fantomes = a.filter((e) => e.alerte > 0 && e.vu === 0 && e.r < vFin - 5); // ceux encore devant ne sont pas arrivés
    console.log("ALERTES", a.length, "· sans véhicule vu :", JSON.stringify(fantomes), "· v", await course(() => Math.round(window.__pote.player.v)));
    console.log("HALLES", JSON.stringify(await course(() => { const p = window.__pote, out = []; for (let r = 0; r < 2000; r++) { const d = p.rows.halleA(r); if (d !== null && !out.some((o) => o.d === d)) out.push({ d, type: p.rows.typeHalle(d) }); } return out; })));
  },
  menus: async () => {
    // ⚠️ Pas de touche D ici : overlay masqué = touches de debug coupées (G, I…).
    await attendre(1200);
    await page.click("#pause-button"); await attendre(500); await photo("42-pause");
    await page.click("#resume-button"); await attendre(3000);
    await page.keyboard.press("KeyI");
    await page.keyboard.press("KeyG"); await attendre(900); await photo("43-mort");
    await page.click("#revive-cta"); await attendre(700); await photo("44-porte");
  },
  // Sans l'overlay de debug (touche D), pour juger l'image telle que le joueur la voit.
  propre: async () => { await page.keyboard.press("KeyD"); await attendre(400); await photo("11-propre"); await page.keyboard.press("KeyD"); },
};
const liste = demandes.length ? demandes : Object.keys(SCENES);
for (const nom of liste) { if (SCENES[nom]) await SCENES[nom](); }
const stats = await course(() => ({ v: Math.round(window.__pote.player.v), potes: window.__pote.friends.count(), fps: window.__pote.fps ? window.__pote.fps() : null, erreurs: window.__erreursJeu || [] }));
console.log("État :", JSON.stringify(stats));
if (erreurs.length) console.log("ERREURS :", erreurs.slice(0, 8));
const toutes = [...erreurs, ...stats.erreurs];
verdict(!toutes.length && (stats.fps === null || stats.fps >= 50), `${surBuild ? "build" : "sources"} : ${stats.fps ?? "?"} i/s, ${toutes.length} erreur(s)`);
await navigateur.close();
await (surBuild ? serveur.httpServer.close() : serveur.close());
