// sql-concours.mjs — Le banc d'essai du SQL du concours (`node outils/sql-concours.mjs`).
//
// Les fichiers de `supabase/` sont la partie la moins visible et la plus
// risquée du projet : une vue fausse se voit seulement au classement, un
// `grant` de trop ouvre les contacts de tous les joueurs, et on ne s'en rend
// compte qu'une fois le SQL collé en production.
//
// Ce test rejoue les trois fichiers dans l'ordre sur un vrai Postgres (PGlite,
// en mémoire), avec LES MÊMES DROITS PAR DÉFAUT QUE SUPABASE, puis vérifie le
// calcul du classement, les plafonds et la confidentialité.
// ⚠️ Il ne contacte JAMAIS la base de production : tout vit en mémoire et
// disparaît à la fin.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";

const SQL = join(dirname(dirname(fileURLToPath(import.meta.url))), "supabase");
const FICHIERS = ["schema-v2.sql", "CONCOURS-A-COLLER.sql", "AVANT-LE-LANCEMENT.sql"];

const db = new PGlite();
let ko = 0;
const ok = (c, quoi, detail = "") => {
  console.log(`  ${c ? "ok  " : "KO  "} ${quoi}${detail ? " — " + detail : ""}`);
  if (!c) ko++;
};
const q = async (sql) => (await db.query(sql)).rows;

// Le réglage par défaut de Supabase : la clé publique reçoit TOUS les droits
// sur ce qui se crée dans `public`, et seule la RLS (ou un `revoke` explicite)
// l'arrête. Sans cette ligne, le banc d'essai serait plus fermé que la vraie
// base et ne verrait pas une fuite de contacts.
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);

for (const f of FICHIERS) {
  // `notify pgrst` ne veut rien dire hors de Supabase.
  const sql = readFileSync(join(SQL, f), "utf8").replace(/^\s*notify pgrst.*$/gim, "");
  try { await db.exec(sql); console.log(`— ${f} passe`); }
  catch (e) { console.log(`— ${f} ÉCHOUE : ${e.message}`); ko++; }
}

// --- Les réglages -----------------------------------------------------------
const r = (await q(`select commission, plafond_score from public.concours where id = 1`))[0];
ok(Number(r.commission) === 0.1, "commission = 0,10", String(r.commission));
ok(r.plafond_score === 110000, "plafond de score = 110 000", String(r.plafond_score));

// --- Les places dans une ligue ----------------------------------------------
const b = (await q(`select nom, plafond, concours from public.ligues where code = 'BRUNO'`))[0];
ok(b && b.nom === "Bruno" && b.plafond === 21 && b.concours === true, "la ligue BRUNO existe : 21 places, en concours", JSON.stringify(b));
ok((await q(`select plafond from public.ligues where code = 'PMCMP'`))[0].plafond === 6, "la ligue de démo reste à 6 places");
const defaut = (await q(`select column_default from information_schema.columns where table_name = 'ligues' and column_name = 'plafond'`))[0].column_default;
ok(String(defaut).startsWith("21"), "une ligue créée dans le jeu aura 21 places", String(defaut));

// Le plafond est tenu par un trigger, pas seulement par le jeu : 21 passent, le 22e non.
for (let i = 1; i <= 21; i++) {
  try { await db.exec(`insert into public.ligue_membres (code, pseudo) values ('BRUNO', 'collegue${i}')`); }
  catch (e) { ok(false, `le membre n°${i} est accepté`, e.message); break; }
}
ok((await q(`select count(*)::int as n from public.ligue_membres where code = 'BRUNO'`))[0].n === 21, "21 personnes tiennent dans une ligue");
let refuse = false;
try { await db.exec(`insert into public.ligue_membres (code, pseudo) values ('BRUNO', 'collegue22')`); } catch (e) { refuse = true; }
ok(refuse, "le 22e est refusé");

// --- Le classement général --------------------------------------------------
// Trois collègues dans BRUNO, un joueur sans ligue, et une ligue de test hors
// concours dont le score énorme ne doit JAMAIS apparaître.
await db.exec(`
  insert into public.ligues (code, nom, createur, concours) values ('ESSAI', 'Essai', 'tom', false) on conflict (code) do nothing;
  insert into public.ligue_scores (code, pseudo, metres, potes, mode, duree_s, appareil) values
    ('BRUNO', 'paul',  10000, 5, 'course', 170, 'tel-paul'),
    ('BRUNO', 'julie',  6000, 5, 'course', 170, 'tel-julie'),
    ('BRUNO', 'momo',   4000, 5, 'course', 170, 'tel-momo'),
    ('BRUNO', 'momo',   2000, 5, 'course', 170, 'tel-momo'),
    ('PMCMP', 'solo',   9000, 5, 'course', 170, 'tel-solo'),
    ('ESSAI', 'tom',   99000, 5, 'course', 170, 'faux-tom');
`);
const cl = await q(`select rang, pseudo, metres, commission, potes, total, classes from public.concours_joueurs order by rang`);
const paul = cl.find((x) => x.pseudo === "paul"), julie = cl.find((x) => x.pseudo === "julie"), solo = cl.find((x) => x.pseudo === "solo");
ok(!cl.some((x) => x.pseudo === "tom"), "le faux joueur d'une ligue hors concours n'est pas classé");
ok(paul.commission === 1000 && paul.potes === 2, "paul touche 10 % de ses deux collègues (6 000 + 4 000 → 1 000)", `${paul.commission}, ${paul.potes} potes`);
ok(Number(paul.total) === 11000 && paul.rang === 1, "paul : 10 000 + 1 000 = 11 000, 1er", `${paul.total}, rang ${paul.rang}`);
ok(julie.commission === 1400, "julie touche 10 % de paul et de momo (14 000 → 1 400)", String(julie.commission));
ok(solo.commission === 0 && solo.potes === 0, "le joueur sans ligue est classé, sans commission");
ok(Number(solo.total) === 9000 && solo.rang === 2, "le joueur sans ligue passe devant julie et ses 7 400", `rang ${solo.rang}`);
ok(cl.every((x) => x.classes === 4), "le nombre de classés est juste", String(cl[0].classes));
// Le record est pris une fois : la deuxième course de momo (2 000) ne s'ajoute pas.
ok(cl.find((x) => x.pseudo === "momo").metres === 4000, "seul le record de chaque joueur compte");

