import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader, Eye, FileText, FileSpreadsheet, Star, Calendar, Clock, Users } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../../lib/journal'
import { exportPDF, exportExcel } from '../../lib/export'

const emptyForm = {
  ordre: '',
  date_activite: '',
  conducteurs_priere: '',
  heure_debut: '',
  heure_fin: '',
  duree_minutes: '',
  nombre_star: 0,
  hommes: 0,
  femmes: 0,
  enfants: 0,
  comptage: '',
  notes: '',
}

const COLS_EXPORT = [
  { header: 'N°', key: 'ordre', width: 6 },
  { header: 'Date', key: 'date_activite', width: 14 },
  { header: 'Conducteurs', key: 'conducteurs_priere', width: 28 },
  { header: 'Début', key: 'heure_debut', width: 10 },
  { header: 'Fin', key: 'heure_fin', width: 10 },
  { header: 'Durée (min)', key: 'duree_minutes', width: 12 },
  { header: 'STAR', key: 'nombre_star', width: 8 },
  { header: 'Hommes', key: 'hommes', width: 10 },
  { header: 'Femmes', key: 'femmes', width: 10 },
  { header: 'Enfants', key: 'enfants', width: 10 },
  { header: 'Comptage', key: 'comptage', width: 12 },
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

export default function ActivitesPriereStar() {
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

  useEffect(() => { fetchData() }, [filterFrom, filterTo])

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('activites_cultes_prieres_star').select('*').eq('actif', true)
    if (filterFrom) q = q.gte('date_activite', filterFrom)
    if (filterTo) q = q.lte('date_activite', filterTo)
    const { data } = await q.order('date_activite', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const genNumeroPS = (): string => {
    const annee = new Date().getFullYear()
    const prefix = `PS-${annee}-`
    const existing = items
      .map((s: any) => s.ordre)
      .filter((n: string) => n && n.startsWith(prefix))
      .map((n: string) => parseInt(n.replace(prefix, ''), 10))
      .filter((n: number) => !isNaN(n))
    const max = existing.length > 0 ? Math.max(...existing) : 0
    return `${prefix}${String(max + 1).padStart(3, '0')}`
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ ...emptyForm, ordre: genNumeroPS() })
    setModal(true)
  }

  const openEdit = (a: any) => {
    setEditItem(a)
    setForm({
      ordre: a.ordre?.toString() || '',
      date_activite: a.date_activite || '',
      conducteurs_priere: a.conducteurs_priere || '',
      heure_debut: a.heure_debut || '',
      heure_fin: a.heure_fin || '',
      duree_minutes: a.duree_minutes?.toString() || '',
      nombre_star: a.nombre_star || 0,
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

  const save = async () => {
    if (!form.date_activite) return toast.error('Date requise')
    setSaving(true)
    const payload = {
      ordre: form.ordre || null,
      date_activite: form.date_activite,
      conducteurs_priere: form.conducteurs_priere || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      duree_minutes: form.duree_minutes ? parseInt(form.duree_minutes) : null,
      nombre_star: form.nombre_star || 0,
      hommes: form.hommes || 0,
      femmes: form.femmes || 0,
      enfants: form.enfants || 0,
      comptage: form.comptage || null,
      notes: form.notes || null,
      auteur_id: user?.id,
    }
    const { error } = editItem
      ? await supabase.from('activites_cultes_prieres_star').update(payload).eq('id', editItem.id)
      : await supabase.from('activites_cultes_prieres_star').insert({ ...payload, actif: true })
    if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
    await logEvent('activites', editItem ? 'modification' : 'creation',
      `Prières STAR du ${form.date_activite}`, editItem?.id)
    toast.success('Enregistré')
    setModal(false)
    fetchData()
    setSaving(false)
  }

  const supprimer = async (a: any) => {
    await supabase.from('activites_cultes_prieres_star').update({ actif: false }).eq('id', a.id)
    toast.success('Supprimé')
    fetchData()
  }

  // Stats
  const totalStar = items.reduce((s, a) => s + (a.nombre_star || 0), 0)
  const totalH = items.reduce((s, a) => s + (a.hommes || 0), 0)
  const totalF = items.reduce((s, a) => s + (a.femmes || 0), 0)
  const totalE = items.reduce((s, a) => s + (a.enfants || 0), 0)

  const doExportPDF = () => exportPDF('Prières STAR', COLS_EXPORT, items,
    `${items.length} séance(s)`)
  const doExportExcel = () => exportExcel('Prieres_STAR', COLS_EXPORT, items, 'Prières STAR')

  const setNum = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [field]: parseInt(e.target.value) || 0 }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Prières STAR</h3>
          <p className="text-sm text-slate-500">{items.length} séance{items.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
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
              <Plus size={16} /> Nouvelle séance
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total STAR', val: totalStar, color: 'text-yellow-600' },
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
        <EmptyState icon={Star} title="Aucune séance enregistrée" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Date</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-500">Conducteurs</th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-500">Début</th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-500">Fin</th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-500">Durée</th>
                  <th className="px-2 py-2 text-center font-semibold text-yellow-600">STAR</th>
                  <th className="px-2 py-2 text-center font-semibold text-blue-600">H</th>
                  <th className="px-2 py-2 text-center font-semibold text-pink-500">F</th>
                  <th className="px-2 py-2 text-center font-semibold text-green-600">E</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 font-medium text-slate-700">{fmtDate(a.date_activite)}</td>
                    <td className="px-2 py-1.5 text-slate-600 max-w-32 truncate">{a.conducteurs_priere || '—'}</td>
                    <td className="px-2 py-1.5 text-center text-slate-500">{a.heure_debut || '—'}</td>
                    <td className="px-2 py-1.5 text-center text-slate-500">{a.heure_fin || '—'}</td>
                    <td className="px-2 py-1.5 text-center text-slate-500">
                      {a.duree_minutes ? `${a.duree_minutes} min` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center font-bold text-yellow-600">{a.nombre_star || 0}</td>
                    <td className="px-2 py-1.5 text-center text-blue-600">{a.hommes || 0}</td>
                    <td className="px-2 py-1.5 text-center text-pink-500">{a.femmes || 0}</td>
                    <td className="px-2 py-1.5 text-center text-green-600">{a.enfants || 0}</td>
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
        title={editItem ? 'Modifier la séance' : 'Nouvelle séance de prière STAR'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">N° Ordre</label>
            {!editItem ? (
              <div className="input bg-slate-50 text-slate-600 font-mono font-semibold select-none">
                {form.ordre}
              </div>
            ) : (
              <input className="input" value={form.ordre}
                onChange={e => setForm(p => ({ ...p, ordre: e.target.value }))} />
            )}
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.date_activite}
              onChange={e => setForm(p => ({ ...p, date_activite: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Conducteurs de prière</label>
            <input className="input" value={form.conducteurs_priere}
              onChange={e => setForm(p => ({ ...p, conducteurs_priere: e.target.value }))} />
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
            <label className="label">Durée (min) — auto-calculée</label>
            <input type="number" className="input bg-slate-50" value={form.duree_minutes}
              onChange={e => setForm(p => ({ ...p, duree_minutes: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nombre STAR</label>
            <input type="number" className="input" min={0} value={form.nombre_star}
              onChange={setNum('nombre_star')} />
          </div>
          <div>
            <label className="label">Hommes</label>
            <input type="number" className="input" min={0} value={form.hommes}
              onChange={setNum('hommes')} />
          </div>
          <div>
            <label className="label">Femmes</label>
            <input type="number" className="input" min={0} value={form.femmes}
              onChange={setNum('femmes')} />
          </div>
          <div>
            <label className="label">Enfants</label>
            <input type="number" className="input" min={0} value={form.enfants}
              onChange={setNum('enfants')} />
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
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="" size="md">
        {viewItem && (
          <div className="-m-4 -mt-4">
            {/* Header indigo/blue */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0">
                  <Star size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Prière STAR</h2>
                  <p className="text-indigo-100 text-sm mt-0.5 flex items-center gap-1">
                    <Calendar size={13} /> {fmtDate(viewItem.date_activite)}
                  </p>
                  {viewItem.conducteurs_priere && (
                    <p className="text-indigo-200 text-xs mt-0.5 flex items-center gap-1">
                      <Users size={12} /> {viewItem.conducteurs_priere}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Contenu */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-indigo-400 font-medium flex items-center gap-1"><Clock size={11} /> Heure début</p>
                  <p className="font-semibold text-indigo-900 text-sm mt-0.5">{viewItem.heure_debut || '—'}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-indigo-400 font-medium flex items-center gap-1"><Clock size={11} /> Heure fin</p>
                  <p className="font-semibold text-indigo-900 text-sm mt-0.5">{viewItem.heure_fin || '—'}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-indigo-400 font-medium">Durée</p>
                  <p className="font-semibold text-indigo-900 text-sm mt-0.5">{viewItem.duree_minutes ? `${viewItem.duree_minutes} min` : '—'}</p>
                </div>
              </div>
              {/* Statistiques */}
              <div className="grid grid-cols-4 gap-2 bg-indigo-50 rounded-xl p-3 text-center">
                <div><p className="text-2xl font-bold text-yellow-600">{viewItem.nombre_star || 0}</p><p className="text-xs text-indigo-400">STAR</p></div>
                <div><p className="text-2xl font-bold text-blue-600">{viewItem.hommes || 0}</p><p className="text-xs text-indigo-400">Hommes</p></div>
                <div><p className="text-2xl font-bold text-pink-500">{viewItem.femmes || 0}</p><p className="text-xs text-indigo-400">Femmes</p></div>
                <div><p className="text-2xl font-bold text-green-600">{viewItem.enfants || 0}</p><p className="text-xs text-indigo-400">Enfants</p></div>
              </div>
              {viewItem.comptage && (
                <div className="bg-blue-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-blue-400 font-medium">Comptage</p>
                  <p className="text-blue-800 text-sm mt-0.5">{viewItem.comptage}</p>
                </div>
              )}
              {viewItem.notes && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium">Notes</p>
                  <p className="text-gray-700 text-sm mt-0.5">{viewItem.notes}</p>
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button onClick={() => setViewModal(false)} className="btn-secondary">Fermer</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && supprimer(deleteItem)}
        title="Supprimer" message="Supprimer cette séance ?"
        confirmLabel="Supprimer" danger
      />
    </div>
  )
}
