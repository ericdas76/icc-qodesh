import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader, Eye, FileText, FileSpreadsheet, Radio } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../../lib/journal'
import { exportPDF, exportExcel } from '../../lib/export'

const TYPES_RNA = [
  'Culte de quartier',
  'Retraite',
  'Évangélisation',
  'Veillée',
  'Formation RNA',
  'Autre',
]

const emptyForm = {
  ordre: '',
  date_activite: '',
  responsable: '',
  type_activite: '',
  lieu: '',
  heure_debut: '',
  heure_fin: '',
  duree_minutes: '',
  hommes: 0,
  femmes: 0,
  enfants: 0,
  comptage: '',
  notes: '',
}

const COLS_EXPORT = [
  { header: 'N°', key: 'ordre', width: 6 },
  { header: 'Date', key: 'date_activite', width: 14 },
  { header: 'Responsable', key: 'responsable', width: 24 },
  { header: 'Type', key: 'type_activite', width: 20 },
  { header: 'Lieu', key: 'lieu', width: 20 },
  { header: 'Début', key: 'heure_debut', width: 10 },
  { header: 'Fin', key: 'heure_fin', width: 10 },
  { header: 'Durée (min)', key: 'duree_minutes', width: 12 },
  { header: 'Hommes', key: 'hommes', width: 10 },
  { header: 'Femmes', key: 'femmes', width: 10 },
  { header: 'Enfants', key: 'enfants', width: 10 },
  { header: 'Total', key: 'effectif', width: 10 },
  { header: 'Notes', key: 'notes', width: 30 },
]

function calcDureeMinutes(debut: string, fin: string): number {
  if (!debut || !fin) return 0
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  const total = (fh * 60 + fm) - (dh * 60 + dm)
  return total > 0 ? total : 0
}

function fmtDate(d: string): string {
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: fr }) } catch { return d }
}

