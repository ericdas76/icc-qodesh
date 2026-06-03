-- ============================================================
-- MIGRATION EJP — Église des Jeunes Prodiges
-- ============================================================

-- 1. Table ejp_departements (liste administrable)
CREATE TABLE IF NOT EXISTS ejp_departements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Valeurs initiales
INSERT INTO ejp_departements (nom) VALUES
  ('Logistique'),
  ('Modération'),
  ('Accueil'),
  ('Formation'),
  ('Communication'),
  ('Louange')
ON CONFLICT DO NOTHING;

-- 2. Table ejp_types_rencontre (liste administrable)
CREATE TABLE IF NOT EXISTS ejp_types_rencontre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Valeurs initiales
INSERT INTO ejp_types_rencontre (nom) VALUES
  ('Camp'),
  ('Ciné'),
  ('Veillée'),
  ('Retraite')
ON CONFLICT DO NOTHING;

-- 3. Table ejp_formations_pcnc (liste administrable)
CREATE TABLE IF NOT EXISTS ejp_formations_pcnc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  libelle text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Valeurs initiales
INSERT INTO ejp_formations_pcnc (code, libelle) VALUES
  ('001/BDR', 'Base de la Réconciliation'),
  ('101', 'Formation 101'),
  ('201', 'Formation 201'),
  ('301', 'Formation 301')
ON CONFLICT DO NOTHING;

-- 4. Table ejp_membres
CREATE TABLE IF NOT EXISTS ejp_membres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_membre_ejp text UNIQUE,
  nom text NOT NULL,
  prenom text NOT NULL,
  date_naissance date,
  lieu_naissance text,
  sexe text CHECK (sexe IN ('Homme', 'Femme')),
  nationalite text,
  langue_parlee text,
  telephone1 text,
  whatsapp text,
  email text,
  origine text CHECK (origine IN ('Nouvel arrivant', 'Nouveau converti')),
  source_contact text,
  de_passage boolean DEFAULT false,
  departement_ejp_id uuid REFERENCES ejp_departements(id) ON DELETE SET NULL,
  bapteme boolean DEFAULT false,
  date_bapteme text,
  formation_pcnc_id uuid REFERENCES ejp_formations_pcnc(id) ON DELETE SET NULL,
  note text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Table ejp_activites
CREATE TABLE IF NOT EXISTS ejp_activites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_activite text UNIQUE,
  date_activite date NOT NULL,
  heure_debut time,
  heure_fin time,
  duree text,
  type_rencontre_id uuid REFERENCES ejp_types_rencontre(id) ON DELETE SET NULL,
  theme text,
  predicateur text,
  moderateur text,
  hommes integer DEFAULT 0,
  femmes integer DEFAULT 0,
  total_participants integer DEFAULT 0,
  visiteurs integer DEFAULT 0,
  comptage integer DEFAULT 0,
  priere_salut boolean DEFAULT false,
  sainte_cene boolean DEFAULT false,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Table ejp_activite_membres (participation)
CREATE TABLE IF NOT EXISTS ejp_activite_membres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activite_id uuid NOT NULL REFERENCES ejp_activites(id) ON DELETE CASCADE,
  membre_id uuid NOT NULL REFERENCES ejp_membres(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activite_id, membre_id)
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_ejp_membres_actif ON ejp_membres(actif);
CREATE INDEX IF NOT EXISTS idx_ejp_activites_date ON ejp_activites(date_activite);
CREATE INDEX IF NOT EXISTS idx_ejp_activite_membres_activite ON ejp_activite_membres(activite_id);
CREATE INDEX IF NOT EXISTS idx_ejp_activite_membres_membre ON ejp_activite_membres(membre_id);
