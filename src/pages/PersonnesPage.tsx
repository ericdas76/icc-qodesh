import { useEffect, useState } from 'react'
import { supabase, Personne } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Eye, Edit2, UserX, Download, FileText, Users, Upload, Phone, Mail, Briefcase, Globe, MapPin, Heart, Calendar, BookOpen } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel, exportPDF } from '../lib/export'
import ImportExcelModal from '../components/ImportExcelModal'

// ─── Constantes statiques (hors composant) ───────────────────────────────────
const PAGE_SIZE = 25
const SEXES = [{ v: '', l: 'Tous' }, { v: 'M', l: 'Homme' }, { v: 'F', l: 'Femme' }]
const SOURCES = ['culte', 'ami', 'internet', 'autre']
const SITUATIONS = ['celibataire', 'marie', 'divorce', 'veuf']

const emptyForm = {
  nom: '', prenom: '', sexe: '', date_naissance: '', lieu_naissance: '',
  telephone: '', telephone_whatsapp: '', email: '', profession: '', situation_familiale: '',
  nombre_enfants: 0, nationalite: 'Malagasy', adresse: '', quartier: '',
  statut: 'nouveau', origine: '', langue: '', suivi_par: '', de_passage: 'non',
  date_premier_contact: format(new Date(), 'yyyy-MM-dd'),
  source_contact: '', notes: ''
}

const COLS_EXPORT = [
  { header: 'Nom', key: 'nom' },
  { header: 'Prénom', key: 'prenom' },
  { header: 'Sexe', key: 'sexe' },
  { header: 'Téléphone', key: 'telephone' },
  { header: 'Email', key: 'email' },
  { header: 'Origine', key: 'origine' },
  { header: 'Quartier', key: 'quartier' },
  { header: 'Nationalité', key: 'nationalite' },
  { header: 'Date contact', key: 'date_premier_contact' },
  { header: 'Source', key: 'source_contact' },
]

// ─── Formulaire extrait HORS du composant parent (fix React error #130 + bug curseur) ──
interface PersonneFormProps {
  form: typeof emptyForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  origineOptions: string[]
  langueOptions: string[]
  suiviParOptions: { id: string; label: string }[]
}

