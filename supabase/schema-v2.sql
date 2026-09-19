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
  created_at timestamptz not null default now()
);
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
