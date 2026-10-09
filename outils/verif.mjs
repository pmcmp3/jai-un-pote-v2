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
for (const [nom, args, env, quoi] of choisis) {
  const t = Date.now();
  process.stdout.write(`▶ ${nom.padEnd(13)} ${quoi} … `);
  let r;
  if (args) r = spawnSync("node", args, { cwd: racine, env: { ...process.env, ...env }, encoding: "utf8" });
  else {
    // Ce qui part en ligne : le build, servi tel quel, une course lancée.
    r = spawnSync("npx", ["vite", "build", "--base=./", "--outDir=dist-pages", "--emptyOutDir", "--logLevel=error"], { cwd: racine, encoding: "utf8" });
    if (r.status === 0) r = spawnSync("node", ["outils/capture.mjs", "depart"], { cwd: racine, env: { ...process.env, SERVIR: "dist" }, encoding: "utf8" });
  }
  const sortie = `${r.stdout || ""}${r.stderr || ""}`;
  const ligne = sortie.split("\n").reverse().find((l) => /^(✅ OK|❌ ÉCHEC)/.test(l)) || "";
  const ok = r.status === 0 && ligne.startsWith("✅");
  const s = ((Date.now() - t) / 1000).toFixed(0);
  console.log(`${ok ? "OK" : "ÉCHEC"} (${s} s)`);
  if (ligne) console.log(`    ${ligne.replace(/^(✅ OK|❌ ÉCHEC) — /, "")}`);
  if (!ok) console.log(sortie.split("\n").slice(-25).map((l) => `    │ ${l}`).join("\n"));
  bilan.push([nom, ok]);
}
const rates = bilan.filter(([, ok]) => !ok).map(([n]) => n);
console.log(`\n${rates.length ? `❌ ÉCHEC : ${rates.join(", ")}` : `✅ Tout est vert (${bilan.length} tests)`} en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exitCode = rates.length ? 1 : 0;
