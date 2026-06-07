-- ============================================================
-- Migration : Séances Famille d'Impact + Participants
-- ============================================================

-- ─── TABLE seances_fi ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seances_fi (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  famille_id         UUID REFERENCES familles_impact(id) ON DELETE CASCADE NOT NULL,
  date_seance        DATE NOT NULL,
  responsable        TEXT,
  copilote           TEXT,
  theme              TEXT,
  heure_debut        TIME,
  heure_fin          TIME,
  duree_minutes      INT,
  nb_adulte          INT DEFAULT 0,
  nb_homme           INT DEFAULT 0,
  nb_femme           INT DEFAULT 0,
  nb_enfant          INT DEFAULT 0,
  total_participants INT DEFAULT 0,
  notes              TEXT,
  actif              BOOLEAN DEFAULT TRUE,
  auteur_id          UUID REFERENCES profils(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE seances_fi_participants ───────────────────────────
CREATE TABLE IF NOT EXISTS seances_fi_participants (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seance_id  UUID REFERENCES seances_fi(id) ON DELETE CASCADE NOT NULL,
  nom        TEXT NOT NULL,
  prenom     TEXT NOT NULL,
  sexe       TEXT CHECK (sexe IN ('M', 'F')),
  age        INT,
  telephone  TEXT,
  adresse    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE seances_fi ENABLE ROW LEVEL SECURITY;
ALTER TABLE seances_fi_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_seances_fi" ON seances_fi
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_seances_fi_participants" ON seances_fi_participants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── INDEX ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seances_fi_famille   ON seances_fi(famille_id);
CREATE INDEX IF NOT EXISTS idx_seances_fi_date      ON seances_fi(date_seance);
CREATE INDEX IF NOT EXISTS idx_seances_fi_actif     ON seances_fi(actif);
CREATE INDEX IF NOT EXISTS idx_seances_fi_part      ON seances_fi_participants(seance_id);

-- ─── TRIGGER updated_at ──────────────────────────────────────
CREATE TRIGGER trig_seances_fi_updated
  BEFORE UPDATE ON seances_fi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
