// mesurer.mjs — Mesures de la v2 sur N graines (node outils/mesurer.mjs [N]) :
//   1. quotas identiques d'une graine à l'autre (recenser) ;
//   2. aucun obstacle « salto » à moins de 8 rangées d'un autre ;
//   3. score parfait (simulation.js) et moment d'arrivée de chaque pote ;
//   4. joueur idéal scripté : 0 obstacle touché (traversées armées comme en jeu) ;
//      joueur immobile : touche TOUS les obstacles (la collision marche dans les deux sens).
import { chargerConfig } from "./charger-config.mjs";
const C = chargerConfig();
const { Route, KINDS, armer, familleDe, montee, solAt, ecartMin: ecartMinTheorique } = await import("../src/rows.js");
const { scoreParfait, recenser } = await import("../src/simulation.js");
const { V_UNIT, targetSpeed, dureeCourse } = await import("../src/regles.js");

const N = Number(process.argv[2]) || 40;
const graines = Array.from({ length: N }, (_, i) => 1000 + i * 2467);

// 1. Quotas.
const rec = graines.map((g) => recenser(g, 1100));
const cles = [...new Set(rec.flatMap((r) => Object.keys(r)))].sort();
console.log("— Quotas sur 1 100 rangées (min / max sur", N, "graines)");
for (const k of cles) { const vals = rec.map((r) => r[k] || 0); console.log(`  ${k.padEnd(14)} ${Math.min(...vals)} / ${Math.max(...vals)}`); }

// 2. Écart entre obstacles : jamais collés, jamais de longue ligne droite.
let ecartMin = Infinity, ecartMax = 0, serres = 0;
for (const g of graines) {
  const route = new Route(g); let dernier = null, dernierKind = null;
  for (let r = 0; r < 1100; r++) {
    const row = route.rowAt(r);
    if (row.type === "safe") continue;
    if (dernier !== null) {
      const d = r - dernier;
      // Les halles coupent la route en deux : l'écart qui les enjambe n'est
      // pas un « trou », c'est la variation voulue. On ne le compte pas.
      let halle = false;
      for (let q = dernier; q <= r && !halle; q++) if (solAt(q) > 0.05) halle = true;
      if (!halle) { ecartMin = Math.min(ecartMin, d); ecartMax = Math.max(ecartMax, d); }
      if (d < ecartMinTheorique(dernierKind, row.kind)) serres += 1;
    }
    dernier = r; dernierKind = row.kind;
  }
}
console.log(`— Écart entre obstacles : ${ecartMin} à ${ecartMax} rangées ; ${serres} paire(s) plus serrée(s) que la physique du saut`);

// 3. Score parfait.
const sp = graines.map((g) => scoreParfait(g, C.potesMax));
const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sc = sp.map((s) => s.score);
console.log(`— Score parfait (${C.potesMax} potes) : moyenne ${Math.round(moy(sc))}, ${Math.min(...sc)} → ${Math.max(...sc)} (±${(100 * (Math.max(...sc) - Math.min(...sc)) / 2 / moy(sc)).toFixed(1)} %)`);
console.log(`  pièces prises ${Math.round(moy(sp.map((s) => s.pieces)))}, sauts ${Math.round(moy(sp.map((s) => s.sauts)))}, doubles ${Math.round(moy(sp.map((s) => s.doubles)))}, laits ${moy(sp.map((s) => s.laits)).toFixed(1)}, rouges ${moy(sp.map((s) => s.rouges)).toFixed(1)}, rangées ${Math.round(moy(sp.map((s) => s.rangees)))}`);
console.log(`  score parfait seul : ${Math.round(moy(graines.map((g) => scoreParfait(g, 0).score)))}`);

