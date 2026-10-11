-- « J'ai un pote v2 » — SCHÉMA COMPLET de la base (19 septembre 2026).
--
-- À exécuter UNE FOIS dans l'éditeur SQL d'un projet Supabase NEUF, dédié à la
-- v2 (jamais dans le projet de la v1 : la bêta fermée y tourne). Idempotent :
-- peut être relancé sans erreur.
--
-- Consolide, dans l'ordre, les trois fichiers de la v1 conservés à côté pour
-- mémoire : supabase-migration-ligues.sql (trois parties),
-- supabase-migration-beta.sql, supabase-migration-A-EXECUTER.sql.
-- Seule différence voulue : pas de table `preinscriptions_concert` (le concert
-- et ses « 50 places » ont été retirés du jeu le 16 septembre 2026).
--
-- Même philosophie que la v1 : aucun anti-triche, RLS permissive (lecture et
-- insertion publiques sur ce qui s'affiche, insertion seule sur ce qui ne se
-- relit jamais), jamais d'update/delete côté client.

-- ---------------------------------------------------------------------------
-- LIGUES : un code à 5 lettres, un plafond de membres (6 par défaut, 60 pour
-- la bêta fermée).
-- ---------------------------------------------------------------------------
create table if not exists public.ligues (
  code text primary key,
  nom text,
  createur text,
  plafond integer not null default 6,
  created_at timestamptz not null default now()
);
alter table public.ligues add column if not exists plafond integer not null default 6;
alter table public.ligues enable row level security;
drop policy if exists "Lecture publique des ligues" on public.ligues;
create policy "Lecture publique des ligues" on public.ligues for select to anon using (true);
drop policy if exists "Creation publique d'une ligue" on public.ligues;
create policy "Creation publique d'une ligue" on public.ligues for insert to anon with check (true);

-- ---------------------------------------------------------------------------
-- MEMBRES : ils deviennent les potes du peloton des autres, avec leur skin.
-- ---------------------------------------------------------------------------
create table if not exists public.ligue_membres (
  id bigint generated always as identity primary key,
  code text not null references public.ligues(code),
  pseudo text not null,
  skin text,
  created_at timestamptz not null default now(),
  unique (code, pseudo)
);
alter table public.ligue_membres add column if not exists skin text;
alter table public.ligue_membres enable row level security;
drop policy if exists "Lecture publique des membres" on public.ligue_membres;
create policy "Lecture publique des membres" on public.ligue_membres for select to anon using (true);
drop policy if exists "Adhesion publique" on public.ligue_membres;
create policy "Adhesion publique" on public.ligue_membres for insert to anon with check (true);
create index if not exists ligue_membres_code_idx on public.ligue_membres (code, created_at);

-- Plafond vérifié côté serveur, lu dans ligues.plafond.
create or replace function public.ligue_plafond() returns trigger language plpgsql as $$
declare cap integer;
begin
  select coalesce(plafond, 6) into cap from public.ligues where code = new.code;
  if cap is null then cap := 6; end if;
  if (select count(*) from public.ligue_membres where code = new.code) >= cap then
    raise exception 'ligue complete (% max)', cap;
  end if;
  return new;
end $$;
drop trigger if exists ligue_plafond_trg on public.ligue_membres;
create trigger ligue_plafond_trg before insert on public.ligue_membres
  for each row execute function public.ligue_plafond();

-- ---------------------------------------------------------------------------
-- SCORES : une ligne par course. `graine` = la route jouée (une ligue = une
-- course, regles.graineLigue) ; `trace` = le fantôme, envoyé seulement quand
-- la course bat le record de la ligue sur cette route. La colonne s'appelle
-- encore `metres` pour rester compatible avec le code : ce sont des « pts ».
-- ---------------------------------------------------------------------------
create table if not exists public.ligue_scores (
  id bigint generated always as identity primary key,
  code text not null references public.ligues(code),
  pseudo text not null,
  metres integer not null,
  potes integer not null default 0,
  mode text not null default 'course',
  graine integer,
  trace text,
  created_at timestamptz not null default now()
);
alter table public.ligue_scores add column if not exists mode text not null default 'course';
alter table public.ligue_scores add column if not exists graine integer;
alter table public.ligue_scores add column if not exists trace text;
-- Boost de ligue (29 septembre 2026) : durée de la course, en secondes.
alter table public.ligue_scores add column if not exists duree_s integer;
create index if not exists ligue_scores_boost_idx on public.ligue_scores (code, duree_s);
alter table public.ligue_scores enable row level security;
drop policy if exists "Lecture publique des scores de ligue" on public.ligue_scores;
create policy "Lecture publique des scores de ligue" on public.ligue_scores for select to anon using (true);
drop policy if exists "Envoi public d'un score de ligue" on public.ligue_scores;
create policy "Envoi public d'un score de ligue" on public.ligue_scores for insert to anon with check (true);
create index if not exists ligue_scores_code_idx on public.ligue_scores (code, metres desc);
create index if not exists ligue_scores_graine_idx on public.ligue_scores (code, graine, metres desc);

