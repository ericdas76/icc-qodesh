-- ============================================================
-- Migration Formation v2
-- Module Formation : nouvelles colonnes + extension inscriptions
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Nouvelles colonnes sur la table formations
ALTER TABLE formations
  ADD COLUMN IF NOT EXISTS formation_pcnc_id uuid REFERENCES ejp_formations_pcnc(id),
  ADD COLUMN IF NOT EXISTS nb_seance integer,
  ADD COLUMN IF NOT EXISTS nb_seance_obligatoire integer,
  ADD COLUMN IF NOT EXISTS date_creation date,
  ADD COLUMN IF NOT EXISTS nb_femme integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_homme integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS examen_prevu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nb_redoublant integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_abandon integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cloture boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enseignant_id uuid REFERENCES profils(id),
  ADD COLUMN IF NOT EXISTS assistant_id uuid REFERENCES profils(id);

-- 2. Extension de la table inscriptions_formation
--    type_apprenant : 'membre_ejp' | 'star' | 'personne'
--    ejp_membre_id  : renseigné si type = 'membre_ejp'
--    profil_id      : renseigné si type = 'star'
--    personne_id    : existant, réutilisé si type = 'personne'
ALTER TABLE inscriptions_formation
  ADD COLUMN IF NOT EXISTS type_apprenant text
    CHECK (type_apprenant IN ('membre_ejp', 'star', 'personne'))
    DEFAULT 'personne',
  ADD COLUMN IF NOT EXISTS ejp_membre_id uuid REFERENCES ejp_membres(id),
  ADD COLUMN IF NOT EXISTS profil_id uuid REFERENCES profils(id);

-- 3. Vérification finale
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('formations', 'inscriptions_formation')
  AND table_schema = 'public'
  AND column_name IN (
    'formation_pcnc_id','nb_seance','nb_seance_obligatoire','date_creation',
    'nb_femme','nb_homme','examen_prevu','nb_redoublant','nb_abandon',
    'cloture','enseignant_id','assistant_id',
    'type_apprenant','ejp_membre_id','profil_id'
  )
ORDER BY table_name, column_name;
