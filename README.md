# ICC-Qodesh — Gestion des Membres ICC Antananarivo

## Vue d'ensemble
Remplacement du suivi Excel pour la gestion du cycle de vie des membres d'ICC Antananarivo.
**Périmètre MVP** : Arrivée → Suivi → Intégration → Formation → Service → Historique

---

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Un projet Supabase (supabase.com)

### 1. Cloner et installer
```bash
npm install
```

### 2. Configurer Supabase
```bash
cp .env.example .env
# Éditer .env avec vos vraies clés Supabase
```

### 3. Initialiser la base de données
Dans Supabase Dashboard > SQL Editor :
1. Exécuter `supabase/schema.sql` (schéma complet + RLS)
2. Exécuter `supabase/create_users.sql` (trigger d'auto-création de profil)
3. Exécuter `supabase/seed.sql` (données de démonstration)

### 4. Créer les comptes utilisateurs
Dans Supabase Dashboard > Authentication > Users :

| Prénom | Nom | Email (exemple) | Rôle |
|--------|-----|-----------------|------|
| Fabrice | NK | fabrice.nk@icc.mg | admin |
| Redox | — | redox@icc.mg | referent |
| Céline | K | celine.k@icc.mg | admin |
| Éric | DS | eric.ds@icc.mg | admin |
| Victor | — | victor@icc.mg | referent |
| Miary | — | miary@icc.mg | referent |

Après création, assigner les rôles dans Administration > Utilisateurs.

### 5. Lancer en développement
```bash
npm run dev
```

### 6. Build production
```bash
npm run build
npm run preview
```

---

## 🏗️ Architecture technique

### Stack
- **Frontend** : React 18 + TypeScript + Tailwind CSS
- **Backend** : Supabase (PostgreSQL + Auth + RLS)
- **Build** : Vite
- **Routing** : React Router v6

### Structure
```
src/
├── contexts/AuthContext.tsx   # Auth + permissions
├── lib/
│   ├── supabase.ts            # Client + types
│   └── journal.ts             # Journalisation
├── components/                # Composants réutilisables
├── pages/
│   ├── LoginPage              # Connexion
│   ├── DashboardPage          # Tableau de bord
│   ├── PersonnesPage          # Liste intégration
│   ├── PersonneFichePage      # Fiche personne
│   ├── PersonneFormPage       # Formulaire personne
│   ├── PhoningPage            # Suivi phoning
│   ├── MembresPage            # Liste membres
│   ├── MembreFichePage        # Fiche membre
│   ├── FamillesImpactPage     # Liste FI
│   ├── FamilleImpactFichePage # Fiche FI
│   ├── FormationsPage         # Liste formations
│   ├── FormationFichePage     # Fiche formation + inscriptions
│   ├── ActivitesPage          # Container onglets activités
│   ├── activites/
│   │   ├── ActivitesADG       # ADG
│   │   ├── ActivitesPriereStar # Prières STAR
│   │   ├── ActivitesCelebration # Cultes Célébration
│   │   ├── ActivitesConges    # Congés 2026
│   │   └── ActivitesRNA       # RNA
│   ├── AdministrationPage     # Admin (users, listes, rôles)
│   └── HistoriquePage         # Journal d'événements
supabase/
├── schema.sql                 # Schéma PostgreSQL complet
├── seed.sql                   # Données de démonstration
└── create_users.sql           # Trigger + instructions comptes
```

---

## 📊 Schéma de base de données

### Tables principales
| Table | Description |
|-------|-------------|
| `profils` | Comptes utilisateurs + rôles |
| `roles` | admin / referent / lecture |
| `permissions` | Module × action |
| `personnes` | Fiches intégration (visiteurs/nouveaux) |
| `membres` | Membres avancés dans le cycle |
| `interactions_phoning` | Historique appels/WhatsApp/visites |
| `taches_suivi` | Tâches + tâche J+3 automatique |
| `familles_impact` | FI avec responsable/copilote |
| `membres_familles_impact` | Membres d'une FI |
| `formations` | Classes 001/101/201/301 |
| `sessions_formation` | Séances de formation |
| `inscriptions_formation` | Inscriptions + suivi absences |
| `absences_formation` | Absences (alerte ≥ 2) |
| `activites_adg` | ADG |
| `activites_cultes_prieres_star` | Prières STAR |
| `activites_cultes_celebration` | Cultes célébration |
| `activites_conges` | Congés 2026 |
| `activites_rna` | RNA |
| `listes_parametrables` | Listes modifiables (statuts, dép., etc.) |
| `journal_evenements` | Audit trail complet |

### Règles data
- ✅ `created_at` / `updated_at` partout
- ✅ `actif` = suppression logique (jamais de DELETE)
- ✅ `auteur_id` sur toutes les tables sensibles
- ✅ Triggers `updated_at` automatiques
- ✅ Trigger tâche J+3 à la création de personne
- ✅ Row Level Security (RLS) activé

---

## 🔐 Rôles et permissions

| Module | Admin | Référent | Lecture |
|--------|-------|----------|---------|
| Membres | CRUD + Export | CRUD | Lire |
| Phoning | CRUD | CRUD | Lire |
| Formations | CRUD | CRUD | Lire |
| Activités | CRUD | CRUD | Lire |
| Administration | Accès complet | — | — |

---

## 🗂️ Modules MVP V1

### ✅ Implémentés
- [x] Authentification Supabase + rôles + permissions
- [x] Dashboard avec KPIs (7 métriques)
- [x] Intégration : CRUD personnes, workflow statuts
- [x] Tâche J+3 automatique (trigger SQL)
- [x] Phoning : appel/WhatsApp/visite, statuts, issues, "Mes suivis du jour"
- [x] Membres : liste filtrée, export XLSX
- [x] Familles d'Impact : CRUD + gestion membres
- [x] Formation : classes 001/101/201/301, inscriptions, suivi absences (alerte ≥ 2)
- [x] Activités : ADG, Prières STAR, Célébration, Congés 2026, RNA
- [x] Administration : utilisateurs, rôles, listes paramétrables
- [x] Historique : journal consultable, filtres, pagination
- [x] Suppression logique partout (actif=false)
- [x] Export XLSX membres/intégration

### 🔮 V2 (non implémenté)
- [ ] Notifications push / email
- [ ] Rapports statistiques avancés
- [ ] Application mobile
- [ ] Import CSV/Excel en masse
- [ ] Multi-assemblée

---

## 🚢 Déploiement Cloudflare Pages (optionnel)

```bash
npm run build
npx wrangler pages deploy dist --project-name icc-qodesh
```

Variables d'environnement à configurer :
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 📅 Dernière mise à jour
Mai 2026 — Version MVP 1.0
