import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Eye, Edit2, UserX, Download, FileText, Users } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel, exportPDF } from '../lib/export'

// ─── Constantes statiques (hors composant) ───────────────────────────────────
const STATUTS_FILTRE = ['', 'nouveau', 'fi', 'formation', 'star', 'departement', 'libere', 'inactif']

const COLS_EXPORT = [
  { header: 'N° Membre', key: 'numero_membre' },
  { header: 'Nom', key: 'personnes.nom' },
  { header: 'Prénom', key: 'personnes.prenom' },
  { header: 'Téléphone', key: 'personnes.telephone' },
  { header: 'Catégorie', key: 'categorie' },
  { header: 'Statut', key: 'statut' },
  { header: 'Département', key: 'departement' },
  { header: 'Date adhésion', key: 'date_adhesion' },
]

const emptyForm = {
  personne_id: '',
  numero_membre: '',
  date_adhesion: format(new Date(), 'yyyy-MM-dd'),
  statut: 'nouveau',
  categorie: 'Nouveau',
  departement: '',
  date_liberation: '',
  motif_liberation: '',
}

// ─── Formulaire extrait HORS du composant parent (fix bug curseur) ─────────────
interface MembreFormProps {
  isEdit?: boolean
  form: typeof emptyForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  personnesList: any[]
  editItem: any | null
  statutOptions: string[]
  categorieOptions: string[]
  departementOptions: string[]
}

