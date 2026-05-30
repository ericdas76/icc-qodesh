import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader, Eye, FileText, FileSpreadsheet, Filter, CalendarOff } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { logEvent } from '../../lib/journal'
import { exportPDF, exportExcel } from '../../lib/export'

const TYPES_CONGE = [
  { val: 'conge', label: 'Congé', color: 'bg-blue-100 text-blue-700' },
  { val: 'sante', label: 'Santé', color: 'bg-red-100 text-red-700' },
  { val: 'autre', label: 'Autre', color: 'bg-slate-100 text-slate-700' },
]

const emptyForm = {
  ordre: '',
  prenom_nom: '',
  sexe: '',
  categorie: '',
  departement: '',
  type_conge: '',
  description: '',
  date_debut: '',
  date_fin: '',
  remarque_speciale: '',
  annee: new Date().getFullYear(),
}

const COLS_EXPORT = [
  { header: 'N°', key: 'ordre', width: 6 },
  { header: 'Prénom & Nom', key: 'prenom_nom', width: 28 },
  { header: 'Sexe', key: 'sexe', width: 8 },
  { header: 'Catégorie', key: 'categorie', width: 18 },
  { header: 'Département', key: 'departement', width: 20 },
  { header: 'Type', key: 'type_conge', width: 12 },
  { header: 'Début', key: 'date_debut', width: 14 },
  { header: 'Fin', key: 'date_fin', width: 14 },
  { header: 'Durée (j)', key: '_duree', width: 10 },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Remarque', key: 'remarque_speciale', width: 30 },
]

function calcDuree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return '—'
  const d = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86400000) + 1
  return d > 0 ? `${d} j` : '—'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

