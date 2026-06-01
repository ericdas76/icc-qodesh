-- ============================================================
-- MIGRATION V4 — ICC Qodesh
-- Date : 2026-06-01
-- ============================================================

-- 1. auteur_id manquant sur impact_junior_enfants
ALTER TABLE impact_junior_enfants
  ADD COLUMN IF NOT EXISTS auteur_id UUID REFERENCES profils(id);

-- 2. auteur_id manquant sur activites_impact_junior
ALTER TABLE activites_impact_junior
  ADD COLUMN IF NOT EXISTS auteur_id UUID REFERENCES profils(id);

-- 3. auteur_id manquant sur logistique
ALTER TABLE logistique
  ADD COLUMN IF NOT EXISTS auteur_id UUID REFERENCES profils(id);

-- 4. Colonne categorie dans membres (pointe vers statut_membre)
ALTER TABLE membres
  ADD COLUMN IF NOT EXISTS categorie TEXT DEFAULT 'Nouveau';

-- 5. Dédupliquer listes_parametrables (doublons constatés en base)
DELETE FROM listes_parametrables WHERE id NOT IN (
  SELECT MIN(id) FROM listes_parametrables GROUP BY categorie, valeur
);

-- 6. Remplacer les anciennes valeurs statut_membre
DELETE FROM listes_parametrables WHERE categorie = 'statut_membre';
INSERT INTO listes_parametrables (categorie, valeur, ordre, actif) VALUES
  ('statut_membre', 'Nouveau',  1, true),
  ('statut_membre', 'Inactif',  2, true),
  ('statut_membre', 'Star',     3, true),
  ('statut_membre', 'Référent', 4, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIN MIGRATION V4
-- ============================================================
