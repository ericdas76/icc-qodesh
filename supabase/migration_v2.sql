-- =============================================
-- ICC-QODESH — Migration V2
-- À exécuter dans Supabase SQL Editor
-- Idempotent : peut être relancée sans erreur
-- =============================================

-- =============================================
-- 0. FONCTIONS update_updated_at (deux alias)
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 1. FAMILLES D'IMPACT — ajout date_creation
-- =============================================
ALTER TABLE familles_impact
  ADD COLUMN IF NOT EXISTS date_creation DATE;

-- =============================================
-- 2. TABLE PROMOTIONS (nouvelle)
-- =============================================
CREATE TABLE IF NOT EXISTS promotions (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom          TEXT        NOT NULL,
  date_promotion DATE,
  actif        BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'promotions' AND policyname = 'auth_read_promotions'
  ) THEN
    CREATE POLICY "auth_read_promotions"
      ON promotions FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trig_promotions_updated'
  ) THEN
    CREATE TRIGGER trig_promotions_updated
      BEFORE UPDATE ON promotions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- =============================================
-- 3. FORMATIONS — nouvelles colonnes V2
-- =============================================
ALTER TABLE formations
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id),
  ADD COLUMN IF NOT EXISTS code        TEXT,
  ADD COLUMN IF NOT EXISTS enseignant  TEXT,
  ADD COLUMN IF NOT EXISTS assistant   TEXT,
  ADD COLUMN IF NOT EXISTS date_fin    DATE;

-- Index unicité : une seule classe par type par promotion
CREATE UNIQUE INDEX IF NOT EXISTS idx_formations_promotion_classe
  ON formations(promotion_id, classe)
  WHERE actif = TRUE AND promotion_id IS NOT NULL;

-- =============================================
-- 4. ACTIVITES_CONGES — nouveau schéma
-- =============================================
ALTER TABLE activites_conges
  ADD COLUMN IF NOT EXISTS type_conge   TEXT CHECK (type_conge IN ('conge','sante','autre')),
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS date_debut   DATE,
  ADD COLUMN IF NOT EXISTS date_fin     DATE,
  ADD COLUMN IF NOT EXISTS mois         INT  CHECK (mois BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS annee_conge  INT;

-- =============================================
-- 5. ACTIVITES_CULTES_PRIERES_STAR — hommes/femmes/enfants
-- =============================================
ALTER TABLE activites_cultes_prieres_star
  ADD COLUMN IF NOT EXISTS hommes  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS femmes  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enfants INT DEFAULT 0;

-- =============================================
-- 6. ACTIVITES_RNA — lieu + hommes/femmes/enfants
-- =============================================
ALTER TABLE activites_rna
  ADD COLUMN IF NOT EXISTS lieu    TEXT,
  ADD COLUMN IF NOT EXISTS hommes  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS femmes  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enfants INT DEFAULT 0;

-- =============================================
-- 7. SEED — 3 promotions de démonstration
-- =============================================
INSERT INTO promotions (nom, date_promotion, actif)
VALUES
  ('Suis-Christ 2025',   '2025-01-15', TRUE),
  ('Lumière 2025',       '2025-04-01', TRUE),
  ('Fondation 2024',     '2024-09-01', TRUE)
ON CONFLICT DO NOTHING;

-- =============================================
-- FIN DE LA MIGRATION V2
-- =============================================
