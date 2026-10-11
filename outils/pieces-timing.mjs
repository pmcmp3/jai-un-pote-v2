// pieces-timing.mjs — Faut-il un timing « absolument fou » pour prendre toutes
// les pièces ? Le joueur idéal, mais qui saute avec une erreur de timing tirée
// au hasard (±E s) : part des pièces qu'il ramasse, comparée au joueur parfait.
//   node outils/pieces-timing.mjs [N]
import { chargerConfig } from "./charger-config.mjs";
const C = chargerConfig();
const { Route, armer, delaiArmement, familleDe, montee, solAt, toitGare } = await import("../src/rows.js");
const { V_UNIT, targetSpeed, dureeCourse } = await import("../src/regles.js");
const N = Number(process.argv[2]) || 12;
const graines = Array.from({ length: N }, (_, i) => 1000 + i * 2467);
const croisements = [];
function course(seed, E, geste = null) {
  const route = new Route(seed);
  let alea = seed + 17;
  const hasard = () => { alea = (alea * 16807) % 2147483647; return alea / 2147483647; };
  const dt = 1 / 120, T = dureeCourse();
  let v = 0, prevV = 0, speed = V_UNIT * C.vitesseBase, jumpY = 0, vy = 0, doubled = false, tHaut = 0, plan = null, pieces = 0, chocs = 0;
  const ecart = new Map();
  for (let now = 0; now < T; now += dt) {
    speed += (targetSpeed(now) - speed) * Math.min(1, 3 * dt);
    prevV = v; v += speed * dt;
    for (let r = Math.floor(v + 0.5); r <= Math.floor(v + 0.5) + Math.ceil(speed * 5.5) + 1; r++) {
      const row = route.rowAt(r);
      if ((row.type !== "traverse" && row.type !== "contresens") || row.armed) continue;
      const tArr = now + (r - v) / speed;
      if (tArr - now <= delaiArmement(row)) armer(row, now, tArr);
    }
    const sol = Math.max(solAt(v), toitGare(route, v, jumpY));
    if (jumpY <= sol + 0.02 && !plan) {
      for (let r = Math.floor(v) + 1; r <= Math.floor(v) + 12; r++) {
        const row = route.rowAt(r);
        if (row.type === "safe") continue;
        // Sur le toit d'une voiture du bouchon, la suivante se prend en roulant.
        if (row.bouchon !== undefined && sol > solAt(v) + 0.5) break;
        // La première voiture du bouchon : un PETIT saut pour se poser sur son toit.
        const type = row.bouchon === 0 ? "tap" : familleDe(row.kind);
        if (!ecart.has(r)) ecart.set(r, (hasard() * 2 - 1) * E);
        if (type !== "sol" && r - v <= speed * (montee(type) + ecart.get(r))) { plan = { r, type: geste ? geste(type) : type }; jumpY = sol + 0.001; vy = C.sautVitesse; doubled = false; tHaut = 0; }
        break;
      }
    }
    if (plan && plan.type === "double" && !doubled && jumpY > sol && vy <= 0) { vy = C.sautVitesseDouble; doubled = true; }
    if (jumpY > sol) {
      const tenu = plan && plan.type !== "tap" && vy > 0 && tHaut < C.sautTenueMaxS;
      if (tenu) tHaut += dt;
      vy -= (tenu ? C.sautGraviteTenue : C.sautGravite) * dt;
      jumpY += vy * dt;
    }
    if (jumpY <= sol) { jumpY = sol; vy = 0; doubled = false; tHaut = 0; plan = null; }
    if (E === 0 && !geste) for (let r = Math.floor(v) - 2; r <= Math.floor(v) + 2; r++) {
      const row = route.rowAt(r);
      if (row.type !== "contresens" || !row.armed || row.vu) continue;
      const c = r + row.v0 - row.vitesse * (now - row.t0);
      if (c <= v) { row.vu = true; croisements.push({ kind: row.kind, d: v - r }); }
    }
    for (const ev of route.checkMember("j", prevV, v, jumpY, now)) { if (ev.type === "piece") pieces += ev.double ? 2 : 1; if (ev.type === "obstacle") chocs += 1; }
  }
  // Toutes les pièces posées sur la route parcourue, prises ou non.
  let poses = 0; const manquees = [];
  for (let r = 0; r <= v; r++) { const row = route.rowAt(r); for (let i = 0; i < row.coins.length; i++) { poses += row.double ? 2 : 1; if (!route.coinTaken(r, i)) manquees.push({ r, h: row.coins[i] - solAt(r), voisin: voisinDe(route, r) }); } }
  return { pieces, chocs, poses, manquees };
}
function voisinDe(route, r) { for (let d = 0; d <= 8; d++) for (const q of [r + d, r - d]) { const row = route.rowAt(q); if (row.type !== "safe") return `${row.kind}${q > r ? "+" : q < r ? "-" : ""}${Math.abs(q - r)}`; } return "rien"; }
const parfait = graines.map((g) => course(g, 0));
const tot = parfait.reduce((a, x) => a + x.poses, 0), pris = parfait.reduce((a, x) => a + x.pieces, 0);
console.log(`  Joueur PARFAIT : ${pris} pièces sur ${tot} posées (${(100 * pris / tot).toFixed(1)} %)`);
const ex = parfait.flatMap((x) => x.manquees);
const parVoisin = {}; for (const m of ex) { const k = m.voisin.replace(/[+-]\d+$/, ""); parVoisin[k] = (parVoisin[k] || 0) + 1; }
console.log("  pièces qu'il rate, par obstacle le plus proche :", JSON.stringify(parVoisin));
console.log("  exemples :", ex.slice(0, 8).map((m) => `r${m.r} h${m.h.toFixed(2)} ${m.voisin}`).join(" · "));
for (const E of [0.05, 0.1, 0.15]) {
  const r = graines.map((g) => course(g, E));
  const part = r.reduce((a, x, i) => a + x.pieces / parfait[i].pieces, 0) / N;
  console.log(`  erreur de timing ±${E} s : ${Math.round(100 * part)} % des pièces du joueur parfait · ${(r.reduce((a, x) => a + x.chocs, 0) / N).toFixed(1)} choc(s) par course`);
}
for (const [nom, g] of [["tient tous ses sauts (tap → appui)", (t) => (t === "tap" ? "haut" : t)], ["double saute tout", () => "double"]]) {
  const r = graines.map((gr) => course(gr, 0, g));
  const part = r.reduce((a, x, i) => a + x.pieces / parfait[i].pieces, 0) / N;
  console.log(`  ${nom} : ${Math.round(100 * part)} % des pièces · ${(r.reduce((a, x) => a + x.chocs, 0) / N).toFixed(1)} choc(s) par course`);
}
const parKind = {};
for (const c of croisements) (parKind[c.kind] ||= []).push(c.d);
console.log("  Croisement réel d'un obstacle venu d'en face, en rangées par rapport à sa rangée prévue (moyenne / pire) :");
for (const [k, ds] of Object.entries(parKind)) console.log(`    ${k.padEnd(12)} ${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(2)} / ${Math.max(...ds.map(Math.abs)).toFixed(2)}  (${ds.length})`);
