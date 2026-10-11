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
