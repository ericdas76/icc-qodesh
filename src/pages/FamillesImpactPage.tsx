import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, Search, Eye, Edit2, Trash2, Download, FileText,
  Users, UserPlus, UserMinus, MapPin, Home,
  History, Calendar, Clock, BookOpen, X
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel, exportPDF } from '../lib/export'

// ─── Constantes ──────────────────────────────────────────────────────────────
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const PAGE_SIZE = 25

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcDureeMinutes(debut: string, fin: string): number | null {
  if (!debut || !fin) return null
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  const total = fh * 60 + fm - (dh * 60 + dm)
  return total > 0 ? total : null
}

function fmtDuree(minutes: number | null | undefined): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: fr }) } catch { return d }
}

// ─── emptyForm FI ─────────────────────────────────────────────────────────────
const emptyFIForm = {
  nom: '', quartier: '', adresse_maison_hote: '',
  responsable_id: '', copilote_id: '',
  jour_reunion: '', heure_reunion: '',
  date_creation: format(new Date(), 'yyyy-MM-dd'), notes: '',
}

// ─── emptyForm Séance ─────────────────────────────────────────────────────────
const emptySeanceForm = {
  famille_id: '', date_seance: format(new Date(), 'yyyy-MM-dd'),
  responsable: '', copilote: '',
  theme: '', heure_debut: '', heure_fin: '',
  nb_adulte: 0, nb_homme: 0, nb_femme: 0, nb_enfant: 0,
  notes: '',
}

// ─── emptyForm Participant ────────────────────────────────────────────────────
const emptyParticipantForm = {
  nom: '', prenom: '', sexe: '', age: '', telephone: '', adresse: '',
}

// ─── Colonnes export FI ───────────────────────────────────────────────────────
const COLS_FI_EXPORT = [
  { header: 'Nom FI', key: 'nom' },
  { header: 'Quartier', key: 'quartier' },
  { header: 'Responsable', key: '_resp' },
  { header: 'Copilote', key: '_copil' },
  { header: 'Nb membres', key: '_nbMembres' },
  { header: 'Jour réunion', key: 'jour_reunion' },
]

// ─── Colonnes export Séances ──────────────────────────────────────────────────
const COLS_SEANCES_EXPORT = [
  { header: 'Date', key: '_date' },
  { header: 'Famille', key: '_famille' },
  { header: 'Responsable', key: 'responsable' },
  { header: 'Copilote', key: 'copilote' },
  { header: 'Thème', key: 'theme' },
  { header: 'Durée', key: '_duree' },
  { header: 'Hommes', key: 'nb_homme' },
  { header: 'Femmes', key: 'nb_femme' },
  { header: 'Enfants', key: 'nb_enfant' },
  { header: 'Total', key: 'total_participants' },
]

