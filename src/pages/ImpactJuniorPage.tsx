import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit2, Loader, Download, Eye, Users, Baby, Calendar, Phone, GraduationCap, User, Clock } from 'lucide-react'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel } from '../lib/export'

type Onglet = 'enfants' | 'cultes'

const CLASSES_SCOLAIRES = [
  'Maternelle', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale',
  'Université / Supérieur', 'Hors scolarité',
]

const emptyEnfant = {
  prenom: '', nom: '', date_naissance: '', nom_parent_tuteur: '',
  telephone_parent: '', classe_scolaire: '', notes: '',
}

const emptyCulte = {
  date_activite: '', heure_debut: '', heure_fin: '',
  nb_moniteurs: '', nb_monitrices: '',
  garcons: '', filles: '', visiteurs: '',
  theme: '', comptage: '',
}

const COLS_ENFANTS = [
  { header: 'Prénom', key: 'prenom' },
  { header: 'Nom', key: 'nom' },
  { header: 'Date naissance', key: 'date_naissance' },
  { header: 'Âge', key: '_age' },
  { header: 'Parent / Tuteur', key: 'nom_parent_tuteur' },
  { header: 'Téléphone parent', key: 'telephone_parent' },
  { header: 'Classe scolaire', key: 'classe_scolaire' },
  { header: 'Notes', key: 'notes' },
]

const COLS_CULTES = [
  { header: 'N°', key: 'ordre' },
  { header: 'Date', key: '_date_fmt' },
  { header: 'Heure début', key: 'heure_debut' },
  { header: 'Heure fin', key: 'heure_fin' },
  { header: 'Durée (min)', key: '_duree' },
  { header: 'Moniteurs', key: 'nb_moniteurs' },
  { header: 'Monitrices', key: 'nb_monitrices' },
  { header: 'Garçons', key: 'garcons' },
  { header: 'Filles', key: 'filles' },
  { header: 'Total enfants', key: '_total' },
  { header: 'Visiteurs', key: 'visiteurs' },
  { header: 'Thème', key: 'theme' },
  { header: 'Comptage', key: 'comptage' },
]

// Calcul de l'âge à partir d'une date de naissance
function calcAge(dateNaissance: string): string {
  if (!dateNaissance) return '-'
  const dn = new Date(dateNaissance)
  const now = new Date()
  let age = now.getFullYear() - dn.getFullYear()
  const m = now.getMonth() - dn.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dn.getDate())) age--
  return `${age} ans`
}

// Calcul durée en minutes entre deux heures HH:MM
function calcDuree(debut: string, fin: string): number {
  if (!debut || !fin) return 0
  const [h1, m1] = debut.split(':').map(Number)
  const [h2, m2] = fin.split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1))
}

