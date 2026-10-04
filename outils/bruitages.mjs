// bruitages.mjs — Banc d'écoute SANS oreilles (4 octobre 2026, nuit) : rend
// chaque bruitage hors ligne avec le VRAI code (src/bruitages.js dans un
// OfflineAudioContext de Chrome), mesure son niveau (ffmpeg ebur128 : crête
// du niveau momentané, LUFS) et dessine son spectrogramme.
//   node outils/bruitages.mjs              → mesuré · visé · gain conseillé
//   node outils/bruitages.mjs --brut       → gains à 1 (pour caler NIVEAUX)
//   node outils/bruitages.mjs poule train  → seulement ceux-là
// Fichiers : outils/sorties/sons/<nom>.wav et <nom>.png. Le morceau est à
// −9,9 LUFS intégré : un bruitage visé à −22 sonne ~12 LU sous la musique.
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const brut = args.includes("--brut");
const noms = args.filter((a) => !a.startsWith("--"));
const racine = fileURLToPath(new URL("..", import.meta.url));
const dossier = fileURLToPath(new URL("./sorties/sons/", import.meta.url));
mkdirSync(dossier, { recursive: true });

const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5191, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
const page = await navigateur.newPage();
await page.goto(`http://localhost:${port}/?debug`);
const rendus = await page.evaluate(async ({ noms, brut }) => {
  const B = await import("/src/bruitages.js");
  const out = {};
  // La voix « pfff, aïe » est un fichier : décodée une fois pour le rendu.
  const voix = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await (await fetch("/" + window.CONFIG.fichierAie)).arrayBuffer());
  for (const nom of noms.length ? noms : B.NOMS) {
    const sr = 44100;
    const ctx = new OfflineAudioContext(1, sr * 6, sr);
    const g = ctx.createGain();
    g.gain.value = brut ? 1 : (B.NIVEAUX[nom] ?? 1);
    g.connect(ctx.destination);
    B.rendre(nom, ctx, g, 0.05, { graine: 42, force: 8, surface: "route", doppler: 1, buffer: voix, prise: 0 });
    const d = (await ctx.startRendering()).getChannelData(0);
    let fin = d.length - 1;
    while (fin > 0 && Math.abs(d[fin]) < 1e-4) fin--;
    const n = Math.min(d.length, fin + Math.round(sr * 0.45)); // + du silence : la fenêtre de 400 ms se referme
    const wav = new DataView(new ArrayBuffer(44 + n * 2));
    const ecrire = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
    ecrire(0, "RIFF"); wav.setUint32(4, 36 + n * 2, true); ecrire(8, "WAVEfmt ");
    wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, sr, true);
    wav.setUint32(28, sr * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); ecrire(36, "data"); wav.setUint32(40, n * 2, true);
    let crete = 0;
    for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, d[i])); crete = Math.max(crete, Math.abs(d[i])); wav.setInt16(44 + i * 2, x * 32767, true); }
    let bin = "";
    const octets = new Uint8Array(wav.buffer);
    for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    out[nom] = { wav: btoa(bin), crete, duree: n / sr, niveau: B.NIVEAUX[nom] ?? 1, cible: B.CIBLES[nom] };
  }
  return out;
}, { noms, brut });
await navigateur.close();
await serveur.close();

console.log("son".padEnd(20), "durée", "  crête dBFS", " M max LUFS", "  visé", "  gain conseillé");
for (const [nom, r] of Object.entries(rendus)) {
  const fichier = `${dossier}${nom}.wav`;
  writeFileSync(fichier, Buffer.from(r.wav, "base64"));
  let mMax = -Infinity;
  const tout = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i '${fichier}' -af ebur128 -f null - 2>&1`], { encoding: "utf8" });
  for (const m of tout.matchAll(/M:\s*(-?[\d.]+)/g)) mMax = Math.max(mMax, parseFloat(m[1]));
  execFileSync("sh", ["-c", `ffmpeg -y -hide_banner -loglevel error -i '${fichier}' -lavfi "showspectrumpic=s=640x256:legend=1:scale=log:stop=8000" '${dossier}${nom}.png'`]);
  const conseil = r.cible !== undefined && Number.isFinite(mMax) ? r.niveau * Math.pow(10, (r.cible - mMax) / 20) : null;
  console.log(nom.padEnd(20), r.duree.toFixed(2).padStart(5), (20 * Math.log10(r.crete || 1e-9)).toFixed(1).padStart(12), mMax.toFixed(1).padStart(12),
    String(r.cible ?? "").padStart(6), conseil === null ? "" : conseil.toFixed(3).padStart(16));
}
