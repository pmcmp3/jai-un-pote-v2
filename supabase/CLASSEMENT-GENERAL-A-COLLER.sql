-- « J'ai un pote v2 » — LE CLASSEMENT GÉNÉRAL ET LA COMMISSION.
--
-- À coller EN UNE FOIS dans l'éditeur SQL du projet Supabase de la v2
-- (jamais celui de la v1), après CONCOURS-A-COLLER.sql. Relançable sans risque.
--
-- LA RÈGLE :
--   score au général = ton record + 10 % du record de chaque pote de ta ligue.
--   À la clôture, tirage au sort entre les 3 premiers du général.
--
-- Deux mécaniques séparées :
--   - le BOOST (déjà en place) multiplie tes points pendant la course ;
--   - la COMMISSION (ici) s'ajoute après coup, dans le classement.
-- Elle se calcule sur les RECORDS, jamais sur les totaux : pas d'effet boule de
-- neige entre membres d'une ligue.
--
-- Pour changer le taux : update public.concours set commission = 0.15 where id = 1;

-- ===========================================================================
-- 1. LES RÉGLAGES.
-- Le plafond passe aussi à 95 000 : à 75 000, le jeu refuserait des scores
-- possibles depuis l'accélération de fin de course.
-- ===========================================================================
alter table public.concours add column if not exists commission numeric(4,3) not null default 0.10;
update public.concours set plafond_score = 95000 where id = 1 and plafond_score < 95000;

-- ===========================================================================
-- 2. LE CLASSEMENT DES JOUEURS.
--
-- - Les joueurs SANS ligue y figurent : leur score part sous le code de la ligue
--   de démo (PMCMP), qui reste exclue du classement des ligues. Ils n'ont aucune
--   commission.
-- - Un joueur ne rapporte sa commission qu'à UNE ligue : celle où il a fait son
--   meilleur score.
-- - Un même téléphone ne rapporte qu'UNE commission : dix pseudos créés sur un
--   seul appareil comptent pour un pote, et jamais pour eux-mêmes.
-- ===========================================================================
create or replace view public.concours_joueurs as
  with fenetre as (
    select coalesce(max(debut), '-infinity'::timestamptz) as d,
           coalesce(max(fin),   'infinity'::timestamptz)  as f,
           coalesce(max(commission), 0.10)                as taux
    from public.concours where id = 1
  ),
  scores as (
    select s.pseudo, s.code, s.metres, s.created_at,
           coalesce(s.appareil, 'pseudo:' || s.pseudo) as app,
           l.concours
    from public.ligue_scores s
    join public.ligues l on l.code = s.code
    cross join fenetre w
    where s.mode = 'course'
      and s.created_at >= w.d and s.created_at < w.f
      and (l.concours or l.code = 'PMCMP')
  ),
  records as (
    select distinct on (pseudo) pseudo, metres, created_at as atteint
    from scores order by pseudo, metres desc, created_at asc
  ),
  rattachement as (
    select distinct on (pseudo) pseudo, code, app, metres
    from scores where concours
    order by pseudo, metres desc, created_at asc
  ),
  par_appareil as (
    select code, app, max(metres) as metres
    from rattachement group by code, app
  ),
  gains as (
    select r.pseudo, sum(p.metres) as somme, count(p.app) as potes
    from rattachement r
    join par_appareil p on p.code = r.code and p.app <> r.app
    group by r.pseudo
  ),
  calcul as (
    select rec.pseudo, rec.metres, rec.atteint, rat.code,
           floor(coalesce(g.somme, 0) * w.taux)::int as commission,
           coalesce(g.potes, 0)::int as potes
    from records rec
    cross join fenetre w
    left join rattachement rat on rat.pseudo = rec.pseudo
    left join gains g on g.pseudo = rec.pseudo
  )
  select c.pseudo,
         c.metres::int as metres,
         c.code,
         l.nom,
         c.commission,
         c.potes,
         (c.metres + c.commission)::bigint as total,
         (row_number() over (order by c.metres + c.commission desc, c.atteint asc))::int as rang,
         (count(*) over ())::int as classes
  from calcul c
  left join public.ligues l on l.code = c.code;
grant select on public.concours_joueurs to anon;

-- ===========================================================================
-- 3. TA VUE DE CONTRÔLE : les 10 premiers et comment les joindre.
-- Lisible seulement ici, jamais avec la clé publique. La fiche retenue est celle
-- du téléphone qui a fait le record : deux joueurs peuvent porter le même pseudo.
-- `fiches` > 1 ou `appareils` très inférieur à `potes` : regarde de plus près.
-- ===========================================================================
create or replace view public.concours_podium as
  with meilleur as (
    select distinct on (pseudo) pseudo, appareil
    from public.ligue_scores where mode = 'course'
    order by pseudo, metres desc, created_at asc
  )
  select c.rang, c.pseudo, c.total, c.metres as record, c.commission, c.potes, c.code, c.nom,
         f.insta, f.email, f.ville,
         (select count(distinct j.insta) from public.joueurs j where j.pseudo = c.pseudo) as fiches,
         (select count(distinct s.appareil) from public.ligue_scores s where s.code = c.code and s.mode = 'course') as appareils
  from public.concours_joueurs c
  left join meilleur m on m.pseudo = c.pseudo
  left join lateral (
    select j.insta, j.email, j.ville from public.joueurs j
    where j.pseudo = c.pseudo
    order by (j.appareil is not distinct from m.appareil) desc, j.created_at desc
    limit 1
  ) f on true
  where c.rang <= 10
  order by c.rang;
revoke all on public.concours_podium from anon, authenticated;

notify pgrst, 'reload schema';

-- ===========================================================================
-- VÉRIFICATION — la dernière ligne doit répondre false.
-- ===========================================================================
select 'taux de commission' as quoi, commission as valeur from public.concours;
select rang, pseudo, metres as record, commission, total, nom from public.concours_joueurs order by rang limit 10;
select has_table_privilege('anon', 'public.concours_podium', 'select') as podium_lisible_par_le_public;
