-- =============================================
-- ICC-QODESH — Seed de démonstration
-- =============================================

-- Rôles
INSERT INTO roles (id, nom, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Administrateur — accès complet'),
  ('00000000-0000-0000-0000-000000000002', 'referent', 'Référent — lecture et saisie'),
  ('00000000-0000-0000-0000-000000000003', 'lecture', 'Lecture seule');

-- Permissions
INSERT INTO permissions (id, module, action, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'membres', 'lire', 'Voir les membres'),
  ('10000000-0000-0000-0000-000000000002', 'membres', 'creer', 'Créer un membre'),
  ('10000000-0000-0000-0000-000000000003', 'membres', 'modifier', 'Modifier un membre'),
  ('10000000-0000-0000-0000-000000000004', 'membres', 'supprimer', 'Désactiver un membre'),
  ('10000000-0000-0000-0000-000000000005', 'membres', 'exporter', 'Exporter les membres'),
  ('10000000-0000-0000-0000-000000000011', 'phoning', 'lire', 'Voir les interactions'),
  ('10000000-0000-0000-0000-000000000012', 'phoning', 'creer', 'Créer une interaction'),
  ('10000000-0000-0000-0000-000000000021', 'formations', 'lire', 'Voir les formations'),
  ('10000000-0000-0000-0000-000000000022', 'formations', 'creer', 'Créer une formation'),
  ('10000000-0000-0000-0000-000000000031', 'activites', 'lire', 'Voir les activités'),
  ('10000000-0000-0000-0000-000000000032', 'activites', 'creer', 'Créer une activité'),
  ('10000000-0000-0000-0000-000000000033', 'activites', 'modifier', 'Modifier une activité'),
  ('10000000-0000-0000-0000-000000000041', 'administration', 'lire', 'Voir l administration'),
  ('10000000-0000-0000-0000-000000000042', 'administration', 'modifier', 'Modifier la configuration');

-- Rôles/Permissions
-- Admin : tout
INSERT INTO roles_permissions SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions;
-- Référent : tout sauf admin
INSERT INTO roles_permissions SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions WHERE module != 'administration';
-- Lecture : lire seulement
INSERT INTO roles_permissions SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions WHERE action = 'lire';

-- Listes paramétrables
INSERT INTO listes_parametrables (categorie, valeur, ordre) VALUES
  -- Statuts
  ('statut_membre', 'Nouveau', 1),
  ('statut_membre', 'FI', 2),
  ('statut_membre', 'Formation', 3),
  ('statut_membre', 'STAR', 4),
  ('statut_membre', 'Département', 5),
  ('statut_membre', 'Libéré', 6),
  ('statut_membre', 'Inactif', 7),
  -- Issues phoning
  ('issue_phoning', 'Revient', 1),
  ('issue_phoning', 'Incertain', 2),
  ('issue_phoning', 'FI', 3),
  ('issue_phoning', 'Libération', 4),
  ('issue_phoning', 'Aucune', 5),
  -- Types d'appel
  ('type_appel', 'Appel téléphonique', 1),
  ('type_appel', 'WhatsApp', 2),
  ('type_appel', 'Visite', 3),
  -- Départements
  ('departement', 'Louange', 1),
  ('departement', 'Intercession', 2),
  ('departement', 'Évangélisation', 3),
  ('departement', 'Enfants', 4),
  ('departement', 'Intendance', 5),
  ('departement', 'Médias', 6),
  ('departement', 'Accueil', 7),
  -- Nationalités
  ('nationalite', 'Malagasy', 1),
  ('nationalite', 'Française', 2),
  ('nationalite', 'Autre', 3),
  -- Types activité RNA
  ('type_activite_rna', 'Réunion de zone', 1),
  ('type_activite_rna', 'Formation spéciale', 2),
  ('type_activite_rna', 'Évangélisation', 3),
  ('type_activite_rna', 'Autre', 4),
  -- Situations familiales
  ('situation_familiale', 'Célibataire', 1),
  ('situation_familiale', 'Marié(e)', 2),
  ('situation_familiale', 'Divorcé(e)', 3),
  ('situation_familiale', 'Veuf/Veuve', 4);

-- NOTE: Les profils utilisateurs (FabriceNK, Redox, CélineK, EricDS, Victor, Miary)
-- doivent être créés via l'interface Supabase Auth ou le script d'initialisation.
-- Voir supabase/create_users.sql pour les instructions.

-- Données de démonstration — Personnes
INSERT INTO personnes (id, nom, prenom, telephone, email, sexe, situation_familiale, nationalite, statut, date_premier_contact, profession) VALUES
  ('20000000-0000-0000-0000-000000000001', 'RAKOTO', 'Jean', '+261 34 12 345 67', 'jean.rakoto@email.com', 'M', 'marie', 'Malagasy', 'fi', '2025-10-01', 'Enseignant'),
  ('20000000-0000-0000-0000-000000000002', 'RABE', 'Marie', '+261 33 98 765 43', 'marie.rabe@email.com', 'F', 'celibataire', 'Malagasy', 'formation', '2025-09-15', 'Infirmière'),
  ('20000000-0000-0000-0000-000000000003', 'ANDRIAMAMY', 'Pierre', '+261 32 55 123 44', NULL, 'M', 'celibataire', 'Malagasy', 'nouveau', '2025-11-20', 'Étudiant'),
  ('20000000-0000-0000-0000-000000000004', 'RASOA', 'Claudine', '+261 34 67 890 12', 'claudine@email.com', 'F', 'marie', 'Malagasy', 'star', '2025-08-01', 'Commercante'),
  ('20000000-0000-0000-0000-000000000005', 'RANDRIA', 'Samuel', '+261 33 22 334 55', NULL, 'M', 'celibataire', 'Malagasy', 'departement', '2025-07-10', 'Ingénieur'),
  ('20000000-0000-0000-0000-000000000006', 'RAVELONA', 'Hanta', '+261 32 77 556 88', 'hanta@email.com', 'F', 'celibataire', 'Malagasy', 'nouveau', '2025-12-01', 'Secrétaire'),
  ('20000000-0000-0000-0000-000000000007', 'RAJOELISON', 'Tsiory', '+261 34 11 223 44', NULL, 'M', 'marie', 'Malagasy', 'fi', '2025-11-05', 'Médecin'),
  ('20000000-0000-0000-0000-000000000008', 'RABEMANANTSOA', 'Lalao', '+261 33 44 556 77', 'lalao@email.com', 'F', 'marie', 'Malagasy', 'formation', '2025-10-20', 'Comptable');

-- Membres
INSERT INTO membres (personne_id, numero_membre, statut, departement, date_adhesion) VALUES
  ('20000000-0000-0000-0000-000000000001', 'ICC-001', 'fi', NULL, '2025-10-01'),
  ('20000000-0000-0000-0000-000000000002', 'ICC-002', 'formation', NULL, '2025-09-15'),
  ('20000000-0000-0000-0000-000000000004', 'ICC-004', 'star', NULL, '2025-08-01'),
  ('20000000-0000-0000-0000-000000000005', 'ICC-005', 'departement', 'Louange', '2025-07-10');

-- Famille d'Impact demo
INSERT INTO familles_impact (id, nom, quartier, responsable_id, actif) VALUES
  ('30000000-0000-0000-0000-000000000001', 'FI Ambohimanarina', 'Ambohimanarina', '20000000-0000-0000-0000-000000000005', TRUE),
  ('30000000-0000-0000-0000-000000000002', 'FI Ankadifotsy', 'Ankadifotsy', '20000000-0000-0000-0000-000000000004', TRUE);

INSERT INTO membres_familles_impact (famille_id, personne_id, date_ajout) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2025-10-05'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006', '2025-12-03'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '2025-09-20'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000007', '2025-11-10');

-- Formations
INSERT INTO formations (id, classe, nom, annee) VALUES
  ('40000000-0000-0000-0000-000000000001', '001', 'Classe 001 — Démarrage en foi', 2025),
  ('40000000-0000-0000-0000-000000000002', '101', 'Classe 101 — Fondements', 2025),
  ('40000000-0000-0000-0000-000000000003', '201', 'Classe 201 — Maturité spirituelle', 2025),
  ('40000000-0000-0000-0000-000000000004', '301', 'Classe 301 — Leadership', 2025);

INSERT INTO inscriptions_formation (formation_id, personne_id, statut) VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'inscrit'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'en_cours'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000008', 'en_cours'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'termine');

-- Activités démo
INSERT INTO activites_adg (ordre, date_activite, conducteurs, heure_debut, heure_fin, duree_minutes, hommes, femmes, enfants, comptage) VALUES
  (1, '2025-11-15', 'Samuel RANDRIA', '18:30', '20:00', 90, 8, 12, 3, 'Présence normale'),
  (2, '2025-11-22', 'Hanta RAVELONA', '18:30', '20:15', 105, 7, 15, 2, 'Bonne participation'),
  (3, '2025-11-29', 'Samuel RANDRIA', '18:30', '19:45', 75, 10, 10, 4, 'Soirée évangélisation');

INSERT INTO activites_cultes_celebration (date_activite, heure_debut, heure_fin, duree_minutes, hommes, femmes, enfants, priere_salut, visiteurs, moderateur, predicateur, theme) VALUES
  ('2025-11-23', '09:00', '11:30', 150, 45, 68, 22, TRUE, 8, 'Pierre ANDRIAMAMY', 'Jean RAKOTO', 'La grâce de Dieu'),
  ('2025-11-30', '09:00', '11:15', 135, 42, 72, 18, FALSE, 5, 'Pierre ANDRIAMAMY', 'Samuel RANDRIA', 'Marcher dans la foi');

-- Interactions phoning démo
INSERT INTO interactions_phoning (personne_id, type_interaction, statut_contact, issue, notes) VALUES
  ('20000000-0000-0000-0000-000000000003', 'appel', 'joignable', 'revient', 'Très motivé, confirmé pour dimanche'),
  ('20000000-0000-0000-0000-000000000006', 'whatsapp', 'joignable', 'incertain', 'Hésite encore, besoin de suivi'),
  ('20000000-0000-0000-0000-000000000007', 'appel', 'non_joignable', 'aucune', 'Pas de réponse, à rappeler demain');
