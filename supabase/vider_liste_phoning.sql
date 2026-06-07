-- ============================================================
-- VIDER LA LISTE PHONING — désactivation douce (actif = false)
-- Sans risque : aucune donnée supprimée, toutes les FK préservées
-- ============================================================
--
-- La liste phoning affiche les personnes qui :
--   1. sont actives (personnes.actif = true)
--   2. ne sont PAS membres actifs (pas de ligne dans membres avec actif=true)
--
-- Solution : passer actif=false sur ces personnes uniquement
-- Effet : disparaissent de la liste phoning, HistoriquePage,
--         PersonnesPage — mais TOUTES les données liées restent intactes.
--
-- Vérification préalable (audit) :
-- ============================================================

-- ÉTAPE 1 : Voir qui va être désactivé (lecture seule, sans risque)
SELECT
  p.id,
  p.nom,
  p.prenom,
  p.statut,
  p.telephone,
  p.actif,
  (SELECT COUNT(*) FROM interactions_phoning ip WHERE ip.personne_id = p.id) AS nb_interactions,
  (SELECT COUNT(*) FROM taches_suivi ts WHERE ts.personne_id = p.id)         AS nb_taches,
  (SELECT COUNT(*) FROM membres_familles_impact mfi WHERE mfi.personne_id = p.id) AS nb_fi,
  (SELECT COUNT(*) FROM inscriptions_formation inf WHERE inf.personne_id = p.id)  AS nb_formations
FROM personnes p
WHERE
  p.actif = true
  AND p.id NOT IN (
    SELECT personne_id FROM membres WHERE actif = true
  )
ORDER BY p.nom, p.prenom;

-- ============================================================
-- ÉTAPE 2 : Compter combien de personnes seront désactivées
-- ============================================================
SELECT COUNT(*) AS nb_personnes_a_desactiver
FROM personnes p
WHERE
  p.actif = true
  AND p.id NOT IN (
    SELECT personne_id FROM membres WHERE actif = true
  );

-- ============================================================
-- ÉTAPE 3 : Désactivation (exécuter seulement après avoir
--            vérifié le résultat des étapes 1 et 2)
-- ============================================================
-- Décommenter pour exécuter :
/*
UPDATE personnes
SET
  actif      = false,
  updated_at = now()
WHERE
  actif = true
  AND id NOT IN (
    SELECT personne_id FROM membres WHERE actif = true
  );
*/

-- ============================================================
-- ÉTAPE 4 : Vérification post-désactivation
-- La liste phoning doit retourner 0 ligne
-- ============================================================
/*
SELECT COUNT(*) AS reste_dans_phoning
FROM personnes p
WHERE
  p.actif = true
  AND p.id NOT IN (
    SELECT personne_id FROM membres WHERE actif = true
  );
*/