export default function ImpactJuniorPage() {
  const { user, hasPermission } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('enfants')

  // ─── ENFANTS ───────────────────────────────────────────────────────────────
  const [enfants, setEnfants] = useState<any[]>([])
  const [loadingEnfants, setLoadingEnfants] = useState(true)
  const [enfantModal, setEnfantModal] = useState(false)
  const [enfantEditing, setEnfantEditing] = useState<any | null>(null)
  const [enfantForm, setEnfantForm] = useState({ ...emptyEnfant })
  const [enfantSaving, setEnfantSaving] = useState(false)
  const [enfantViewing, setEnfantViewing] = useState<any | null>(null)
  const [confirmDeleteEnfant, setConfirmDeleteEnfant] = useState<any | null>(null)

  // ─── CULTES ────────────────────────────────────────────────────────────────
  const [cultes, setCultes] = useState<any[]>([])
  const [loadingCultes, setLoadingCultes] = useState(true)
  const [culteModal, setCulteModal] = useState(false)
  const [culteEditing, setCulteEditing] = useState<any | null>(null)
  const [culteForm, setCulteForm] = useState({ ...emptyCulte })
  const [culteSaving, setCulteSaving] = useState(false)
  const [culteViewing, setCulteViewing] = useState<any | null>(null)
  const [confirmDeleteCulte, setConfirmDeleteCulte] = useState<any | null>(null)

  // ─── Chargement ───────────────────────────────────────────────────────────
  useEffect(() => { loadEnfants() }, [])
  useEffect(() => { loadCultes() }, [])

  async function loadEnfants() {
    setLoadingEnfants(true)
    const { data, error } = await supabase
      .from('impact_junior_enfants')
      .select('*')
      .eq('actif', true)
      .order('nom')
    if (error) toast.error('Erreur chargement enfants')
    else setEnfants(data || [])
    setLoadingEnfants(false)
  }

  async function loadCultes() {
    setLoadingCultes(true)
    const { data, error } = await supabase
      .from('activites_impact_junior')
      .select('*')
      .eq('actif', true)
      .order('ordre', { ascending: false })
    if (error) toast.error('Erreur chargement cultes IJ')
    else setCultes(data || [])
    setLoadingCultes(false)
  }

  // ─── ENFANTS : CRUD ────────────────────────────────────────────────────────
  function openAddEnfant() {
    setEnfantEditing(null)
    setEnfantForm({ ...emptyEnfant })
    setEnfantModal(true)
  }

  function openEditEnfant(e: any) {
    setEnfantEditing(e)
    setEnfantForm({
      prenom: e.prenom || '',
      nom: e.nom || '',
      date_naissance: e.date_naissance || '',
      nom_parent_tuteur: e.nom_parent_tuteur || '',
      telephone_parent: e.telephone_parent || '',
      classe_scolaire: e.classe_scolaire || '',
      notes: e.notes || '',
    })
    setEnfantModal(true)
  }

  async function saveEnfant() {
    if (!enfantForm.prenom.trim() || !enfantForm.nom.trim()) {
      toast.error('Prénom et Nom sont obligatoires')
      return
    }
    setEnfantSaving(true)
    const payload = {
      prenom: enfantForm.prenom.trim(),
      nom: enfantForm.nom.trim(),
      date_naissance: enfantForm.date_naissance || null,
      nom_parent_tuteur: enfantForm.nom_parent_tuteur.trim() || null,
      telephone_parent: enfantForm.telephone_parent.trim() || null,
      classe_scolaire: enfantForm.classe_scolaire || null,
      notes: enfantForm.notes.trim() || null,
    }
    if (enfantEditing) {
      const { error } = await supabase
        .from('impact_junior_enfants')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', enfantEditing.id)
      if (error) { toast.error('Erreur modification enfant : ' + error.message); setEnfantSaving(false); return }
      toast.success('Enfant modifié')
      await logEvent('impact_junior_enfants', 'modification', `${enfantForm.prenom} ${enfantForm.nom} modifié`, enfantEditing.id)
    } else {
      const { error } = await supabase
        .from('impact_junior_enfants')
        .insert({ ...payload, actif: true, auteur_id: user?.id })
      if (error) { toast.error('Erreur ajout enfant : ' + error.message); setEnfantSaving(false); return }
      toast.success('Enfant ajouté')
      await logEvent('impact_junior_enfants', 'creation', `${enfantForm.prenom} ${enfantForm.nom} ajouté`)
    }
    setEnfantSaving(false)
    setEnfantModal(false)
    loadEnfants()
  }

  async function deleteEnfant(e: any) {
    const { error } = await supabase
      .from('impact_junior_enfants')
      .update({ actif: false, updated_at: new Date().toISOString() })
      .eq('id', e.id)
    if (error) { toast.error('Erreur suppression'); return }
    toast.success('Enfant retiré')
    await logEvent('impact_junior_enfants', 'suppression', `${e.prenom} ${e.nom} retiré`, e.id)
    setConfirmDeleteEnfant(null)
    loadEnfants()
  }

  // ─── CULTES : CRUD ─────────────────────────────────────────────────────────
  function openAddCulte() {
    setCulteEditing(null)
    setCulteForm({ ...emptyCulte })
    setCulteModal(true)
  }

  function openEditCulte(c: any) {
    setCulteEditing(c)
    setCulteForm({
      date_activite: c.date_activite || '',
      heure_debut: c.heure_debut || '',
      heure_fin: c.heure_fin || '',
      nb_moniteurs: c.nb_moniteurs != null ? String(c.nb_moniteurs) : '',
      nb_monitrices: c.nb_monitrices != null ? String(c.nb_monitrices) : '',
      garcons: c.garcons != null ? String(c.garcons) : '',
      filles: c.filles != null ? String(c.filles) : '',
      visiteurs: c.visiteurs != null ? String(c.visiteurs) : '',
      theme: c.theme || '',
      comptage: c.comptage || '',
    })
    setCulteModal(true)
  }

  async function saveCulte() {
    if (!culteForm.date_activite) {
      toast.error('La date est obligatoire')
      return
    }
    setCulteSaving(true)

    // Calcul ordre auto (max + 1)
    let ordre = 1
    if (!culteEditing && cultes.length > 0) {
      const maxOrdre = Math.max(...cultes.map(c => c.ordre || 0))
      ordre = maxOrdre + 1
    } else if (culteEditing) {
      ordre = culteEditing.ordre
    }

    const g = parseInt(culteForm.garcons) || 0
    const f = parseInt(culteForm.filles) || 0
    const duree = calcDuree(culteForm.heure_debut, culteForm.heure_fin)

    const payload = {
      date_activite: culteForm.date_activite,
      heure_debut: culteForm.heure_debut || null,
      heure_fin: culteForm.heure_fin || null,
      duree_minutes: duree || null,
      nb_moniteurs: parseInt(culteForm.nb_moniteurs) || 0,
      nb_monitrices: parseInt(culteForm.nb_monitrices) || 0,
      garcons: g,
      filles: f,
      visiteurs: parseInt(culteForm.visiteurs) || 0,
      theme: culteForm.theme.trim() || null,
      comptage: culteForm.comptage.trim() || null,
    }

    if (culteEditing) {
      const { error } = await supabase
        .from('activites_impact_junior')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', culteEditing.id)
      if (error) { toast.error('Erreur modification culte : ' + error.message); setCulteSaving(false); return }
      toast.success('Culte IJ modifié')
      await logEvent('activites_impact_junior', 'modification', `Culte IJ modifié du ${culteForm.date_activite}`, culteEditing.id)
    } else {
      const { error } = await supabase
        .from('activites_impact_junior')
        .insert({ ...payload, ordre, actif: true, auteur_id: user?.id })
      if (error) { toast.error('Erreur ajout culte : ' + error.message); setCulteSaving(false); return }
      toast.success('Culte IJ ajouté')
      await logEvent('activites_impact_junior', 'creation', `Culte IJ ajouté du ${culteForm.date_activite}`)
    }
    setCulteSaving(false)
    setCulteModal(false)
    loadCultes()
  }

  async function deleteCulte(c: any) {
    const { error } = await supabase
      .from('activites_impact_junior')
      .update({ actif: false, updated_at: new Date().toISOString() })
      .eq('id', c.id)
    if (error) { toast.error('Erreur suppression'); return }
    toast.success('Culte retiré')
    await logEvent('activites_impact_junior', 'suppression', `Culte IJ supprimé`, c.id)
    setConfirmDeleteCulte(null)
    loadCultes()
  }

  // ─── EXPORTS ───────────────────────────────────────────────────────────────
  function exportEnfants() {
    const rows = enfants.map(e => ({
      ...e,
      _age: calcAge(e.date_naissance),
    }))
    exportExcel('Impact Junior — Enfants', COLS_ENFANTS, rows)
    toast.success('Export Excel généré')
  }

  function exportCultes() {
    const rows = cultes.map(c => ({
      ...c,
      _date_fmt: c.date_activite ? format(new Date(c.date_activite), 'dd/MM/yyyy') : '-',
      _duree: calcDuree(c.heure_debut, c.heure_fin) || c.duree_minutes || '-',
      _total: (parseInt(c.garcons) || 0) + (parseInt(c.filles) || 0),
    }))
    exportExcel('Impact Junior — Cultes', COLS_CULTES, rows)
    toast.success('Export Excel généré')
  }

  // ─── PAGINATION ────────────────────────────────────────────────────────────
  const PAGE_SIZE = 25
  const [pageEnfants, setPageEnfants] = useState(1)
  const [pageCultes, setPageCultes] = useState(1)
  const paginatedEnfants = enfants.slice((pageEnfants - 1) * PAGE_SIZE, pageEnfants * PAGE_SIZE)
  const paginatedCultes = cultes.slice((pageCultes - 1) * PAGE_SIZE, pageCultes * PAGE_SIZE)

  // ─── STATS ─────────────────────────────────────────────────────────────────
  const totalEnfants = enfants.length
  const totalCultes = cultes.length
  const totalGarcons = cultes.reduce((s, c) => s + (parseInt(c.garcons) || 0), 0)
  const totalFilles = cultes.reduce((s, c) => s + (parseInt(c.filles) || 0), 0)
  const moyenneFreq = totalCultes > 0
    ? Math.round((totalGarcons + totalFilles) / totalCultes)
    : 0

  // ─── RENDU ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Baby size={24} className="text-yellow-500" />
            Impact Junior
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des enfants et des cultes Impact Junior</p>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-yellow-50 border border-yellow-200">
          <p className="text-xs text-yellow-600 font-medium uppercase">Enfants inscrits</p>
          <p className="text-3xl font-bold text-yellow-700">{totalEnfants}</p>
        </div>
        <div className="card bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-600 font-medium uppercase">Cultes organisés</p>
          <p className="text-3xl font-bold text-blue-700">{totalCultes}</p>
        </div>
        <div className="card bg-green-50 border border-green-200">
          <p className="text-xs text-green-600 font-medium uppercase">Moy. fréquentation</p>
          <p className="text-3xl font-bold text-green-700">{moyenneFreq}</p>
        </div>
        <div className="card bg-purple-50 border border-purple-200">
          <p className="text-xs text-purple-600 font-medium uppercase">Total présentiel</p>
          <p className="text-3xl font-bold text-purple-700">{totalGarcons + totalFilles}</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-6">
          {([
            { key: 'enfants', label: 'Enfants', icon: <Baby size={16} /> },
            { key: 'cultes', label: 'Cultes Impact Junior', icon: <Users size={16} /> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setOnglet(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                onglet === tab.key
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── ONGLET ENFANTS ─── */}
      {onglet === 'enfants' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Enfants ({totalEnfants})
            </h2>
            <div className="flex gap-2">
              {hasPermission('impact_junior', 'export') && (
                <button onClick={exportEnfants} className="btn btn-secondary flex items-center gap-2">
                  <Download size={16} /> Export Excel
                </button>
              )}
              {hasPermission('impact_junior', 'create') && (
                <button onClick={openAddEnfant} className="btn btn-primary flex items-center gap-2">
                  <Plus size={16} /> Ajouter un enfant
                </button>
              )}
            </div>
          </div>

          {loadingEnfants ? (
            <div className="flex justify-center py-12">
              <Loader size={32} className="animate-spin text-yellow-500" />
            </div>
          ) : enfants.length === 0 ? (
            <EmptyState
              icon={Baby}
              title="Aucun enfant enregistré"
              description="Commencez par ajouter le premier enfant Impact Junior."
              action={hasPermission('impact_junior', 'create') ? (
                <button onClick={openAddEnfant} className="btn-primary"><Plus size={16} /> Ajouter un enfant</button>
              ) : undefined}
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Prénom & Nom', 'Date naissance', 'Âge', 'Parent / Tuteur', 'Tél. parent', 'Classe', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedEnfants.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {e.prenom} {e.nom}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {e.date_naissance ? format(new Date(e.date_naissance), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{calcAge(e.date_naissance)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.nom_parent_tuteur || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.telephone_parent || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {e.classe_scolaire ? (
                          <span className="badge badge-blue">{e.classe_scolaire}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEnfantViewing(e)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Voir"
                          >
                            <Eye size={16} />
                          </button>
                          {hasPermission('impact_junior', 'update') && (
                            <button
                              onClick={() => openEditEnfant(e)}
                              className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                              title="Modifier"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {hasPermission('impact_junior', 'delete') && (
                            <button
                              onClick={() => setConfirmDeleteEnfant(e)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Retirer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination total={enfants.length} page={pageEnfants} pageSize={PAGE_SIZE} onPage={setPageEnfants} />
            </div>
          )}
        </div>
      )}

      {/* ─── ONGLET CULTES IJ ─── */}
      {onglet === 'cultes' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Cultes Impact Junior ({totalCultes})
            </h2>
            <div className="flex gap-2">
              {hasPermission('impact_junior', 'export') && (
                <button onClick={exportCultes} className="btn btn-secondary flex items-center gap-2">
                  <Download size={16} /> Export Excel
                </button>
              )}
              {hasPermission('impact_junior', 'create') && (
                <button onClick={openAddCulte} className="btn btn-primary flex items-center gap-2">
                  <Plus size={16} /> Ajouter un culte
                </button>
              )}
            </div>
          </div>

          {loadingCultes ? (
            <div className="flex justify-center py-12">
              <Loader size={32} className="animate-spin text-yellow-500" />
            </div>
          ) : cultes.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun culte IJ enregistré"
              description="Commencez par ajouter le premier culte Impact Junior."
              action={hasPermission('impact_junior', 'create') ? (
                <button onClick={openAddCulte} className="btn-primary"><Plus size={16} /> Ajouter un culte</button>
              ) : undefined}
            />
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['N°', 'Date', 'Horaires', 'Durée', 'Moniteurs', 'Présents (G/F/Total)', 'Visiteurs', 'Thème', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedCultes.map(c => {
                    const total = (parseInt(c.garcons) || 0) + (parseInt(c.filles) || 0)
                    const duree = c.duree_minutes || calcDuree(c.heure_debut, c.heure_fin)
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="badge badge-gray">#{c.ordre}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {c.date_activite ? format(new Date(c.date_activite), 'dd MMM yyyy', { locale: fr }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {c.heure_debut ? `${c.heure_debut}` : '-'}
                          {c.heure_fin ? ` → ${c.heure_fin}` : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {duree ? `${duree} min` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(parseInt(c.nb_moniteurs) || 0) + (parseInt(c.nb_monitrices) || 0)}
                          <span className="text-xs text-gray-400 ml-1">
                            ({c.nb_moniteurs || 0}H/{c.nb_monitrices || 0}F)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-semibold text-yellow-700">{total}</span>
                          <span className="text-gray-400 ml-1 text-xs">
                            ({c.garcons || 0}G / {c.filles || 0}F)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{c.visiteurs || 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">
                          {c.theme || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCulteViewing(c)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Voir"
                            >
                              <Eye size={16} />
                            </button>
                            {hasPermission('impact_junior', 'update') && (
                              <button
                                onClick={() => openEditCulte(c)}
                                className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                                title="Modifier"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {hasPermission('impact_junior', 'delete') && (
                              <button
                                onClick={() => setConfirmDeleteCulte(c)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Supprimer"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Pagination total={cultes.length} page={pageCultes} pageSize={PAGE_SIZE} onPage={setPageCultes} />
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODALS ENFANTS
      ══════════════════════════════════════════════════════════ */}

      {/* Modal Ajouter/Modifier Enfant */}
      <Modal
        isOpen={enfantModal}
        onClose={() => setEnfantModal(false)}
        title={enfantEditing ? 'Modifier l\'enfant' : 'Ajouter un enfant'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prénom <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input"
                value={enfantForm.prenom}
                onChange={ev => setEnfantForm(f => ({ ...f, prenom: ev.target.value }))}
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="label">Nom <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input"
                value={enfantForm.nom}
                onChange={ev => setEnfantForm(f => ({ ...f, nom: ev.target.value }))}
                placeholder="Nom de famille"
              />
            </div>
          </div>

          <div>
            <label className="label">Date de naissance</label>
            <input
              type="date"
              className="input"
              value={enfantForm.date_naissance}
              onChange={ev => setEnfantForm(f => ({ ...f, date_naissance: ev.target.value }))}
            />
            {enfantForm.date_naissance && (
              <p className="text-xs text-gray-500 mt-1">Âge : {calcAge(enfantForm.date_naissance)}</p>
            )}
          </div>

          <div>
            <label className="label">Nom du parent / tuteur</label>
            <input
              type="text"
              className="input"
              value={enfantForm.nom_parent_tuteur}
              onChange={ev => setEnfantForm(f => ({ ...f, nom_parent_tuteur: ev.target.value }))}
              placeholder="Nom complet"
            />
          </div>

          <div>
            <label className="label">Téléphone du parent</label>
            <input
              type="tel"
              className="input"
              value={enfantForm.telephone_parent}
              onChange={ev => setEnfantForm(f => ({ ...f, telephone_parent: ev.target.value }))}
              placeholder="+243..."
            />
          </div>

          <div>
            <label className="label">Classe scolaire</label>
            <select
              className="input"
              value={enfantForm.classe_scolaire}
              onChange={ev => setEnfantForm(f => ({ ...f, classe_scolaire: ev.target.value }))}
            >
              <option value="">-- Sélectionner --</option>
              {CLASSES_SCOLAIRES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={3}
              value={enfantForm.notes}
              onChange={ev => setEnfantForm(f => ({ ...f, notes: ev.target.value }))}
              placeholder="Remarques éventuelles..."
            />
          </div>

          <p className="text-xs text-slate-400 mt-1"><span className="text-red-500">*</span> Champ obligatoire</p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEnfantModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={saveEnfant} disabled={enfantSaving} className="btn-primary flex items-center gap-2">
              {enfantSaving && <Loader size={14} className="animate-spin" />}
              {enfantEditing ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Visualiser Enfant */}
      <Modal
        isOpen={!!enfantViewing}
        onClose={() => setEnfantViewing(null)}
        title=""
        size="md"
      >
        {enfantViewing && (
          <div className="-m-4 -mt-4">
            {/* Header rose/pink */}
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {enfantViewing.prenom?.[0]?.toUpperCase()}{enfantViewing.nom?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{enfantViewing.prenom} {enfantViewing.nom}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-pink-100 text-sm flex items-center gap-1">
                      <Baby size={14} /> {calcAge(enfantViewing.date_naissance)}
                    </span>
                    {enfantViewing.classe_scolaire && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-white text-xs font-medium">
                        {enfantViewing.classe_scolaire}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* Contenu */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-pink-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-pink-400 font-medium flex items-center gap-1"><Calendar size={11} /> Date de naissance</p>
                  <p className="font-semibold text-pink-900 text-sm mt-0.5">
                    {enfantViewing.date_naissance ? format(new Date(enfantViewing.date_naissance), 'dd/MM/yyyy') : '—'}
                  </p>
                </div>
                <div className="bg-pink-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-pink-400 font-medium flex items-center gap-1"><Clock size={11} /> Âge</p>
                  <p className="font-semibold text-pink-900 text-sm mt-0.5">{calcAge(enfantViewing.date_naissance)}</p>
                </div>
                <div className="bg-rose-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-rose-400 font-medium flex items-center gap-1"><User size={11} /> Parent / Tuteur</p>
                  <p className="font-semibold text-rose-900 text-sm mt-0.5">{enfantViewing.nom_parent_tuteur || '—'}</p>
                </div>
                <div className="bg-rose-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-rose-400 font-medium flex items-center gap-1"><Phone size={11} /> Téléphone parent</p>
                  <p className="font-semibold text-rose-900 text-sm mt-0.5">{enfantViewing.telephone_parent || '—'}</p>
                </div>
                <div className="bg-pink-50 rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-xs text-pink-400 font-medium flex items-center gap-1"><GraduationCap size={11} /> Classe scolaire</p>
                  <p className="font-semibold text-pink-900 text-sm mt-0.5">{enfantViewing.classe_scolaire || '—'}</p>
                </div>
              </div>
              {enfantViewing.notes && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium">Notes</p>
                  <p className="text-gray-700 text-sm mt-0.5">{enfantViewing.notes}</p>
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button onClick={() => setEnfantViewing(null)} className="btn-secondary">Fermer</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Enfant */}
      <ConfirmDialog
        open={!!confirmDeleteEnfant}
        onClose={() => setConfirmDeleteEnfant(null)}
        onConfirm={() => confirmDeleteEnfant && deleteEnfant(confirmDeleteEnfant)}
        title="Retirer un enfant"
        message={confirmDeleteEnfant ? `Retirer ${confirmDeleteEnfant.prenom} ${confirmDeleteEnfant.nom} de la liste Impact Junior ?` : ''}
        confirmLabel="Retirer"
        danger
      />

      {/* ══════════════════════════════════════════════════════════
          MODALS CULTES
      ══════════════════════════════════════════════════════════ */}

      {/* Modal Ajouter/Modifier Culte */}
      <Modal
        isOpen={culteModal}
        onClose={() => setCulteModal(false)}
        title={culteEditing ? 'Modifier le culte IJ' : 'Ajouter un culte Impact Junior'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              className="input"
              value={culteForm.date_activite}
              onChange={ev => setCulteForm(f => ({ ...f, date_activite: ev.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Heure début</label>
              <input
                type="time"
                className="input"
                value={culteForm.heure_debut}
                onChange={ev => setCulteForm(f => ({ ...f, heure_debut: ev.target.value }))}
              />
            </div>
            <div>
              <label className="label">Heure fin</label>
              <input
                type="time"
                className="input"
                value={culteForm.heure_fin}
                onChange={ev => setCulteForm(f => ({ ...f, heure_fin: ev.target.value }))}
              />
            </div>
          </div>

          {culteForm.heure_debut && culteForm.heure_fin && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
              ⏱ Durée calculée : <strong>{calcDuree(culteForm.heure_debut, culteForm.heure_fin)} min</strong>
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nb moniteurs (H)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={culteForm.nb_moniteurs}
                onChange={ev => setCulteForm(f => ({ ...f, nb_moniteurs: ev.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Nb monitrices (F)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={culteForm.nb_monitrices}
                onChange={ev => setCulteForm(f => ({ ...f, nb_monitrices: ev.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Garçons</label>
              <input
                type="number"
                min="0"
                className="input"
                value={culteForm.garcons}
                onChange={ev => setCulteForm(f => ({ ...f, garcons: ev.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Filles</label>
              <input
                type="number"
                min="0"
                className="input"
                value={culteForm.filles}
                onChange={ev => setCulteForm(f => ({ ...f, filles: ev.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Total (auto)</label>
              <input
                type="number"
                className="input bg-gray-100"
                readOnly
                value={(parseInt(culteForm.garcons) || 0) + (parseInt(culteForm.filles) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="label">Visiteurs</label>
            <input
              type="number"
              min="0"
              className="input"
              value={culteForm.visiteurs}
              onChange={ev => setCulteForm(f => ({ ...f, visiteurs: ev.target.value }))}
              placeholder="0"
            />
          </div>

          <div>
            <label className="label">Thème / Message</label>
            <input
              type="text"
              className="input"
              value={culteForm.theme}
              onChange={ev => setCulteForm(f => ({ ...f, theme: ev.target.value }))}
              placeholder="Titre du message ou thème abordé"
            />
          </div>

          <div>
            <label className="label">Comptage / Observations</label>
            <textarea
              className="input"
              rows={2}
              value={culteForm.comptage}
              onChange={ev => setCulteForm(f => ({ ...f, comptage: ev.target.value }))}
              placeholder="Notes de comptage ou observations..."
            />
          </div>

          <p className="text-xs text-slate-400 mt-1"><span className="text-red-500">*</span> Champ obligatoire</p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setCulteModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={saveCulte} disabled={culteSaving} className="btn-primary flex items-center gap-2">
              {culteSaving && <Loader size={14} className="animate-spin" />}
              {culteEditing ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Visualiser Culte */}
      <Modal
        isOpen={!!culteViewing}
        onClose={() => setCulteViewing(null)}
        title=""
        size="md"
      >
        {culteViewing && (
          <div className="-m-4 -mt-4">
            {/* Header yellow/amber */}
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xl font-bold text-white shrink-0">
                  #{culteViewing.ordre}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Culte Impact Junior</h2>
                  <p className="text-yellow-100 text-sm mt-0.5">
                    {culteViewing.date_activite ? format(new Date(culteViewing.date_activite), 'EEEE dd MMMM yyyy', { locale: fr }) : '—'}
                  </p>
                  {culteViewing.theme && (
                    <p className="text-yellow-200 text-xs mt-0.5 italic">"{culteViewing.theme}"</p>
                  )}
                </div>
              </div>
            </div>
            {/* Contenu */}
            <div className="p-4 space-y-3">
              {/* Horaires */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-yellow-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-yellow-500 font-medium">Heure début</p>
                  <p className="font-semibold text-yellow-900 text-sm mt-0.5">{culteViewing.heure_debut || '—'}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-yellow-500 font-medium">Heure fin</p>
                  <p className="font-semibold text-yellow-900 text-sm mt-0.5">{culteViewing.heure_fin || '—'}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-yellow-500 font-medium">Durée</p>
                  <p className="font-semibold text-yellow-900 text-sm mt-0.5">{culteViewing.duree_minutes ? `${culteViewing.duree_minutes} min` : '—'}</p>
                </div>
              </div>
              {/* Moniteurs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-amber-500 font-medium">Moniteurs (H)</p>
                  <p className="font-semibold text-amber-900 text-sm mt-0.5">{culteViewing.nb_moniteurs ?? 0}</p>
                </div>
                <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-amber-500 font-medium">Monitrices (F)</p>
                  <p className="font-semibold text-amber-900 text-sm mt-0.5">{culteViewing.nb_monitrices ?? 0}</p>
                </div>
              </div>
              {/* Statistiques enfants */}
              <div className="grid grid-cols-4 gap-2 bg-yellow-50 rounded-xl p-3 text-center">
                <div>
                  <p className="text-xl font-bold text-blue-600">{culteViewing.garcons ?? 0}</p>
                  <p className="text-xs text-yellow-500">Garçons</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-pink-500">{culteViewing.filles ?? 0}</p>
                  <p className="text-xs text-yellow-500">Filles</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-yellow-700">{(parseInt(culteViewing.garcons) || 0) + (parseInt(culteViewing.filles) || 0)}</p>
                  <p className="text-xs text-yellow-500">Total</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-green-600">{culteViewing.visiteurs ?? 0}</p>
                  <p className="text-xs text-yellow-500">Visiteurs</p>
                </div>
              </div>
              {culteViewing.comptage && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium">Comptage / Observations</p>
                  <p className="text-gray-700 text-sm mt-0.5">{culteViewing.comptage}</p>
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button onClick={() => setCulteViewing(null)} className="btn-secondary">Fermer</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Culte */}
      <ConfirmDialog
        open={!!confirmDeleteCulte}
        onClose={() => setConfirmDeleteCulte(null)}
        onConfirm={() => confirmDeleteCulte && deleteCulte(confirmDeleteCulte)}
        title="Supprimer un culte"
        message={confirmDeleteCulte ? `Supprimer le culte du ${confirmDeleteCulte.date_activite ? format(new Date(confirmDeleteCulte.date_activite), 'dd/MM/yyyy') : '—'} ?` : ''}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