-- Classement historique (repli quand la graine manque) : meilleure course par membre.
create or replace view public.ligue_classement as
  select code, pseudo, max(metres) as metres, max(potes) as potes, count(*) as parties
  from public.ligue_scores where mode = 'course'
  group by code, pseudo;
grant select on public.ligue_classement to anon;

-- Relais : points cumulés d'une ligue depuis le lundi de la semaine en cours.
create or replace view public.ligue_relais as
  select code, sum(metres) as metres, count(*) as parties
  from public.ligue_scores
  where mode = 'course' and created_at >= date_trunc('week', now())
  group by code;
grant select on public.ligue_relais to anon;

-- ---------------------------------------------------------------------------
-- ÉVÉNEMENTS du funnel (insert-only : illisibles avec la clé anon, se lisent
-- dans le Table editor Supabase).
-- ---------------------------------------------------------------------------
create table if not exists public.evenements (
  id bigint generated always as identity primary key,
  type text not null,
  pseudo text,
  source text,
  ligue text,
  details jsonb,           -- 5 octobre 2026 : palier de la porte, action, numéro de partie, plateforme
  created_at timestamptz not null default now()
);
alter table public.evenements add column if not exists details jsonb;
alter table public.evenements enable row level security;
drop policy if exists "Envoi public d'un evenement" on public.evenements;
create policy "Envoi public d'un evenement" on public.evenements for insert to anon with check (true);
create index if not exists evenements_type_idx on public.evenements (type, created_at);

-- ---------------------------------------------------------------------------
-- RETOURS des bêta-testeurs (insert-only : Table editor → retours_beta).
-- ---------------------------------------------------------------------------
create table if not exists public.retours_beta (
  id bigint generated always as identity primary key,
  ligue text,
  pseudo text,
  texte text not null,
  score integer,
  potes integer,
  fin boolean,
  partie integer,
  appareil text,
  created_at timestamptz not null default now()
);
alter table public.retours_beta enable row level security;
drop policy if exists "Envoi public d'un retour" on public.retours_beta;
create policy "Envoi public d'un retour" on public.retours_beta for insert to anon with check (true);
create index if not exists retours_beta_date_idx on public.retours_beta (created_at desc);

-- ---------------------------------------------------------------------------
-- LIGUES DE DÉPART : la ligue de démo (Paul et ses quatre potes) et la bêta.
-- Les autres ligues et tous les membres réels de la v1 arrivent par
-- outils/copier-ligues-v1-vers-v2.mjs (les SCORES v1 ne sont pas copiés :
-- ils portent la graine d'une route qui n'existe pas en v2).
-- ---------------------------------------------------------------------------
insert into public.ligues (code, nom, createur, plafond) values ('PMCMP', 'Ligue de démo', 'paul', 6) on conflict (code) do nothing;
insert into public.ligues (code, nom, createur, plafond) values ('BETA', 'Bêta-test', 'pmc', 60)
  on conflict (code) do update set nom = excluded.nom, plafond = excluded.plafond;
insert into public.ligue_membres (code, pseudo, skin) values
  ('PMCMP', 'paul',   '{"motif":"raye","c1":"#2f7a46","c2":"#f2ede2","short":"#3a3e4e","chapeau":"casquette","chaussures":"#565a66","velo":"vtt"}'),
  ('PMCMP', 'lea',    '{"motif":"uni","c1":"#ffcf2e","c2":"#f2ede2","short":"#3f63b4","chapeau":"paille","chaussures":"#f2ede2","velo":"grandbi"}'),
  ('PMCMP', 'marius', '{"motif":"uni","c1":"#f2ede2","c2":"#f2ede2","short":"#b8402c","chapeau":"aucun","chaussures":"#f2ede2","velo":"vtt"}'),
  ('PMCMP', 'ines',   '{"motif":"uni","c1":"#2f7a46","c2":"#f2ede2","short":"#3a3e4e","chapeau":"bob","chaussures":"#e0742e","velo":"vtt"}'),
  ('PMCMP', 'hugo',   '{"motif":"carreaux","c1":"#e13e26","c2":"#0d0d10","short":"#c8963a","chapeau":"casquette","chaussures":"#33353d","velo":"grandbi"}')
on conflict (code, pseudo) do nothing;


-- tableau-de-bord.sql — Les VUES du tableau de bord (public/tableau-de-bord.html).
-- À exécuter dans le SQL editor Supabase APRÈS schema-v2.sql.
--
-- La table `evenements` reste en écriture seule pour la clé anon (personne ne
-- peut lire les événements bruts depuis le jeu). Ces vues ne montrent que des
-- COMPTES et des MOYENNES, jamais un pseudo : elles sont lisibles avec la clé
-- anon, et c'est tout ce que lit le tableau de bord.
-- Chaque événement porte details.visite (un chargement de page) et
-- details.joueur (identifiant anonyme gardé dans le téléphone), posés par net.js.

