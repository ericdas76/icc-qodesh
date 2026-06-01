-- ============================================================
-- MIGRATION V5 — ICC Qodesh
-- Date : 2026-06-01
-- À exécuter dans Supabase SQL Editor (rôle postgres)
-- ============================================================

SET ROLE postgres;

-- 1. Colonne origine dans personnes
ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS origine TEXT;

-- 2. Seed table origine dans listes_parametrables
INSERT INTO listes_parametrables (categorie, valeur, ordre, actif) VALUES
  ('origine', 'Nouvel arrivant',  1, true),
  ('origine', 'Nouveau converti', 2, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIN MIGRATION V5
-- ============================================================