// 4. Joueurs scriptés, avec traversées armées comme dans main.js.
function course(seed, pilote) {
  const route = new Route(seed);
  const dt = 1 / 120, T = dureeCourse();
  const tTenue = C.sautTenueMaxS;
  const M = { tap: C.sautVitesse / C.sautGravite, tDouble: C.sautVitesseDouble / C.sautGravite };
  M.haut = tTenue + (C.sautVitesse - C.sautGraviteTenue * tTenue) / C.sautGravite;
  M.double = M.haut + M.tDouble * 0.6;
  let v = 0, prevV = 0, speed = V_UNIT * C.vitesseBase, jumpY = 0, vy = 0, doubled = false, tHaut = 0, plan = null;
  const parEspece = {};
  let touches = 0, obstacles = 0, pieces = 0, apexMax = 0;
  const tPotes = [];
  for (let now = 0; now < T; now += dt) {
    speed += (targetSpeed(now) - speed) * Math.min(1, 3 * dt);
    prevV = v; v += speed * dt;
    for (let r = Math.floor(v + 0.5); r <= Math.floor(v + 0.5) + Math.ceil(speed * 4) + 1; r++) {
      const row = route.rowAt(r);
      if ((row.type !== "traverse" && row.type !== "contresens") || row.armed) continue;
      const tArr = now + (r - v) / speed;
      if (tArr - now <= 4) armer(row, now, tArr);
    }
    const sol = solAt(v);
    if (pilote && jumpY <= sol + 0.02 && !plan) {
      for (let r = Math.floor(v) + 1; r <= Math.floor(v) + 12; r++) {
        const row = route.rowAt(r);
        if (row.type === "safe") continue;
        const type = familleDe(row.kind);
        if (r - v <= speed * montee(type)) { plan = { r, type }; jumpY = sol + 0.001; vy = C.sautVitesse; doubled = false; tHaut = 0; }
        break;
      }
    }
    if (plan && plan.type === "double" && !doubled && jumpY > sol && vy <= 0) { vy = C.sautVitesseDouble; doubled = true; }
    if (jumpY > sol) {
      const tenu = plan && plan.type !== "tap" && vy > 0 && tHaut < tTenue;
      if (tenu) tHaut += dt;
      vy -= (tenu ? C.sautGraviteTenue : C.sautGravite) * dt;
      jumpY += vy * dt;
      apexMax = Math.max(apexMax, jumpY);
    }
    if (jumpY <= sol) { jumpY = sol; vy = 0; doubled = false; tHaut = 0; plan = null; }
    for (const ev of route.checkMember("j", prevV, v, jumpY, now)) {
      if (ev.type === "obstacle") { touches += 1; parEspece[ev.kind] = (parEspece[ev.kind] || 0) + 1; }
      if (ev.type === "piece") { pieces += 1; const p = C.potesPaliers[tPotes.length]; if (p !== undefined && pieces >= p) tPotes.push(now); }
    }
    const r = Math.floor(v + 0.5);
    if (prevV < r && v >= r && route.rowAt(r).type !== "safe") obstacles += 1;
  }
  return { touches, obstacles, pieces, tPotes, parEspece, apexMax };
}
const idem = graines.map((gr) => course(gr, true));
const immo = graines.map((gr) => course(gr, false));
console.log(`— Joueur idéal scripté : ${idem.reduce((a, c) => a + c.touches, 0)} obstacle(s) touché(s) sur ${idem.reduce((a, c) => a + c.obstacles, 0)} franchis (${N} graines)`);
const detail = {}; for (const c of idem) for (const [k, n] of Object.entries(c.parEspece)) detail[k] = (detail[k] || 0) + n;
if (Object.keys(detail).length) console.log("  détail :", JSON.stringify(detail));
console.log(`— Joueur immobile : ${immo.reduce((a, c) => a + c.touches, 0)} touchés sur ${immo.reduce((a, c) => a + c.obstacles, 0)} rencontrés`);
console.log(`— Pièces du joueur idéal (qui ne vise QUE les obstacles) : ${Math.round(moy(idem.map((c) => c.pieces)))} ; apex maximal atteint ${moy(idem.map((c) => c.apexMax)).toFixed(2)} u`);
const pot = C.potesPaliers.map((_, i) => { const t = idem.map((c) => c.tPotes[i]).filter((x) => x !== undefined); return t.length ? `${Math.round(moy(t))} s (${t.length}/${N})` : "jamais"; });
console.log(`— Arrivée des potes (paliers ${C.potesPaliers.join(", ")}) : ${pot.join(" · ")}`);
