-- Migration : ejp_activite_participants
-- Participants par activité EJP (membres EJP + externes)
-- Date : 2026-06-07

CREATE TABLE IF NOT EXISTS ejp_activite_participants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activite_id   uuid NOT NULL REFERENCES ejp_activites(id) ON DELETE CASCADE,
  -- Si membre EJP existant
  membre_id     uuid REFERENCES ejp_membres(id) ON DELETE SET NULL,
  -- Infos participant (remplies pour externes, ou dupliquées depuis ejp_membres pour affichage)
  prenom        text NOT NULL,
  nom           text NOT NULL,
  sexe          text CHECK (sexe IN ('Homme', 'Femme', NULL)),
  age           integer,
  telephone     text,
  est_membre    boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_ejp_activite_participants_activite ON ejp_activite_participants(activite_id);
CREATE INDEX IF NOT EXISTS idx_ejp_activite_participants_membre  ON ejp_activite_participants(membre_id);

-- RLS
ALTER TABLE ejp_activite_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ejp_participants_select" ON ejp_activite_participants
  FOR SELECT USING (true);

CREATE POLICY "ejp_participants_insert" ON ejp_activite_participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ejp_participants_update" ON ejp_activite_participants
  FOR UPDATE USING (true);

CREATE POLICY "ejp_participants_delete" ON ejp_activite_participants
  FOR DELETE USING (true);
