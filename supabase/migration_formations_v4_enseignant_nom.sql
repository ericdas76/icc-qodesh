-- ============================================================
-- Migration Formation v4 — Saisie libre enseignant/assistant
-- Ajoute deux colonnes texte libres pour éviter la dépendance FK
-- À exécuter dans Supabase SQL Editor
-- ============================================================

ALTER TABLE formations
  ADD COLUMN IF NOT EXISTS enseignant_nom text,
  ADD COLUMN IF NOT EXISTS assistant_nom  text;

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'formations'
  AND column_name IN ('enseignant_nom', 'assistant_nom');
