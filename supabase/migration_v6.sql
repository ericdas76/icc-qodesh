-- ============================================================
-- MIGRATION V6 — ICC Qodesh
-- Date : 2026-06-02
-- À exécuter dans Supabase SQL Editor (rôle postgres)
-- ============================================================

SET ROLE postgres;

-- 1. Nouveaux champs sur la table personnes
ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS telephone_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS langue             TEXT,
  ADD COLUMN IF NOT EXISTS suivi_par          TEXT,
  ADD COLUMN IF NOT EXISTS de_passage         BOOLEAN DEFAULT false;

-- 2. Seed table langue dans listes_parametrables
INSERT INTO listes_parametrables (categorie, valeur, ordre, actif) VALUES
  ('langue', 'Français', 1, true),
  ('langue', 'Anglais',  2, true),
  ('langue', 'Malgache', 3, true),
  ('langue', 'Autre',    4, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIN MIGRATION V6
-- ============================================================
