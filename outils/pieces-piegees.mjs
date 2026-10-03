// pieces-piegees.mjs — Des pièces qu'on ne peut prendre QU'EN touchant un
// obstacle ? (5 octobre 2026 : « une pièce qui est passée à travers une
// voiture [...] on ne pouvait pas faire le meilleur score, sinon on se prenait
// une voiture et on perdait la multiplication »).
//   node outils/pieces-piegees.mjs [N]
// Le joueur idéal de mesurer.mjs roule ; à l'instant où il passe sur la
// rangée d'une pièce, on regarde si un obstacle (garé, ou en face — à sa
// VRAIE position du moment) occupe cette rangée et monte plus haut que ce
// que la pièce permet : pour la prendre, il faudrait être dans l'obstacle.
import { chargerConfig } from "./charger-config.mjs";
const C = chargerConfig();
const R = await import("../src/rows.js");
const { V_UNIT, targetSpeed, dureeCourse } = await import("../src/regles.js");
const { Route, KINDS, armer, delaiArmement, familleDe, montee, solAt, toitGare, demiLongueurRoute, hauteurAFranchir, VELO_DEMI, CORPS_CENTRE, CORPS_DEMI } = R;
const N = Number(process.argv[2]) || 20;
const graines = Array.from({ length: N }, (_, i) => 1000 + i * 2467);
const parEspece = {}, exemples = [];
let total = 0, piegees = 0, balayees = 0;
const DEVANT = 14; // rangées visibles devant le joueur (portrait)
for (const seed of graines) {
  const route = new Route(seed);
  const dt = 1 / 120, T = dureeCourse();
  const tTenue = C.sautTenueMaxS;
  let v = 0, prevV = 0, speed = V_UNIT * C.vitesseBase, jumpY = 0, vy = 0, doubled = false, tHaut = 0, plan = null;
  const vues = new Set();
  var vuesBalayage = vuesBalayage || new Set();
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
    }
    if (jumpY <= sol) { jumpY = sol; vy = 0; doubled = false; tHaut = 0; plan = null; }
    route.checkMember("j", prevV, v, jumpY, now);
    // Une pièce que traverse, À L'ÉCRAN, un véhicule venu d'en face (plus bas que son toit).
    for (let r = Math.floor(v); r <= Math.floor(v) + 40; r++) {
      const row = route.rowAt(r);
      if (row.type !== "contresens" || !row.armed || KINDS[row.kind].lanceur || KINDS[row.kind].vitesse < 1.2) continue; // véhicules (les piétons, lents, à part)
      const c = r + row.v0 - row.vitesse * (now - row.t0), demi = demiLongueurRoute(row.kind);
      if (c - demi > v + DEVANT || c < v + 1) continue;
      for (let q = Math.ceil(c - demi); q <= Math.floor(c + demi); q++) {
        if (q <= v + 1) continue;
        const rq = route.rowAt(q);
        if (!rq.coins.length || rq.coins[0] - solAt(q) >= KINDS[row.kind].h + 0.3) continue;
        const cle = `${seed}:${q}`;
        if (!vuesBalayage.has(cle)) { vuesBalayage.add(cle); balayees += 1; }
      }
    }
    // Les pièces de la rangée qu'on vient d'atteindre.
    const q = Math.floor(v);
    if (q === Math.floor(prevV) || vues.has(q)) continue;
    vues.add(q);
    const rowQ = route.rowAt(q);
    for (const h of rowQ.coins) {
      total += 1;
      for (let r = q - 6; r <= q + 6; r++) {
        const row = route.rowAt(r);
        if (row.type === "safe" || row.type === "traverse") continue;
        let centre = r;
        if (row.type === "contresens") { if (!row.armed) continue; centre = r + row.v0 - row.vitesse * (now - row.t0); }
        const demi = demiLongueurRoute(row.kind) + VELO_DEMI;
        if (Math.abs(q - centre) >= demi) continue;
        // Pour la prendre il faut le buste sur h : roues au plus à h − CORPS_CENTRE + CORPS_DEMI.
        const rouesMax = h - CORPS_CENTRE + CORPS_DEMI;
        const dessus = hauteurAFranchir(row.kind) + solAt(centre);
        if (rouesMax >= dessus) continue;
        piegees += 1;
        parEspece[row.kind] = (parEspece[row.kind] || 0) + 1;
        if (exemples.length < 12) exemples.push(`graine ${seed} · pièce rangée ${q} à ${h.toFixed(2)} u (${rowQ.double ? "double" : "simple"}) dans ${row.kind} ${row.type} (rangée ${r}, centre ${centre.toFixed(1)}) · t ${now.toFixed(1)} s`);
        break;
      }
    }
  }
}
console.log(`${piegees} pièce(s) piégée(s) sur ${total} (${N} graines)`, JSON.stringify(parEspece));
console.log(`${balayees} pièce(s) traversée(s) à l'écran par un véhicule venu d'en face`);
for (const e of exemples) console.log("  ", e);
