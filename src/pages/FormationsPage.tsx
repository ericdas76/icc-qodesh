import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, Eye, Edit2, Trash2, BookOpen, Users,
  GraduationCap, Lock, List, Download, Save, Loader, Unlock, CalendarDays, Layers
} from 'lucide-react'
import SeancesModal from '../components/SeancesModal'
import { exportExcel } from '../lib/export'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'

const PAGE_SIZE = 25

type Onglet = 'promotions' | 'types' | 'en_cours' | 'cloturees' | 'formation_pluri'

const ONGLETS: { id: Onglet; label: string; icon: React.ReactNode }[] = [
  { id: 'promotions',      label: 'Promotions',           icon: <List size={15} /> },
  { id: 'types',           label: 'Types de classes',      icon: <BookOpen size={15} /> },
  { id: 'en_cours',        label: 'Classes en cours',      icon: <GraduationCap size={15} /> },
  { id: 'cloturees',       label: 'Classes clôturées',     icon: <Lock size={15} /> },
  { id: 'formation_pluri', label: 'Formation Pluri',       icon: <Layers size={15} /> },
]

// ─── Colonnes export Formation Pluri ─────────────────────────────────────────
const COLS_EXPORT_FP = [
  { header: 'N°', key: 'numero', width: 14 },
  { header: 'Type formation', key: 'formation_type', width: 22 },
  { header: 'Date', key: 'date_seance', width: 14 },
  { header: 'Orateur', key: 'orateur', width: 22 },
  { header: 'Traducteur', key: 'traducteur', width: 20 },
  { header: 'Thématique', key: 'thematique', width: 28 },
  { header: 'Hommes', key: 'nb_homme', width: 10 },
  { header: 'Femmes', key: 'nb_femme', width: 10 },
  { header: 'Apprenants', key: 'nb_apprenant', width: 12 },
  { header: 'Proch. séance', key: 'date_prochaine_seance', width: 16 },
  { header: 'Observations', key: 'obs', width: 30 },
]

// ─── Génération code classe : {code_pcnc_slug}-{slug_promo}-{annee} ─────────
function genCodeClasse(codePcnc: string, promoNom: string, annee: number): string {
  const slugPcnc = codePcnc.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '').slice(0, 8)
  const slugPromo = promoNom.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return `${slugPcnc}-${slugPromo}-${annee}`
}

// ─── Formatage date JJ/MM/AAAA ────────────────────────────────────────────
function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: fr }) } catch { return d }
}

// ─── Formulaire promotion vide ────────────────────────────────────────────
const EMPTY_PROMO = { nom: '', date_promotion: '' }

