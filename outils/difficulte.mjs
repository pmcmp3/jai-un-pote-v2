// difficulte.mjs — Est-ce qu'on peut MOURIR ? (11 octobre 2026 : « le jeu est
// encore trop facile [...] en one shot, je n'ai pas réussi à mourir »).
//   node outils/difficulte.mjs [N]
// Le joueur idéal de mesurer.mjs, mais qui RATE une part des obstacles (il ne
// saute pas : il roule dedans), tirée au hasard avec une graine fixe. Avec la
// vraie économie de main.js : paliers de potes, rachat après le dernier palier
// (de plus en plus cher), coût des chocs qui monte, turbo du lait. Mort =
// un choc sans aucun pote. Pour chaque taux d'erreur : la part des courses
// où il meurt, et quand.
import { chargerConfig } from "./charger-config.mjs";
const C = chargerConfig();
const { Route, KINDS, armer, delaiArmement, familleDe, montee, solAt, toitGare } = await import("../src/rows.js");
const { V_UNIT, targetSpeed, dureeCourse } = await import("../src/regles.js");

const N = Number(process.argv[2]) || 30;
const graines = Array.from({ length: N }, (_, i) => 1000 + i * 2467);
const TAUX = [0.05, 0.1, 0.15, 0.2];

function coutRachat(t) {
  const base = C.poteRachatPieces || 5, fin = C.poteRachatPiecesFin || base;
  return Math.round(base + (fin - base) * Math.max(0, Math.min(1, (t - 60) / 100)));
}
function coutChoc(kind, t) {
  const a = t / dureeCourse();
  return KINDS[kind].cout + (a > (C.chocPlusDeuxApres || 2) ? 2 : a > (C.chocPlusUnApres || 2) ? 1 : 0);
}

function course(seed, taux) {
  const route = new Route(seed);
  let alea = seed * 7 + Math.round(taux * 1000);
  const hasard = () => { alea = (alea * 16807) % 2147483647; return alea / 2147483647; };
  const dt = 1 / 120, T = dureeCourse(), tTenue = C.sautTenueMaxS;
  let v = 0, prevV = 0, speed = V_UNIT * C.vitesseBase, jumpY = 0, vy = 0, doubled = false, tHaut = 0, plan = null;
  let points = 0, potes = 0, gagnes = 0, cible = null, turbo = 0, chocs = 0, mort = null;
  const decides = new Map(); // rangée → raté ?
  for (let now = 0; now < T && mort === null; now += dt) {
    speed += (targetSpeed(now) * (turbo > 0 ? C.laitVitesse || 1.2 : 1) - speed) * Math.min(1, 3 * dt);
    prevV = v; v += speed * dt; turbo = Math.max(0, turbo - dt);
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
        const type = familleDe(row.kind);
        if (!decides.has(r)) decides.set(r, type !== "sol" && hasard() < taux);
        if (type !== "sol" && !decides.get(r) && r - v <= speed * montee(type)) { plan = { r, type }; jumpY = sol + 0.001; vy = C.sautVitesse; doubled = false; tHaut = 0; }
        break;
      }
    }
    if (plan && plan.type === "double" && !doubled && jumpY > sol && vy <= 0) { vy = C.sautVitesseDouble; doubled = true; }
    if (jumpY > sol) {
      const tenu = plan && plan.type !== "tap" && vy > 0 && tHaut < tTenue;
      if (tenu) tHaut += dt;
      vy -= (tenu ? C.sautGraviteTenue : C.sautGravite) * dt;
      jumpY += vy * dt;
    }
    if (jumpY <= sol) { jumpY = sol; vy = 0; doubled = false; tHaut = 0; plan = null; }
    for (const ev of route.checkMember("j", prevV, v, jumpY, now)) {
      if (ev.type === "piece" || ev.type === "rouge") {
        points += ev.type === "rouge" ? 0 : ev.double ? 2 : 1;
        while (gagnes < C.potesPaliers.length && points >= C.potesPaliers[gagnes]) { gagnes += 1; potes = Math.min(C.potesMax, potes + 1); }
        if (cible !== null && points >= cible) { potes = Math.min(C.potesMax, potes + 1); cible = potes < C.potesMax ? points + coutRachat(now) : null; }
      } else if (ev.type === "lait") turbo = C.laitDureeS || 5;
      else if (ev.type === "obstacle" && turbo <= 0) {
        chocs += 1;
        if (potes === 0) { mort = now; break; }
        potes = Math.max(0, potes - coutChoc(ev.kind, now));
        if (gagnes >= C.potesPaliers.length && cible === null) cible = points + coutRachat(now);
      }
    }
  }
  return { mort, potes, chocs };
}

console.log(`Joueur qui rate une part des obstacles, ${N} courses par taux (économie de config.js) :`);
for (const taux of TAUX) {
  const res = graines.map((g) => course(g, taux));
  const morts = res.filter((r) => r.mort !== null).map((r) => r.mort).sort((a, b) => a - b);
  const vivants = res.filter((r) => r.mort === null);
  const med = morts.length ? `${Math.round(morts[Math.floor(morts.length / 2)])} s` : "—";
  const potesFin = vivants.length ? (vivants.reduce((a, r) => a + r.potes, 0) / vivants.length).toFixed(1) : "—";
  const chocs = (res.reduce((a, r) => a + r.chocs, 0) / res.length).toFixed(0);
  console.log(`  rate ${String(Math.round(taux * 100)).padStart(2)} % : meurt ${String(Math.round((100 * morts.length) / N)).padStart(3)} % des courses (médiane ${med}) · ~${chocs} chocs · potes à l'arrivée des survivants ${potesFin}`);
}
