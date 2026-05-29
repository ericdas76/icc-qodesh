-- =============================================
-- ICC-QODESH — Création des comptes seed
-- =============================================
-- IMPORTANT : Ces comptes doivent être créés via Supabase Auth Dashboard
-- ou via l'API d'administration Supabase.
-- 
-- ÉTAPES :
-- 1. Aller dans Supabase Dashboard > Authentication > Users
-- 2. Créer chaque compte avec "Invite user" ou "Create new user"
-- 3. Copier l'UUID généré par Supabase
-- 4. Exécuter les INSERT ci-dessous dans SQL Editor
-- 5. Les profils seront créés automatiquement via le trigger auth (ou manuellement)
-- =============================================

-- Après création dans Supabase Auth, exécuter ces inserts en remplaçant les UUIDs :
-- (Les UUIDs doivent correspondre aux IDs générés par Supabase Auth)

-- Exemple de structure (adapter les UUIDs réels) :
/*
INSERT INTO profils (id, email, nom, prenom, role_id) VALUES
  -- UUID depuis auth.users | Email | Nom | Prénom | Role ID
  ('<UUID-FabriceNK>', 'fabrice.nk@icc-antananarivo.mg', 'NK', 'Fabrice', '00000000-0000-0000-0000-000000000001'),
  ('<UUID-Redox>', 'redox@icc-antananarivo.mg', 'Redox', 'Référent', '00000000-0000-0000-0000-000000000002'),
  ('<UUID-CelineK>', 'celine.k@icc-antananarivo.mg', 'K', 'Céline', '00000000-0000-0000-0000-000000000001'),
  ('<UUID-EricDS>', 'eric.ds@icc-antananarivo.mg', 'DS', 'Éric', '00000000-0000-0000-0000-000000000001'),
  ('<UUID-Victor>', 'victor@icc-antananarivo.mg', 'Victor', 'Référent', '00000000-0000-0000-0000-000000000002'),
  ('<UUID-Miary>', 'miary@icc-antananarivo.mg', 'Miary', 'Référent', '00000000-0000-0000-0000-000000000002');
*/

-- =============================================
-- TRIGGER : Auto-création du profil à l'inscription
-- =============================================
-- Ajouter dans Supabase > SQL Editor :

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profils (id, email, nom, prenom, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Nouveau'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Utilisateur'),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
