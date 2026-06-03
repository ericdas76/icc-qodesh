-- ============================================================
-- Migration Formation v3 — Fix contrainte classe
-- Supprime la contrainte CHECK obsolète sur formations.classe
-- qui bloquait l'insertion avec les nouveaux codes générés
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Supprimer la contrainte CHECK obsolète sur la colonne "classe"
--    (elle limitait à IN ('001','101','201','301'))
ALTER TABLE formations
  DROP CONSTRAINT IF EXISTS formations_classe_check;

-- 2. Rendre la colonne "classe" nullable (elle était NOT NULL dans l'ancien schéma)
--    car le nouveau module utilise "code" auto-généré stocké dans une autre colonne
ALTER TABLE formations
  ALTER COLUMN classe DROP NOT NULL;

-- 3. Vérification : plus aucune contrainte check sur "classe"
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'formations'::regclass
  AND contype = 'c';