export default function ActivitesRNA() {
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
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => { fetchData() }, [filterFrom, filterTo, filterType])

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('activites_rna').select('*').eq('actif', true)
    if (filterFrom) q = q.gte('date_activite', filterFrom)
    if (filterTo) q = q.lte('date_activite', filterTo)
    if (filterType) q = q.eq('type_activite', filterType)
    const { data } = await q.order('date_activite', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setModal(true)
  }

  const openEdit = (a: any) => {
    setEditItem(a)
    setForm({
      ordre: a.ordre?.toString() || '',
      date_activite: a.date_activite || '',
      responsable: a.responsable || '',
      type_activite: a.type_activite || '',
      lieu: a.lieu || '',
      heure_debut: a.heure_debut || '',
      heure_fin: a.heure_fin || '',
      duree_minutes: a.duree_minutes?.toString() || '',
      hommes: a.hommes || 0,
      femmes: a.femmes || 0,
      enfants: a.enfants || 0,
      comptage: a.comptage || '',
      notes: a.notes || '',
    })
    setModal(true)
  }

  const openView = (a: any) => {
    setViewItem(a)
    setViewModal(true)
  }

  const handleHeureChange = (field: 'heure_debut' | 'heure_fin', val: string) => {
    const newForm = { ...form, [field]: val }
    if (newForm.heure_debut && newForm.heure_fin) {
      const duree = calcDureeMinutes(newForm.heure_debut, newForm.heure_fin)
      setForm({ ...newForm, duree_minutes: duree > 0 ? duree.toString() : '' })
    } else {
      setForm(newForm)
    }
  }

  const calcEffectif = (h: number, f: number, e: number) => h + f + e

  const save = async () => {
    if (!form.date_activite) return toast.error('Date requise')
    setSaving(true)
    const effectif = calcEffectif(form.hommes, form.femmes, form.enfants)
    const payload = {
      ordre: form.ordre ? parseInt(form.ordre) : null,
      date_activite: form.date_activite,
      responsable: form.responsable || null,
      type_activite: form.type_activite || null,
      lieu: form.lieu || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      duree_minutes: form.duree_minutes ? parseInt(form.duree_minutes) : null,
      effectif,
      hommes: form.hommes || 0,
      femmes: form.femmes || 0,
      enfants: form.enfants || 0,
      comptage: form.comptage || null,
      notes: form.notes || null,
      auteur_id: user?.id,
    }
    const { error } = editItem
      ? await supabase.from('activites_rna').update(payload).eq('id', editItem.id)
      : await supabase.from('activites_rna').insert({ ...payload, actif: true })
    if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
    await logEvent('activites', editItem ? 'modification' : 'creation',
      `RNA ${editItem ? 'modifié' : 'créé'} du ${form.date_activite}`, editItem?.id)
    toast.success('Enregistré')
    setModal(false)
    fetchData()
    setSaving(false)
  }

  const supprimer = async (a: any) => {
    await supabase.from('activites_rna').update({ actif: false }).eq('id', a.id)
    toast.success('Supprimé')
    fetchData()
  }

  // Stats
  const totalH = items.reduce((s, a) => s + (a.hommes || 0), 0)
  const totalF = items.reduce((s, a) => s + (a.femmes || 0), 0)
  const totalE = items.reduce((s, a) => s + (a.enfants || 0), 0)
  const totalEffectif = totalH + totalF + totalE

  const doExportPDF = () => exportPDF('Activités RNA', COLS_EXPORT, items, `${items.length} activité(s)`)
  const doExportExcel = () => exportExcel('Activites_RNA', COLS_EXPORT, items, 'RNA')

  const setNum = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [field]: parseInt(e.target.value) || 0 }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Activités RNA</h3>
          <p className="text-sm text-slate-500">{items.length} activité{items.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select className="input w-auto text-sm" value={filterType}
            onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous types</option>
            {TYPES_RNA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" className="input w-auto text-sm" value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)} />
          <span className="text-slate-400 text-sm">→</span>
          <input type="date" className="input w-auto text-sm" value={filterTo}
            onChange={e => setFilterTo(e.target.value)} />
          <button onClick={doExportPDF} className="btn-secondary text-xs" title="Export PDF">
            <FileText size={14} />
          </button>
          <button onClick={doExportExcel} className="btn-secondary text-xs" title="Export Excel">
            <FileSpreadsheet size={14} />
          </button>
          {hasPermission('activites', 'creer') && (
            <button onClick={openAdd} className="btn-primary">
              <Plus size={16} /> Nouvelle activité
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total effectif', val: totalEffectif, color: 'text-slate-700' },
          { label: 'Hommes', val: totalH, color: 'text-blue-600' },
          { label: 'Femmes', val: totalF, color: 'text-pink-500' },
          { label: 'Enfants', val: totalE, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Radio} title="Aucune activité RNA enregistrée" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Date</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Responsable</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Type</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Lieu</th>
                  <th className="px-2 py-2 text-center font-semibold text-blue-600">H</th>
                  <th className="px-2 py-2 text-center font-semibold text-pink-500">F</th>
                  <th className="px-2 py-2 text-center font-semibold text-green-600">E</th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-500">Total</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 font-medium text-slate-700">{fmtDate(a.date_activite)}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-28 truncate">{a.responsable || '—'}</td>
                    <td className="px-2 py-1.5">
                      {a.type_activite
                        ? <span className="badge bg-purple-100 text-purple-700">{a.type_activite}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 max-w-24 truncate">{a.lieu || '—'}</td>
                    <td className="px-2 py-1.5 text-center text-blue-600">{a.hommes || 0}</td>
                    <td className="px-2 py-1.5 text-center text-pink-500">{a.femmes || 0}</td>
                    <td className="px-2 py-1.5 text-center text-green-600">{a.enfants || 0}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-slate-700">
                      {(a.hommes || 0) + (a.femmes || 0) + (a.enfants || 0)}
                    </td>
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
        title={editItem ? 'Modifier l\'activité RNA' : 'Nouvelle activité RNA'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">N° Ordre</label>
            <input className="input" value={form.ordre}
              onChange={e => setForm(p => ({ ...p, ordre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.date_activite}
              onChange={e => setForm(p => ({ ...p, date_activite: e.target.value }))} />
          </div>
          <div>
            <label className="label">Responsable</label>
            <input className="input" value={form.responsable}
              onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} />
          </div>
          <div>
            <label className="label">Type d'activité</label>
            <select className="input" value={form.type_activite}
              onChange={e => setForm(p => ({ ...p, type_activite: e.target.value }))}>
              <option value="">—</option>
              {TYPES_RNA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Lieu</label>
            <input className="input" value={form.lieu}
              onChange={e => setForm(p => ({ ...p, lieu: e.target.value }))} />
          </div>
          <div>
            <label className="label">Heure début</label>
            <input type="time" className="input" value={form.heure_debut}
              onChange={e => handleHeureChange('heure_debut', e.target.value)} />
          </div>
          <div>
            <label className="label">Heure fin</label>
            <input type="time" className="input" value={form.heure_fin}
              onChange={e => handleHeureChange('heure_fin', e.target.value)} />
          </div>
          <div>
            <label className="label">Durée (min) — auto</label>
            <input type="number" className="input bg-slate-50" value={form.duree_minutes}
              onChange={e => setForm(p => ({ ...p, duree_minutes: e.target.value }))} />
          </div>
          <div className="col-span-2 bg-slate-50 rounded p-2 text-xs text-slate-500">
            Effectif total = H + F + E = <strong>
              {calcEffectif(form.hommes, form.femmes, form.enfants)}
            </strong>
          </div>
          <div>
            <label className="label">Hommes</label>
            <input type="number" className="input" min={0} value={form.hommes} onChange={setNum('hommes')} />
          </div>
          <div>
            <label className="label">Femmes</label>
            <input type="number" className="input" min={0} value={form.femmes} onChange={setNum('femmes')} />
          </div>
          <div>
            <label className="label">Enfants</label>
            <input type="number" className="input" min={0} value={form.enfants} onChange={setNum('enfants')} />
          </div>
          <div>
            <label className="label">Comptage</label>
            <input className="input" value={form.comptage}
              onChange={e => setForm(p => ({ ...p, comptage: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input min-h-12 resize-none" value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Détail activité RNA" size="md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="label">Date</span><p className="font-semibold">{fmtDate(viewItem.date_activite)}</p></div>
              <div><span className="label">Type</span>
                <p>{viewItem.type_activite
                  ? <span className="badge bg-purple-100 text-purple-700">{viewItem.type_activite}</span>
                  : '—'}</p>
              </div>
              <div><span className="label">Responsable</span><p>{viewItem.responsable || '—'}</p></div>
              <div><span className="label">Lieu</span><p>{viewItem.lieu || '—'}</p></div>
              <div><span className="label">Heure début</span><p>{viewItem.heure_debut || '—'}</p></div>
              <div><span className="label">Heure fin</span><p>{viewItem.heure_fin || '—'}</p></div>
              <div><span className="label">Durée</span><p>{viewItem.duree_minutes ? `${viewItem.duree_minutes} min` : '—'}</p></div>
            </div>
            <div className="grid grid-cols-4 gap-3 bg-slate-50 rounded p-3 text-center">
              <div><p className="text-2xl font-bold text-blue-600">{viewItem.hommes || 0}</p><p className="text-xs text-slate-400">Hommes</p></div>
              <div><p className="text-2xl font-bold text-pink-500">{viewItem.femmes || 0}</p><p className="text-xs text-slate-400">Femmes</p></div>
              <div><p className="text-2xl font-bold text-green-600">{viewItem.enfants || 0}</p><p className="text-xs text-slate-400">Enfants</p></div>
              <div><p className="text-2xl font-bold text-slate-700">{(viewItem.hommes||0)+(viewItem.femmes||0)+(viewItem.enfants||0)}</p><p className="text-xs text-slate-400">Total</p></div>
            </div>
            {viewItem.notes && <div><span className="label">Notes</span><p>{viewItem.notes}</p></div>}
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
        title="Supprimer" message="Supprimer cette activité RNA ?"
        confirmLabel="Supprimer" danger
      />
    </div>
  )
}
