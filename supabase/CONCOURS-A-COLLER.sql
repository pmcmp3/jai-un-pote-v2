-- « J'ai un pote v2 » — LE CONCOURS DE LIGUES.
--
-- À coller EN UNE FOIS dans l'éditeur SQL du projet Supabase de la v2
-- (jamais celui de la v1). Idempotent : relançable sans rien casser, et il
-- n'écrase PAS les dates que tu auras modifiées ensuite à la main.
--
-- Ce qu'il pose :
--   1. la table `concours` : dates d'ouverture et de clôture, plafond de score ;
--   2. le drapeau `ligues.concours` : les ligues de test sortent du classement ;
--   3. l'identifiant d'appareil sur chaque score (détection des fausses ligues) ;
--   4. la table `joueurs` : Insta et email des joueurs, ILLISIBLES avec la clé
--      publique, lus seulement ici dans le Table editor ;
--   5. le classement des ligues et le top 50 individuel ;
--   6. le garde-fou anti-triche à l'insertion d'un score ;
--   7. trois vues de contrôle pour repérer la triche et lire l'A/B test.

-- ===========================================================================
-- 1. LE CONCOURS : une seule ligne, modifiable à la main.
-- ===========================================================================
create table if not exists public.concours (
  id integer primary key default 1,
  debut timestamptz not null default now(),
  fin timestamptz,
  plafond_score integer not null default 95000,
  constraint concours_ligne_unique check (id = 1)
);
alter table public.concours enable row level security;
drop policy if exists "Lecture publique du concours" on public.concours;
create policy "Lecture publique du concours" on public.concours for select to anon using (true);

-- Clôture : dimanche 22 novembre 2026 à 12 h (heure de Paris).
-- Ouverture : l'instant où tu colles ce fichier. `do nothing` : relancer le
-- fichier ne réécrit jamais une date que tu as corrigée après coup.
insert into public.concours (id, debut, fin, plafond_score)
values (1, now(), '2026-11-22 12:00:00+01', 95000)
on conflict (id) do nothing;

-- ===========================================================================
-- 2. LES LIGUES DE TEST SORTENT DU CLASSEMENT.
-- La ligue de démo reste en base : c'est le peloton de ceux qui jouent sans
-- ligue. Elle ne concourt simplement pas.
-- ===========================================================================
alter table public.ligues add column if not exists concours boolean not null default true;
update public.ligues set concours = false where code in ('PMCMP', 'BETA', 'TESTV2', 'DEMO');

-- ===========================================================================
-- 3. L'APPAREIL DERRIÈRE CHAQUE SCORE.
-- Identifiant anonyme tiré au sort et gardé dans le téléphone (jp2Joueur) :
-- il ne dit pas QUI joue, il dit si vingt pseudos d'une même ligue sortent du
-- même téléphone. Détection, pas blocage : c'est toi qui remets le lot.
-- ===========================================================================
alter table public.ligue_scores add column if not exists appareil text;
create index if not exists ligue_scores_pseudo_date_idx on public.ligue_scores (pseudo, created_at desc);

-- ===========================================================================
-- 4. LES JOUEURS : de quoi contacter la ligue gagnante.
-- ⚠️ DONNÉES PERSONNELLES. La table est en insertion seule : AUCUNE règle de
-- lecture pour la clé publique, donc le jeu (et n'importe qui d'autre) ne peut
-- pas les relire. Elles se lisent ici, dans le Table editor, ou par la vue
-- `contacts` plus bas.
-- ===========================================================================
create table if not exists public.joueurs (
  id bigint generated always as identity primary key,
  pseudo text not null,
  insta text,
  email text,
  newsletter boolean not null default false,
  ville text,
  ligue text,
  appareil text,
  created_at timestamptz not null default now()
);
alter table public.joueurs enable row level security;
drop policy if exists "Enregistrement public d'un joueur" on public.joueurs;
create policy "Enregistrement public d'un joueur" on public.joueurs for insert to anon with check (true);
create index if not exists joueurs_pseudo_idx on public.joueurs (pseudo, created_at desc);

-- La dernière fiche de chaque joueur. Pas de `grant` : invisible avec la clé
-- publique, lisible ici dans le SQL editor.
create or replace view public.contacts as
  select distinct on (pseudo) pseudo, insta, email, newsletter, ville, ligue, created_at
  from public.joueurs
  order by pseudo, created_at desc;

-- ===========================================================================
-- 5. LES CLASSEMENTS DU CONCOURS.
--
-- LA RÈGLE : le score d'une ligue, c'est la somme des meilleurs scores de ses
-- membres, sur les courses jouées pendant le concours.
--
-- Un joueur ne compte que pour UNE ligue : celle où il a fait son meilleur
-- score. Sans ça, cinq potes qui rejoignent les cinq ligues les uns des autres
-- feraient monter les cinq d'un coup.
-- ===========================================================================
create or replace view public.concours_ligues as
  with fenetre as (
    select coalesce(max(debut), '-infinity'::timestamptz) as d,
           coalesce(max(fin),   'infinity'::timestamptz)  as f
    from public.concours where id = 1
  ),
  par_ligue as (
    select s.pseudo, s.code, max(s.metres) as metres
    from public.ligue_scores s, fenetre w
    where s.mode = 'course'
      and s.created_at >= w.d and s.created_at < w.f
      and s.code in (select code from public.ligues where concours)
    group by s.pseudo, s.code
  ),
  meilleurs as (
    select distinct on (pseudo) pseudo, code, metres
    from par_ligue order by pseudo, metres desc
  )
  select l.code,
         l.nom,
         count(m.pseudo)::int        as joueurs,
         coalesce(sum(m.metres), 0)::bigint as total
  from public.ligues l
  join meilleurs m on m.code = l.code
  where l.concours
  group by l.code, l.nom;
