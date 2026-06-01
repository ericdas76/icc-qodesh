import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true }
})

export interface Profil {
  id: string
  email: string
  nom: string
  prenom: string
  role_id: string | null
  actif: boolean
  created_at: string
  updated_at: string
  roles?: Role
}

export interface Role {
  id: string
  nom: string
  description: string | null
}

export interface Permission {
  id: string
  module: string
  action: string
  description: string | null
}

export interface Personne {
  id: string
  nom: string
  prenom: string
  date_naissance: string | null
  lieu_naissance: string | null
  telephone: string | null
  email: string | null
  profession: string | null
  sexe: 'M' | 'F' | null
  situation_familiale: string | null
  nombre_enfants: number
  nationalite: string
  adresse: string | null
  quartier: string | null
  statut: string
  date_premier_contact: string | null
  source_contact: string | null
  notes: string | null
  auteur_creation: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface Membre {
  id: string
  personne_id: string
  numero_membre: string | null
  date_adhesion: string | null
  statut: string
  departement: string | null
  date_liberation: string | null
  motif_liberation: string | null
  photo_url: string | null
  categorie: string | null
  actif: boolean
  created_at: string
  updated_at: string
  personnes?: Personne
}

export interface InteractionPhoning {
  id: string
  personne_id: string
  type_interaction: 'appel' | 'whatsapp' | 'visite'
  statut_contact: 'joignable' | 'non_joignable' | 'a_rappeler'
  issue: 'revient' | 'incertain' | 'fi' | 'liberation' | 'aucune' | null
  date_interaction: string
  notes: string | null
  prochain_contact: string | null
  auteur_id: string | null
  created_at: string
  personnes?: Personne
  profils?: Profil
}

export interface TacheSuivi {
  id: string
  personne_id: string
  titre: string
  description: string | null
  type_tache: string
  echeance: string
  statut: 'en_attente' | 'en_cours' | 'terminee' | 'annulee'
  priorite: 'basse' | 'normale' | 'haute' | 'urgente'
  assignee_id: string | null
  auteur_id: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  personnes?: Personne
}

export interface FamilleImpact {
  id: string
  nom: string
  quartier: string | null
  adresse_maison_hote: string | null
  responsable_id: string | null
  copilote_id: string | null
  jour_reunion: string | null
  heure_reunion: string | null
  date_creation: string | null
  actif: boolean
  notes: string | null
  created_at: string
  updated_at: string
  responsable?: Personne
  copilote?: Personne
  membres_familles_impact?: { personne_id: string; actif: boolean; personnes?: Personne }[]
}

// ===== PROMOTIONS V2 =====
export interface Promotion {
  id: string
  nom: string
  date_promotion: string
  actif: boolean
  created_at: string
  updated_at: string
}

// ===== FORMATIONS V2 =====
export interface Formation {
  id: string
  classe: '001' | '101' | '201' | '301'
  nom: string
  description: string | null
  annee: number
  // V2 — nouvelles colonnes
  promotion_id: string | null
  code: string | null
  enseignant: string | null
  assistant: string | null
  date_fin: string | null
  actif: boolean
  created_at: string
  updated_at: string
  // relations
  promotions?: Promotion
}

export interface SessionFormation {
  id: string
  formation_id: string
  titre: string
  date_session: string
  heure_debut: string | null
  heure_fin: string | null
  lieu: string | null
  animateur_id: string | null
  notes: string | null
  created_at: string
}

export interface InscriptionFormation {
  id: string
  formation_id: string
  personne_id: string
  date_inscription: string
  statut: 'inscrit' | 'en_cours' | 'termine' | 'abandonne'
  auteur_id: string | null
  created_at: string
  personnes?: Personne
  formations?: Formation
  absences_formation?: AbsenceFormation[]
}

export interface AbsenceFormation {
  id: string
  inscription_id: string
  session_id: string
  justifiee: boolean
  notes: string | null
  created_at: string
}

// ===== ACTIVITÉS =====
export interface ActiviteADG {
  id: string
  ordre: number | null
  date_activite: string
  conducteurs: string | null
  heure_debut: string | null
  heure_fin: string | null
  duree_minutes: number | null
  hommes: number
  femmes: number
  enfants: number
  total_participants: number
  comptage: string | null
  notes: string | null
  auteur_id: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface ActiviteCultePriereStar {
  id: string
  ordre: number | null
  date_activite: string
  conducteurs_priere: string | null
  heure_debut: string | null
  heure_fin: string | null
  duree_minutes: number | null
  nombre_star: number
  // V2 — nouvelles colonnes
  hommes: number
  femmes: number
  enfants: number
  comptage: string | null
  notes: string | null
  auteur_id: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface ActiviteCulteCelebration {
  id: string
  date_activite: string
  heure_debut: string | null
  heure_fin: string | null
  duree_minutes: number | null
  hommes: number
  femmes: number
  enfants: number
  total_participants: number
  priere_salut: boolean
  visiteurs: number
  sainte_cene: boolean
  nombre_sainte_cene: number
  moderateur: string | null
  predicateur: string | null
  theme: string | null
  comptage: string | null
  notes: string | null
  auteur_id: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

// ===== CONGÉS V2 — nouveau schéma (date_debut/date_fin/type_conge) =====
export interface ActiviteConge {
  id: string
  ordre: number | null
  prenom_nom: string
  sexe: 'M' | 'F' | null
  categorie: string | null
  departement: string | null
  // V2 — remplace grille booléenne mensuelle
  type_conge: 'conge' | 'sante' | 'autre' | null
  description: string | null
  date_debut: string | null
  date_fin: string | null
  mois: number | null
  annee_conge: number | null
  remarque_speciale: string | null
  annee: number
  auteur_id: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

// ===== RNA V2 — lieu + hommes/femmes/enfants =====
export interface ActiviteRNA {
  id: string
  ordre: number | null
  date_activite: string
  responsable: string | null
  type_activite: string | null
  lieu: string | null
  heure_debut: string | null
  heure_fin: string | null
  duree_minutes: number | null
  effectif: number
  hommes: number
  femmes: number
  enfants: number
  comptage: string | null
  notes: string | null
  auteur_id: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface JournalEvenement {
  id: string
  auteur_id: string | null
  module: string
  action: string
  entite_id: string | null
  description: string | null
  anciennes_valeurs: Record<string, unknown> | null
  nouvelles_valeurs: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  profils?: Profil
}

export interface ListeParametrable {
  id: string
  categorie: string
  valeur: string
  ordre: number
  actif: boolean
  created_at: string
  updated_at: string
}
