-- ============================================================
-- Migration : participants des séances Formation Pluri
-- Table     : seances_formation_pluri_participants
-- Version   : v1
-- ============================================================

CREATE TABLE IF NOT EXISTS seances_formation_pluri_participants (
  id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  seance_id   UUID        NOT NULL REFERENCES seances_formation_pluri(id) ON DELETE CASCADE,
  nom         TEXT        NOT NULL,
  prenom      TEXT        NOT NULL,
  sexe        TEXT        CHECK (sexe IN ('M', 'F')),
  telephone   TEXT,
  actif       BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE seances_formation_pluri_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_sfpp" ON seances_formation_pluri_participants;
CREATE POLICY "auth_sfpp" ON seances_formation_pluri_participants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_sfpp_seance_id
  ON seances_formation_pluri_participants(seance_id);

CREATE INDEX IF NOT EXISTS idx_sfpp_actif
  ON seances_formation_pluri_participants(actif);