function PersonneForm({ form, setForm, origineOptions, langueOptions, suiviParOptions }: PersonneFormProps) {
  return (
    <div className="space-y-5">
      {/* Identité */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identité</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nom *</label>
            <input className="input uppercase" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom de famille" />
          </div>
          <div>
            <label className="label">Prénom *</label>
            <input className="input" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Prénom" />
          </div>
          <div>
            <label className="label">Sexe</label>
            <select className="input" value={form.sexe} onChange={e => setForm(f => ({ ...f, sexe: e.target.value }))}>
              <option value="">-- Sélectionner --</option>
              <option value="M">Homme</option>
              <option value="F">Femme</option>
            </select>
          </div>
          <div>
            <label className="label">Nationalité</label>
            <input className="input" value={form.nationalite} onChange={e => setForm(f => ({ ...f, nationalite: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date de naissance</label>
            <input type="date" className="input" value={form.date_naissance} onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value }))} />
          </div>
          <div>
            <label className="label">Lieu de naissance</label>
            <input className="input" value={form.lieu_naissance} onChange={e => setForm(f => ({ ...f, lieu_naissance: e.target.value }))} />
          </div>
        </div>
      </div>
      {/* Contact & Situation */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact & Situation</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">N° Téléphone</label>
            <input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+261 34 00 000 00" />
          </div>
          <div>
            <label className="label">N° WhatsApp</label>
            <input className="input" value={form.telephone_whatsapp} onChange={e => setForm(f => ({ ...f, telephone_whatsapp: e.target.value }))} placeholder="+261 34 00 000 00" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Profession</label>
            <input className="input" value={form.profession} onChange={e => setForm(f => ({ ...f, profession: e.target.value }))} />
          </div>
          <div>
            <label className="label">Situation familiale</label>
            <select className="input" value={form.situation_familiale} onChange={e => setForm(f => ({ ...f, situation_familiale: e.target.value }))}>
              <option value="">-- Sélectionner --</option>
              {SITUATIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nombre d'enfants</label>
            <input type="number" min={0} className="input" value={form.nombre_enfants} onChange={e => setForm(f => ({ ...f, nombre_enfants: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Adresse / Quartier</label>
            <input className="input" value={form.quartier} onChange={e => setForm(f => ({ ...f, quartier: e.target.value }))} />
          </div>
          <div>
            <label className="label">Langue parlée</label>
            <select className="input" value={form.langue} onChange={e => setForm(f => ({ ...f, langue: e.target.value }))}>
              <option value="">-- Choisir --</option>
              {langueOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Suivi par</label>
            <select className="input" value={form.suivi_par} onChange={e => setForm(f => ({ ...f, suivi_par: e.target.value }))}>
              <option value="">-- Choisir --</option>
              {suiviParOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">De passage</label>
            <select className="input" value={form.de_passage} onChange={e => setForm(f => ({ ...f, de_passage: e.target.value }))}>
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
        </div>
      </div>
      {/* Suivi pastoral */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Suivi pastoral</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Origine *</label>
            <select className="input" value={form.origine} onChange={e => setForm(f => ({ ...f, origine: e.target.value }))} required>
              <option value="">-- Sélectionner --</option>
              {origineOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date premier contact</label>
            <input type="date" className="input" value={form.date_premier_contact} onChange={e => setForm(f => ({ ...f, date_premier_contact: e.target.value }))} />
          </div>
          <div>
            <label className="label">Source contact</label>
            <select className="input" value={form.source_contact} onChange={e => setForm(f => ({ ...f, source_contact: e.target.value }))}>
              <option value="">-- Sélectionner --</option>
              {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PersonnesPage() {
  const { hasPermission, user } = useAuth()
  const [personnes, setPersonnes] = useState<Personne[]>([])
  const [origineOptions, setOrigineOptions] = useState<string[]>([])
  const [langueOptions, setLangueOptions] = useState<string[]>([])
  const [suiviParOptions, setSuiviParOptions] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOrigine, setFilterOrigine] = useState('')
  const [filterSexe, setFilterSexe] = useState('')
  const [page, setPage] = useState(1)

  // Modals
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewItem, setViewItem] = useState<Personne | null>(null)
  const [editItem, setEditItem] = useState<Personne | null>(null)
  const [desactiverDialog, setDesactiverDialog] = useState<Personne | null>(null)
  const [importModal, setImportModal] = useState(false)

  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('membres', 'creer')
  const canEdit = hasPermission('membres', 'modifier')
  const canDelete = hasPermission('membres', 'supprimer')
  const canExport = hasPermission('membres', 'exporter')

  useEffect(() => {
    fetchPersonnes()
    fetchOrigines()
    fetchLangues()
    fetchSuiviPar()
  }, [])

  const fetchPersonnes = async () => {
    setLoading(true)
    // Exclure les personnes déjà membres actifs
    const { data: membresActifs } = await supabase.from('membres').select('personne_id').eq('actif', true)
    const membresIds = (membresActifs || []).map((m: any) => m.personne_id)
    const { data } = await supabase.from('personnes').select('*').eq('actif', true).order('nom', { ascending: true }).order('prenom', { ascending: true })
    setPersonnes((data || []).filter((p: any) => !membresIds.includes(p.id)))
    setLoading(false)
  }

  const fetchOrigines = async () => {
    const { data } = await supabase
      .from('listes_parametrables')
      .select('valeur')
      .eq('categorie', 'origine')
      .eq('actif', true)
      .order('ordre')
    setOrigineOptions((data || []).map(d => d.valeur))
  }

  const fetchLangues = async () => {
    const { data } = await supabase
      .from('listes_parametrables')
      .select('valeur')
      .eq('categorie', 'langue')
      .eq('actif', true)
      .order('ordre')
    setLangueOptions((data || []).map(d => d.valeur))
  }

  const fetchSuiviPar = async () => {
    const { data } = await supabase
      .from('membres')
      .select('id, categorie, personnes(nom, prenom)')
      .eq('actif', true)
      .in('categorie', ['Référent', 'Star'])
    if (data) {
      setSuiviParOptions(data.map((m: any) => ({
        id: `${m.personnes?.prenom} ${m.personnes?.nom}`,
        label: `${m.personnes?.prenom} ${m.personnes?.nom} (${m.categorie})`
      })))
    }
  }

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilterOrigine = (v: string) => { setFilterOrigine(v); setPage(1) }
  const handleFilterSexe = (v: string) => { setFilterSexe(v); setPage(1) }

  const filtered = personnes.filter(p => {
    const s = search.toLowerCase()
    const matchSearch = !search || p.nom.toLowerCase().includes(s) || p.prenom.toLowerCase().includes(s) || (p.telephone || '').includes(s)
    const matchOrigine = !filterOrigine || p.origine === filterOrigine
    const matchSexe = !filterSexe || p.sexe === filterSexe
    return matchSearch && matchOrigine && matchSexe
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // --- Ajouter ---
  const openAdd = () => { setForm({ ...emptyForm }); setAddModal(true) }

  const doAdd = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) { toast.error('Nom et prénom requis'); return }
    if (!form.origine) { toast.error('Origine obligatoire'); return }
    setSaving(true)
    const { data, error } = await supabase.from('personnes').insert({
      ...form,
      origine: form.origine || null,
      telephone_whatsapp: form.telephone_whatsapp || null,
      langue: form.langue || null,
      suivi_par: form.suivi_par || null,
      de_passage: form.de_passage === 'oui',
      date_naissance: form.date_naissance || null,
      date_premier_contact: form.date_premier_contact || null,
      nombre_enfants: Number(form.nombre_enfants),
      auteur_creation: user?.id,
    }).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('personnes', 'creer', data.id, `Création de ${data.prenom} ${data.nom}`)
    toast.success('Personne créée')
    setAddModal(false)
    fetchPersonnes()
  }

  // --- Modifier ---
  const openEdit = (p: Personne) => {
    setEditItem(p)
    setForm({
      nom: p.nom, prenom: p.prenom, sexe: p.sexe || '',
      date_naissance: p.date_naissance || '', lieu_naissance: p.lieu_naissance || '',
      telephone: p.telephone || '', telephone_whatsapp: (p as any).telephone_whatsapp || '',
      email: p.email || '', profession: p.profession || '',
      situation_familiale: p.situation_familiale || '',
      nombre_enfants: p.nombre_enfants, nationalite: p.nationalite,
      adresse: p.adresse || '', quartier: p.quartier || '',
      statut: p.statut, origine: p.origine || '',
      langue: (p as any).langue || '', suivi_par: (p as any).suivi_par || '',
      de_passage: (p as any).de_passage ? 'oui' : 'non',
      date_premier_contact: p.date_premier_contact || '',
      source_contact: p.source_contact || '', notes: p.notes || ''
    })
    setEditModal(true)
  }

  const doEdit = async () => {
    if (!editItem) return
    if (!form.nom.trim() || !form.prenom.trim()) { toast.error('Nom et prénom requis'); return }
    if (!form.origine) { toast.error('Origine obligatoire'); return }
    setSaving(true)
    const { error } = await supabase.from('personnes').update({
      ...form,
      origine: form.origine || null,
      telephone_whatsapp: form.telephone_whatsapp || null,
      langue: form.langue || null,
      suivi_par: form.suivi_par || null,
      de_passage: form.de_passage === 'oui',
      date_naissance: form.date_naissance || null,
      date_premier_contact: form.date_premier_contact || null,
      nombre_enfants: Number(form.nombre_enfants),
    }).eq('id', editItem.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('personnes', 'modifier', editItem.id, `Modification de ${form.prenom} ${form.nom}`)
    toast.success('Personne mise à jour')
    setEditModal(false)
    fetchPersonnes()
  }

  // --- Visualiser ---
  const openView = (p: Personne) => { setViewItem(p); setViewModal(true) }

  // --- Désactiver ---
  const doDesactiver = async () => {
    if (!desactiverDialog) return
    const { error } = await supabase.from('personnes').update({ actif: false }).eq('id', desactiverDialog.id)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('personnes', 'supprimer', desactiverDialog.id, `Désactivation de ${desactiverDialog.prenom} ${desactiverDialog.nom}`)
    toast.success('Personne désactivée')
    setDesactiverDialog(null)
    fetchPersonnes()
  }

  // --- Export ---
  const doExportExcel = () => exportExcel('Personnes', COLS_EXPORT, filtered as any, 'Personnes')
  const doExportPDF = () => exportPDF('Liste des Personnes', COLS_EXPORT, filtered as any, `${filtered.length} enregistrements`)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personnes</h1>
          <p className="text-gray-500 text-sm">{filtered.length} personne{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canExport && (
            <>
              <button onClick={doExportPDF} className="btn-secondary flex items-center gap-1">
                <FileText size={16} /> PDF
              </button>
              <button onClick={doExportExcel} className="btn-secondary flex items-center gap-1">
                <Download size={16} /> Excel
              </button>
            </>
          )}
          {canCreate && (
            <button onClick={() => setImportModal(true)} className="btn-secondary flex items-center gap-2">
              <Upload size={16} /> Import Excel
            </button>
          )}
          {canCreate && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Nom, prénom, téléphone..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <select className="input" value={filterOrigine} onChange={e => handleFilterOrigine(e.target.value)}>
            <option value="">Toutes les origines</option>
            {origineOptions.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select className="input" value={filterSexe} onChange={e => handleFilterSexe(e.target.value)}>
            {SEXES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucune personne trouvée"
            description="Aucune personne ne correspond à votre recherche."
            action={canCreate ? (
              <button onClick={openAdd} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Ajouter une personne
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Prénom</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Sexe</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Téléphone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Origine</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Quartier</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 uppercase">{p.nom}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.prenom}</td>
                    <td className="px-4 py-3 text-gray-600">{p.sexe === 'M' ? 'Homme' : p.sexe === 'F' ? 'Femme' : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.telephone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.origine || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.quartier || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {p.date_premier_contact ? format(new Date(p.date_premier_contact), 'dd MMM yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openView(p)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Visualiser">
                          <Eye size={15} />
                        </button>
                        {canEdit && (
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                            <Edit2 size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDesactiverDialog(p)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Désactiver">
                            <UserX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Modal Ajouter */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Nouvelle personne" size="xl">
        <PersonneForm form={form} setForm={setForm} origineOptions={origineOptions} langueOptions={langueOptions} suiviParOptions={suiviParOptions} />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doAdd} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* Modal Modifier */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={`Modifier — ${editItem?.prenom} ${editItem?.nom}`} size="xl">
        <PersonneForm form={form} setForm={setForm} origineOptions={origineOptions} langueOptions={langueOptions} suiviParOptions={suiviParOptions} />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doEdit} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>
      </Modal>

      {/* Modal Visualiser */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="" size="lg">
        {viewItem && (
          <div className="-m-4 -mt-4">
            {/* En-tête vert/emerald */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-700 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {viewItem.prenom?.[0]?.toUpperCase()}{viewItem.nom?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{viewItem.prenom} {viewItem.nom}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {viewItem.sexe && <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full">{viewItem.sexe === 'M' ? 'Homme' : viewItem.sexe === 'F' ? 'Femme' : viewItem.sexe}</span>}
                    {viewItem.nationalite && <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1"><Globe size={10}/> {viewItem.nationalite}</span>}
                  </div>
                </div>
              </div>
            </div>
            {/* Section Identité */}
            <div className="px-5 pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><BookOpen size={11}/> Identité</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Date naissance', val: viewItem.date_naissance ? format(new Date(viewItem.date_naissance), 'dd MMMM yyyy', { locale: fr }) : '—' },
                  { label: 'Lieu naissance', val: viewItem.lieu_naissance || '—' },
                  { label: 'Situation familiale', val: viewItem.situation_familiale || '—' },
                  { label: "Nb enfants", val: String(viewItem.nombre_enfants ?? '—') },
                  { label: 'Origine', val: viewItem.origine || '—' },
                  { label: 'Source contact', val: viewItem.source_contact || '—' },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-emerald-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-emerald-400 font-medium mb-0.5">{label}</p>
                    <p className="font-semibold text-emerald-900 text-sm">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Section Contact */}
            <div className="px-5 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Phone size={11}/> Contact & Localisation</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <Phone size={13} className="text-green-400 mt-0.5 shrink-0"/>
                  <div><p className="text-xs text-green-500 font-medium">Téléphone</p><p className="font-semibold text-green-900 text-sm">{viewItem.telephone || '—'}</p></div>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <Mail size={13} className="text-green-400 mt-0.5 shrink-0"/>
                  <div><p className="text-xs text-green-500 font-medium">Email</p><p className="font-semibold text-green-900 text-sm break-all">{viewItem.email || '—'}</p></div>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <Briefcase size={13} className="text-green-400 mt-0.5 shrink-0"/>
                  <div><p className="text-xs text-green-500 font-medium">Profession</p><p className="font-semibold text-green-900 text-sm">{viewItem.profession || '—'}</p></div>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <MapPin size={13} className="text-green-400 mt-0.5 shrink-0"/>
                  <div><p className="text-xs text-green-500 font-medium">Quartier</p><p className="font-semibold text-green-900 text-sm">{viewItem.quartier || '—'}</p></div>
                </div>
                {viewItem.adresse && (
                  <div className="bg-green-50 rounded-xl px-3 py-2.5 col-span-2 flex items-start gap-2">
                    <MapPin size={13} className="text-green-400 mt-0.5 shrink-0"/>
                    <div><p className="text-xs text-green-500 font-medium">Adresse</p><p className="font-semibold text-green-900 text-sm">{viewItem.adresse}</p></div>
                  </div>
                )}
              </div>
            </div>
            {viewItem.notes && (
              <div className="px-5 pb-3">
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium mb-1">Notes</p>
                  <p className="text-gray-700 text-sm">{viewItem.notes}</p>
                </div>
              </div>
            )}
            <div className="px-5 pb-4 flex items-center justify-between border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">Créé le {format(new Date(viewItem.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
              <button onClick={() => setViewModal(false)} className="btn-secondary text-sm">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Import Excel */}
      <ImportExcelModal
        isOpen={importModal}
        onClose={() => setImportModal(false)}
        onImported={() => { setImportModal(false); fetchPersonnes() }}
        origineOptions={origineOptions}
        langueOptions={langueOptions}
      />

      {/* Dialog désactivation */}
      <ConfirmDialog
        open={!!desactiverDialog}
        onClose={() => setDesactiverDialog(null)}
        onConfirm={doDesactiver}
        title="Désactiver la personne"
        message={`Désactiver ${desactiverDialog?.prenom} ${desactiverDialog?.nom} ? Cette action est réversible.`}
        confirmLabel="Désactiver"
        danger
      />
    </div>
  )
}
