-- « J'ai un pote v2 » — LE DERNIER SQL AVANT LE LANCEMENT (13 novembre 2026).
--
-- À coller EN UNE FOIS dans l'éditeur SQL du projet Supabase de la v2
-- (khlxublwgcqihuezzsam — JAMAIS celui de la v1). Relançable sans risque.
-- Il REMPLACE CLASSEMENT-GENERAL-A-COLLER.sql, qu'il contient en entier.
--
-- CE QU'IL FAIT, dans l'ordre :
--   1. la commission (10 %) et le plafond de score à 110 000 ;
--   2. le classement général des joueurs (vue `concours_joueurs`) ;
--   3. ta vue de contrôle du podium, fermée au public (`concours_podium`) ;
--   4. les ligues peuvent enfin accueillir 21 personnes au lieu de 6 ;
--   5. la ligue BRUNO (le bureau) ;
--   6. les ligues de test sortent du classement (RIEN n'est supprimé).
--
-- Rien n'est effacé par ce fichier : les scores de test restent en base, ils
-- sont seulement mis hors concours (`ligues.concours = false`). Pour en
-- remettre une dans la course : update public.ligues set concours = true where code = 'ESSAI';

-- ===========================================================================
-- 1. LES RÉGLAGES.
-- Le plafond passe à 110 000 (outils/plafond.mjs) : à 75 000, la base
-- REFUSERAIT des scores possibles (le maximum humain mesuré est 77 814) et le
-- joueur perdrait sa course sans le savoir.
-- ===========================================================================
alter table public.concours add column if not exists commission numeric(4,3) not null default 0.10;
update public.concours set plafond_score = 110000 where id = 1 and plafond_score < 110000;

-- ===========================================================================
-- 2. LE CLASSEMENT DES JOUEURS.
--
-- LA RÈGLE : score au général = ton record + 10 % du record de chaque pote de
-- ta ligue. À la clôture, tirage au sort entre les 3 premiers.
-- La commission se calcule sur les RECORDS, jamais sur les totaux : pas
-- d'effet boule de neige entre membres d'une ligue.
--
-- - Les joueurs SANS ligue y figurent : leur score part sous le code de la
--   ligue de démo (PMCMP), qui reste exclue du classement des ligues. Ils
--   n'ont aucune commission.
-- - Un joueur ne rapporte sa commission qu'à UNE ligue : celle où il a fait
--   son meilleur score.
-- - Un même téléphone ne rapporte qu'UNE commission : dix pseudos créés sur
--   un seul appareil comptent pour un pote, et jamais pour eux-mêmes.
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
-- Lisible seulement ici, jamais avec la clé publique. La fiche retenue est
-- celle du téléphone qui a fait le record : deux joueurs peuvent porter le
-- même pseudo. `fiches` > 1 ou `appareils` très inférieur à `potes` : regarde
-- de plus près.
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

-- ===========================================================================
-- 4. UNE LIGUE PEUT ACCUEILLIR 21 PERSONNES (toi + 20 potes).
--
-- ⚠️ Sans ça, le concours est INJOUABLE comme il est annoncé : la colonne
-- `plafond` valait 6 par défaut, le jeu refusait le 7e membre (« Cette ligue
-- est complète ») alors que la commission se gagne jusqu'à 20 potes et que le
-- jeu, lui, annonce 21. La bêta (60) et la ligue de démo (6) ne bougent pas :
-- personne ne doit pouvoir s'inviter dans le peloton de démonstration.
-- ===========================================================================
alter table public.ligues alter column plafond set default 21;
update public.ligues set plafond = 21 where plafond < 21 and code not in ('PMCMP', 'BETA');

-- Le portier de la ligue, réécrit (version qui fait foi ; schema-v2.sql pose
-- la première). Deux défauts mesurés sur vingt inscriptions simultanées :
--
--   1. un membre DÉJÀ inscrit était refusé quand la ligue était pleine — il
--      suffisait qu'il rouvre le lien d'invitation ou change de vélo pour que
--      la base réponde « ligue complète ». Il passe maintenant toujours : il
--      ne prend aucune place, il l'occupe déjà.
--   2. deux personnes qui s'inscrivent au même centième de seconde voyaient
--      toutes les deux la même place libre, et entraient toutes les deux.
--      `for update` pose un verrou sur la ligne de la ligue : les inscriptions
--      simultanées sont comptées l'une après l'autre.
create or replace function public.ligue_plafond() returns trigger language plpgsql as $$
declare cap integer;
begin
  if exists (select 1 from public.ligue_membres where code = new.code and pseudo = new.pseudo) then
    return new;
  end if;
  select coalesce(plafond, 21) into cap from public.ligues where code = new.code for update;
  if cap is null then cap := 21; end if;
  if (select count(*) from public.ligue_membres where code = new.code) >= cap then
    raise exception 'ligue complete (% max)', cap;
  end if;
  return new;
end $$;
drop trigger if exists ligue_plafond_trg on public.ligue_membres;
create trigger ligue_plafond_trg before insert on public.ligue_membres
  for each row execute function public.ligue_plafond();

-- ===========================================================================
-- 5. LA LIGUE DU BUREAU.
-- Lien : https://pmcmp3.github.io/jai-un-pote-v2/?ligue=BRUNO
-- Aucun faux joueur dedans : chacun arrive avec son pseudo en ouvrant le lien.
-- ===========================================================================
insert into public.ligues (code, nom, createur, plafond, concours)
values ('BRUNO', 'Bruno', 'paul', 21, true)
on conflict (code) do update
  set nom = excluded.nom, plafond = excluded.plafond, concours = excluded.concours;

-- ===========================================================================
-- 6. LES LIGUES DE TEST SORTENT DU CLASSEMENT.
-- ESSAI porte 5 faux scores (jusqu'à 4 200) qui, sinon, squattent le général.
-- Les quatre autres sont des essais de septembre, sans aucun score.
-- Rien n'est supprimé : un `update ... set concours = true` les fait revenir.
-- ===========================================================================
update public.ligues set concours = false
  where code in ('ESSAI', '9UW5K', 'UKMVV', 'C3HH3', 'R5298');

-- ===========================================================================
-- 7. LA CADENCE SE COMPTE PAR APPAREIL, PLUS PAR PSEUDO.
--
-- ⚠️ Trouvé par un audit à l'aveugle du règlement (13 novembre 2026). Le
-- garde-fou « pas plus de 10 scores en une minute » comptait `where pseudo =
-- new.pseudo`. Comme les pseudos ne sont PAS uniques et qu'aucun mot de passe
-- ne les protège, n'importe qui pouvait envoyer dix scores bidons sous le
-- pseudo d'un rival pendant qu'il jouait : le vrai score du rival était
-- refusé, en silence, et il perdait sa course. Un sabotage gratuit et
-- intraçable, juste avant la clôture.
-- En comptant par APPAREIL, celui qui inonde se bride lui-même.
-- ===========================================================================
create or replace function public.score_vraisemblable() returns trigger language plpgsql as $$
declare cap integer; recentes integer;
begin
  select plafond_score into cap from public.concours where id = 1;
  if cap is null then cap := 110000; end if;
  if new.metres > cap then
    raise exception 'score impossible : % (plafond %)', new.metres, cap;
  end if;
  if new.metres < 0 then
    raise exception 'score negatif';
  end if;
  select count(*) into recentes from public.ligue_scores
    where created_at > now() - interval '1 minute'
      and coalesce(appareil, 'pseudo:' || pseudo) = coalesce(new.appareil, 'pseudo:' || new.pseudo);
  if recentes >= 10 then
    raise exception 'trop de scores en une minute depuis cet appareil';
  end if;
  return new;
end $$;
drop trigger if exists score_vraisemblable_trg on public.ligue_scores;
create trigger score_vraisemblable_trg before insert on public.ligue_scores
  for each row execute function public.score_vraisemblable();

-- ===========================================================================
-- 8. DOUBLE TOUR SUR LES CONTACTS.
--
-- Les Insta, emails et villes des joueurs sont déjà protégés par la RLS (la
-- table `joueurs` n'a qu'une règle d'écriture, aucune de lecture). Mais il
-- suffirait d'un `create policy … for select` ajouté un jour pour tout ouvrir.
-- Le jeu n'a JAMAIS besoin de relire ces trois tables (il poste avec
-- `Prefer: return=minimal`) : on retire carrément le droit de lecture.
-- ===========================================================================
revoke select on public.joueurs from anon, authenticated;
revoke select on public.evenements from anon, authenticated;
revoke select on public.retours_beta from anon, authenticated;

notify pgrst, 'reload schema';

-- ===========================================================================
-- VÉRIFICATION — à lire ligne par ligne :
--   1. commission = 0.100 et plafond = 110000 ;
--   2. le classement ne contient plus un seul faux joueur (tom, lola, sam,
--      nina, yanis) — il est probablement vide, c'est normal avant le départ ;
--   3. BRUNO existe, plafond 21, en concours ;
--   4. la dernière ligne ne doit répondre que des false : ni le podium, ni les
--      contacts, ni les fiches des joueurs ne sont lisibles par le public.
-- ===========================================================================
select 'reglages' as quoi, commission, plafond_score from public.concours;
select rang, pseudo, metres as record, commission, total, nom from public.concours_joueurs order by rang limit 10;
select code, nom, plafond, concours from public.ligues order by concours desc, code;
select has_table_privilege('anon', 'public.concours_podium', 'select') as podium,
       has_table_privilege('anon', 'public.contacts', 'select')        as contacts,
       has_table_privilege('anon', 'public.joueurs', 'select')         as fiches,
       has_table_privilege('anon', 'public.evenements', 'select')      as evenements;
