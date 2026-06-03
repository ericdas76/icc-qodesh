import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, Eye, Edit2, Trash2, BookOpen, Users,
  GraduationCap, Lock, List, Clock
} from 'lucide-react'
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

  const PromoForm = () => (
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
        <PromoForm />
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
        <PromoForm />
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
// ONGLET 3 — CLASSES EN COURS (placeholder étape 2 → développé étape 3)
// =========================================================================
function ClassesEnCoursTab({
  formations, promotions, typesPcnc,
  canCreate, canEdit, canDelete, onRefresh
}: {
  formations: any[], promotions: any[], typesPcnc: any[],
  canCreate: boolean, canEdit: boolean, canDelete: boolean,
  onRefresh: () => void
}) {
  return (
    <div className="card p-8 text-center text-gray-400">
      <Clock size={36} className="mx-auto mb-3 text-gray-300" />
      <p className="font-medium text-gray-500">Classes en cours</p>
      <p className="text-xs mt-1 text-gray-400">Cette section sera disponible à l'étape suivante.</p>
    </div>
  )
}

// =========================================================================
// ONGLET 4 — CLASSES CLÔTURÉES (placeholder étape 2 → développé étape 5)
// =========================================================================
function ClassesCloatureesTab({
  formations, onRefresh
}: {
  formations: any[], onRefresh: () => void
}) {
  return (
    <div className="card p-8 text-center text-gray-400">
      <Lock size={36} className="mx-auto mb-3 text-gray-300" />
      <p className="font-medium text-gray-500">Classes clôturées</p>
      <p className="text-xs mt-1 text-gray-400">Cette section sera disponible prochainement.</p>
    </div>
  )
}
