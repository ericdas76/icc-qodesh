-- =============================================
-- ICC-QODESH — Schéma PostgreSQL Supabase
-- =============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLES DE RÉFÉRENCE / LISTES PARAMÉTRABLES
-- =============================================
CREATE TABLE listes_parametrables (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  categorie TEXT NOT NULL, -- 'statut_membre', 'issue_phoning', 'type_appel', 'departement', 'nationalite', 'type_activite'
  valeur TEXT NOT NULL,
  ordre INT DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RÔLES ET PERMISSIONS
-- =============================================
CREATE TABLE roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL, -- 'lire', 'creer', 'modifier', 'supprimer', 'exporter'
  description TEXT,
  UNIQUE(module, action)
);

CREATE TABLE roles_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- =============================================
-- PROFILS UTILISATEURS
-- =============================================
CREATE TABLE profils (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role_id UUID REFERENCES roles(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PERSONNES (intégration / visiteurs)
-- =============================================
CREATE TABLE personnes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE,
  lieu_naissance TEXT,
  telephone TEXT,
  email TEXT,
  profession TEXT,
  sexe TEXT CHECK (sexe IN ('M','F')),
  situation_familiale TEXT, -- 'celibataire','marie','divorce','veuf'
  nombre_enfants INT DEFAULT 0,
  nationalite TEXT NOT NULL DEFAULT 'Malagasy',
  adresse TEXT,
  quartier TEXT,
  statut TEXT DEFAULT 'nouveau' CHECK (statut IN ('nouveau','fi','formation','star','departement','libere','inactif')),
  date_premier_contact DATE DEFAULT CURRENT_DATE,
  source_contact TEXT, -- 'culte','ami','internet','autre'
  notes TEXT,
  auteur_creation UUID REFERENCES profils(id),
  actif BOOLEAN DEFAULT TRUE, -- suppression logique
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MEMBRES (personnes avancées dans le cycle)
-- =============================================
CREATE TABLE membres (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  personne_id UUID REFERENCES personnes(id) ON DELETE CASCADE UNIQUE,
  numero_membre TEXT UNIQUE,
  date_adhesion DATE DEFAULT CURRENT_DATE,
  statut TEXT DEFAULT 'nouveau' CHECK (statut IN ('nouveau','fi','formation','star','departement','libere','inactif')),
  departement TEXT,
  date_liberation DATE,
  motif_liberation TEXT,
  photo_url TEXT,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INTERACTIONS PHONING
-- =============================================
CREATE TABLE interactions_phoning (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  personne_id UUID REFERENCES personnes(id) ON DELETE CASCADE,
  type_interaction TEXT NOT NULL CHECK (type_interaction IN ('appel','whatsapp','visite')),
  statut_contact TEXT NOT NULL CHECK (statut_contact IN ('joignable','non_joignable','a_rappeler')),
  issue TEXT CHECK (issue IN ('revient','incertain','fi','liberation','aucune')),
  date_interaction TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  prochain_contact DATE,
  auteur_id UUID REFERENCES profils(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TÂCHES DE SUIVI
-- =============================================
CREATE TABLE taches_suivi (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  personne_id UUID REFERENCES personnes(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  type_tache TEXT DEFAULT 'suivi', -- 'suivi','relance','fi','formation'
  echeance DATE NOT NULL,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','en_cours','terminee','annulee')),
  priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
  assignee_id UUID REFERENCES profils(id),
  auteur_id UUID REFERENCES profils(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FAMILLES D'IMPACT
-- =============================================
CREATE TABLE familles_impact (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  quartier TEXT,
  adresse_maison_hote TEXT,
  responsable_id UUID REFERENCES personnes(id),
  copilote_id UUID REFERENCES personnes(id),
  jour_reunion TEXT,
  heure_reunion TIME,
  actif BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE membres_familles_impact (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  famille_id UUID REFERENCES familles_impact(id) ON DELETE CASCADE,
  personne_id UUID REFERENCES personnes(id) ON DELETE CASCADE,
  date_ajout DATE DEFAULT CURRENT_DATE,
  date_depart DATE,
  actif BOOLEAN DEFAULT TRUE,
  UNIQUE(famille_id, personne_id)
);

-- =============================================
-- FORMATIONS
-- =============================================
CREATE TABLE formations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  classe TEXT NOT NULL CHECK (classe IN ('001','101','201','301')),
  nom TEXT NOT NULL,
  description TEXT,
  annee INT DEFAULT EXTRACT(YEAR FROM NOW()),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions_formation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  formation_id UUID REFERENCES formations(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  date_session DATE NOT NULL,
  heure_debut TIME,
  heure_fin TIME,
  lieu TEXT,
  animateur_id UUID REFERENCES personnes(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inscriptions_formation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  formation_id UUID REFERENCES formations(id) ON DELETE CASCADE,
  personne_id UUID REFERENCES personnes(id) ON DELETE CASCADE,
  date_inscription DATE DEFAULT CURRENT_DATE,
  statut TEXT DEFAULT 'inscrit' CHECK (statut IN ('inscrit','en_cours','termine','abandonne')),
  auteur_id UUID REFERENCES profils(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(formation_id, personne_id)
);

CREATE TABLE absences_formation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inscription_id UUID REFERENCES inscriptions_formation(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions_formation(id) ON DELETE CASCADE,
  justifiee BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACTIVITÉS
-- =============================================

-- ADG (Assemblée de Groupe)
CREATE TABLE activites_adg (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ordre INT,
  date_activite DATE NOT NULL,
  conducteurs TEXT,
  heure_debut TIME,
  heure_fin TIME,
  duree_minutes INT,
  hommes INT DEFAULT 0,
  femmes INT DEFAULT 0,
  enfants INT DEFAULT 0,
  total_participants INT GENERATED ALWAYS AS (hommes + femmes + enfants) STORED,
  comptage TEXT,
  notes TEXT,
  auteur_id UUID REFERENCES profils(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cultes — Prières des STAR
CREATE TABLE activites_cultes_prieres_star (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ordre INT,
  date_activite DATE NOT NULL,
  conducteurs_priere TEXT,
  heure_debut TIME,
  heure_fin TIME,
  duree_minutes INT,
  nombre_star INT DEFAULT 0,
  comptage TEXT,
  notes TEXT,
  auteur_id UUID REFERENCES profils(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cultes — Célébration
CREATE TABLE activites_cultes_celebration (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date_activite DATE NOT NULL,
  heure_debut TIME,
  heure_fin TIME,
  duree_minutes INT,
  hommes INT DEFAULT 0,
  femmes INT DEFAULT 0,
  enfants INT DEFAULT 0,
  total_participants INT GENERATED ALWAYS AS (hommes + femmes + enfants) STORED,
  priere_salut BOOLEAN DEFAULT FALSE,
  visiteurs INT DEFAULT 0,
  sainte_cene BOOLEAN DEFAULT FALSE,
  nombre_sainte_cene INT DEFAULT 0,
  moderateur TEXT,
  predicateur TEXT,
  theme TEXT,
  comptage TEXT,
  notes TEXT,
  auteur_id UUID REFERENCES profils(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Congés
CREATE TABLE activites_conges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ordre INT,
  prenom_nom TEXT NOT NULL,
  sexe TEXT CHECK (sexe IN ('M','F')),
  categorie TEXT,
  departement TEXT,
  janvier BOOLEAN DEFAULT FALSE,
  fevrier BOOLEAN DEFAULT FALSE,
  mars BOOLEAN DEFAULT FALSE,
  avril BOOLEAN DEFAULT FALSE,
  mai BOOLEAN DEFAULT FALSE,
  juin BOOLEAN DEFAULT FALSE,
  juillet BOOLEAN DEFAULT FALSE,
  aout BOOLEAN DEFAULT FALSE,
  septembre BOOLEAN DEFAULT FALSE,
  octobre BOOLEAN DEFAULT FALSE,
  novembre BOOLEAN DEFAULT FALSE,
  decembre BOOLEAN DEFAULT FALSE,
  remarque_speciale TEXT,
  type_absence TEXT CHECK (type_absence IN ('conge','sante')),
  annee INT DEFAULT 2026,
  auteur_id UUID REFERENCES profils(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RNA (Réunion / Activité Non-Assignée)
CREATE TABLE activites_rna (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ordre INT,
  date_activite DATE NOT NULL,
  responsable TEXT,
  type_activite TEXT,
  heure_debut TIME,
  heure_fin TIME,
  duree_minutes INT,
  effectif INT DEFAULT 0,
  comptage TEXT,
  notes TEXT,
  auteur_id UUID REFERENCES profils(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- JOURNAL D'ÉVÉNEMENTS
-- =============================================
CREATE TABLE journal_evenements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auteur_id UUID REFERENCES profils(id),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entite_id TEXT,
  description TEXT,
  anciennes_valeurs JSONB,
  nouvelles_valeurs JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE profils ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions_phoning ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches_suivi ENABLE ROW LEVEL SECURITY;
ALTER TABLE familles_impact ENABLE ROW LEVEL SECURITY;
ALTER TABLE membres_familles_impact ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_formation ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscriptions_formation ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences_formation ENABLE ROW LEVEL SECURITY;
ALTER TABLE activites_adg ENABLE ROW LEVEL SECURITY;
ALTER TABLE activites_cultes_prieres_star ENABLE ROW LEVEL SECURITY;
ALTER TABLE activites_cultes_celebration ENABLE ROW LEVEL SECURITY;
ALTER TABLE activites_conges ENABLE ROW LEVEL SECURITY;
ALTER TABLE activites_rna ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listes_parametrables ENABLE ROW LEVEL SECURITY;

-- Policies : utilisateurs connectés peuvent tout lire
CREATE POLICY "auth_users_read" ON profils FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_users_update_own" ON profils FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "auth_read" ON personnes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_membres" ON membres FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_phoning" ON interactions_phoning FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_taches" ON taches_suivi FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_fi" ON familles_impact FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_membres_fi" ON membres_familles_impact FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_formations" ON formations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_sessions" ON sessions_formation FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_inscriptions" ON inscriptions_formation FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_absences" ON absences_formation FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_adg" ON activites_adg FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_prieres" ON activites_cultes_prieres_star FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_celebration" ON activites_cultes_celebration FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_conges" ON activites_conges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_rna" ON activites_rna FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_journal" ON journal_evenements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_permissions" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_roles_permissions" ON roles_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_listes" ON listes_parametrables FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_listes" ON listes_parametrables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_roles" ON roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_permissions" ON permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_roles_permissions" ON roles_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_personnes_statut ON personnes(statut);
CREATE INDEX idx_personnes_actif ON personnes(actif);
CREATE INDEX idx_membres_statut ON membres(statut);
CREATE INDEX idx_interactions_personne ON interactions_phoning(personne_id);
CREATE INDEX idx_interactions_date ON interactions_phoning(date_interaction);
CREATE INDEX idx_taches_echeance ON taches_suivi(echeance);
CREATE INDEX idx_taches_statut ON taches_suivi(statut);
CREATE INDEX idx_journal_module ON journal_evenements(module);
CREATE INDEX idx_journal_created ON journal_evenements(created_at);

-- =============================================
-- FONCTIONS ET TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_personnes_updated BEFORE UPDATE ON personnes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_membres_updated BEFORE UPDATE ON membres FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_taches_updated BEFORE UPDATE ON taches_suivi FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_fi_updated BEFORE UPDATE ON familles_impact FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_formations_updated BEFORE UPDATE ON formations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_adg_updated BEFORE UPDATE ON activites_adg FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_prieres_updated BEFORE UPDATE ON activites_cultes_prieres_star FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_celebration_updated BEFORE UPDATE ON activites_cultes_celebration FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_conges_updated BEFORE UPDATE ON activites_conges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trig_rna_updated BEFORE UPDATE ON activites_rna FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: créer tâche J+3 automatiquement à la création d'une personne
CREATE OR REPLACE FUNCTION creer_tache_j3()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO taches_suivi (personne_id, titre, description, type_tache, echeance, priorite, auteur_id)
  VALUES (
    NEW.id,
    'Suivi J+3 — ' || NEW.prenom || ' ' || NEW.nom,
    'Premier suivi automatique 3 jours après la création de la fiche.',
    'suivi',
    CURRENT_DATE + INTERVAL '3 days',
    'normale',
    NEW.auteur_creation
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_tache_j3 AFTER INSERT ON personnes FOR EACH ROW EXECUTE FUNCTION creer_tache_j3();
