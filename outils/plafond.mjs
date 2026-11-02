// plafond.mjs — Plafond de vraisemblance du concours (node outils/plafond.mjs [N]).
//
// Le score le plus haut qu'un humain puisse poser : le score parfait
// (simulation.js) sur la graine la plus généreuse, multiplié par le boost de
// ligue maximal. Le plafond écrit dans la base (table `concours`,
// colonne `plafond_score`) se pose confortablement AU-DESSUS : un plafond trop
// bas refuserait une vraie partie, et le joueur perdrait son score en silence.
import { chargerConfig } from "./charger-config.mjs";
const C = chargerConfig();
const { scoreParfait } = await import("../src/simulation.js");

const N = Number(process.argv[2]) || 400;
let max = 0, min = Infinity, somme = 0, graineMax = 0;
for (let i = 0; i < N; i++) {
  const g = (i * 7919 + 13) % 2147483647;
  const s = scoreParfait(g, C.potesMax).score;
  if (s > max) { max = s; graineMax = g; }
  min = Math.min(min, s); somme += s;
}
const boost = 1 + C.boostLigueMaxPotes * C.boostLigueParPote;
console.log(`— Score parfait sur ${N} graines : ${Math.round(min)} à ${Math.round(max)} (moyenne ${Math.round(somme / N)}, max sur la graine ${graineMax})`);
console.log(`— Boost de ligue maximal ×${boost} → score humain maximal ${Math.round(max * boost)}`);
console.log(`— Plafond conseillé dans la table concours : ${Math.ceil((max * boost * 1.35) / 5000) * 5000}`);
