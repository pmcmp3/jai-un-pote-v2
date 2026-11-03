-- CORRECTIF À COLLER MAINTENANT (après CONCOURS-A-COLLER.sql). Relançable.
--
-- 1. Supabase donne par défaut à la clé publique le droit de LIRE tout ce qui
--    se crée dans `public`, vues comprises. La vue `contacts` (Insta + email des
--    joueurs) aurait donc été lisible par n'importe qui dès le premier inscrit.
--    On retire ce droit, et on force la vue à respecter les règles de la table.
-- 2. Le classement des ligues n'affiche plus les ligues sans aucun score
--    (les anciennes ligues de test copiées de la v1 y figuraient à 0 point).

revoke all on public.contacts from anon, authenticated;
revoke all on public.ligues_suspectes from anon, authenticated;
revoke all on public.ab_ecoute from anon, authenticated;
revoke all on public.ab_invitation from anon, authenticated;
alter view public.contacts set (security_invoker = true);
alter view public.ligues_suspectes set (security_invoker = true);

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
  select l.code, l.nom,
         count(m.pseudo)::int as joueurs,
         coalesce(sum(m.metres), 0)::bigint as total
  from public.ligues l
  join meilleurs m on m.code = l.code
  where l.concours
  group by l.code, l.nom;
grant select on public.concours_ligues to anon;

-- Preuve : les deux premières lignes doivent répondre « false ».
select has_table_privilege('anon', 'public.contacts', 'select') as contacts_lisible_par_tous,
       has_table_privilege('anon', 'public.joueurs', 'select')  as joueurs_lisible_par_tous;
select * from public.concours_ligues order by total desc;