export default function ActivitesConges() {
  const { user, hasPermission } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewItem, setViewItem] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear())
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [filterAnnee])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('activites_conges')
      .select('*')
      .eq('actif', true)
      .eq('annee', filterAnnee)
      .order('ordre', { nullsFirst: false })
    setItems(data || [])
    setLoading(false)
  }

  const filtered = items.filter(a => {
    if (filterType && a.type_conge !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(a.prenom_nom || '').toLowerCase().includes(q) &&
          !(a.departement || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setModal(true)
  }

  const openEdit = (a: any) => {
    setEditItem(a)
    setForm({
      ordre: a.ordre?.toString() || '',
      prenom_nom: a.prenom_nom || '',
      sexe: a.sexe || '',
      categorie: a.categorie || '',
      departement: a.departement || '',
      type_conge: a.type_conge || '',
      description: a.description || '',
      date_debut: a.date_debut || '',
      date_fin: a.date_fin || '',
      remarque_speciale: a.remarque_speciale || '',
      annee: a.annee || new Date().getFullYear(),
    })
    setModal(true)
  }

  const openView = (a: any) => {
    setViewItem(a)
    setViewModal(true)
  }

  const save = async () => {
    if (!form.prenom_nom.trim()) return toast.error('Prénom & Nom requis')
    setSaving(true)
    const payload: any = {
      ordre: form.ordre ? parseInt(form.ordre) : null,
      prenom_nom: form.prenom_nom.trim(),
      sexe: (form.sexe as 'M' | 'F') || null,
      categorie: form.categorie || null,
      departement: form.departement || null,
      type_conge: (form.type_conge as 'conge' | 'sante' | 'autre') || null,
      description: form.description || null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
      remarque_speciale: form.remarque_speciale || null,
      annee: form.annee,
      annee_conge: form.annee,
      auteur_id: user?.id,
    }
    // Calcul du mois depuis date_debut
    if (form.date_debut) {
      payload.mois = new Date(form.date_debut).getMonth() + 1
    }
    const { error } = editItem
      ? await supabase.from('activites_conges').update(payload).eq('id', editItem.id)
      : await supabase.from('activites_conges').insert({ ...payload, actif: true })
    if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
    await logEvent('activites', editItem ? 'modification' : 'creation',
      `Congé ${editItem ? 'modifié' : 'créé'} : ${form.prenom_nom}`, editItem?.id)
    toast.success('Enregistré')
    setModal(false)
    fetchData()
    setSaving(false)
  }

  const supprimer = async (a: any) => {
    await supabase.from('activites_conges').update({ actif: false }).eq('id', a.id)
    toast.success('Supprimé')
    fetchData()
  }

  const doExportData = () => filtered.map(a => ({ ...a, _duree: calcDuree(a.date_debut, a.date_fin) }))

  const doExportPDF = () => exportPDF(
    `Congés ${filterAnnee}`,
    COLS_EXPORT,
    doExportData(),
    `${filtered.length} entrée(s) • Année ${filterAnnee}${filterType ? ` • ${filterType}` : ''}`
  )

  const doExportExcel = () => exportExcel(
    `Congés_${filterAnnee}`,
    COLS_EXPORT,
    doExportData(),
    `Congés ${filterAnnee}`
  )

  const typeBadge = (t: string | null) => {
    const cfg = TYPES_CONGE.find(x => x.val === t)
    return cfg ? <span className={`badge ${cfg.color}`}>{cfg.label}</span> : <span className="text-slate-400">—</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Congés {filterAnnee}</h3>
          <p className="text-sm text-slate-500">{filtered.length} entrée{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select className="input w-auto text-sm" value={filterAnnee}
            onChange={e => setFilterAnnee(parseInt(e.target.value))}>
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input w-auto text-sm" value={filterType}
            onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous types</option>
            {TYPES_CONGE.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
          </select>
          <input className="input w-auto text-sm" placeholder="Recherche…" value={search}
            onChange={e => setSearch(e.target.value)} />
          <button onClick={doExportPDF} className="btn-secondary text-xs gap-1" title="Export PDF">
            <FileText size={14} />
          </button>
          <button onClick={doExportExcel} className="btn-secondary text-xs gap-1" title="Export Excel">
            <FileSpreadsheet size={14} />
          </button>
          {hasPermission('activites', 'creer') && (
            <button onClick={openAdd} className="btn-primary">
              <Plus size={16} /> Nouveau
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarOff} title="Aucun congé enregistré" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">N°</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Prénom & Nom</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Sexe</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Dép.</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Type</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Début</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Fin</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Durée</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-slate-400">{a.ordre || '—'}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-800">{a.prenom_nom}</td>
                    <td className="px-2 py-1.5 text-slate-500">{a.sexe || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-500 max-w-20 truncate">{a.departement || '—'}</td>
                    <td className="px-2 py-1.5">{typeBadge(a.type_conge)}</td>
                    <td className="px-2 py-1.5 text-slate-600">{fmtDate(a.date_debut)}</td>
                    <td className="px-2 py-1.5 text-slate-600">{fmtDate(a.date_fin)}</td>
                    <td className="px-2 py-1.5 font-semibold text-slate-700">{calcDuree(a.date_debut, a.date_fin)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={() => openView(a)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                          <Eye size={13} />
                        </button>
                        {hasPermission('activites', 'modifier') && (
                          <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                            <Edit size={13} />
                          </button>
                        )}
                        {hasPermission('activites', 'supprimer') && (
                          <button onClick={() => setDeleteItem(a)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500">
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
        </div>
      )}

      {/* Modal Ajouter / Modifier */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editItem ? 'Modifier le congé' : 'Nouveau congé'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">N° Ordre</label>
            <input className="input" value={form.ordre}
              onChange={e => setForm(p => ({ ...p, ordre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Année</label>
            <input type="number" className="input" value={form.annee}
              onChange={e => setForm(p => ({ ...p, annee: parseInt(e.target.value) }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Prénom & Nom *</label>
            <input className="input" value={form.prenom_nom}
              onChange={e => setForm(p => ({ ...p, prenom_nom: e.target.value }))}
              placeholder="Jean RAKOTO" />
          </div>
          <div>
            <label className="label">Sexe</label>
            <select className="input" value={form.sexe}
              onChange={e => setForm(p => ({ ...p, sexe: e.target.value }))}>
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>
          <div>
            <label className="label">Type congé</label>
            <select className="input" value={form.type_conge}
              onChange={e => setForm(p => ({ ...p, type_conge: e.target.value }))}>
              <option value="">—</option>
              {TYPES_CONGE.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Catégorie</label>
            <input className="input" value={form.categorie}
              onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))} />
          </div>
          <div>
            <label className="label">Département</label>
            <input className="input" value={form.departement}
              onChange={e => setForm(p => ({ ...p, departement: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date début <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={form.date_debut}
              onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date fin <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={form.date_fin}
              onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} />
          </div>
          {form.date_debut && form.date_fin && (
            <div className="col-span-2 bg-blue-50 rounded p-2 text-sm text-blue-700">
              Durée : <strong>{calcDuree(form.date_debut, form.date_fin)}</strong>
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Remarque spéciale</label>
            <textarea className="input min-h-12 resize-none" value={form.remarque_speciale}
              onChange={e => setForm(p => ({ ...p, remarque_speciale: e.target.value }))} />
          </div>
        </div>
          <p className="text-xs text-slate-400 mt-1"><span className="text-red-500">*</span> Champ obligatoire</p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving && <Loader size={14} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </Modal>

      {/* Modal Visualiser */}
      <Modal open={viewModal} onClose={() => setViewModal(false)}
        title="Détail congé" size="md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="label">Prénom & Nom</span><p className="font-semibold">{viewItem.prenom_nom}</p></div>
              <div><span className="label">Sexe</span><p>{viewItem.sexe || '—'}</p></div>
              <div><span className="label">Catégorie</span><p>{viewItem.categorie || '—'}</p></div>
              <div><span className="label">Département</span><p>{viewItem.departement || '—'}</p></div>
              <div><span className="label">Type</span><p>{typeBadge(viewItem.type_conge)}</p></div>
              <div><span className="label">Année</span><p>{viewItem.annee}</p></div>
              <div><span className="label">Date début</span><p>{fmtDate(viewItem.date_debut)}</p></div>
              <div><span className="label">Date fin</span><p>{fmtDate(viewItem.date_fin)}</p></div>
            </div>
            <div className="bg-blue-50 rounded p-3 text-center">
              <span className="text-blue-600 font-bold text-lg">
                {calcDuree(viewItem.date_debut, viewItem.date_fin)}
              </span>
              <p className="text-xs text-blue-400">durée totale</p>
            </div>
            {viewItem.description && <div><span className="label">Description</span><p>{viewItem.description}</p></div>}
            {viewItem.remarque_speciale && <div><span className="label">Remarque</span><p>{viewItem.remarque_speciale}</p></div>}
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewModal(false)} className="btn-secondary">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && supprimer(deleteItem)}
        title="Supprimer"
        message="Supprimer cet enregistrement ?"
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