// =========================================================================
// COMPOSANT PRINCIPAL
// =========================================================================
export default function FormationsPage() {
  const { hasPermission } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('promotions')

  // Données partagées
  const [promotions, setPromotions]   = useState<any[]>([])
  const [formations, setFormations]   = useState<any[]>([])
  const [typesPcnc,  setTypesPcnc]    = useState<any[]>([])

  const canCreate = hasPermission('formations', 'creer')
  const canEdit   = hasPermission('formations', 'modifier')
  const canDelete = hasPermission('formations', 'supprimer')

  useEffect(() => {
    fetchPromotions()
    fetchFormations()
    fetchTypesPcnc()
  }, [])

  const fetchPromotions = async () => {
    const { data } = await supabase
      .from('promotions').select('*')
      .eq('actif', true).order('date_promotion', { ascending: false })
    setPromotions(data || [])
  }

  const fetchFormations = async () => {
    const { data } = await supabase
      .from('formations')
      .select(`
        *,
        promotions(id, nom),
        ejp_formations_pcnc(id, code, libelle, nb_seance, nb_seance_obligatoire),
        enseignant:profils!formations_enseignant_id_fkey(id, nom, prenom),
        assistant:profils!formations_assistant_id_fkey(id, nom, prenom),
        inscriptions_formation(id, statut)
      `)
      .eq('actif', true)
      .order('created_at', { ascending: false })
    setFormations(data || [])
  }

  const fetchTypesPcnc = async () => {
    const { data } = await supabase
      .from('ejp_formations_pcnc')
      .select('*')
      .order('code')
    setTypesPcnc(data || [])
  }

  // ─── Formation Pluri state ───────────────────────────────────────────────
  const [seancesPluri, setSeancesPluri]       = useState<any[]>([])
  const [loadingPluri, setLoadingPluri]       = useState(false)
  const [typesFormPluri, setTypesFormPluri]   = useState<string[]>([])
  const [modalPluri, setModalPluri]           = useState(false)
  const [editPluri, setEditPluri]             = useState<any | null>(null)
  const [viewPluriItem, setViewPluriItem]     = useState<any | null>(null)
  const [viewPluriModal, setViewPluriModal]   = useState(false)
  const [desactPluriDlg, setDesactPluriDlg]   = useState<any | null>(null)
  const [pagePluri, setPagePluri]             = useState(1)
  const [savingPluri, setSavingPluri]         = useState(false)

  // ─── Participants Formation Pluri state ──────────────────────────────────
  const [participantsModal, setParticipantsModal]   = useState(false)
  const [participantsSeance, setParticipantsSeance] = useState<any | null>(null)
  const [participants, setParticipants]             = useState<any[]>([])
  const [loadingPart, setLoadingPart]               = useState(false)
  const [savingPart, setSavingPart]                 = useState(false)
  const emptyPart = { nom: '', prenom: '', sexe: '', telephone: '' }
  const [formPart, setFormPart]                     = useState(emptyPart)

  const fetchParticipants = async (seanceId: string) => {
    setLoadingPart(true)
    const { data } = await supabase
      .from('seances_formation_pluri_participants')
      .select('*')
      .eq('seance_id', seanceId)
      .eq('actif', true)
      .order('created_at', { ascending: true })
    setParticipants(data || [])
    setLoadingPart(false)
  }

  const openParticipants = (s: any) => {
    setParticipantsSeance(s)
    setFormPart(emptyPart)
    setParticipants([])
    setParticipantsModal(true)
    fetchParticipants(s.id)
  }

  const addParticipant = async () => {
    if (!formPart.nom.trim()) { toast.error('Nom requis'); return }
    if (!formPart.prenom.trim()) { toast.error('Prenom requis'); return }
    setSavingPart(true)
    const { error } = await supabase
      .from('seances_formation_pluri_participants')
      .insert({
        seance_id: participantsSeance.id,
        nom: formPart.nom.trim(),
        prenom: formPart.prenom.trim(),
        sexe: formPart.sexe || null,
        telephone: formPart.telephone.trim() || null,
        actif: true,
      })
    if (error) { toast.error('Erreur : ' + error.message); setSavingPart(false); return }
    setFormPart(emptyPart)
    await fetchParticipants(participantsSeance.id)
    setSavingPart(false)
  }

  const removeParticipant = async (id: string) => {
    await supabase
      .from('seances_formation_pluri_participants')
      .update({ actif: false })
      .eq('id', id)
    await fetchParticipants(participantsSeance.id)
  }

  const emptyFP = {
    formation_type: '', date_seance: '', orateur: '', traducteur: '',
    thematique: '', nb_homme: 0, nb_femme: 0, date_prochaine_seance: '', obs: ''
  }
  const [formPluri, setFormPluri] = useState({ ...emptyFP })

  // Auto-calcul nb_apprenant = nb_homme + nb_femme
  const nbApprenantPluri = (Number(formPluri.nb_homme) || 0) + (Number(formPluri.nb_femme) || 0)

  // Fetch données Pluri
  const fetchSeancesPluri = async () => {
    setLoadingPluri(true)
    const { data } = await supabase
      .from('seances_formation_pluri')
      .select('*').eq('actif', true)
      .order('date_seance', { ascending: false })
    setSeancesPluri(data || [])
    setLoadingPluri(false)
  }

  const fetchTypesFormPluri = async () => {
    const { data } = await supabase
      .from('listes_parametrables')
      .select('valeur')
      .eq('categorie', 'type_formation_pluri')
      .eq('actif', true)
      .order('ordre')
    setTypesFormPluri((data || []).map((d: any) => d.valeur))
  }

  // Numéro auto FP-AAAA-nnn
  const genNumeroPLuri = (): string => {
    const annee = new Date().getFullYear()
    const prefix = `FP-${annee}-`
    const existing = seancesPluri
      .map(s => s.numero)
      .filter((n: string) => n && n.startsWith(prefix))
      .map((n: string) => parseInt(n.replace(prefix, ''), 10))
      .filter((n: number) => !isNaN(n))
    const max = existing.length > 0 ? Math.max(...existing) : 0
    return `${prefix}${String(max + 1).padStart(3, '0')}`
  }

  const openAddPluri = () => {
    setEditPluri(null)
    setFormPluri({ ...emptyFP })
    setModalPluri(true)
  }

  const openEditPluri = (s: any) => {
    setEditPluri(s)
    setFormPluri({
      formation_type: s.formation_type || '',
      date_seance: s.date_seance || '',
      orateur: s.orateur || '',
      traducteur: s.traducteur || '',
      thematique: s.thematique || '',
      nb_homme: s.nb_homme || 0,
      nb_femme: s.nb_femme || 0,
      date_prochaine_seance: s.date_prochaine_seance || '',
      obs: s.obs || '',
    })
    setModalPluri(true)
  }

  const savePluri = async () => {
    if (!formPluri.formation_type) { toast.error('Type de formation requis'); return }
    if (!formPluri.date_seance) { toast.error('Date requise'); return }
    setSavingPluri(true)
    const apprenant = (Number(formPluri.nb_homme) || 0) + (Number(formPluri.nb_femme) || 0)
    const payload: any = {
      formation_type: formPluri.formation_type,
      date_seance: formPluri.date_seance,
      orateur: formPluri.orateur || null,
      traducteur: formPluri.traducteur || null,
      thematique: formPluri.thematique || null,
      nb_homme: Number(formPluri.nb_homme) || 0,
      nb_femme: Number(formPluri.nb_femme) || 0,
      nb_apprenant: apprenant,
      date_prochaine_seance: formPluri.date_prochaine_seance || null,
      obs: formPluri.obs || null,
    }
    if (editPluri) {
      const { error } = await supabase.from('seances_formation_pluri').update(payload).eq('id', editPluri.id)
      if (error) { toast.error('Erreur : ' + error.message); setSavingPluri(false); return }
      await logEvent('formations', 'modifier', editPluri.id, `Seance FP modifiee ${editPluri.numero}`)
      toast.success('Seance mise a jour')
    } else {
      const numero = genNumeroPLuri()
      const { data, error } = await supabase.from('seances_formation_pluri')
        .insert({ ...payload, numero, actif: true }).select().single()
      if (error) { toast.error('Erreur : ' + error.message); setSavingPluri(false); return }
      await logEvent('formations', 'creer', data.id, `Seance FP creee ${numero}`)
      toast.success('Seance enregistree (' + numero + ')')
    }
    setSavingPluri(false)
    setModalPluri(false)
    fetchSeancesPluri()
  }

  const desactiverPluri = async () => {
    if (!desactPluriDlg) return
    await supabase.from('seances_formation_pluri').update({ actif: false }).eq('id', desactPluriDlg.id)
    toast.success('Seance desactivee')
    setDesactPluriDlg(null)
    fetchSeancesPluri()
  }

  // Charger les données pluri quand on arrive sur l'onglet
  useEffect(() => {
    if (onglet === 'formation_pluri') {
      fetchSeancesPluri()
      fetchTypesFormPluri()
    }
  }, [onglet])

  const paginatedPluri = seancesPluri.slice((pagePluri - 1) * PAGE_SIZE, pagePluri * PAGE_SIZE)

  // Compteurs pour badges onglets
  const nbEnCours   = formations.filter(f => !f.cloture).length
  const nbCloturees = formations.filter(f => f.cloture).length

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
        <p className="text-gray-500 text-sm mt-0.5">Promotions, types de classes, classes en cours et clôturées</p>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {ONGLETS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setOnglet(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                onglet === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'en_cours' && nbEnCours > 0 && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">
                  {nbEnCours}
                </span>
              )}
              {tab.id === 'cloturees' && nbCloturees > 0 && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-semibold">
                  {nbCloturees}
                </span>
              )}
              {tab.id === 'promotions' && promotions.length > 0 && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                  {promotions.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      {onglet === 'promotions' && (
        <PromotionsTab
          promotions={promotions}
          formations={formations}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          onRefresh={fetchPromotions}
        />
      )}

      {onglet === 'types' && (
        <TypesClassesTab typesPcnc={typesPcnc} />
      )}

      {onglet === 'en_cours' && (
        <ClassesEnCoursTab
          formations={formations.filter(f => !f.cloture)}
          promotions={promotions}
          typesPcnc={typesPcnc}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          onRefresh={fetchFormations}
        />
      )}

      {onglet === 'cloturees' && (
        <ClassesCloatureesTab
          formations={formations.filter(f => f.cloture)}
          onRefresh={fetchFormations}
        />
      )}

      {/* ===== FORMATION PLURI ===== */}
      {onglet === 'formation_pluri' && (
        <div className="space-y-4">
          {/* Barre actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-500">{seancesPluri.length} seance{seancesPluri.length > 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button
                onClick={() => exportExcel('Formation Pluri', COLS_EXPORT_FP, seancesPluri, 'FormationPluri')}
                className="btn-secondary flex items-center gap-1 text-sm">
                <Download size={14} /> Excel
              </button>
              {canCreate && (
                <button onClick={openAddPluri} className="btn-primary flex items-center gap-2">
                  <Plus size={16} /> Ajouter seance
                </button>
              )}
            </div>
          </div>

          {/* Tableau */}
          {loadingPluri ? (
            <div className="flex justify-center h-32 items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
            </div>
          ) : seancesPluri.length === 0 ? (
            <EmptyState icon={Layers} title="Aucune seance enregistree" description="Ajoutez la premiere seance de formation pluridisciplinaire." />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {['N°', 'Type', 'Date', 'Orateur', 'Thematique', 'H', 'F', 'Apprenants', 'Proch. seance', ''].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedPluri.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">{s.numero}</td>
                        <td className="px-3 py-2">
                          <span className="badge bg-indigo-100 text-indigo-700 text-xs">{s.formation_type}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{fmtDate(s.date_seance)}</td>
                        <td className="px-3 py-2 text-slate-700 text-xs">{s.orateur || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs max-w-40 truncate" title={s.thematique || ''}>{s.thematique || '—'}</td>
                        <td className="px-3 py-2 text-center font-semibold text-blue-600">{s.nb_homme ?? 0}</td>
                        <td className="px-3 py-2 text-center font-semibold text-pink-600">{s.nb_femme ?? 0}</td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-800">{s.nb_apprenant ?? 0}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{fmtDate(s.date_prochaine_seance)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setViewPluriItem(s); setViewPluriModal(true) }}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Voir">
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => openParticipants(s)}
                              className="p-1.5 rounded hover:bg-violet-50 text-violet-500" title="Participants">
                              <Users size={13} />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => openEditPluri(s)}
                                className="p-1.5 rounded hover:bg-amber-50 text-amber-500" title="Modifier">
                                <Edit2 size={13} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDesactPluriDlg(s)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Desactiver">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t">
                <Pagination total={seancesPluri.length} page={pagePluri} pageSize={PAGE_SIZE} onPage={setPagePluri} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Ajouter / Modifier Formation Pluri */}
      <Modal
        open={modalPluri}
        onClose={() => setModalPluri(false)}
        title={editPluri ? `Modifier — ${editPluri.numero}` : 'Nouvelle seance Formation Pluri'}
        size="lg">
        <div className="space-y-4">
          {!editPluri && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-blue-500 font-medium">N° attribue automatiquement :</span>
              <span className="font-mono font-bold text-blue-700">{genNumeroPLuri()}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Type de formation <span className="text-red-500">*</span></label>
              <select
                className="input"
                value={formPluri.formation_type}
                onChange={e => setFormPluri(f => ({ ...f, formation_type: e.target.value }))}>
                <option value="">-- Selectionner --</option>
                {typesFormPluri.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date <span className="text-red-500">*</span></label>
              <input
                type="date" className="input"
                value={formPluri.date_seance}
                onChange={e => setFormPluri(f => ({ ...f, date_seance: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date prochaine seance</label>
              <input
                type="date" className="input"
                value={formPluri.date_prochaine_seance}
                onChange={e => setFormPluri(f => ({ ...f, date_prochaine_seance: e.target.value }))} />
            </div>
            <div>
              <label className="label">Orateur</label>
              <input
                className="input"
                value={formPluri.orateur}
                onChange={e => setFormPluri(f => ({ ...f, orateur: e.target.value }))} />
            </div>
            <div>
              <label className="label">Traducteur</label>
              <input
                className="input"
                value={formPluri.traducteur}
                onChange={e => setFormPluri(f => ({ ...f, traducteur: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Thematique</label>
              <input
                className="input"
                value={formPluri.thematique}
                onChange={e => setFormPluri(f => ({ ...f, thematique: e.target.value }))} />
            </div>
            <div>
              <label className="label">Hommes</label>
              <input
                type="number" min={0} className="input"
                value={formPluri.nb_homme}
                onChange={e => setFormPluri(f => ({ ...f, nb_homme: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Femmes</label>
              <input
                type="number" min={0} className="input"
                value={formPluri.nb_femme}
                onChange={e => setFormPluri(f => ({ ...f, nb_femme: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="col-span-2">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Total Apprenants (auto)</span>
                <span className="text-2xl font-bold text-indigo-700">{nbApprenantPluri}</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">Observations</label>
              <textarea
                className="input resize-none min-h-16"
                value={formPluri.obs}
                onChange={e => setFormPluri(f => ({ ...f, obs: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-slate-400"><span className="text-red-500">*</span> Champ obligatoire</p>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button onClick={() => setModalPluri(false)} className="btn-secondary">Annuler</button>
          <button onClick={savePluri} disabled={savingPluri} className="btn-primary">
            {savingPluri && <Loader size={14} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </Modal>

      {/* Modal Vue Formation Pluri */}
      <Modal open={viewPluriModal} onClose={() => setViewPluriModal(false)} title="" size="md">
        {viewPluriItem && (
          <div className="-m-4 -mt-4">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <Layers size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-indigo-200 text-xs font-mono">{viewPluriItem.numero}</p>
                  <h2 className="text-lg font-bold text-white">{viewPluriItem.formation_type}</h2>
                  <p className="text-indigo-100 text-sm">{fmtDate(viewPluriItem.date_seance)}</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: 'Orateur', value: viewPluriItem.orateur || '—', bg: 'bg-indigo-50', text: 'text-indigo-400' },
                  { label: 'Traducteur', value: viewPluriItem.traducteur || '—', bg: 'bg-indigo-50', text: 'text-indigo-400' },
                  { label: 'Prochaine seance', value: fmtDate(viewPluriItem.date_prochaine_seance), bg: 'bg-blue-50', text: 'text-blue-400' },
                  { label: 'Thematique', value: viewPluriItem.thematique || '—', bg: 'bg-slate-50', text: 'text-slate-400' },
                ] as { label: string; value: string; bg: string; text: string }[]).map(item => (
                  <div key={item.label} className={`${item.bg} rounded-xl px-3 py-2.5`}>
                    <p className={`text-xs ${item.text} font-medium`}>{item.label}</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 bg-indigo-50 rounded-xl p-3 text-center">
                <div>
                  <p className="text-xl font-bold text-blue-600">{viewPluriItem.nb_homme ?? 0}</p>
                  <p className="text-xs text-indigo-400">Hommes</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-pink-600">{viewPluriItem.nb_femme ?? 0}</p>
                  <p className="text-xs text-indigo-400">Femmes</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-indigo-700">{viewPluriItem.nb_apprenant ?? 0}</p>
                  <p className="text-xs text-indigo-400">Apprenants</p>
                </div>
              </div>
              {viewPluriItem.obs && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium">Observations</p>
                  <p className="text-gray-700 text-sm mt-0.5">{viewPluriItem.obs}</p>
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button onClick={() => setViewPluriModal(false)} className="btn-secondary">Fermer</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== MODAL PARTICIPANTS FORMATION PLURI ===== */}
      <Modal
        open={participantsModal}
        onClose={() => setParticipantsModal(false)}
        title=""
        size="lg">
        {participantsSeance && (
          <div className="-m-4 -mt-4">
            {/* En-tête violet */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <Users size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-violet-200 text-xs font-mono">{participantsSeance.numero}</p>
                  <h2 className="text-lg font-bold text-white">{participantsSeance.formation_type}</h2>
                  <p className="text-violet-100 text-sm">{fmtDate(participantsSeance.date_seance)}</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">

              {/* Compteur */}
              {!loadingPart && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full">
                    {participants.length} participant{participants.length > 1 ? 's' : ''}
                  </span>
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                    {participants.filter(p => p.sexe === 'M').length} homme{participants.filter(p => p.sexe === 'M').length > 1 ? 's' : ''}
                  </span>
                  <span className="bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full">
                    {participants.filter(p => p.sexe === 'F').length} femme{participants.filter(p => p.sexe === 'F').length > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Liste participants */}
              {loadingPart ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-violet-600" />
                </div>
              ) : participants.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">
                  <Users size={32} className="mx-auto mb-2 text-slate-300" />
                  Aucun participant enregistre
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Prenom</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Nom</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">Sexe</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Telephone</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {participants.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-800">{p.prenom}</td>
                          <td className="px-3 py-2 text-slate-700">{p.nom}</td>
                          <td className="px-3 py-2 text-center">
                            {p.sexe === 'M' ? (
                              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">H</span>
                            ) : p.sexe === 'F' ? (
                              <span className="bg-pink-100 text-pink-700 text-xs font-bold px-2 py-0.5 rounded-full">F</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{p.telephone || '—'}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => removeParticipant(p.id)}
                              className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"
                              title="Retirer">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Formulaire ajout rapide */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Ajouter un participant</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Prenom <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      placeholder="Prenom"
                      value={formPart.prenom}
                      onChange={e => setFormPart(f => ({ ...f, prenom: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Nom <span className="text-red-500">*</span></label>
                    <input
                      className="input"
                      placeholder="Nom"
                      value={formPart.nom}
                      onChange={e => setFormPart(f => ({ ...f, nom: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Sexe</label>
                    <select
                      className="input"
                      value={formPart.sexe}
                      onChange={e => setFormPart(f => ({ ...f, sexe: e.target.value }))}>
                      <option value="">-- Sexe --</option>
                      <option value="M">Homme</option>
                      <option value="F">Femme</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Telephone</label>
                    <input
                      className="input"
                      placeholder="034..."
                      value={formPart.telephone}
                      onChange={e => setFormPart(f => ({ ...f, telephone: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <p className="text-xs text-slate-400"><span className="text-red-500">*</span> Champs obligatoires</p>
                  <button
                    onClick={addParticipant}
                    disabled={savingPart}
                    className="btn-primary flex items-center gap-2">
                    {savingPart
                      ? <Loader size={14} className="animate-spin" />
                      : <Plus size={14} />}
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-2 border-t">
                <button onClick={() => setParticipantsModal(false)} className="btn-secondary">Fermer</button>
              </div>

            </div>
          </div>
        )}
      </Modal>

      {/* Confirm desactiver Formation Pluri */}
      <ConfirmDialog
        open={!!desactPluriDlg}
        onClose={() => setDesactPluriDlg(null)}
        onConfirm={desactiverPluri}
        title="Desactiver cette seance ?"
        message={`Desactiver la seance "${desactPluriDlg?.numero}" ?`}
        confirmLabel="Desactiver"
        danger
      />

    </div>
  )
}

// =========================================================================
// ONGLET 1 — PROMOTIONS (inchangé)
// =========================================================================
function PromotionsTab({
  promotions, formations, canCreate, canEdit, canDelete, onRefresh
}: {
  promotions: any[], formations: any[],
  canCreate: boolean, canEdit: boolean, canDelete: boolean,
  onRefresh: () => void
}) {
  const [page, setPage]               = useState(1)
  const [addModal, setAddModal]       = useState(false)
  const [editModal, setEditModal]     = useState(false)
  const [viewModal, setViewModal]     = useState(false)
  const [editItem, setEditItem]       = useState<any>(null)
  const [viewItem, setViewItem]       = useState<any>(null)
  const [deleteDialog, setDeleteDialog] = useState<any>(null)
  const [form, setForm]               = useState({ ...EMPTY_PROMO })
  const [saving, setSaving]           = useState(false)

  const paginatedPromos = promotions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openAdd = () => { setForm({ ...EMPTY_PROMO }); setAddModal(true) }

  const doAdd = async () => {
    if (!form.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { data, error } = await supabase.from('promotions').insert({
      nom: form.nom.trim(),
      date_promotion: form.date_promotion || null
    }).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('formations', 'creer', data.id, `Promotion créée : ${data.nom}`)
    toast.success('Promotion créée')
    setAddModal(false)
    onRefresh()
  }

  const openEdit = (p: any) => {
    setEditItem(p)
    setForm({ nom: p.nom, date_promotion: p.date_promotion || '' })
    setEditModal(true)
  }

  const doEdit = async () => {
    if (!editItem || !form.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { error } = await supabase.from('promotions').update({
      nom: form.nom.trim(),
      date_promotion: form.date_promotion || null
    }).eq('id', editItem.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('formations', 'modifier', editItem.id, `Promotion modifiée : ${form.nom}`)
    toast.success('Promotion mise à jour')
    setEditModal(false)
    onRefresh()
  }

  const doDelete = async () => {
    if (!deleteDialog) return
    const { error } = await supabase.from('promotions').update({ actif: false }).eq('id', deleteDialog.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Promotion désactivée')
    setDeleteDialog(null)
    onRefresh()
  }

  // promoFormJsx : JSX inline (pas de sous-composant) pour éviter le remontage au re-render
  // Pattern identique à classeFormJsx dans ClassesEnCoursTab
  const promoFormJsx = (
    <div className="space-y-4">
      <div>
        <label className="label">Nom de la promotion *</label>
        <input className="input" value={form.nom}
          onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
          placeholder="Ex : Promo 2025" autoFocus />
      </div>
      <div>
        <label className="label">Date de la promotion</label>
        <input type="date" className="input" value={form.date_promotion}
          onChange={e => setForm(f => ({ ...f, date_promotion: e.target.value }))} />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate && (
          <button onClick={openAdd} className="btn btn-primary flex items-center gap-2">
            <Plus size={16} /> Nouvelle promotion
          </button>
        )}
      </div>

      {promotions.length === 0 ? (
        <EmptyState icon={BookOpen} title="Aucune promotion" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedPromos.map(p => {
              const nbClasses = formations.filter(f => f.promotion_id === p.id).length
              return (
                <div key={p.id} className="card hover:shadow-md transition-shadow p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900">{p.nom}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                      {nbClasses} classe{nbClasses > 1 ? 's' : ''}
                    </span>
                  </div>
                  {p.date_promotion && (
                    <p className="text-sm text-gray-500 mb-3">
                      {format(new Date(p.date_promotion), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  )}
                  <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                    <button onClick={() => { setViewItem(p); setViewModal(true) }}
                      className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Voir">
                      <Eye size={15} />
                    </button>
                    {canEdit && (
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                        <Edit2 size={15} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeleteDialog(p)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500 ml-auto" title="Désactiver">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <Pagination total={promotions.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}

      {/* Modal Ajouter */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Nouvelle promotion" size="md">
        {promoFormJsx}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doAdd} disabled={saving} className="btn btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* Modal Modifier */}
      <Modal open={editModal} onClose={() => setEditModal(false)}
        title={`Modifier — ${editItem?.nom}`} size="md">
        {promoFormJsx}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doEdit} disabled={saving} className="btn btn-primary">
            {saving ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>
      </Modal>

      {/* Modal Voir */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="" size="md">
        {viewItem && (
          <div className="-m-4 -mt-4">
            {/* En-tête violet */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <GraduationCap size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{viewItem.nom}</h2>
                  {viewItem.date_promotion && (
                    <p className="text-white/80 text-sm mt-0.5">
                      {format(new Date(viewItem.date_promotion), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Stats */}
            <div className="px-5 pt-4 pb-3">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-violet-50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-2xl font-bold text-violet-700">{formations.filter(f => f.promotion_id === viewItem.id).length}</p>
                  <p className="text-xs text-violet-400 font-medium">Classes associées</p>
                </div>
                <div className="bg-violet-50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-2xl font-bold text-violet-700">{formations.filter(f => f.promotion_id === viewItem.id && !f.cloture).length}</p>
                  <p className="text-xs text-violet-400 font-medium">En cours</p>
                </div>
              </div>
              {/* Liste classes */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Classes</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {formations.filter(f => f.promotion_id === viewItem.id).length === 0
                  ? <p className="text-xs text-gray-400 py-2">Aucune classe</p>
                  : formations.filter(f => f.promotion_id === viewItem.id).map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg bg-gray-50">
                      <span className="font-mono text-violet-700 text-xs font-bold">{f.code || '—'}</span>
                      <span className="text-gray-600 flex-1">
                        {f.ejp_formations_pcnc?.code ? `${f.ejp_formations_pcnc.code} — ${f.ejp_formations_pcnc.libelle || ''}` : f.classe || '—'}
                      </span>
                      {f.cloture && <span className="text-xs bg-gray-200 text-gray-500 rounded px-1.5 py-0.5">Clôturée</span>}
                    </div>
                  ))
                }
              </div>
            </div>
            <div className="px-5 pb-4 flex justify-end border-t border-gray-100 pt-3">
              <button onClick={() => setViewModal(false)} className="btn btn-secondary text-sm">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm désactivation */}
      <ConfirmDialog
        open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={doDelete}
        title="Désactiver la promotion"
        message={`Désactiver "${deleteDialog?.nom}" ? Les classes associées resteront visibles.`}
        confirmLabel="Désactiver" danger={true}
      />
    </div>
  )
}

// =========================================================================
// ONGLET 2 — TYPES DE CLASSES DISPONIBLES (lecture seule)
// =========================================================================
function TypesClassesTab({ typesPcnc }: { typesPcnc: any[] }) {
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-700">Types de classes disponibles</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Source : Administration → Listes EJP → Formations PCNC · {typesPcnc.length} type{typesPcnc.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {typesPcnc.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <BookOpen size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucun type de classe configuré</p>
            <p className="text-xs mt-1">Allez dans Administration → Listes EJP → Formations PCNC</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Libellé</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Nb séances</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Nb séances obligatoires</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {typesPcnc.map(t => (
                  <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${!t.actif ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-purple-700">{t.code}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{t.libelle || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      {t.nb_seance != null
                        ? <span className="font-medium text-gray-800">{t.nb_seance}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.nb_seance_obligatoire != null
                        ? <span className="font-medium text-gray-800">{t.nb_seance_obligatoire}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.actif
                        ? <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-medium">✅ Actif</span>
                        : <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 rounded-full px-2.5 py-0.5 font-medium">⛔ Inactif</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// =========================================================================
// ONGLET 3 — CLASSES EN COURS
// =========================================================================

const EMPTY_FORM_CLASSE = {
  formation_pcnc_id: '',
  promotion_id: '',
  nb_seance: '' as string | number,
  nb_seance_obligatoire: '' as string | number,
  date_creation: '',
  annee: new Date().getFullYear(),
  enseignant_nom: '',
  assistant_nom: '',
  nb_femme: 0,
  nb_homme: 0,
  date_fin: '',
  examen_prevu: false,
  nb_redoublant: 0,
  nb_abandon: 0,
  description: '',
  cloture: false,
}

const COLS_EXPORT_CLASSES = [
  { header: 'Code',             key: 'code' },
  { header: 'Type PCNC',        key: '_type_label' },
  { header: 'Promotion',        key: 'promotions.nom' },
  { header: 'Enseignant',       key: '_enseignant_nom' },
  { header: 'Nb femmes',        key: 'nb_femme' },
  { header: 'Nb hommes',        key: 'nb_homme' },
  { header: 'Total inscrits',   key: '_total' },
  { header: 'Séances',          key: 'nb_seance' },
  { header: 'Séances oblig.',   key: 'nb_seance_obligatoire' },
  { header: 'Examen prévu',     key: 'examen_prevu' },
  { header: 'Redoublants',      key: 'nb_redoublant' },
  { header: 'Abandons',         key: 'nb_abandon' },
  { header: 'Date fin',         key: 'date_fin' },
  { header: 'Description',      key: 'description' },
]

function ClassesEnCoursTab({
  formations, promotions, typesPcnc,
  canCreate, canEdit, canDelete, onRefresh
}: {
  formations: any[], promotions: any[], typesPcnc: any[],
  canCreate: boolean, canEdit: boolean, canDelete: boolean,
  onRefresh: () => void
}) {
  const [page, setPage]             = useState(1)
  const [addModal, setAddModal]     = useState(false)
  const [editModal, setEditModal]   = useState(false)
  const [viewModal, setViewModal]   = useState(false)
  const [editItem, setEditItem]     = useState<any>(null)
  const [viewItem, setViewItem]     = useState<any>(null)
  const [deleteDialog, setDeleteDialog] = useState<any>(null)
  const [form, setForm]             = useState<any>({ ...EMPTY_FORM_CLASSE })
  const [saving, setSaving]         = useState(false)
  // (profils fetch supprimé — saisie libre enseignant/assistant)
  // Modal apprenants
  const [apprenantClasse, setApprenantClasse] = useState<any>(null)
  const [apprenantModal,  setApprenantModal]  = useState(false)
  // Modal séances
  const [seanceClasse, setSeanceClasse]       = useState<any>(null)
  const [seanceModal, setSeanceModal]         = useState(false)



  // Pré-remplissage nb_seance / nb_seance_obligatoire selon type choisi
  const handleTypePcncChange = (id: string) => {
    const type = typesPcnc.find(t => t.id === id)
    setForm((f: any) => ({
      ...f,
      formation_pcnc_id: id,
      nb_seance: type?.nb_seance ?? '',
      nb_seance_obligatoire: type?.nb_seance_obligatoire ?? '',
    }))
  }

  // Code auto-généré
  const codePreview = (() => {
    const type  = typesPcnc.find(t => t.id === form.formation_pcnc_id)
    const promo = promotions.find(p => p.id === form.promotion_id)
    if (!type || !promo) return ''
    return genCodeClasse(type.code, promo.nom, form.annee)
  })()

  const openAdd = () => {
    setEditItem(null)
    setForm({ ...EMPTY_FORM_CLASSE })
    setAddModal(true)
  }

  const openEdit = (f: any) => {
    setEditItem(f)
    setForm({
      formation_pcnc_id:       f.formation_pcnc_id    || '',
      promotion_id:            f.promotion_id         || '',
      nb_seance:               f.nb_seance            ?? '',
      nb_seance_obligatoire:   f.nb_seance_obligatoire ?? '',
      date_creation:           f.date_creation        || '',
      annee:                   f.annee                || new Date().getFullYear(),
      enseignant_nom:          f.enseignant_nom       || (f.enseignant ? `${f.enseignant.prenom} ${f.enseignant.nom}`.trim() : ''),
      assistant_nom:           f.assistant_nom        || (f.assistant  ? `${f.assistant.prenom}  ${f.assistant.nom}`.trim()  : ''),
      nb_femme:                f.nb_femme             ?? 0,
      nb_homme:                f.nb_homme             ?? 0,
      date_fin:                f.date_fin             || '',
      examen_prevu:            f.examen_prevu         ?? false,
      nb_redoublant:           f.nb_redoublant        ?? 0,
      nb_abandon:              f.nb_abandon           ?? 0,
      description:             f.description          || '',
      cloture:                 f.cloture              ?? false,
    })
    setEditModal(true)
  }

  const doSave = async (isEdit: boolean) => {
    if (!form.formation_pcnc_id) { toast.error('Type de classe obligatoire'); return }
    if (!form.promotion_id)      { toast.error('Promotion obligatoire'); return }
    setSaving(true)
    try {
      const type  = typesPcnc.find(t => t.id === form.formation_pcnc_id)
      const promo = promotions.find(p => p.id === form.promotion_id)
      const code  = (type && promo) ? genCodeClasse(type.code, promo.nom, form.annee) : null

      const payload: any = {
        formation_pcnc_id:     form.formation_pcnc_id     || null,
        promotion_id:          form.promotion_id           || null,
        code,
        nom:                   promo?.nom                  || '',
        classe:                type?.code                  || '',
        nb_seance:             form.nb_seance !== ''       ? Number(form.nb_seance)              : null,
        nb_seance_obligatoire: form.nb_seance_obligatoire !== '' ? Number(form.nb_seance_obligatoire) : null,
        date_creation:         form.date_creation          || null,
        annee:                 Number(form.annee),
        enseignant_nom:        form.enseignant_nom         || null,
        assistant_nom:         form.assistant_nom          || null,
        nb_femme:              Number(form.nb_femme)       || 0,
        nb_homme:              Number(form.nb_homme)       || 0,
        date_fin:              form.date_fin               || null,
        examen_prevu:          form.examen_prevu,
        nb_redoublant:         Number(form.nb_redoublant)  || 0,
        nb_abandon:            Number(form.nb_abandon)     || 0,
        description:           form.description            || null,
        cloture:               form.cloture,
      }

      if (isEdit && editItem) {
        const { error } = await supabase.from('formations').update(payload).eq('id', editItem.id)
        if (error) throw error
        await logEvent('formations', 'modifier', editItem.id, `Classe modifiée : ${code}`)
        toast.success('Classe mise à jour')
        setEditModal(false)
      } else {
        const { data, error } = await supabase.from('formations')
          .insert({ ...payload, actif: true }).select().single()
        if (error) throw error
        await logEvent('formations', 'creer', data.id, `Classe créée : ${code}`)
        toast.success('Classe créée')
        setAddModal(false)
      }
      onRefresh()
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleteDialog) return
    const { error } = await supabase.from('formations')
      .update({ actif: false }).eq('id', deleteDialog.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Classe désactivée')
    setDeleteDialog(null)
    onRefresh()
  }

  const doExportExcel = () => {
    const data = formations.map(f => ({
      ...f,
      _type_label:    f.ejp_formations_pcnc ? `${f.ejp_formations_pcnc.code} — ${f.ejp_formations_pcnc.libelle || ''}` : (f.classe || '—'),
      _enseignant_nom: f.enseignant_nom || (f.enseignant ? `${f.enseignant.prenom} ${f.enseignant.nom}` : '—'),
      _total:          (f.nb_femme || 0) + (f.nb_homme || 0),
      'promotions.nom': f.promotions?.nom || '—',
    }))
    exportExcel('Classes en cours', COLS_EXPORT_CLASSES, data, 'Classes')
  }

  const nbInscrits = (f: any) =>
    (f.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length

  const paginatedClasses = formations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Formulaire partagé Ajouter / Modifier ────────────────────────────────
  // classeFormJsx : JSX inline (pas de sous-composant) pour éviter le remontage au re-render
  const classeFormJsx = (
    <div className="space-y-5">
      {/* Section 1 — Identification */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Identification</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Promotion *</label>
            <select className="input" value={form.promotion_id}
              onChange={e => setForm((f: any) => ({ ...f, promotion_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {promotions.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type de classe *</label>
            <select className="input" value={form.formation_pcnc_id}
              onChange={e => handleTypePcncChange(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {typesPcnc.filter(t => t.actif).map(t => (
                <option key={t.id} value={t.id}>{t.code}{t.libelle ? ` — ${t.libelle}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Code classe (auto-généré)</label>
            <input className="input bg-gray-50 font-mono text-xs" value={codePreview}
              readOnly placeholder="Sélectionner type + promotion" />
          </div>
          <div>
            <label className="label">Année</label>
            <input type="number" className="input" value={form.annee} min={2020} max={2035}
              onChange={e => setForm((f: any) => ({ ...f, annee: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Nb séances total</label>
            <input type="number" className="input" min={0} value={form.nb_seance}
              onChange={e => setForm((f: any) => ({ ...f, nb_seance: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nb séances obligatoires</label>
            <input type="number" className="input" min={0} value={form.nb_seance_obligatoire}
              onChange={e => setForm((f: any) => ({ ...f, nb_seance_obligatoire: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date de création</label>
            <input type="date" className="input" value={form.date_creation}
              onChange={e => setForm((f: any) => ({ ...f, date_creation: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Section 2 — Encadrement */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Encadrement</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Enseignant</label>
            <input type="text" className="input" placeholder="Nom de l'enseignant"
              value={form.enseignant_nom}
              onChange={e => setForm((f: any) => ({ ...f, enseignant_nom: e.target.value }))} />
          </div>
          <div>
            <label className="label">Assistant</label>
            <input type="text" className="input" placeholder="Nom de l'assistant"
              value={form.assistant_nom}
              onChange={e => setForm((f: any) => ({ ...f, assistant_nom: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Section 3 — Effectifs */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Effectifs</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Nombre de femmes</label>
            <input type="number" className="input" min={0} value={form.nb_femme}
              onChange={e => setForm((f: any) => ({ ...f, nb_femme: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Nombre d'hommes</label>
            <input type="number" className="input" min={0} value={form.nb_homme}
              onChange={e => setForm((f: any) => ({ ...f, nb_homme: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Total inscrits</label>
            <input className="input bg-gray-50 font-semibold text-blue-700" readOnly
              value={(Number(form.nb_femme) || 0) + (Number(form.nb_homme) || 0)} />
          </div>
        </div>
      </div>

      {/* Section 4 — Informations complémentaires */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informations complémentaires</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Date de fin</label>
            <input type="date" className="input" value={form.date_fin}
              onChange={e => setForm((f: any) => ({ ...f, date_fin: e.target.value }))} />
          </div>
          <div>
            <label className="label">Examen prévu</label>
            <select className="input" value={form.examen_prevu ? 'oui' : 'non'}
              onChange={e => setForm((f: any) => ({ ...f, examen_prevu: e.target.value === 'oui' }))}>
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
          <div>
            <label className="label">Nombre de redoublants</label>
            <input type="number" className="input" min={0} value={form.nb_redoublant}
              onChange={e => setForm((f: any) => ({ ...f, nb_redoublant: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Nombre d'abandons</label>
            <input type="number" className="input" min={0} value={form.nb_abandon}
              onChange={e => setForm((f: any) => ({ ...f, nb_abandon: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="mt-4">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description}
            onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="mt-4">
          <label className="label">Clôture</label>
          <select className="input" value={form.cloture ? 'oui' : 'non'}
            onChange={e => setForm((f: any) => ({ ...f, cloture: e.target.value === 'oui' }))}>
            <option value="non">Non — classe en cours</option>
            <option value="oui">Oui — clôturer cette classe</option>
          </select>
          {form.cloture && (
            <p className="mt-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
              ⚠️ Cette classe sera déplacée dans "Classes clôturées" après validation.
            </p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {formations.length} classe{formations.length > 1 ? 's' : ''} en cours
        </p>
        <div className="flex items-center gap-2">
          <button onClick={doExportExcel}
            className="btn btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={15} /> Excel
          </button>
          {canCreate && (
            <button onClick={openAdd}
              className="btn btn-primary flex items-center gap-2">
              <Plus size={16} /> Ajouter une classe
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      {formations.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Aucune classe en cours"
          description={canCreate ? 'Cliquez sur "Ajouter une classe" pour commencer' : undefined} />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type PCNC</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Promotion</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Enseignant</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Apprenants</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Séances</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date fin</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedClasses.map(f => {
                  const typePcnc = f.ejp_formations_pcnc
                  const ensLabel = f.enseignant_nom || (f.enseignant ? `${f.enseignant.prenom} ${f.enseignant.nom}` : '—')
                  const total    = (f.nb_femme || 0) + (f.nb_homme || 0)
                  return (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-blue-700 font-bold">{f.code || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {typePcnc
                          ? <span className="text-sm">
                              <span className="font-semibold text-purple-700">{typePcnc.code}</span>
                              {typePcnc.libelle && <span className="text-gray-500 ml-1 text-xs">— {typePcnc.libelle}</span>}
                            </span>
                          : <span className="text-gray-400 text-xs">{f.classe || '—'}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-700">{f.promotions?.nom || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{ensLabel}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                          <Users size={13} /> {nbInscrits(f)}
                          {total > 0 && <span className="text-xs text-gray-400 ml-1">({total})</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(f.nb_seance != null || typePcnc?.nb_seance != null)
                          ? <span className="text-xs text-gray-600">
                              {f.nb_seance ?? typePcnc?.nb_seance ?? '—'}
                              {(f.nb_seance_obligatoire ?? typePcnc?.nb_seance_obligatoire) != null &&
                                <span className="text-gray-400"> / {f.nb_seance_obligatoire ?? typePcnc?.nb_seance_obligatoire}</span>
                              }
                            </span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(f.date_fin)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setViewItem(f); setViewModal(true) }}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Voir">
                            <Eye size={15} />
                          </button>
                          {canEdit && (
                            <button onClick={() => openEdit(f)}
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                              <Edit2 size={15} />
                            </button>
                          )}
                          <button
                            className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Gérer apprenants"
                            onClick={() => { setApprenantClasse(f); setApprenantModal(true) }}>
                            <Users size={15} />
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-purple-50 text-purple-600" title="Séances"
                            onClick={() => { setSeanceClasse(f); setSeanceModal(true) }}>
                            <CalendarDays size={15} />
                          </button>
                          {canDelete && (
                            <button onClick={() => setDeleteDialog(f)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Désactiver">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination total={formations.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {/* Modal Ajouter */}
      <Modal key={`add-${addModal}`} open={addModal} onClose={() => setAddModal(false)}
        title="Nouvelle classe" size="xl">
        {classeFormJsx}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={() => doSave(false)} disabled={saving} className="btn btn-primary flex items-center gap-2">
            {saving ? <><Loader size={14} className="animate-spin" /> Enregistrement...</> : <><Save size={14} /> Enregistrer</>}
          </button>
        </div>
      </Modal>

      {/* Modal Modifier */}
      <Modal key={`edit-${editItem?.id}`} open={editModal} onClose={() => setEditModal(false)}
        title={`Modifier — ${editItem?.code || ''}`} size="xl">
        {classeFormJsx}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={() => doSave(true)} disabled={saving} className="btn btn-primary flex items-center gap-2">
            {saving ? <><Loader size={14} className="animate-spin" /> Enregistrement...</> : <><Save size={14} /> Mettre à jour</>}
          </button>
        </div>
      </Modal>

      {/* Modal Voir */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="" size="xl">
        {viewItem && (
          <div className="-m-4 -mt-4">
            {/* En-tête orange/amber */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <GraduationCap size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white font-mono">{viewItem.code || '—'}</h2>
                  <p className="text-white/80 text-sm mt-0.5">
                    {viewItem.ejp_formations_pcnc ? `${viewItem.ejp_formations_pcnc.code}${viewItem.ejp_formations_pcnc.libelle ? ' — ' + viewItem.ejp_formations_pcnc.libelle : ''}` : (viewItem.classe || '')}
                  </p>
                  {viewItem.promotions?.nom && <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mt-1 inline-block">{viewItem.promotions.nom}</span>}
                </div>
              </div>
            </div>
            <div className="px-5 pt-4 pb-2 space-y-4 text-sm">
              {/* Identification */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Identification</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['Année', String(viewItem.annee || '—')], ['Nb séances', String(viewItem.nb_seance ?? '—')], ['Séances oblig.', String(viewItem.nb_seance_obligatoire ?? '—')], ['Date création', fmtDate(viewItem.date_creation)]].map(([l, v]) => (
                    <div key={l} className="bg-orange-50 rounded-xl px-3 py-2"><p className="text-xs text-orange-400 font-medium">{l}</p><p className="font-semibold text-orange-900">{v}</p></div>
                  ))}
                </div>
              </div>
              {/* Encadrement */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Encadrement</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-amber-50 rounded-xl px-3 py-2"><p className="text-xs text-amber-400 font-medium">Enseignant</p><p className="font-semibold text-amber-900">{viewItem.enseignant_nom || (viewItem.enseignant ? `${viewItem.enseignant.prenom} ${viewItem.enseignant.nom}` : '—')}</p></div>
                  <div className="bg-amber-50 rounded-xl px-3 py-2"><p className="text-xs text-amber-400 font-medium">Assistant</p><p className="font-semibold text-amber-900">{viewItem.assistant_nom || (viewItem.assistant ? `${viewItem.assistant.prenom} ${viewItem.assistant.nom}` : '—')}</p></div>
                </div>
              </div>
              {/* Effectifs */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Effectifs</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['Femmes', viewItem.nb_femme ?? 0], ['Hommes', viewItem.nb_homme ?? 0], ['Total', (viewItem.nb_femme || 0) + (viewItem.nb_homme || 0)]].map(([l, v]) => (
                    <div key={l} className="bg-orange-50 rounded-xl px-3 py-2 text-center"><p className="text-xl font-bold text-orange-700">{v}</p><p className="text-xs text-orange-400">{l}</p></div>
                  ))}
                </div>
              </div>
              {/* Complémentaires */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Informations complémentaires</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['Date de fin', fmtDate(viewItem.date_fin)], ['Examen prévu', viewItem.examen_prevu ? 'Oui' : 'Non'], ['Redoublants', String(viewItem.nb_redoublant ?? 0)], ['Abandons', String(viewItem.nb_abandon ?? 0)]].map(([l, v]) => (
                    <div key={l} className="bg-orange-50 rounded-xl px-3 py-2"><p className="text-xs text-orange-400 font-medium">{l}</p><p className="font-semibold text-orange-900">{v}</p></div>
                  ))}
                </div>
                {viewItem.description && <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2"><p className="text-xs text-gray-400">Description</p><p className="text-gray-700 text-sm">{viewItem.description}</p></div>}
              </div>
              {/* Apprenants */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Apprenants inscrits</p>
                {(viewItem.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length === 0
                  ? <p className="text-xs text-gray-400">Aucun apprenant inscrit</p>
                  : <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(viewItem.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').map((i: any) => (
                        <div key={i.id} className="flex items-center gap-2 py-1 px-2 rounded bg-gray-50">
                          <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{i.nom_apprenant || i.statut}</span>
                        </div>
                      ))}
                    </div>
                }
              </div>
            </div>
            <div className="px-5 pb-4 flex justify-end border-t border-gray-100 pt-3">
              <button onClick={() => setViewModal(false)} className="btn btn-secondary text-sm">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Apprenants */}
      {apprenantModal && apprenantClasse && (
        <ApprenantModal
          classe={apprenantClasse}
          onClose={() => { setApprenantModal(false); setApprenantClasse(null) }}
          onRefresh={() => { setApprenantModal(false); setApprenantClasse(null); onRefresh() }}
        />
      )}

      {/* Modal Séances */}
      <SeancesModal
        classe={seanceClasse}
        isOpen={seanceModal}
        onClose={() => { setSeanceModal(false); setSeanceClasse(null) }}
      />

      {/* Confirm désactivation */}
      <ConfirmDialog
        open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={doDelete}
        title="Désactiver la classe"
        message={`Désactiver la classe "${deleteDialog?.code}" ?`}
        confirmLabel="Désactiver" danger={true}
      />
    </div>
  )
}

// =========================================================================
// MODAL APPRENANTS — 3 populations : ejp_membres / stars (profils) / personnes
// =========================================================================



function ApprenantModal({ classe, onClose, onRefresh }: {
  classe: any
  onClose: () => void
  onRefresh: () => void
}) {
  const [inscrits,       setInscrits]       = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [confirmRetirer, setConfirmRetirer] = useState<any>(null)
  // Saisie libre
  const [inputPrenom,    setInputPrenom]    = useState('')
  const [inputNom,       setInputNom]       = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inscriptions_formation')
      .select('id, statut, type_apprenant, nom_apprenant')
      .eq('formation_id', classe.id)
      .order('created_at', { ascending: true })
    setInscrits(data || [])
    setLoading(false)
  }

  const doInscrire = async () => {
    const prenom = inputPrenom.trim()
    const nom    = inputNom.trim()
    if (!prenom && !nom) { toast.error('Saisir au moins un prénom ou un nom'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('inscriptions_formation').insert({
        formation_id:   classe.id,
        statut:         'inscrit',
        type_apprenant: 'personne',
        nom_apprenant:  `${prenom} ${nom}`.trim(),
      })
      if (error) throw error
      toast.success(`${prenom} ${nom} inscrit(e)`.trim())
      setInputPrenom('')
      setInputNom('')
      fetchAll()
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const doChangerStatut = async (inscId: string, statut: string) => {
    const { error } = await supabase.from('inscriptions_formation').update({ statut }).eq('id', inscId)
    if (error) { toast.error('Erreur'); return }
    fetchAll()
  }

  const doRetirer = async () => {
    if (!confirmRetirer) return
    const { error } = await supabase.from('inscriptions_formation').delete().eq('id', confirmRetirer.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Apprenant retiré')
    setConfirmRetirer(null)
    fetchAll()
  }

  const nomInscrit = (i: any): string => i.nom_apprenant || '—'

  return (
    <>
      <Modal open={true} onClose={onClose} title={`Apprenants — ${classe.code || '—'}`} size="xl">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader size={24} className="animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* Partie haute — inscrits actuels */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Inscrits actuels ({inscrits.length})
              </h4>
              {inscrits.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">
                  Aucun apprenant inscrit — utilisez le formulaire ci-dessous pour en ajouter.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Nom</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Statut</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inscrits.map((i, idx) => (
                        <tr key={i.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{nomInscrit(i)}</td>
                          <td className="px-3 py-2">
                            <select
                              value={i.statut}
                              onChange={e => doChangerStatut(i.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                            >
                              <option value="inscrit">Inscrit</option>
                              <option value="en_cours">En cours</option>
                              <option value="termine">Terminé</option>
                              <option value="abandonne">Abandonné</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => setConfirmRetirer(i)}
                              className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                              title="Retirer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Partie basse — saisie libre */}
            <div className="border-t pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Ajouter un apprenant
              </h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="label">Prénom</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Prénom"
                    value={inputPrenom}
                    onChange={e => setInputPrenom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doInscrire() }}
                  />
                </div>
                <div className="flex-1">
                  <label className="label">Nom</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Nom"
                    value={inputNom}
                    onChange={e => setInputNom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doInscrire() }}
                  />
                </div>
                <button
                  onClick={doInscrire}
                  disabled={saving || (!inputPrenom.trim() && !inputNom.trim())}
                  className="btn btn-primary flex items-center gap-2 shrink-0"
                >
                  {saving
                    ? <><Loader size={14} className="animate-spin" /> Ajout...</>
                    : <><Plus size={14} /> Ajouter</>
                  }
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Appuyez sur Entrée ou cliquez Ajouter — vous pouvez enchaîner plusieurs ajouts sans fermer.
              </p>
            </div>

          </div>
        )}

        <div className="flex justify-end mt-4 pt-4 border-t">
          <button onClick={onRefresh} className="btn btn-secondary">Fermer</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmRetirer}
        onClose={() => setConfirmRetirer(null)}
        onConfirm={doRetirer}
        title="Retirer l'apprenant"
        message={`Retirer "${confirmRetirer ? nomInscrit(confirmRetirer) : ''}" de cette classe ?`}
        confirmLabel="Retirer"
        danger={true}
      />
    </>
  )
}

// =========================================================================
// ONGLET 4 — CLASSES CLÔTURÉES
// =========================================================================
function ClassesCloatureesTab({
  formations, onRefresh
}: {
  formations: any[], onRefresh: () => void
}) {
  const [page, setPage]               = useState(1)
  const [viewModal, setViewModal]     = useState(false)
  const [viewItem, setViewItem]       = useState<any>(null)
  const [reouvrirDialog, setReouvrirDialog] = useState<any>(null)

  const doReouvrir = async () => {
    if (!reouvrirDialog) return
    const { error } = await supabase.from('formations')
      .update({ cloture: false }).eq('id', reouvrirDialog.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Classe ré-ouverte — elle est de retour dans "Classes en cours"')
    setReouvrirDialog(null)
    onRefresh()
  }

  const nbInscrits = (f: any) =>
    (f.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length

  const paginatedClasses = formations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {formations.length} classe{formations.length > 1 ? 's' : ''} clôturée{formations.length > 1 ? 's' : ''}
        </p>
      </div>

      {formations.length === 0 ? (
        <EmptyState icon={Lock} title="Aucune classe clôturée"
          description="Les classes clôturées depuis l'onglet «&nbsp;Classes en cours&nbsp;» apparaîtront ici." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type PCNC</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Promotion</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Enseignant</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Apprenants</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date fin</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedClasses.map(f => {
                  const typePcnc  = f.ejp_formations_pcnc
                  const ensLabel  = f.enseignant_nom || (f.enseignant ? `${f.enseignant.prenom} ${f.enseignant.nom}` : '—')
                  return (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600 font-bold">{f.code || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {typePcnc
                          ? <span className="text-sm">
                              <span className="font-semibold text-purple-700">{typePcnc.code}</span>
                              {typePcnc.libelle && <span className="text-gray-500 ml-1 text-xs">— {typePcnc.libelle}</span>}
                            </span>
                          : <span className="text-gray-400 text-xs">{f.classe || '—'}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-700">{f.promotions?.nom || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{ensLabel}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <Users size={13} /> {nbInscrits(f)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(f.date_fin)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setViewItem(f); setViewModal(true) }}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Voir">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => setReouvrirDialog(f)}
                            className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Ré-ouvrir">
                            <Unlock size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination total={formations.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {/* Modal Voir */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="" size="lg">
        {viewItem && (
          <div className="-m-4 -mt-4">
            {/* En-tête slate/gray — clôturée */}
            <div className="bg-gradient-to-r from-slate-600 to-gray-700 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <Lock size={20} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white font-mono">{viewItem.code || '—'}</h2>
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">Clôturée</span>
                  </div>
                  <p className="text-white/80 text-sm mt-0.5">
                    {viewItem.ejp_formations_pcnc ? `${viewItem.ejp_formations_pcnc.code}${viewItem.ejp_formations_pcnc.libelle ? ' — ' + viewItem.ejp_formations_pcnc.libelle : ''}` : (viewItem.classe || '')}
                  </p>
                  {viewItem.promotions?.nom && <span className="text-white/70 text-xs">{viewItem.promotions.nom} · {viewItem.annee}</span>}
                </div>
              </div>
            </div>
            <div className="px-5 pt-4 pb-2 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Encadrement & Effectifs</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['Enseignant', viewItem.enseignant_nom || (viewItem.enseignant ? `${viewItem.enseignant.prenom} ${viewItem.enseignant.nom}` : '—')], ['Assistant', viewItem.assistant_nom || (viewItem.assistant ? `${viewItem.assistant.prenom} ${viewItem.assistant.nom}` : '—')], ['Femmes', String(viewItem.nb_femme ?? 0)], ['Hommes', String(viewItem.nb_homme ?? 0)], ['Total inscrits', String((viewItem.nb_femme || 0) + (viewItem.nb_homme || 0))], ['Examen prévu', viewItem.examen_prevu ? 'Oui' : 'Non'], ['Redoublants', String(viewItem.nb_redoublant ?? 0)], ['Abandons', String(viewItem.nb_abandon ?? 0)], ['Date de fin', fmtDate(viewItem.date_fin)]].map(([l, v]) => (
                    <div key={l} className="bg-slate-50 rounded-xl px-3 py-2"><p className="text-xs text-slate-400 font-medium">{l}</p><p className="font-semibold text-slate-800">{v}</p></div>
                  ))}
                </div>
              </div>
              {viewItem.description && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-400 font-medium">Description</p>
                  <p className="text-gray-700 text-sm mt-0.5">{viewItem.description}</p>
                </div>
              )}
            </div>
            <div className="px-5 pb-4 flex justify-end border-t border-gray-100 pt-3">
              <button onClick={() => setViewModal(false)} className="btn btn-secondary text-sm">Fermer</button>
            </div>
          </div>
        )}
      </Modal>
      {/* Confirm ré-ouverture */}
      <ConfirmDialog
        open={!!reouvrirDialog}
        onClose={() => setReouvrirDialog(null)}
        onConfirm={doReouvrir}
        title="Ré-ouvrir cette classe ?"
        message={`La classe "${reouvrirDialog?.code}" sera remise dans "Classes en cours".`}
        confirmLabel="Ré-ouvrir"
        danger={false}
      />
    </div>
  )
}
