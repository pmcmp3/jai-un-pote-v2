// verif.mjs — Le filet de sécurité (`npm run verif`, 9 octobre 2026) : enchaîne
// les tests qui comptent, chacun conclut par OK ou ÉCHEC (outils/verdict.mjs),
// et le tout répond par un code de sortie. deploy.sh refuse de mettre en ligne
// sur un ÉCHEC.
//   npm run verif              → tout (≈ 3 min)
//   npm run verif -- collisions clavier   → seulement ceux-là
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
// Du plus rapide au plus lent ; chaque ligne : nom, commande, ce qui est garanti.
const TESTS = [
  ["regles", ["outils/mesurer.mjs", "20"], {}, "joueur idéal sans choc, joueur immobile touche tout"],
  ["conflits", ["outils/pieces-piegees.mjs", "20"], {}, "aucune pièce ni brique de lait dans un obstacle ou un véhicule"],
  ["collisions", ["outils/collisions.mjs"], {}, "chaque obstacle percuté coûte"],
  ["tap-android", ["outils/tap-android.mjs"], {}, "un tap = un saut sur Android"],
  ["tuto", ["outils/tuto-neuf.mjs"], {}, "chaque tuto tombe sur une route dégagée"],
  ["menu-android", ["outils/menu-android.mjs"], {}, "choisir une puce ne fait rien bouger"],
  ["clavier", ["outils/clavier.mjs"], {}, "la carte reste en vue quand le clavier s'ouvre"],
  ["premiere", ["outils/premiere.mjs"], {}, "première visite façon Instagram, de bout en bout"],
  ["volumes", ["outils/volumes.mjs"], {}, "curseurs Musique / Effets"],
  ["sons", ["outils/sons-course.mjs"], {}, "course entière : sons dans leur décor, aucune erreur"],
  ["perf", ["outils/perf-plage.mjs"], {}, "une image coûte moins de 8,3 ms à CPU ×4"],
  ["build", null, {}, "le build se construit et tourne sans erreur"],
];
const demandes = process.argv.slice(2);
const choisis = demandes.length ? TESTS.filter(([n]) => demandes.includes(n)) : TESTS;
const bilan = [];
const t0 = Date.now();
// Un test lancé au bout de son délai, ou qui échoue, est relancé UNE fois :
// s'il passe au second essai, il est signalé « instable » (navigateur sans
// tête parfois lent à démarrer) mais ne bloque pas la mise en ligne.
const DELAI_MS = 150000;
function lancer(args, env) {
  if (args) return spawnSync("node", args, { cwd: racine, env: { ...process.env, ...env }, encoding: "utf8", timeout: DELAI_MS });
  // Ce qui part en ligne : le build, servi tel quel, une course lancée.
  const b = spawnSync("npx", ["vite", "build", "--base=./", "--outDir=dist-pages", "--emptyOutDir", "--logLevel=error"], { cwd: racine, encoding: "utf8", timeout: DELAI_MS });
  if (b.status !== 0) return b;
  return spawnSync("node", ["outils/capture.mjs", "depart"], { cwd: racine, env: { ...process.env, SERVIR: "dist" }, encoding: "utf8", timeout: DELAI_MS });
}
function lire(r) {
  const sortie = `${r.stdout || ""}${r.stderr || ""}${r.error ? `\n${r.error.message}` : ""}`;
  const ligne = sortie.split("\n").reverse().find((l) => /^(✅ OK|❌ ÉCHEC)/.test(l)) || "";
  return { sortie, ligne, ok: r.status === 0 && ligne.startsWith("✅") };
}
for (const [nom, args, env, quoi] of choisis) {
  const t = Date.now();
  process.stdout.write(`▶ ${nom.padEnd(13)} ${quoi} … `);
  let res = lire(lancer(args, env)), instable = false;
  if (!res.ok) { const second = lire(lancer(args, env)); if (second.ok) { res = second; instable = true; } }
  const s = ((Date.now() - t) / 1000).toFixed(0);
  console.log(`${res.ok ? (instable ? "OK au 2e essai (instable)" : "OK") : "ÉCHEC"} (${s} s)`);
  if (res.ligne) console.log(`    ${res.ligne.replace(/^(✅ OK|❌ ÉCHEC) — /, "")}`);
  if (!res.ok) console.log(res.sortie.split("\n").slice(-25).map((l) => `    │ ${l}`).join("\n"));
  bilan.push([nom, res.ok, instable]);
}
const rates = bilan.filter(([, ok]) => !ok).map(([n]) => n);
const instables = bilan.filter(([, ok, i]) => ok && i).map(([n]) => n);
if (instables.length) console.log(`\n⚠️ Instable(s), passé(s) au second essai : ${instables.join(", ")}`);
console.log(`\n${rates.length ? `❌ ÉCHEC : ${rates.join(", ")}` : `✅ Tout est vert (${bilan.length} tests)`} en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exitCode = rates.length ? 1 : 0;
