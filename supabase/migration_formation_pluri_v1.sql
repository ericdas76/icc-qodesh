-- ============================================================
-- Migration : Séances Formation Pluridisciplinaire
-- ============================================================

-- ─── TABLE seances_formation_pluri ───────────────────────────
CREATE TABLE IF NOT EXISTS seances_formation_pluri (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero                TEXT NOT NULL,
  formation_type        TEXT NOT NULL,
  date_seance           DATE NOT NULL,
  orateur               TEXT,
  traducteur            TEXT,
  thematique            TEXT,
  nb_homme              INT DEFAULT 0,
  nb_femme              INT DEFAULT 0,
  nb_apprenant          INT DEFAULT 0,
  date_prochaine_seance DATE,
  obs                   TEXT,
  actif                 BOOLEAN DEFAULT TRUE,
  auteur_id             UUID REFERENCES profils(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE seances_formation_pluri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_seances_formation_pluri" ON seances_formation_pluri
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── INDEX ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sfp_date   ON seances_formation_pluri(date_seance);
CREATE INDEX IF NOT EXISTS idx_sfp_type   ON seances_formation_pluri(formation_type);
CREATE INDEX IF NOT EXISTS idx_sfp_actif  ON seances_formation_pluri(actif);
CREATE INDEX IF NOT EXISTS idx_sfp_num    ON seances_formation_pluri(numero);

-- ─── TRIGGER updated_at ──────────────────────────────────────
CREATE TRIGGER trig_sfp_updated
  BEFORE UPDATE ON seances_formation_pluri
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Données initiales listes_parametrables ──────────────────
-- Valeurs par défaut pour le type de formation pluridisciplinaire
-- (si la catégorie n'existe pas encore)
INSERT INTO listes_parametrables (categorie, valeur, ordre, actif)
SELECT 'type_formation_pluri', valeur, ordre, true
FROM (VALUES
  ('Comptabilite', 1),
  ('Finance', 2),
  ('Informatique', 3),
  ('Langue', 4),
  ('Entrepreneuriat', 5),
  ('Aide Emploi', 6)
) AS v(valeur, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM listes_parametrables
  WHERE categorie = 'type_formation_pluri'
);
