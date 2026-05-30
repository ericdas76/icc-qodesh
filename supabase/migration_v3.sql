-- =============================================
-- ICC-QODESH — Migration V3
-- Nouveaux modules : Évangélisation, STAR membres,
-- Baptêmes, Impact Junior, Logistique
-- Idempotent : peut être relancée sans erreur
-- =============================================

-- =============================================
-- 1. ÉVANGÉLISATION
-- =============================================
CREATE TABLE IF NOT EXISTS activites_evangelisation (
  id               UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  ordre            INT,
  date_sortie      DATE        NOT NULL,
  supervision      TEXT,
  heure_debut      TIME,
  heure_fin        TIME,
  duree_minutes    INT,
  effectif_membres INT         DEFAULT 0,
  nb_abordees      INT         DEFAULT 0,
  nb_invitees      INT         DEFAULT 0,
  nb_priere_salut  INT         DEFAULT 0,
  comptage         TEXT,
  notes            TEXT,
  auteur_id        UUID        REFERENCES profils(id),
  actif            BOOLEAN     DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activites_evangelisation ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activites_evangelisation' AND policyname='auth_evang') THEN
    CREATE POLICY "auth_evang" ON activites_evangelisation FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trig_evang_updated') THEN
    CREATE TRIGGER trig_evang_updated BEFORE UPDATE ON activites_evangelisation FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- =============================================
-- 2. MEMBRES STAR
-- =============================================
CREATE TABLE IF NOT EXISTS membres_star (
  id             UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  membre_id      UUID        REFERENCES membres(id),
  departement    TEXT,
  formation_001  BOOLEAN     DEFAULT FALSE,
  date_service   DATE,
  notes          TEXT,
  actif          BOOLEAN     DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(membre_id)
);

ALTER TABLE membres_star ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membres_star' AND policyname='auth_star') THEN
    CREATE POLICY "auth_star" ON membres_star FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trig_star_updated') THEN
    CREATE TRIGGER trig_star_updated BEFORE UPDATE ON membres_star FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- =============================================
-- 3. BAPTÊMES — Sessions
-- =============================================
CREATE TABLE IF NOT EXISTS sessions_bapteme (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom_session  TEXT        NOT NULL,
  date_session DATE        NOT NULL,
  notes        TEXT,
  actif        BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions_bapteme ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sessions_bapteme' AND policyname='auth_sessions_bapteme') THEN
    CREATE POLICY "auth_sessions_bapteme" ON sessions_bapteme FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trig_sessions_bapteme_updated') THEN
    CREATE TRIGGER trig_sessions_bapteme_updated BEFORE UPDATE ON sessions_bapteme FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- =============================================
-- 4. BAPTÊMES — Inscrits
-- =============================================
CREATE TABLE IF NOT EXISTS inscrits_bapteme (
  id                  UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id          UUID        REFERENCES sessions_bapteme(id),
  nom                 TEXT        NOT NULL,
  prenom              TEXT        NOT NULL,
  date_naissance      DATE,
  date_arrivee_icc    DATE,
  date_conversion     DATE,
  date_cours          DATE,
  temoignage          BOOLEAN     DEFAULT FALSE,
  detail_temoignage   TEXT,
  date_bapteme        DATE,
  officiant           TEXT,
  notes               TEXT,
  actif               BOOLEAN     DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inscrits_bapteme ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inscrits_bapteme' AND policyname='auth_inscrits_bapteme') THEN
    CREATE POLICY "auth_inscrits_bapteme" ON inscrits_bapteme FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trig_inscrits_bapteme_updated') THEN
    CREATE TRIGGER trig_inscrits_bapteme_updated BEFORE UPDATE ON inscrits_bapteme FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- =============================================
-- 5. IMPACT JUNIOR — Enfants
-- =============================================
CREATE TABLE IF NOT EXISTS impact_junior_enfants (
  id                  UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  prenom              TEXT        NOT NULL,
  nom                 TEXT        NOT NULL,
  date_naissance      DATE,
  nom_parent_tuteur   TEXT,
  telephone_parent    TEXT,
  classe_scolaire     TEXT,
  notes               TEXT,
  actif               BOOLEAN     DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE impact_junior_enfants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='impact_junior_enfants' AND policyname='auth_ij_enfants') THEN
    CREATE POLICY "auth_ij_enfants" ON impact_junior_enfants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trig_ij_enfants_updated') THEN
    CREATE TRIGGER trig_ij_enfants_updated BEFORE UPDATE ON impact_junior_enfants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- =============================================
-- 6. IMPACT JUNIOR — Cultes
-- =============================================
CREATE TABLE IF NOT EXISTS activites_impact_junior (
  id             UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  ordre          INT,
  date_activite  DATE        NOT NULL,
  heure_debut    TIME,
  heure_fin      TIME,
  duree_minutes  INT,
  nb_moniteurs   INT         DEFAULT 0,
  nb_monitrices  INT         DEFAULT 0,
  garcons        INT         DEFAULT 0,
  filles         INT         DEFAULT 0,
  visiteurs      INT         DEFAULT 0,
  theme          TEXT,
  comptage       TEXT,
  notes          TEXT,
  auteur_id      UUID        REFERENCES profils(id),
  actif          BOOLEAN     DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activites_impact_junior ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activites_impact_junior' AND policyname='auth_ij_cultes') THEN
    CREATE POLICY "auth_ij_cultes" ON activites_impact_junior FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trig_ij_cultes_updated') THEN
    CREATE TRIGGER trig_ij_cultes_updated BEFORE UPDATE ON activites_impact_junior FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- =============================================
-- 7. LOGISTIQUE
-- =============================================
CREATE TABLE IF NOT EXISTS logistique (
  id            UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  categorie     TEXT,
  designation   TEXT        NOT NULL,
  etat          TEXT        CHECK (etat IN ('bon','usage','mauvais','hors_service')),
  numero_serie  TEXT,
  pret          BOOLEAN     DEFAULT FALSE,
  maintenance   BOOLEAN     DEFAULT FALSE,
  notes         TEXT,
  actif         BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE logistique ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='logistique' AND policyname='auth_logistique') THEN
    CREATE POLICY "auth_logistique" ON logistique FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trig_logistique_updated') THEN
    CREATE TRIGGER trig_logistique_updated BEFORE UPDATE ON logistique FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- =============================================
-- FIN MIGRATION V3
-- =============================================