// Un deuxième pseudo sur le même téléphone ne rapporte pas une deuxième commission.
await db.exec(`insert into public.ligue_scores (code, pseudo, metres, potes, mode, duree_s, appareil) values ('BRUNO', 'momo2', 4000, 5, 'course', 170, 'tel-momo')`);
const paul2 = (await q(`select commission, potes from public.concours_joueurs where pseudo = 'paul'`))[0];
ok(paul2.commission === 1000 && paul2.potes === 2, "un deuxième pseudo sur le téléphone de momo ne rapporte rien de plus", `${paul2.commission}, ${paul2.potes} potes`);

// --- Le garde-fou des scores ------------------------------------------------
let haut = true;
try { await db.exec(`insert into public.ligue_scores (code, pseudo, metres, potes, mode) values ('BRUNO', 'triche', 150000, 5, 'course')`); } catch (e) { haut = false; }
ok(!haut, "un score de 150 000 est refusé");
let vrai = true;
try { await db.exec(`insert into public.ligue_scores (code, pseudo, metres, potes, mode) values ('BRUNO', 'champion', 77814, 5, 'course')`); } catch (e) { vrai = false; }
ok(vrai, "le meilleur score humain possible (77 814) passe");

// --- La confidentialité -----------------------------------------------------
const lisible = async (t) => (await q(`select has_table_privilege('anon', 'public.${t}', 'select') as p`))[0].p;
const pod = await q(`select rang, pseudo, total, insta, fiches, appareils from public.concours_podium`);
const classes = (await q(`select count(*)::int as n from public.concours_joueurs`))[0].n;
ok(pod.length === Math.min(10, classes) && pod[0].rang === 1 && "insta" in pod[0],
   "ta vue de podium répond, avec le contact du premier", `${pod.length} lignes sur ${classes} classés`);
for (const t of ["concours_podium", "contacts", "joueurs", "evenements", "retours_beta", "ligues_suspectes", "ab_ecoute"]) {
  ok(!(await lisible(t)), `${t} : illisible avec la clé publique`);
}
for (const t of ["ligues", "ligue_membres", "ligue_scores", "concours", "concours_joueurs", "concours_ligues", "ligue_classement"]) {
  ok(await lisible(t), `${t} : le jeu peut toujours le lire`);
}
ok((await q(`select has_table_privilege('anon', 'public.joueurs', 'insert') as p`))[0].p, "la fiche de contact peut toujours s'enregistrer");

// --- Le sabotage par le pseudo d'un autre ---------------------------------
// Les pseudos ne sont pas uniques et rien ne les protège : la cadence doit se
// compter par APPAREIL, sinon dix scores bidons envoyés sous le pseudo d'un
// rival font refuser le SIEN (trouvé par l'audit à l'aveugle du 13 novembre).
for (let i = 0; i < 10; i++) {
  try { await db.exec(`insert into public.ligue_scores (code, pseudo, metres, potes, mode, duree_s, appareil) values ('BRUNO', 'victime', ${1000 + i}, 5, 'course', 170, 'tel-mechant')`); }
  catch (e) { ok(false, `le score bidon n°${i + 1} part`, e.message); break; }
}
let encore = true;
try { await db.exec(`insert into public.ligue_scores (code, pseudo, metres, potes, mode, duree_s, appareil) values ('BRUNO', 'victime', 1111, 5, 'course', 170, 'tel-mechant')`); } catch (e) { encore = false; }
ok(!encore, "onze scores en une minute depuis le même appareil : le onzième est refusé");
let victime = true;
try { await db.exec(`insert into public.ligue_scores (code, pseudo, metres, potes, mode, duree_s, appareil) values ('BRUNO', 'victime', 9000, 5, 'course', 170, 'tel-victime')`); } catch (e) { victime = false; }
ok(victime, "le joueur dont on a inondé le pseudo enregistre quand même son score");

verdict(ko === 0, ko === 0 ? "le SQL du concours : classement, plafonds et confidentialité" : `${ko} problème(s) dans le SQL du concours`);
