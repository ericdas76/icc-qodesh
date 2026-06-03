-- ============================================================
-- POLITIQUES RLS — Tables EJP
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Activer RLS sur toutes les tables EJP
ALTER TABLE ejp_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejp_activites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejp_activite_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejp_departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejp_types_rencontre ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejp_formations_pcnc ENABLE ROW LEVEL SECURITY;

-- ── ejp_membres ──────────────────────────────────────────────
CREATE POLICY "ejp_membres_select" ON ejp_membres
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ejp_membres_insert" ON ejp_membres
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ejp_membres_update" ON ejp_membres
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ejp_membres_delete" ON ejp_membres
  FOR DELETE TO authenticated USING (true);

-- ── ejp_activites ─────────────────────────────────────────────
CREATE POLICY "ejp_activites_select" ON ejp_activites
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ejp_activites_insert" ON ejp_activites
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ejp_activites_update" ON ejp_activites
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ejp_activites_delete" ON ejp_activites
  FOR DELETE TO authenticated USING (true);

-- ── ejp_activite_membres ──────────────────────────────────────
CREATE POLICY "ejp_activite_membres_select" ON ejp_activite_membres
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ejp_activite_membres_insert" ON ejp_activite_membres
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ejp_activite_membres_update" ON ejp_activite_membres
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ejp_activite_membres_delete" ON ejp_activite_membres
  FOR DELETE TO authenticated USING (true);

-- ── ejp_departements ──────────────────────────────────────────
CREATE POLICY "ejp_departements_select" ON ejp_departements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ejp_departements_insert" ON ejp_departements
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ejp_departements_update" ON ejp_departements
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ejp_departements_delete" ON ejp_departements
  FOR DELETE TO authenticated USING (true);

-- ── ejp_types_rencontre ───────────────────────────────────────
CREATE POLICY "ejp_types_rencontre_select" ON ejp_types_rencontre
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ejp_types_rencontre_insert" ON ejp_types_rencontre
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ejp_types_rencontre_update" ON ejp_types_rencontre
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ejp_types_rencontre_delete" ON ejp_types_rencontre
  FOR DELETE TO authenticated USING (true);

-- ── ejp_formations_pcnc ───────────────────────────────────────
CREATE POLICY "ejp_formations_pcnc_select" ON ejp_formations_pcnc
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ejp_formations_pcnc_insert" ON ejp_formations_pcnc
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ejp_formations_pcnc_update" ON ejp_formations_pcnc
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ejp_formations_pcnc_delete" ON ejp_formations_pcnc
  FOR DELETE TO authenticated USING (true);