// ─── Sous-composant formulaire FI (hors parent pour éviter bug curseur) ───────
interface FIFormProps {
  form: typeof emptyFIForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyFIForm>>
  personnesList: any[]
}
function FIForm({ form, setForm, personnesList }: FIFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Nom de la FI *</label>
          <input className="input" value={form.nom}
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex : FI Espoir" />
        </div>
        <div>
          <label className="label">Quartier</label>
          <input className="input" value={form.quartier}
            onChange={e => setForm(f => ({ ...f, quartier: e.target.value }))} />
        </div>
        <div>
          <label className="label">Adresse maison hôte</label>
          <input className="input" value={form.adresse_maison_hote}
            onChange={e => setForm(f => ({ ...f, adresse_maison_hote: e.target.value }))} />
        </div>
        <div>
          <label className="label">Responsable</label>
          <select className="input" value={form.responsable_id}
            onChange={e => setForm(f => ({ ...f, responsable_id: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {personnesList.map((p: any) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Copilote</label>
          <select className="input" value={form.copilote_id}
            onChange={e => setForm(f => ({ ...f, copilote_id: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {personnesList.map((p: any) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Jour de réunion</label>
          <select className="input" value={form.jour_reunion}
            onChange={e => setForm(f => ({ ...f, jour_reunion: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Heure de réunion</label>
          <input type="time" className="input" value={form.heure_reunion}
            onChange={e => setForm(f => ({ ...f, heure_reunion: e.target.value }))} />
        </div>
        <div>
          <label className="label">Date de création</label>
          <input type="date" className="input" value={form.date_creation}
            onChange={e => setForm(f => ({ ...f, date_creation: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
    </div>
  )
}

// ─── Sous-composant formulaire Séance (hors parent pour éviter bug curseur) ───
interface SeanceFormProps {
  form: typeof emptySeanceForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptySeanceForm>>
  familles: any[]
}
function SeanceForm({ form, setForm, familles }: SeanceFormProps) {
  const duree = calcDureeMinutes(form.heure_debut, form.heure_fin)
  const total = (Number(form.nb_homme) || 0) + (Number(form.nb_femme) || 0) + (Number(form.nb_enfant) || 0)

  const handleFamilleChange = (familleId: string) => {
    const fi = familles.find((f: any) => f.id === familleId)
    setForm(prev => ({
      ...prev,
      famille_id: familleId,
      responsable: fi?.responsable ? `${fi.responsable.prenom} ${fi.responsable.nom}` : '',
      copilote: fi?.copilote ? `${fi.copilote.prenom} ${fi.copilote.nom}` : '',
    }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Famille */}
        <div className="md:col-span-2">
          <label className="label">Famille d'Impact *</label>
          <select className="input" value={form.famille_id}
            onChange={e => handleFamilleChange(e.target.value)}>
            <option value="">-- Sélectionner une FI --</option>
            {familles.map((f: any) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>
        {/* Date */}
        <div>
          <label className="label">Date de la séance *</label>
          <input type="date" className="input" value={form.date_seance}
            onChange={e => setForm(f => ({ ...f, date_seance: e.target.value }))} />
        </div>
        {/* Thème */}
        <div>
          <label className="label">Thème</label>
          <input className="input" value={form.theme}
            onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} placeholder="Thème de la séance" />
        </div>
        {/* Responsable auto */}
        <div>
          <label className="label">Responsable</label>
          <input className="input bg-slate-50 text-slate-500" value={form.responsable} readOnly
            placeholder="Auto depuis la FI sélectionnée" />
        </div>
        {/* Copilote auto */}
        <div>
          <label className="label">Copilote</label>
          <input className="input bg-slate-50 text-slate-500" value={form.copilote} readOnly
            placeholder="Auto depuis la FI sélectionnée" />
        </div>
        {/* Heures */}
        <div>
          <label className="label">Heure début</label>
          <input type="time" className="input" value={form.heure_debut}
            onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))} />
        </div>
        <div>
          <label className="label">Heure fin</label>
          <input type="time" className="input" value={form.heure_fin}
            onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))} />
        </div>
        {/* Durée auto */}
        <div className="md:col-span-2">
          <label className="label">Durée (calcul automatique)</label>
          <input className="input bg-slate-50 text-slate-500 font-medium" value={fmtDuree(duree)} readOnly />
        </div>
        {/* Participants */}
        <div className="md:col-span-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Participants</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Nb adultes</label>
              <input type="number" min={0} className="input" value={form.nb_adulte}
                onChange={e => setForm(f => ({ ...f, nb_adulte: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Nb hommes</label>
              <input type="number" min={0} className="input" value={form.nb_homme}
                onChange={e => setForm(f => ({ ...f, nb_homme: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Nb femmes</label>
              <input type="number" min={0} className="input" value={form.nb_femme}
                onChange={e => setForm(f => ({ ...f, nb_femme: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Nb enfants</label>
              <input type="number" min={0} className="input" value={form.nb_enfant}
                onChange={e => setForm(f => ({ ...f, nb_enfant: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="mt-2">
            <label className="label">Total participants (H + F + Enfants)</label>
            <input className="input bg-teal-50 text-teal-700 font-bold" value={total} readOnly />
          </div>
        </div>
        {/* Notes */}
        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observations…" />
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function FamillesImpactPage() {
  const { hasPermission, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'fi_en_cours' | 'historique'>('fi_en_cours')

  // ── Données communes ───────────────────────────────────────
  const [familles, setFamilles] = useState<any[]>([])
  const [personnesList, setPersonnesList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ── Onglet 1 : FI en cours ─────────────────────────────────
  const [searchFI, setSearchFI] = useState('')
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [membresModal, setMembresModal] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [gestionFI, setGestionFI] = useState<any | null>(null)
  const [desactiverFIDialog, setDesactiverFIDialog] = useState<any | null>(null)
  const [retirerDialog, setRetirerDialog] = useState<any | null>(null)
  const [fiForm, setFiForm] = useState({ ...emptyFIForm })
  const [ajoutPersonneId, setAjoutPersonneId] = useState('')

  // ── Onglet 2 : Historique séances ──────────────────────────
  const [seances, setSeances] = useState<any[]>([])
  const [seancesLoading, setSeancesLoading] = useState(false)
  const [seancePage, setSeancePage] = useState(1)
  const [searchSeance, setSearchSeance] = useState('')
  const [addSeanceModal, setAddSeanceModal] = useState(false)
  const [editSeanceModal, setEditSeanceModal] = useState(false)
  const [viewSeanceModal, setViewSeanceModal] = useState(false)
  const [participantsModal, setParticipantsModal] = useState(false)
  const [desactiverSeanceDialog, setDesactiverSeanceDialog] = useState<any | null>(null)
  const [selectedSeance, setSelectedSeance] = useState<any | null>(null)
  const [seanceForm, setSeanceForm] = useState({ ...emptySeanceForm })
  const [saving, setSaving] = useState(false)

  // ── Participants ───────────────────────────────────────────
  const [participants, setParticipants] = useState<any[]>([])
  const [participantForm, setParticipantForm] = useState({ ...emptyParticipantForm })
  const [savingParticipant, setSavingParticipant] = useState(false)
  const [supprimerPartDialog, setSupprimerPartDialog] = useState<any | null>(null)

  // ── Permissions ────────────────────────────────────────────
  const canCreate = hasPermission('familles_impact', 'creer')
  const canEdit   = hasPermission('familles_impact', 'modifier')
  const canDelete = hasPermission('familles_impact', 'supprimer')
  const canExport = hasPermission('familles_impact', 'exporter')

  useEffect(() => {
    fetchFamilles()
    fetchPersonnes()
  }, [])

  useEffect(() => {
    if (activeTab === 'historique') fetchSeances()
  }, [activeTab])

  // ── Fetch familles ─────────────────────────────────────────
  const fetchFamilles = async () => {
    setLoading(true)
    const { data } = await supabase.from('familles_impact').select(`
      *, responsable:responsable_id(id, prenom, nom),
      copilote:copilote_id(id, prenom, nom),
      membres_familles_impact(id, personne_id, actif, date_ajout, personnes(id, prenom, nom, telephone))
    `).eq('actif', true).order('nom')
    setFamilles(data || [])
    setLoading(false)
  }

  const fetchPersonnes = async () => {
    const { data } = await supabase.from('personnes').select('id, prenom, nom, telephone').eq('actif', true).order('nom')
    setPersonnesList(data || [])
  }

  // ── Fetch séances ──────────────────────────────────────────
  const fetchSeances = async () => {
    setSeancesLoading(true)
    const { data } = await supabase.from('seances_fi').select(`
      *, familles_impact(id, nom)
    `).eq('actif', true).order('date_seance', { ascending: false })
    setSeances(data || [])
    setSeancesLoading(false)
  }

  // ── Helpers FI ────────────────────────────────────────────
  const getNbMembres = (fi: any) =>
    (fi.membres_familles_impact || []).filter((m: any) => m.actif).length

  const filteredFI = familles.filter(fi => {
    const s = searchFI.toLowerCase()
    return !searchFI || fi.nom.toLowerCase().includes(s) ||
      (fi.quartier || '').toLowerCase().includes(s) ||
      (fi.responsable?.nom || '').toLowerCase().includes(s)
  })

  // ── Helpers séances ───────────────────────────────────────
  const filteredSeances = seances.filter(s => {
    const q = searchSeance.toLowerCase()
    return !searchSeance ||
      (s.familles_impact?.nom || '').toLowerCase().includes(q) ||
      (s.theme || '').toLowerCase().includes(q) ||
      (s.responsable || '').toLowerCase().includes(q)
  })
  const seancesTotal = filteredSeances.length
  const seancesPage  = filteredSeances.slice((seancePage - 1) * PAGE_SIZE, seancePage * PAGE_SIZE)

  // ── Export FI ─────────────────────────────────────────────
  const doExportFIExcel = () => exportExcel("Familles d'Impact", COLS_FI_EXPORT,
    filteredFI.map(fi => ({
      ...fi,
      _resp: fi.responsable ? `${fi.responsable.prenom} ${fi.responsable.nom}` : '—',
      _copil: fi.copilote ? `${fi.copilote.prenom} ${fi.copilote.nom}` : '—',
      _nbMembres: getNbMembres(fi),
    })), 'FamillesImpact')
  const doExportFIPDF = () => exportPDF("Familles d'Impact", COLS_FI_EXPORT,
    filteredFI.map(fi => ({
      ...fi,
      _resp: fi.responsable ? `${fi.responsable.prenom} ${fi.responsable.nom}` : '—',
      _copil: fi.copilote ? `${fi.copilote.prenom} ${fi.copilote.nom}` : '—',
      _nbMembres: getNbMembres(fi),
    })), `${filteredFI.length} famille(s)`)

  // ── Export Séances ────────────────────────────────────────
  const doExportSeancesExcel = () => exportExcel('Historique_Seances_FI', COLS_SEANCES_EXPORT,
    filteredSeances.map(s => ({
      ...s,
      _date: fmtDate(s.date_seance),
      _famille: s.familles_impact?.nom || '—',
      _duree: fmtDuree(s.duree_minutes),
    })), 'Séances FI')

  // ─────────────────────────────────────────────────────────
  // CRUD FI (inchangé)
  // ─────────────────────────────────────────────────────────
  const openAdd   = () => { setFiForm({ ...emptyFIForm }); setAddModal(true) }
  const openEdit  = (fi: any) => {
    setEditItem(fi)
    setFiForm({
      nom: fi.nom, quartier: fi.quartier || '',
      adresse_maison_hote: fi.adresse_maison_hote || '',
      responsable_id: fi.responsable_id || '', copilote_id: fi.copilote_id || '',
      jour_reunion: fi.jour_reunion || '', heure_reunion: fi.heure_reunion || '',
      date_creation: fi.date_creation || '', notes: fi.notes || '',
    })
    setEditModal(true)
  }
  const openView    = (fi: any) => { setViewItem(fi); setViewModal(true) }
  const openMembres = (fi: any) => { setGestionFI(fi); setAjoutPersonneId(''); setMembresModal(true) }

  const doAddFI = async () => {
    if (!fiForm.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { data, error } = await supabase.from('familles_impact').insert({
      nom: fiForm.nom.trim(), quartier: fiForm.quartier || null,
      adresse_maison_hote: fiForm.adresse_maison_hote || null,
      responsable_id: fiForm.responsable_id || null, copilote_id: fiForm.copilote_id || null,
      jour_reunion: fiForm.jour_reunion || null, heure_reunion: fiForm.heure_reunion || null,
      date_creation: fiForm.date_creation || null, notes: fiForm.notes || null,
    }).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('familles_impact', 'creer', data.id, `Création FI ${data.nom}`)
    toast.success("Famille d'Impact créée")
    setAddModal(false); fetchFamilles()
  }

  const doEditFI = async () => {
    if (!editItem || !fiForm.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { error } = await supabase.from('familles_impact').update({
      nom: fiForm.nom.trim(), quartier: fiForm.quartier || null,
      adresse_maison_hote: fiForm.adresse_maison_hote || null,
      responsable_id: fiForm.responsable_id || null, copilote_id: fiForm.copilote_id || null,
      jour_reunion: fiForm.jour_reunion || null, heure_reunion: fiForm.heure_reunion || null,
      date_creation: fiForm.date_creation || null, notes: fiForm.notes || null,
    }).eq('id', editItem.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('familles_impact', 'modifier', editItem.id, `Modification FI ${fiForm.nom}`)
    toast.success("Famille d'Impact mise à jour")
    setEditModal(false); fetchFamilles()
  }

  const doDesactiverFI = async () => {
    if (!desactiverFIDialog) return
    const { error } = await supabase.from('familles_impact').update({ actif: false }).eq('id', desactiverFIDialog.id)
    if (error) { toast.error('Erreur'); return }
    await logEvent('familles_impact', 'supprimer', desactiverFIDialog.id, `Désactivation FI ${desactiverFIDialog.nom}`)
    toast.success("Famille d'Impact désactivée")
    setDesactiverFIDialog(null); fetchFamilles()
  }

  const refreshGestionFI = async (fiId: string) => {
    const { data } = await supabase.from('familles_impact').select(`
      *, responsable:responsable_id(id, prenom, nom), copilote:copilote_id(id, prenom, nom),
      membres_familles_impact(id, personne_id, actif, date_ajout, personnes(id, prenom, nom, telephone))
    `).eq('id', fiId).single()
    if (data) setGestionFI(data)
  }

  const doAjouterMembre = async () => {
    if (!ajoutPersonneId || !gestionFI) { toast.error('Sélectionner une personne'); return }
    const { error } = await supabase.from('membres_familles_impact').upsert({
      famille_id: gestionFI.id, personne_id: ajoutPersonneId,
      actif: true, date_ajout: format(new Date(), 'yyyy-MM-dd'),
    }, { onConflict: 'famille_id,personne_id' })
    if (error) { toast.error('Erreur : ' + error.message); return }
    toast.success('Membre ajouté'); setAjoutPersonneId('')
    fetchFamilles(); refreshGestionFI(gestionFI.id)
  }

  const doRetirerMembre = async () => {
    if (!retirerDialog) return
    const { error } = await supabase.from('membres_familles_impact')
      .update({ actif: false })
      .eq('famille_id', retirerDialog.fi.id).eq('personne_id', retirerDialog.personne_id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Membre retiré'); setRetirerDialog(null)
    fetchFamilles(); refreshGestionFI(retirerDialog.fi.id)
  }

  // ─────────────────────────────────────────────────────────
  // CRUD Séances
  // ─────────────────────────────────────────────────────────
  const openAddSeance = () => { setSeanceForm({ ...emptySeanceForm }); setAddSeanceModal(true) }

  const openEditSeance = (s: any) => {
    setSelectedSeance(s)
    setSeanceForm({
      famille_id: s.famille_id || '',
      date_seance: s.date_seance || format(new Date(), 'yyyy-MM-dd'),
      responsable: s.responsable || '', copilote: s.copilote || '',
      theme: s.theme || '',
      heure_debut: s.heure_debut || '', heure_fin: s.heure_fin || '',
      nb_adulte: s.nb_adulte || 0, nb_homme: s.nb_homme || 0,
      nb_femme: s.nb_femme || 0, nb_enfant: s.nb_enfant || 0,
      notes: s.notes || '',
    })
    setEditSeanceModal(true)
  }

  const openViewSeance = (s: any) => { setSelectedSeance(s); setViewSeanceModal(true) }

  const openParticipants = async (s: any) => {
    setSelectedSeance(s)
    await fetchParticipants(s.id)
    setParticipantForm({ ...emptyParticipantForm })
    setParticipantsModal(true)
  }

  const buildSeancePayload = (form: typeof emptySeanceForm) => {
    const duree = calcDureeMinutes(form.heure_debut, form.heure_fin)
    const total = (Number(form.nb_homme) || 0) + (Number(form.nb_femme) || 0) + (Number(form.nb_enfant) || 0)
    return {
      famille_id: form.famille_id,
      date_seance: form.date_seance,
      responsable: form.responsable || null,
      copilote: form.copilote || null,
      theme: form.theme || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      duree_minutes: duree,
      nb_adulte: Number(form.nb_adulte) || 0,
      nb_homme: Number(form.nb_homme) || 0,
      nb_femme: Number(form.nb_femme) || 0,
      nb_enfant: Number(form.nb_enfant) || 0,
      total_participants: total,
      notes: form.notes || null,
      auteur_id: user?.id || null,
    }
  }

  const doAddSeance = async () => {
    if (!seanceForm.famille_id) { toast.error("Sélectionner une Famille d'Impact"); return }
    if (!seanceForm.date_seance) { toast.error('Date obligatoire'); return }
    setSaving(true)
    const payload = buildSeancePayload(seanceForm)
    const { data, error } = await supabase.from('seances_fi').insert(payload).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('familles_impact', 'creer', data.id, `Séance FI créée`)
    toast.success('Séance enregistrée')
    setAddSeanceModal(false); fetchSeances()
  }

  const doEditSeance = async () => {
    if (!selectedSeance) return
    if (!seanceForm.famille_id) { toast.error("Sélectionner une Famille d'Impact"); return }
    setSaving(true)
    const payload = buildSeancePayload(seanceForm)
    const { error } = await supabase.from('seances_fi').update(payload).eq('id', selectedSeance.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('familles_impact', 'modifier', selectedSeance.id, `Séance FI modifiée`)
    toast.success('Séance mise à jour')
    setEditSeanceModal(false); fetchSeances()
  }

  const doDesactiverSeance = async () => {
    if (!desactiverSeanceDialog) return
    const { error } = await supabase.from('seances_fi').update({ actif: false }).eq('id', desactiverSeanceDialog.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Séance désactivée')
    setDesactiverSeanceDialog(null); fetchSeances()
  }

  // ─────────────────────────────────────────────────────────
  // CRUD Participants
  // ─────────────────────────────────────────────────────────
  const fetchParticipants = async (seanceId: string) => {
    const { data } = await supabase.from('seances_fi_participants')
      .select('*').eq('seance_id', seanceId).order('created_at')
    setParticipants(data || [])
  }

  const doAddParticipant = async () => {
    if (!participantForm.nom.trim() || !participantForm.prenom.trim()) {
      toast.error('Nom et prénom requis'); return
    }
    setSavingParticipant(true)
    const { error } = await supabase.from('seances_fi_participants').insert({
      seance_id: selectedSeance!.id,
      nom: participantForm.nom.trim(),
      prenom: participantForm.prenom.trim(),
      sexe: participantForm.sexe || null,
      age: participantForm.age ? Number(participantForm.age) : null,
      telephone: participantForm.telephone || null,
      adresse: participantForm.adresse || null,
    })
    setSavingParticipant(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    toast.success('Participant ajouté')
    setParticipantForm({ ...emptyParticipantForm })
    fetchParticipants(selectedSeance!.id)
  }

  const doSupprimerParticipant = async () => {
    if (!supprimerPartDialog) return
    const { error } = await supabase.from('seances_fi_participants').delete().eq('id', supprimerPartDialog.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Participant supprimé')
    setSupprimerPartDialog(null)
    fetchParticipants(selectedSeance!.id)
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Familles d'Impact</h1>
          <p className="text-gray-500 text-sm">
            {activeTab === 'fi_en_cours'
              ? `${filteredFI.length} famille${filteredFI.length > 1 ? 's' : ''}`
              : `${seancesTotal} séance${seancesTotal > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === 'fi_en_cours' && canExport && (
            <>
              <button onClick={doExportFIPDF} className="btn-secondary flex items-center gap-1">
                <FileText size={16} /> PDF
              </button>
              <button onClick={doExportFIExcel} className="btn-secondary flex items-center gap-1">
                <Download size={16} /> Excel
              </button>
            </>
          )}
          {activeTab === 'fi_en_cours' && canCreate && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Ajouter FI
            </button>
          )}
          {activeTab === 'historique' && canExport && (
            <button onClick={doExportSeancesExcel} className="btn-secondary flex items-center gap-1">
              <Download size={16} /> Excel
            </button>
          )}
          {activeTab === 'historique' && canCreate && (
            <button onClick={openAddSeance} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Ajouter séance FI
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {[
          { id: 'fi_en_cours', label: 'FI en cours', icon: <Home size={14} /> },
          { id: 'historique',  label: 'Historique des FI', icon: <History size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ════════ ONGLET 1 : FI EN COURS ════════ */}
      {activeTab === 'fi_en_cours' && (
        <>
          <div className="card">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Nom, quartier, responsable..."
                value={searchFI} onChange={e => setSearchFI(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Chargement...</div>
          ) : filteredFI.length === 0 ? (
            <EmptyState icon={Users} title="Aucune famille d'impact"
              description="Aucune famille ne correspond à votre recherche."
              action={canCreate ? (
                <button onClick={openAdd} className="btn-primary flex items-center gap-2">
                  <Plus size={16} /> Nouvelle famille d'impact
                </button>
              ) : undefined} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFI.map(fi => {
                const nb = getNbMembres(fi)
                return (
                  <div key={fi.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{fi.nom}</h3>
                        {fi.quartier && <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={11}/>{fi.quartier}</p>}
                      </div>
                      <span className="badge badge-blue flex items-center gap-1">
                        <Users size={12} /> {nb} membre{nb > 1 ? 's' : ''}
                      </span>
                    </div>
                    {fi.responsable && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Responsable :</span> {fi.responsable.prenom} {fi.responsable.nom}
                      </p>
                    )}
                    {fi.jour_reunion && (
                      <p className="text-sm text-gray-600 mb-3">
                        <span className="font-medium">Réunion :</span> {fi.jour_reunion} {fi.heure_reunion ? `à ${fi.heure_reunion}` : ''}
                      </p>
                    )}
                    <div className="flex items-center gap-1 pt-3 border-t border-gray-100">
                      <button onClick={() => openView(fi)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Visualiser"><Eye size={15} /></button>
                      {canEdit && <button onClick={() => openEdit(fi)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier"><Edit2 size={15} /></button>}
                      <button onClick={() => openMembres(fi)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Gérer les membres"><UserPlus size={15} /></button>
                      {canDelete && <button onClick={() => setDesactiverFIDialog(fi)} className="p-1.5 rounded hover:bg-red-50 text-red-500 ml-auto" title="Désactiver"><Trash2 size={15} /></button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ════════ ONGLET 2 : HISTORIQUE SÉANCES ════════ */}
      {activeTab === 'historique' && (
        <div className="card overflow-hidden">
          {/* Barre recherche */}
          <div className="p-4 border-b border-slate-100">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Famille, thème, responsable…"
                value={searchSeance} onChange={e => { setSearchSeance(e.target.value); setSeancePage(1) }} />
            </div>
          </div>

          {seancesLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : seancesTotal === 0 ? (
            <div className="p-8">
              <EmptyState icon={History} title="Aucune séance enregistrée"
                description="Cliquez sur « Ajouter séance FI » pour créer la première séance."
                action={canCreate ? (
                  <button onClick={openAddSeance} className="btn-primary flex items-center gap-2">
                    <Plus size={16} /> Ajouter séance FI
                  </button>
                ) : undefined} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-teal-700 text-white text-xs">
                      <th className="text-left px-4 py-3 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 font-semibold">Famille</th>
                      <th className="text-left px-4 py-3 font-semibold">Responsable</th>
                      <th className="text-left px-4 py-3 font-semibold">Copilote</th>
                      <th className="text-left px-4 py-3 font-semibold">Thème</th>
                      <th className="text-center px-3 py-3 font-semibold">Durée</th>
                      <th className="text-center px-3 py-3 font-semibold">H</th>
                      <th className="text-center px-3 py-3 font-semibold">F</th>
                      <th className="text-center px-3 py-3 font-semibold">Enf.</th>
                      <th className="text-center px-3 py-3 font-semibold">Total</th>
                      <th className="text-center px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {seancesPage.map((s: any, idx: number) => (
                      <tr key={s.id}
                        className={idx % 2 === 0 ? 'bg-white hover:bg-teal-50/40' : 'bg-slate-50/60 hover:bg-teal-50/40'}>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-teal-500 shrink-0" />
                            {fmtDate(s.date_seance)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{s.familles_impact?.nom || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{s.responsable || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{s.copilote || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">{s.theme || '—'}</td>
                        <td className="px-3 py-3 text-center text-slate-600">
                          <span className="flex items-center justify-center gap-1">
                            <Clock size={12} className="text-teal-400" />{fmtDuree(s.duree_minutes)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-blue-700 font-medium">{s.nb_homme ?? 0}</td>
                        <td className="px-3 py-3 text-center text-pink-700 font-medium">{s.nb_femme ?? 0}</td>
                        <td className="px-3 py-3 text-center text-amber-700 font-medium">{s.nb_enfant ?? 0}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-bold text-sm">
                            {s.total_participants ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openViewSeance(s)}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Voir détail">
                              <Eye size={14} />
                            </button>
                            {canEdit && (
                              <button onClick={() => openEditSeance(s)}
                                className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button onClick={() => openParticipants(s)}
                              className="p-1.5 rounded hover:bg-teal-50 text-teal-600" title="Participants">
                              <Users size={14} />
                            </button>
                            {canDelete && (
                              <button onClick={() => setDesactiverSeanceDialog(s)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Désactiver">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination total={seancesTotal} page={seancePage} pageSize={PAGE_SIZE} onPage={p => setSeancePage(p)} />
            </>
          )}
        </div>
      )}

      {/* ════ MODALES FI ════ */}

      {/* Ajouter FI */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Nouvelle Famille d'Impact" size="xl">
        <FIForm form={fiForm} setForm={setFiForm} personnesList={personnesList} />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doAddFI} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* Modifier FI */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={`Modifier — ${editItem?.nom}`} size="xl">
        <FIForm form={fiForm} setForm={setFiForm} personnesList={personnesList} />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doEditFI} disabled={saving} className="btn-primary">
            {saving ? 'Mise à jour...' : 'Mettre à jour'}
          </button>
        </div>
      </Modal>

      {/* Visualiser FI */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="" size="lg">
        {viewItem && (
          <div className="-m-4 -mt-4">
            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <Home size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{viewItem.nom}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {viewItem.quartier && <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1"><MapPin size={10}/>{viewItem.quartier}</span>}
                    <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1"><Users size={10}/>{getNbMembres(viewItem)} membre{getNbMembres(viewItem) > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 pt-4 pb-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Responsable', val: viewItem.responsable ? `${viewItem.responsable.prenom} ${viewItem.responsable.nom}` : '—' },
                  { label: 'Copilote', val: viewItem.copilote ? `${viewItem.copilote.prenom} ${viewItem.copilote.nom}` : '—' },
                  { label: 'Jour réunion', val: viewItem.jour_reunion || '—' },
                  { label: 'Heure réunion', val: viewItem.heure_reunion || '—' },
                  { label: 'Adresse hôte', val: viewItem.adresse_maison_hote || '—' },
                  { label: 'Date création', val: viewItem.date_creation ? format(new Date(viewItem.date_creation), 'dd MMMM yyyy', { locale: fr }) : '—' },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-teal-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-teal-400 font-medium mb-0.5">{label}</p>
                    <p className="font-semibold text-teal-900 text-sm">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Users size={11}/> Membres actifs ({(viewItem.membres_familles_impact || []).filter((m: any) => m.actif).length})</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {(viewItem.membres_familles_impact || []).filter((m: any) => m.actif).length === 0
                  ? <p className="text-sm text-gray-400">Aucun membre</p>
                  : (viewItem.membres_familles_impact || []).filter((m: any) => m.actif).map((m: any) => (
                    <div key={m.personne_id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg bg-teal-50">
                      <span className="w-2 h-2 bg-teal-400 rounded-full shrink-0" />
                      <span className="font-medium text-teal-900">{m.personnes?.prenom} {m.personnes?.nom}</span>
                      {m.personnes?.telephone && <span className="text-teal-400 text-xs ml-auto">{m.personnes.telephone}</span>}
                    </div>
                  ))}
              </div>
            </div>
            {viewItem.notes && (
              <div className="px-5 pb-3">
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-400 font-medium">Notes</p>
                  <p className="text-gray-700 text-sm mt-0.5">{viewItem.notes}</p>
                </div>
              </div>
            )}
            <div className="px-5 pb-4 flex justify-end border-t border-gray-100 pt-3">
              <button onClick={() => setViewModal(false)} className="btn-secondary text-sm">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Gestion membres FI */}
      <Modal isOpen={membresModal} onClose={() => setMembresModal(false)} title={`Membres — ${gestionFI?.nom}`} size="lg">
        {gestionFI && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <select className="input flex-1" value={ajoutPersonneId} onChange={e => setAjoutPersonneId(e.target.value)}>
                <option value="">-- Sélectionner une personne à ajouter --</option>
                {personnesList
                  .filter((p: any) => !(gestionFI.membres_familles_impact || []).some((m: any) => m.personne_id === p.id && m.actif))
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.telephone ? ` — ${p.telephone}` : ''}</option>
                  ))}
              </select>
              <button onClick={doAjouterMembre} className="btn-primary flex items-center gap-1"><UserPlus size={16} /> Ajouter</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(gestionFI.membres_familles_impact || []).filter((m: any) => m.actif).length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">Aucun membre</p>
                : (gestionFI.membres_familles_impact || []).filter((m: any) => m.actif).map((m: any) => (
                  <div key={m.personne_id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{m.personnes?.prenom} {m.personnes?.nom}</span>
                      {m.personnes?.telephone && <span className="text-gray-400 text-xs ml-2">{m.personnes.telephone}</span>}
                      {m.date_ajout && <span className="text-gray-400 text-xs ml-2">depuis {format(new Date(m.date_ajout), 'dd MMM yyyy', { locale: fr })}</span>}
                    </div>
                    <button onClick={() => setRetirerDialog({ fi: gestionFI, personne_id: m.personne_id })}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"><UserMinus size={14} /></button>
                  </div>
                ))}
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setMembresModal(false)} className="btn-secondary">Fermer</button>
        </div>
      </Modal>

      {/* ════ MODALES SÉANCES ════ */}

      {/* Ajouter séance */}
      <Modal isOpen={addSeanceModal} onClose={() => setAddSeanceModal(false)} title="Nouvelle séance FI" size="xl">
        <SeanceForm form={seanceForm} setForm={setSeanceForm} familles={familles} />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddSeanceModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doAddSeance} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* Modifier séance */}
      <Modal isOpen={editSeanceModal} onClose={() => setEditSeanceModal(false)} title="Modifier la séance" size="xl">
        <SeanceForm form={seanceForm} setForm={setSeanceForm} familles={familles} />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditSeanceModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doEditSeance} disabled={saving} className="btn-primary">
            {saving ? 'Mise à jour...' : 'Mettre à jour'}
          </button>
        </div>
      </Modal>

      {/* Voir séance */}
      <Modal isOpen={viewSeanceModal} onClose={() => setViewSeanceModal(false)} title="" size="lg">
        {selectedSeance && (
          <div className="-m-4 -mt-4">
            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <BookOpen size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedSeance.familles_impact?.nom || '—'}</h2>
                  <p className="text-white/80 text-sm mt-0.5">{fmtDate(selectedSeance.date_seance)}</p>
                  {selectedSeance.theme && <p className="text-white/70 text-xs mt-0.5 italic">{selectedSeance.theme}</p>}
                </div>
              </div>
            </div>
            <div className="px-5 pt-4 pb-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Responsable', val: selectedSeance.responsable || '—' },
                  { label: 'Copilote', val: selectedSeance.copilote || '—' },
                  { label: 'Heure début', val: selectedSeance.heure_debut || '—' },
                  { label: 'Heure fin', val: selectedSeance.heure_fin || '—' },
                  { label: 'Durée', val: fmtDuree(selectedSeance.duree_minutes) },
                  { label: 'Nb adultes', val: String(selectedSeance.nb_adulte ?? 0) },
                  { label: 'Hommes', val: String(selectedSeance.nb_homme ?? 0) },
                  { label: 'Femmes', val: String(selectedSeance.nb_femme ?? 0) },
                  { label: 'Enfants', val: String(selectedSeance.nb_enfant ?? 0) },
                  { label: 'Total participants', val: String(selectedSeance.total_participants ?? 0) },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-teal-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-teal-400 font-medium mb-0.5">{label}</p>
                    <p className="font-semibold text-teal-900 text-sm">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            {selectedSeance.notes && (
              <div className="px-5 pb-3">
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-400 font-medium">Notes</p>
                  <p className="text-gray-700 text-sm mt-0.5">{selectedSeance.notes}</p>
                </div>
              </div>
            )}
            <div className="px-5 pb-4 flex justify-end border-t border-gray-100 pt-3">
              <button onClick={() => setViewSeanceModal(false)} className="btn-secondary text-sm">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Participants d'une séance */}
      <Modal isOpen={participantsModal} onClose={() => setParticipantsModal(false)}
        title={`Participants — ${selectedSeance?.familles_impact?.nom || ''} · ${fmtDate(selectedSeance?.date_seance)}`}
        size="xl">
        <div className="space-y-5">
          {/* Tableau participants */}
          {participants.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aucun participant enregistré</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-teal-700 text-white text-xs">
                    <th className="text-left px-3 py-2.5 font-semibold">Nom</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Prénom</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Sexe</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Âge</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Téléphone</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Adresse</th>
                    <th className="text-center px-3 py-2.5 font-semibold">
                      <X size={13} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participants.map((p: any, idx: number) => (
                    <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{p.nom}</td>
                      <td className="px-3 py-2.5 text-slate-700">{p.prenom}</td>
                      <td className="px-3 py-2.5 text-center">
                        {p.sexe === 'M'
                          ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">H</span>
                          : p.sexe === 'F'
                          ? <span className="text-xs bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">F</span>
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{p.age ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{p.telephone || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{p.adresse || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => setSupprimerPartDialog(p)}
                          className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Formulaire ajout participant */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Ajouter un participant</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="label">Nom *</label>
                <input className="input" value={participantForm.nom}
                  onChange={e => setParticipantForm(f => ({ ...f, nom: e.target.value }))} placeholder="RAKOTO" />
              </div>
              <div>
                <label className="label">Prénom *</label>
                <input className="input" value={participantForm.prenom}
                  onChange={e => setParticipantForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Jean" />
              </div>
              <div>
                <label className="label">Sexe</label>
                <select className="input" value={participantForm.sexe}
                  onChange={e => setParticipantForm(f => ({ ...f, sexe: e.target.value }))}>
                  <option value="">—</option>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </select>
              </div>
              <div>
                <label className="label">Âge</label>
                <input type="number" min={0} className="input" value={participantForm.age}
                  onChange={e => setParticipantForm(f => ({ ...f, age: e.target.value }))} placeholder="25" />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={participantForm.telephone}
                  onChange={e => setParticipantForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+261 34..." />
              </div>
              <div>
                <label className="label">Adresse</label>
                <input className="input" value={participantForm.adresse}
                  onChange={e => setParticipantForm(f => ({ ...f, adresse: e.target.value }))} placeholder="Quartier..." />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={doAddParticipant} disabled={savingParticipant} className="btn-primary flex items-center gap-2">
                <UserPlus size={15} /> {savingParticipant ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4 pt-3 border-t">
          <button onClick={() => setParticipantsModal(false)} className="btn-secondary">Fermer</button>
        </div>
      </Modal>

      {/* ════ CONFIRM DIALOGS ════ */}
      <ConfirmDialog open={!!desactiverFIDialog} onClose={() => setDesactiverFIDialog(null)}
        onConfirm={doDesactiverFI} title="Désactiver la Famille d'Impact"
        message={`Désactiver "${desactiverFIDialog?.nom}" ?`} confirmLabel="Désactiver" danger />

      <ConfirmDialog open={!!retirerDialog} onClose={() => setRetirerDialog(null)}
        onConfirm={doRetirerMembre} title="Retirer le membre"
        message="Retirer ce membre de la Famille d'Impact ?" confirmLabel="Retirer" danger />

      <ConfirmDialog open={!!desactiverSeanceDialog} onClose={() => setDesactiverSeanceDialog(null)}
        onConfirm={doDesactiverSeance} title="Désactiver la séance"
        message={`Désactiver la séance du ${fmtDate(desactiverSeanceDialog?.date_seance)} ?`}
        confirmLabel="Désactiver" danger />

      <ConfirmDialog open={!!supprimerPartDialog} onClose={() => setSupprimerPartDialog(null)}
        onConfirm={doSupprimerParticipant} title="Supprimer le participant"
        message={`Supprimer ${supprimerPartDialog?.prenom} ${supprimerPartDialog?.nom} de cette séance ?`}
        confirmLabel="Supprimer" danger />
    </div>
  )
}
