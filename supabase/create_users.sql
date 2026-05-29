-- =============================================
-- ICC-QODESH — Setup comptes utilisateurs seed
-- Version complète : Trigger + Instructions
-- =============================================
-- ORDRE D'EXÉCUTION :
--   ÉTAPE 1 : Exécuter ce fichier entier dans SQL Editor
--             → installe le trigger auto-profil
--   ÉTAPE 2 : Créer les 6 comptes dans Supabase Dashboard
--             → Authentication > Users > "Add user"
--   ÉTAPE 3 : Exécuter le bloc "ASSIGNER LES RÔLES" en bas
--             → en remplaçant les emails si vous avez utilisé les vôtres
-- =============================================


-- =============================================
-- ÉTAPE 1 — TRIGGER auto-création de profil
-- =============================================
-- Ce trigger crée automatiquement une ligne dans `profils`
-- dès qu'un compte est créé dans auth.users (Supabase Auth).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profils (id, email, nom, prenom, role_id, actif)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Nouveau'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Utilisateur'),
    NULL,   -- rôle non assigné par défaut (à faire dans Administration)
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprime l'ancien trigger s'il existe, puis recrée
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================
-- ÉTAPE 2 — Créer les 6 comptes dans Supabase
-- =============================================
-- Aller dans : Authentication > Users > "Add user" > "Create new user"
--
-- ┌─────────────────────────────────────────────────────────────────┐
-- │  Compte       │ Email                           │ Mot de passe  │
-- ├───────────────┼─────────────────────────────────┼───────────────┤
-- │  FabriceNK    │ fabrice.nk@icc-antananarivo.mg  │ Icc@2025!     │
-- │  Redox        │ redox@icc-antananarivo.mg        │ Icc@2025!     │
-- │  CélineK      │ celine.k@icc-antananarivo.mg    │ Icc@2025!     │
-- │  EricDS       │ eric.ds@icc-antananarivo.mg      │ Icc@2025!     │
-- │  Victor       │ victor@icc-antananarivo.mg       │ Icc@2025!     │
-- │  Miary        │ miary@icc-antananarivo.mg        │ Icc@2025!     │
-- └─────────────────────────────────────────────────────────────────┘
--
-- ⚠️  Cocher "Auto Confirm User" pour éviter la vérification email.
-- ✅  Le trigger créera automatiquement le profil dans `profils`.


-- =============================================
-- ÉTAPE 3 — Assigner les rôles aux profils
-- =============================================
-- À exécuter APRÈS avoir créé les comptes en ÉTAPE 2.
-- Le trigger aura déjà créé les lignes dans `profils`.
-- Ce bloc assigne les rôles admin / référent.

-- ADMINS (FabriceNK, CélineK, EricDS)
UPDATE public.profils
SET
  role_id = '00000000-0000-0000-0000-000000000001',  -- admin
  nom     = CASE email
              WHEN 'fabrice.nk@icc-antananarivo.mg' THEN 'NK'
              WHEN 'celine.k@icc-antananarivo.mg'   THEN 'K'
              WHEN 'eric.ds@icc-antananarivo.mg'     THEN 'DS'
            END,
  prenom  = CASE email
              WHEN 'fabrice.nk@icc-antananarivo.mg' THEN 'Fabrice'
              WHEN 'celine.k@icc-antananarivo.mg'   THEN 'Céline'
              WHEN 'eric.ds@icc-antananarivo.mg'     THEN 'Éric'
            END
WHERE email IN (
  'fabrice.nk@icc-antananarivo.mg',
  'celine.k@icc-antananarivo.mg',
  'eric.ds@icc-antananarivo.mg'
);

-- RÉFÉRENTS (Redox, Victor, Miary)
UPDATE public.profils
SET
  role_id = '00000000-0000-0000-0000-000000000002',  -- referent
  nom     = CASE email
              WHEN 'redox@icc-antananarivo.mg'  THEN 'Redox'
              WHEN 'victor@icc-antananarivo.mg' THEN 'Victor'
              WHEN 'miary@icc-antananarivo.mg'  THEN 'Miary'
            END,
  prenom  = CASE email
              WHEN 'redox@icc-antananarivo.mg'  THEN 'Référent'
              WHEN 'victor@icc-antananarivo.mg' THEN 'Référent'
              WHEN 'miary@icc-antananarivo.mg'  THEN 'Référent'
            END
WHERE email IN (
  'redox@icc-antananarivo.mg',
  'victor@icc-antananarivo.mg',
  'miary@icc-antananarivo.mg'
);


-- =============================================
-- VÉRIFICATION — À exécuter après les étapes
-- =============================================
-- Décommenter pour vérifier que tout est en ordre :

-- SELECT p.email, p.nom, p.prenom, r.nom AS role
-- FROM public.profils p
-- LEFT JOIN public.roles r ON r.id = p.role_id
-- ORDER BY r.nom, p.nom;