function MembreForm({
  isEdit,
  form,
  setForm,
  personnesList,
  editItem,
  statutOptions,
  categorieOptions,
  departementOptions,
}: MembreFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Personne *</label>
        {isEdit ? (
          <p className="input bg-gray-50 text-gray-700">
            {editItem?.personnes?.prenom} {editItem?.personnes?.nom}
            <span className="text-xs text-gray-400 ml-2">(non modifiable)</span>
          </p>
        ) : (
          <select
            className="input"
            value={form.personne_id}
            onChange={e => setForm(f => ({ ...f, personne_id: e.target.value }))}
          >
            <option value="">-- Sélectionner une personne --</option>
            {personnesList.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}{p.telephone ? ` — ${p.telephone}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">N° Membre</label>
          <input
            className="input"
            value={form.numero_membre}
            onChange={e => setForm(f => ({ ...f, numero_membre: e.target.value }))}
            placeholder="Ex : ICC-2025-001"
          />
        </div>
        <div>
          <label className="label">Date d'adhésion</label>
          <input
            type="date"
            className="input"
            value={form.date_adhesion}
            onChange={e => setForm(f => ({ ...f, date_adhesion: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Catégorie</label>
          <select
            className="input"
            value={form.categorie}
            onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
          >
            <option value="">-- Sélectionner --</option>
            {categorieOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select
            className="input"
            value={form.statut}
            onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
          >
            {statutOptions.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Département</label>
          <select
            className="input"
            value={form.departement}
            onChange={e => setForm(f => ({ ...f, departement: e.target.value }))}
          >
            <option value="">-- Sélectionner --</option>
            {departementOptions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date de libération</label>
          <input
            type="date"
            className="input"
            value={form.date_liberation}
            onChange={e => setForm(f => ({ ...f, date_liberation: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <label className="label">Motif de libération</label>
          <input
            className="input"
            value={form.motif_liberation}
            onChange={e => setForm(f => ({ ...f, motif_liberation: e.target.value }))}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function MembresPage() {
  const { hasPermission, user } = useAuth()
  const [membres, setMembres] = useState<any[]>([])
  const [personnesList, setPersonnesList] = useState<any[]>([])
  const [statutOptions, setStatutOptions] = useState<string[]>([])
  const [categorieOptions, setCategorieOptions] = useState<string[]>([])
  const [departementOptions, setDepartementOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  // Modals
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [desactiverDialog, setDesactiverDialog] = useState<any | null>(null)

  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('membres', 'creer')
  const canEdit = hasPermission('membres', 'modifier')
  const canDelete = hasPermission('membres', 'supprimer')
  const canExport = hasPermission('membres', 'exporter')

  useEffect(() => {
    fetchMembres()
    fetchPersonnes()
    fetchListes()
  }, [])

  const fetchListes = async () => {
    const { data } = await supabase
      .from('listes_parametrables')
      .select('categorie, valeur, ordre')
      .in('categorie', ['statut_membre', 'departement'])
      .eq('actif', true)
      .order('ordre')
    if (data) {
      setCategorieOptions(data.filter(d => d.categorie === 'statut_membre').map(d => d.valeur))
      setDepartementOptions(data.filter(d => d.categorie === 'departement').map(d => d.valeur))
    }
  }

  const fetchMembres = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('membres')
      .select('*, personnes(*)')
      .eq('actif', true)
      .order('created_at', { ascending: false })
    setMembres(data || [])
    setLoading(false)
  }

  const fetchPersonnes = async () => {
    const { data: membresExist } = await supabase.from('membres').select('personne_id').eq('actif', true)
    const existingIds = (membresExist || []).map((m: any) => m.personne_id)
    const { data } = await supabase.from('personnes').select('id, nom, prenom, telephone').eq('actif', true).order('nom')
    setPersonnesList((data || []).filter((p: any) => !existingIds.includes(p.id)))
  }

  const filtered = membres.filter(m => {
    const s = search.toLowerCase()
    const p = m.personnes || {}
    const matchSearch = !search ||
      (p.nom || '').toLowerCase().includes(s) ||
      (p.prenom || '').toLowerCase().includes(s) ||
      (p.telephone || '').includes(s) ||
      (m.numero_membre || '').toLowerCase().includes(s)
    const matchStatut = !filterStatut || m.statut === filterStatut
    return matchSearch && matchStatut
  })

  // --- Ajouter ---
  const openAdd = () => {
    setForm({ ...emptyForm })
    setAddModal(true)
  }

  const doAdd = async () => {
    if (!form.personne_id) { toast.error('Sélectionner une personne'); return }
    setSaving(true)
    const { data, error } = await supabase.from('membres').insert({
      personne_id: form.personne_id,
      numero_membre: form.numero_membre || null,
      date_adhesion: form.date_adhesion || null,
      statut: form.statut,
      categorie: form.categorie || null,
      departement: form.departement || null,
      date_liberation: form.date_liberation || null,
      motif_liberation: form.motif_liberation || null,
    }).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('membres', 'creer', data.id, `Création membre`)
    toast.success('Membre créé')
    setAddModal(false)
    fetchMembres()
    fetchPersonnes()
  }

  // --- Modifier ---
  const openEdit = (m: any) => {
    setEditItem(m)
    setForm({
      personne_id: m.personne_id,
      numero_membre: m.numero_membre || '',
      date_adhesion: m.date_adhesion || '',
      statut: m.statut || 'nouveau',
      categorie: m.categorie || 'Nouveau',
      departement: m.departement || '',
      date_liberation: m.date_liberation || '',
      motif_liberation: m.motif_liberation || '',
    })
    setEditModal(true)
  }

  const doEdit = async () => {
    if (!editItem) return
    setSaving(true)
    const { error } = await supabase.from('membres').update({
      numero_membre: form.numero_membre || null,
      date_adhesion: form.date_adhesion || null,
      statut: form.statut,
      categorie: form.categorie || null,
      departement: form.departement || null,
      date_liberation: form.date_liberation || null,
      motif_liberation: form.motif_liberation || null,
    }).eq('id', editItem.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('membres', 'modifier', editItem.id, `Modification membre`)
    toast.success('Membre mis à jour')
    setEditModal(false)
    fetchMembres()
  }

  // --- Visualiser ---
  const openView = (m: any) => { setViewItem(m); setViewModal(true) }

  // --- Désactiver ---
  const doDesactiver = async () => {
    if (!desactiverDialog) return
    const { error } = await supabase.from('membres').update({ actif: false }).eq('id', desactiverDialog.id)
    if (error) { toast.error('Erreur'); return }
    await logEvent('membres', 'supprimer', desactiverDialog.id, `Désactivation membre`)
    toast.success('Membre désactivé')
    setDesactiverDialog(null)
    fetchMembres()
    fetchPersonnes()
  }

  // --- Export ---
  const doExportExcel = () => exportExcel('Membres', COLS_EXPORT, filtered, 'Membres')
  const doExportPDF = () => exportPDF('Liste des Membres', COLS_EXPORT, filtered, `${filtered.length} membre(s)`)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membres</h1>
          <p className="text-gray-500 text-sm">{filtered.length} membre{filtered.length > 1 ? 's' : ''}</p>
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
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Nom, prénom, n° membre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
            <option value="">Tous les statuts</option>
            {STATUTS_FILTRE.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
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
            title="Aucun membre trouvé"
            description="Aucun membre ne correspond à votre recherche."
            action={canCreate ? (
              <button onClick={openAdd} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Ajouter un membre
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">N° Membre</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nom complet</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Téléphone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Catégorie</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Département</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Adhésion</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{m.numero_membre || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.personnes?.prenom} {m.personnes?.nom}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.personnes?.telephone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.categorie || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge statut={m.statut} /></td>
                    <td className="px-4 py-3 text-gray-600">{m.departement || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.date_adhesion ? format(new Date(m.date_adhesion), 'dd MMM yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openView(m)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Visualiser">
                          <Eye size={15} />
                        </button>
                        {canEdit && (
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                            <Edit2 size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDesactiverDialog(m)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Désactiver">
                            <UserX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajouter */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Nouveau membre" size="lg">
        <MembreForm
          form={form}
          setForm={setForm}
          personnesList={personnesList}
          editItem={null}
          statutOptions={STATUTS_FILTRE}
          categorieOptions={categorieOptions}
          departementOptions={departementOptions}
        />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doAdd} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* Modal Modifier */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={`Modifier — ${editItem?.personnes?.prenom} ${editItem?.personnes?.nom}`}
        size="lg"
      >
        <MembreForm
          isEdit
          form={form}
          setForm={setForm}
          personnesList={personnesList}
          editItem={editItem}
          statutOptions={STATUTS_FILTRE}
          categorieOptions={categorieOptions}
          departementOptions={departementOptions}
        />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doEdit} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>
      </Modal>

      {/* Modal Visualiser */}
      <Modal
        isOpen={viewModal}
        onClose={() => setViewModal(false)}
        title={`Fiche membre — ${viewItem?.personnes?.prenom} ${viewItem?.personnes?.nom}`}
        size="md"
      >
        {viewItem && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['N° Membre', viewItem.numero_membre || '—'],
                ['Catégorie', viewItem.categorie || '—'],
                ['Statut', viewItem.statut],
                ['Département', viewItem.departement || '—'],
                ['Date adhésion', viewItem.date_adhesion ? format(new Date(viewItem.date_adhesion), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Téléphone', viewItem.personnes?.telephone || '—'],
                ['Email', viewItem.personnes?.email || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-gray-900">{val}</p>
                </div>
              ))}
            </div>
            {viewItem.date_liberation && (
              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <p className="text-xs text-orange-600 font-semibold mb-1">Libération</p>
                <p>Date : {format(new Date(viewItem.date_liberation), 'dd MMMM yyyy', { locale: fr })}</p>
                {viewItem.motif_liberation && <p>Motif : {viewItem.motif_liberation}</p>}
              </div>
            )}
            <div className="text-xs text-gray-400 border-t pt-3">
              Créé le {format(new Date(viewItem.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setViewModal(false)} className="btn-secondary">Fermer</button>
        </div>
      </Modal>

      {/* Dialog désactivation */}
      <ConfirmDialog
        open={!!desactiverDialog}
        onClose={() => setDesactiverDialog(null)}
        onConfirm={doDesactiver}
        title="Désactiver le membre"
        message={`Désactiver ${desactiverDialog?.personnes?.prenom} ${desactiverDialog?.personnes?.nom} ?`}
        confirmLabel="Désactiver"
        danger
      />
    </div>
  )
}
