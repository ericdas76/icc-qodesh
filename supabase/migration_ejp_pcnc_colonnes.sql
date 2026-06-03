-- ============================================================
-- MIGRATION — Ajout colonnes nb_seance et nb_seance_obligatoire
-- Table : ejp_formations_pcnc
-- À exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE ejp_formations_pcnc
  ADD COLUMN IF NOT EXISTS nb_seance integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nb_seance_obligatoire integer DEFAULT NULL;

-- Commentaires
COMMENT ON COLUMN ejp_formations_pcnc.nb_seance IS 'Nombre total de séances de la formation';
COMMENT ON COLUMN ejp_formations_pcnc.nb_seance_obligatoire IS 'Nombre de séances obligatoires pour valider la formation';
