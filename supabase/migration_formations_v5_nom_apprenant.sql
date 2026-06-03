-- ============================================================
-- Migration Formation v5 — Saisie libre apprenants
-- Ajoute nom_apprenant (texte libre) sur inscriptions_formation
-- À exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE inscriptions_formation
  ADD COLUMN IF NOT EXISTS nom_apprenant text;

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inscriptions_formation'
  AND column_name = 'nom_apprenant';
