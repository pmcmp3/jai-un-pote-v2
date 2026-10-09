// commentaires-seuls.mjs — Preuve qu'une retouche n'a changé QUE des
// commentaires : chaque fichier, avant (git) et maintenant, est passé dans
// esbuild sans commentaires ni espaces ; les deux résultats doivent être
// identiques au caractère près.
//   node outils/commentaires-seuls.mjs [réf git, défaut HEAD] [fichiers…]
// Sans fichiers : tous les .js de src/ et public/ modifiés depuis la réf.
import { transformSync } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const git = (...a) => execFileSync("git", a, { cwd: racine, encoding: "utf8" });
const [ref = "HEAD", ...demandes] = process.argv.slice(2);
const fichiers = demandes.length ? demandes : git("diff", "--name-only", ref, "--", "src", "public").split("\n").filter((f) => f.endsWith(".js"));
const nu = (code) => transformSync(code, { minifyWhitespace: true, legalComments: "none", loader: "js" }).code;
let differents = 0;
for (const f of fichiers) {
  const avant = nu(git("show", `${ref}:${f}`)), apres = nu(readFileSync(`${racine}${f}`, "utf8"));
  if (avant === apres) continue;
  differents += 1;
  let i = 0;
  while (avant[i] === apres[i]) i++;
  console.log(`${f} : le CODE a changé — avant « …${avant.slice(Math.max(0, i - 60), i + 60)}… »\n${" ".repeat(f.length)}   après « …${apres.slice(Math.max(0, i - 60), i + 60)}… »`);
}
verdict(!differents, `${fichiers.length} fichier(s) comparé(s) à ${ref} : ${differents ? `${differents} dont le code a changé` : "seuls les commentaires ont changé"}`);
