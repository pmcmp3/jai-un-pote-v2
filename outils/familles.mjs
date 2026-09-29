// familles.mjs — Geste demandé par chaque obstacle (tap / haut / double).
import { chargerConfig } from "./charger-config.mjs";
chargerConfig();
const { KINDS, familleDe } = await import("../src/rows.js");
for (const k of Object.keys(KINDS)) console.log(k.padEnd(12), familleDe(k));