grant select on public.concours_ligues to anon;

-- Le top 50 individuel (la « super ligue »).
create or replace view public.concours_joueurs as
  with fenetre as (
    select coalesce(max(debut), '-infinity'::timestamptz) as d,
           coalesce(max(fin),   'infinity'::timestamptz)  as f
    from public.concours where id = 1
  )
  select s.pseudo, max(s.metres)::int as metres
  from public.ligue_scores s, fenetre w
  where s.mode = 'course'
    and s.created_at >= w.d and s.created_at < w.f
    and s.code in (select code from public.ligues where concours)
  group by s.pseudo;
grant select on public.concours_joueurs to anon;

-- ===========================================================================
-- 6. LE GARDE-FOU À L'INSERTION D'UN SCORE.
--
-- Plafond : `outils/plafond.mjs` mesure le score parfait le plus haut sur
-- 300 graines (23 050) ; avec le boost de ligue maximal (×3), un humain plafonne
-- à 69 150. Le plafond est posé bien au-dessus, à 95 000 : trop bas, il
-- refuserait une vraie partie et le joueur perdrait son score sans le savoir.
-- Pour le relever : update public.concours set plafond_score = 120000 where id = 1;
--
-- Cadence : une course dure 173 s. Un joueur qui meurt tout de suite et relance
-- peut en enchaîner quelques-unes ; dix en une minute, c'est un script.
-- ===========================================================================
create or replace function public.score_vraisemblable() returns trigger language plpgsql as $$
declare cap integer; recentes integer;
begin
  select plafond_score into cap from public.concours where id = 1;
  if cap is null then cap := 95000; end if;
  if new.metres > cap then
    raise exception 'score impossible : % (plafond %)', new.metres, cap;
  end if;
  if new.metres < 0 then
    raise exception 'score negatif';
  end if;
  select count(*) into recentes from public.ligue_scores
    where pseudo = new.pseudo and created_at > now() - interval '1 minute';
  if recentes >= 10 then
    raise exception 'trop de scores en une minute pour %', new.pseudo;
  end if;
  return new;
end $$;
drop trigger if exists score_vraisemblable_trg on public.ligue_scores;
create trigger score_vraisemblable_trg before insert on public.ligue_scores
  for each row execute function public.score_vraisemblable();

-- ===========================================================================
-- 7. TES VUES DE CONTRÔLE (pas de `grant` : lisibles seulement ici).
-- ===========================================================================

-- Les ligues à regarder de près : beaucoup de pseudos, peu d'appareils.
create or replace view public.ligues_suspectes as
  select s.code,
         count(distinct s.pseudo)   as pseudos,
         count(distinct s.appareil) as appareils,
         count(*)                   as courses,
         max(s.metres)              as meilleur
  from public.ligue_scores s
  where s.mode = 'course' and s.code in (select code from public.ligues where concours)
  group by s.code
  having count(distinct s.pseudo) > greatest(count(distinct s.appareil), 1) + 1
  order by count(distinct s.pseudo) - count(distinct s.appareil) desc;

-- L'A/B test : taux de clic vers l'écoute, par variante.
create or replace view public.ab_ecoute as
  with vus as (
    select details->>'ab' as variante, count(distinct details->>'joueur') as joueurs
    from public.evenements where type = 'fin_vue' and details->>'ab' is not null
    group by 1
  ),
  clics as (
    select details->>'ab' as variante, count(distinct details->>'joueur') as cliqueurs
    from public.evenements where type in ('clic_album', 'ecouter_album') and details->>'ab' is not null
    group by 1
  )
  select v.variante, v.joueurs, coalesce(c.cliqueurs, 0) as cliqueurs,
         round(100.0 * coalesce(c.cliqueurs, 0) / nullif(v.joueurs, 0), 1) as taux_pct
  from vus v left join clics c on c.variante = v.variante
  order by taux_pct desc nulls last;

-- Le tunnel d'invitation, par variante de message.
create or replace view public.ab_invitation as
  select details->>'message' as message,
         count(*) filter (where type = 'invitation_envoyee') as envoyees,
         count(*) filter (where type = 'invitation_acceptee') as acceptees
  from public.evenements
  where details->>'message' is not null
  group by 1 order by 1;

-- Confidentialité : Supabase donne à la clé publique le droit de lire tout ce qui
-- se crée dans `public`. Ces vues sont pour TOI seul.
revoke all on public.contacts from anon, authenticated;
revoke all on public.ligues_suspectes from anon, authenticated;
revoke all on public.ab_ecoute from anon, authenticated;
revoke all on public.ab_invitation from anon, authenticated;
alter view public.contacts set (security_invoker = true);
alter view public.ligues_suspectes set (security_invoker = true);

-- ===========================================================================
-- VÉRIFICATION — ces trois lignes doivent répondre.
-- ===========================================================================
select 'concours' as table_, debut, fin, plafond_score from public.concours;
select 'ligues en concours' as quoi, count(*) from public.ligues where concours;
select * from public.concours_ligues order by total desc limit 10;