-- Par jour : visites, joueurs, courses, arrivées, morts, clics album, invitations.
create or replace view public.tb_jours as
select (created_at at time zone 'Europe/Paris')::date as jour,
  count(distinct details->>'visite') as visites,
  count(distinct details->>'joueur') as joueurs,
  count(*) filter (where type = 'course_debut') as courses,
  count(*) filter (where type = 'course_finie') as arrivees,
  count(*) filter (where type = 'mort') as morts,
  count(*) filter (where type = 'clic_album') as clics_album,
  count(*) filter (where type = 'invitation_envoyee') as invitations
from public.evenements
group by 1 order by 1 desc;

-- L'entonnoir : combien de joueurs DIFFÉRENTS atteignent chaque étape.
create or replace view public.tb_entonnoir as
with j as (
  select details->>'joueur' as joueur,
    bool_or(type = 'arrivee') as arrive,
    bool_or(type = 'chargement_fini') as charge,
    bool_or(type = 'inscription') as inscrit,
    bool_or(type = 'course_debut') as joue,
    bool_or(type in ('course_finie', 'mort')) as termine,
    bool_or(type = 'course_finie') as arrivee,
    bool_or(type = 'course_debut' and coalesce((details->>'partie')::int, 0) >= 1) as rejoue,
    bool_or(type = 'clic_album') as album,
    bool_or(type = 'invitation_envoyee') as invite
  from public.evenements where details ? 'joueur' group by 1
)
select * from (values
  (1, 'Arrivés sur la page',          (select count(*) from j where arrive)),
  (2, 'Chargement terminé',           (select count(*) from j where charge)),
  (3, 'Pseudo écrit',                 (select count(*) from j where inscrit)),
  (4, 'Première course lancée',       (select count(*) from j where joue)),
  (5, 'Course terminée (mort ou fin)',(select count(*) from j where termine)),
  (6, 'Ligne d''arrivée franchie',    (select count(*) from j where arrivee)),
  (7, 'Deuxième course',              (select count(*) from j where rejoue)),
  (8, 'Clic sur l''album',            (select count(*) from j where album)),
  (9, 'Invitation envoyée',           (select count(*) from j where invite))
) as v(ordre, etape, joueurs);

-- Où l'on QUITTE le jeu : le dernier événement de chaque visite. Si c'est une
-- page cachée, l'endroit où elle a été cachée (menu-pseudo, course, mort, fin…).
create or replace view public.tb_departs as
with dernier as (
  select distinct on (details->>'visite') type, details->>'ou' as ou
  from public.evenements where details ? 'visite'
  order by details->>'visite', created_at desc, id desc
)
select coalesce(case when type = 'cachee' then ou end, 'encore là / autre (' || type || ')') as ou, count(*) as visites
from dernier group by 1 order by 2 desc;

-- Durée des courses (secondes de morceau) : à la mort, à l'arrivée, à l'écran
-- de fin, et quand on quitte en pleine course.
create or replace view public.tb_durees as
select case type when 'cachee' then 'quitte en pleine course' when 'mort' then 'mort' when 'course_finie' then 'arrivée' else type end as moment,
  count(*) as n,
  round(avg((details->>'temps')::numeric), 1) as moyenne_s,
  round((percentile_cont(0.5) within group (order by (details->>'temps')::numeric))::numeric, 1) as mediane_s
from public.evenements
where details ? 'temps' and (type in ('mort', 'course_finie', 'fin_vue') or (type = 'cachee' and details->>'ou' = 'course'))
group by 1 order by 2 desc;

-- Conversion : la porte (album / abonnement), les choix à la mort, les clics.
create or replace view public.tb_conversion as
select type, coalesce(details->>'choix', details->>'niveau', details->>'plateforme', details->>'depuis', details->>'action', '') as detail,
  count(*) as n, count(distinct details->>'joueur') as joueurs
from public.evenements
where type in ('mort_choix', 'porte_vue', 'continuer', 'rejouer', 'clic_album', 'clic_suivre', 'ecouter_album')
group by 1, 2 order by 1, 3 desc;

-- À la fin du morceau : parmi les visites qui voient l'écran de fin, combien
-- ouvrent le partage, combien envoient vraiment une invitation depuis là.
create or replace view public.tb_fin_invitations as
with f as (select distinct details->>'visite' as v from public.evenements where type = 'fin_vue'),
     o as (select distinct details->>'visite' as v from public.evenements where type = 'partage_ouvert' and details->>'depuis' = 'fin'),
     e as (select distinct details->>'visite' as v from public.evenements where type = 'invitation_envoyee' and details->>'depuis' = 'fin')
select (select count(*) from f) as visites_fin,
       (select count(*) from f join o using (v)) as ouvrent_le_partage,
       (select count(*) from f join e using (v)) as envoient;

-- Tous les événements, par type (pour vérifier que le suivi arrive).
create or replace view public.tb_types as
select type, count(*) as n, count(distinct details->>'joueur') as joueurs, max(created_at) as dernier
from public.evenements group by 1 order by 2 desc;

grant select on public.tb_jours, public.tb_entonnoir, public.tb_departs, public.tb_durees,
  public.tb_conversion, public.tb_fin_invitations, public.tb_types to anon;
