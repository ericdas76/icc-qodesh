-- =============================================
-- MIGRATION SÉANCES V1
-- =============================================

-- 1. Ajout nb_seance_obligatoire sur formations
ALTER TABLE formations ADD COLUMN IF NOT EXISTS nb_seance_total INTEGER DEFAULT 0;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS nb_seance_obligatoire INTEGER DEFAULT 0;

-- 2. Table séances
CREATE TABLE IF NOT EXISTS seances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  formation_id UUID REFERENCES formations(id) ON DELETE CASCADE NOT NULL,
  num_seance TEXT NOT NULL,           -- S-AAMMJJ-01
  date_seance DATE NOT NULL,
  enseignant TEXT,
  assistant TEXT,
  theme TEXT,
  nb_inscrit INTEGER DEFAULT 0,       -- calculé = effectif_homme + effectif_femme
  nb_present_seance INTEGER DEFAULT 0,
  nb_absent_seance INTEGER GENERATED ALWAYS AS (nb_inscrit - nb_present_seance) STORED,
  heure_debut TIME,
  heure_fin TIME,
  duree_seance INTEGER,               -- en minutes, calculé côté app
  points_remontes TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table présences par séance
CREATE TABLE IF NOT EXISTS presences_seance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seance_id UUID REFERENCES seances(id) ON DELETE CASCADE NOT NULL,
  inscription_id UUID REFERENCES inscriptions_formation(id) ON DELETE CASCADE NOT NULL,
  present BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seance_id, inscription_id)
);

-- 4. RLS
ALTER TABLE seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE presences_seance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_seances" ON seances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_presences_seance" ON presences_seance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_seances_formation ON seances(formation_id);
CREATE INDEX IF NOT EXISTS idx_presences_seance_seance ON presences_seance(seance_id);
CREATE INDEX IF NOT EXISTS idx_presences_seance_inscription ON presences_seance(inscription_id);
