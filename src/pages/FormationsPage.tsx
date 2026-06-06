import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, Eye, Edit2, Trash2, BookOpen, Users,
  GraduationCap, Lock, List, Download, Save, Loader, Unlock, CalendarDays
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

type Onglet = 'promotions' | 'types' | 'en_cours' | 'cloturees'

const ONGLETS: { id: Onglet; label: string; icon: React.ReactNode }[] = [
  { id: 'promotions',  label: 'Promotions',               icon: <List size={15} /> },
  { id: 'types',       label: 'Types de classes',          icon: <BookOpen size={15} /> },
  { id: 'en_cours',    label: 'Classes en cours',          icon: <GraduationCap size={15} /> },
  { id: 'cloturees',   label: 'Classes clôturées',         icon: <Lock size={15} /> },
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
      <Modal open={viewModal} onClose={() => setViewModal(false)}
        title={`Promotion — ${viewItem?.nom}`} size="md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">Nom</p><p className="font-medium">{viewItem.nom}</p></div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p>{viewItem.date_promotion
                  ? format(new Date(viewItem.date_promotion), 'dd MMMM yyyy', { locale: fr })
                  : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Classes associées</p>
                <p>{formations.filter(f => f.promotion_id === viewItem.id).length}</p>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-xs text-gray-500 font-medium mb-2">Classes</p>
              <div className="space-y-1">
                {formations.filter(f => f.promotion_id === viewItem.id).map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50">
                    <span className="font-mono text-blue-700 text-xs">{f.code || '—'}</span>
                    <span className="text-gray-600">
                      {f.ejp_formations_pcnc?.code
                        ? `${f.ejp_formations_pcnc.code} — ${f.ejp_formations_pcnc.libelle || ''}`
                        : f.classe || '—'}
                    </span>
                    {f.cloture && (
                      <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5">Clôturée</span>
                    )}
                  </div>
                ))}
                {formations.filter(f => f.promotion_id === viewItem.id).length === 0 && (
                  <p className="text-xs text-gray-400">Aucune classe</p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setViewModal(false)} className="btn btn-secondary">Fermer</button>
        </div>
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
      <Modal open={viewModal} onClose={() => setViewModal(false)}
        title={`Classe — ${viewItem?.code || '—'}`} size="xl">
        {viewItem && (
          <div className="space-y-5 text-sm">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Identification</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Code',            viewItem.code || '—'],
                  ['Promotion',       viewItem.promotions?.nom || '—'],
                  ['Type PCNC',       viewItem.ejp_formations_pcnc ? `${viewItem.ejp_formations_pcnc.code}${viewItem.ejp_formations_pcnc.libelle ? ' — ' + viewItem.ejp_formations_pcnc.libelle : ''}` : (viewItem.classe || '—')],
                  ['Année',           String(viewItem.annee || '—')],
                  ['Nb séances',      String(viewItem.nb_seance ?? '—')],
                  ['Nb séances oblig.', String(viewItem.nb_seance_obligatoire ?? '—')],
                  ['Date création',   fmtDate(viewItem.date_creation)],
                ].map(([l, v]) => (
                  <div key={l}><p className="text-xs text-gray-400">{l}</p><p className="font-medium">{v}</p></div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Encadrement</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400">Enseignant</p><p className="font-medium">{viewItem.enseignant_nom || (viewItem.enseignant ? `${viewItem.enseignant.prenom} ${viewItem.enseignant.nom}` : '—')}</p></div>
                <div><p className="text-xs text-gray-400">Assistant</p><p className="font-medium">{viewItem.assistant_nom  || (viewItem.assistant  ? `${viewItem.assistant.prenom}  ${viewItem.assistant.nom}`  : '—')}</p></div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Effectifs</h4>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-xs text-gray-400">Femmes</p><p className="font-medium">{viewItem.nb_femme ?? 0}</p></div>
                <div><p className="text-xs text-gray-400">Hommes</p><p className="font-medium">{viewItem.nb_homme ?? 0}</p></div>
                <div><p className="text-xs text-gray-400">Total</p><p className="font-bold text-blue-700">{(viewItem.nb_femme || 0) + (viewItem.nb_homme || 0)}</p></div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informations complémentaires</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Date de fin',     fmtDate(viewItem.date_fin)],
                  ['Examen prévu',    viewItem.examen_prevu ? 'Oui' : 'Non'],
                  ['Redoublants',     String(viewItem.nb_redoublant ?? 0)],
                  ['Abandons',        String(viewItem.nb_abandon ?? 0)],
                ].map(([l, v]) => (
                  <div key={l}><p className="text-xs text-gray-400">{l}</p><p className="font-medium">{v}</p></div>
                ))}
              </div>
              {viewItem.description && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400">Description</p>
                  <p className="mt-1 bg-gray-50 rounded p-2 text-gray-700">{viewItem.description}</p>
                </div>
              )}
            </div>
            {/* Apprenants inscrits */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Apprenants inscrits</h4>
              {(viewItem.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length === 0
                ? <p className="text-xs text-gray-400">Aucun apprenant inscrit</p>
                : <div className="space-y-1 max-h-40 overflow-y-auto">
                    {(viewItem.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').map((i: any) => (
                      <div key={i.id} className="flex items-center gap-2 py-1 border-b border-gray-50">
                        <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{i.statut}</span>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setViewModal(false)} className="btn btn-secondary">Fermer</button>
        </div>
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
      <Modal open={viewModal} onClose={() => setViewModal(false)}
        title={`Classe clôturée — ${viewItem?.code || '—'}`} size="lg">
        {viewItem && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Code',            viewItem.code || '—'],
                ['Promotion',       viewItem.promotions?.nom || '—'],
                ['Type PCNC',       viewItem.ejp_formations_pcnc
                  ? `${viewItem.ejp_formations_pcnc.code}${viewItem.ejp_formations_pcnc.libelle ? ' — ' + viewItem.ejp_formations_pcnc.libelle : ''}`
                  : (viewItem.classe || '—')],
                ['Année',           String(viewItem.annee || '—')],
                ['Enseignant',      viewItem.enseignant_nom || (viewItem.enseignant ? `${viewItem.enseignant.prenom} ${viewItem.enseignant.nom}` : '—')],
                ['Assistant',       viewItem.assistant_nom  || (viewItem.assistant  ? `${viewItem.assistant.prenom}  ${viewItem.assistant.nom}`  : '—')],
                ['Nb femmes',       String(viewItem.nb_femme  ?? 0)],
                ['Nb hommes',       String(viewItem.nb_homme  ?? 0)],
                ['Total inscrits',  String((viewItem.nb_femme || 0) + (viewItem.nb_homme || 0))],
                ['Examen prévu',    viewItem.examen_prevu ? 'Oui' : 'Non'],
                ['Redoublants',     String(viewItem.nb_redoublant ?? 0)],
                ['Abandons',        String(viewItem.nb_abandon ?? 0)],
                ['Date de fin',     fmtDate(viewItem.date_fin)],
              ].map(([l, v]) => (
                <div key={l}><p className="text-xs text-gray-400">{l}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            {viewItem.description && (
              <div>
                <p className="text-xs text-gray-400">Description</p>
                <p className="mt-1 bg-gray-50 rounded p-2 text-gray-700">{viewItem.description}</p>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setViewModal(false)} className="btn btn-secondary">Fermer</button>
        </div>
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
