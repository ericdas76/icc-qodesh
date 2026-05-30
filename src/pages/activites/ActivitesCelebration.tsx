import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader, Eye, FileText, FileSpreadsheet, Church } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../../lib/journal'
import { exportPDF, exportExcel } from '../../lib/export'

const emptyForm = {
  date_activite: '', heure_debut: '', heure_fin: '', duree_minutes: '',
  hommes: 0, femmes: 0, enfants: 0, priere_salut: false, visiteurs: 0,
  sainte_cene: false, nombre_sainte_cene: 0, moderateur: '', predicateur: '',
  theme: '', comptage: '', notes: ''
}

const COLS_EXPORT = [
  { header: 'Date', key: 'date_activite', width: 14 },
  { header: 'Thème', key: 'theme', width: 30 },
  { header: 'Prédicateur', key: 'predicateur', width: 22 },
  { header: 'Modérateur', key: 'moderateur', width: 22 },
  { header: 'Hommes', key: 'hommes', width: 10 },
  { header: 'Femmes', key: 'femmes', width: 10 },
  { header: 'Enfants', key: 'enfants', width: 10 },
  { header: 'Total', key: 'total_participants', width: 10 },
  { header: 'Visiteurs', key: 'visiteurs', width: 10 },
  { header: 'Durée (min)', key: 'duree_minutes', width: 12 },
  { header: 'Prière salut', key: 'priere_salut', width: 14 },
  { header: 'Sainte-Cène', key: 'sainte_cene', width: 14 },
]

function calcDureeMinutes(debut: string, fin: string): number {
  if (!debut || !fin) return 0
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  const total = (fh * 60 + fm) - (dh * 60 + dm)
  return total > 0 ? total : 0
}

export default function ActivitesCelebration() {
  const { user, hasPermission } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewItem, setViewItem] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  useEffect(() => { fetchData() }, [filterFrom, filterTo])

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('activites_cultes_celebration').select('*').eq('actif', true)
    if (filterFrom) q = q.gte('date_activite', filterFrom)
    if (filterTo) q = q.lte('date_activite', filterTo)
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
      date_activite: a.date_activite, heure_debut: a.heure_debut || '', heure_fin: a.heure_fin || '',
      duree_minutes: a.duree_minutes?.toString() || '', hommes: a.hommes, femmes: a.femmes, enfants: a.enfants,
      priere_salut: a.priere_salut, visiteurs: a.visiteurs, sainte_cene: a.sainte_cene,
      nombre_sainte_cene: a.nombre_sainte_cene, moderateur: a.moderateur || '', predicateur: a.predicateur || '',
      theme: a.theme || '', comptage: a.comptage || '', notes: a.notes || ''
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
      date_activite: form.date_activite,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      duree_minutes: form.duree_minutes ? parseInt(form.duree_minutes as unknown as string) : null,
      hommes: form.hommes || 0,
      femmes: form.femmes || 0,
      enfants: form.enfants || 0,
      priere_salut: form.priere_salut,
      visiteurs: form.visiteurs || 0,
      sainte_cene: form.sainte_cene,
      nombre_sainte_cene: form.nombre_sainte_cene || 0,
      moderateur: form.moderateur || null,
      predicateur: form.predicateur || null,
      theme: form.theme || null,
      comptage: form.comptage || null,
      notes: form.notes || null,
      auteur_id: user?.id
    }
    const { error } = editItem
      ? await supabase.from('activites_cultes_celebration').update(payload).eq('id', editItem.id)
      : await supabase.from('activites_cultes_celebration').insert({ ...payload, actif: true })
    if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
    await logEvent('activites', editItem ? 'modification' : 'creation',
      `Célébration du ${form.date_activite}`, editItem?.id)
    toast.success('Enregistré')
    setModal(false)
    fetchData()
    setSaving(false)
  }

  const supprimer = async (a: any) => {
    await supabase.from('activites_cultes_celebration').update({ actif: false }).eq('id', a.id)
    toast.success('Supprimé')
    fetchData()
  }

  const setF = (field: string, val: unknown) => setForm(p => ({ ...p, [field]: val }))
  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(field, ['hommes', 'femmes', 'enfants', 'visiteurs', 'nombre_sainte_cene', 'duree_minutes'].includes(field)
      ? parseInt(e.target.value) || 0 : e.target.value)

  const total = (form.hommes || 0) + (form.femmes || 0) + (form.enfants || 0)

  const doExportPDF = () => exportPDF('Cultes — Célébration', COLS_EXPORT, items,
    `${items.length} culte(s)`)
  const doExportExcel = () => exportExcel('Celebration', COLS_EXPORT, items, 'Célébration')

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Cultes — Célébration</h3>
          <p className="text-sm text-slate-500">{items.length} culte{items.length > 1 ? 's' : ''}</p>
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
              <Plus size={16} /> Nouveau
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Church} title="Aucun culte enregistré" />
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    {format(new Date(a.date_activite), 'EEEE d MMMM yyyy', { locale: fr })}
                  </p>
                  {a.theme && <p className="text-sm text-blue-600 italic mt-0.5">"{a.theme}"</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openView(a)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                    <Eye size={14} />
                  </button>
                  {hasPermission('activites', 'modifier') && (
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                      <Edit size={14} />
                    </button>
                  )}
                  {hasPermission('activites', 'supprimer') && (
                    <button onClick={() => setDeleteItem(a)} className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3">
                {[
                  { label: 'Hommes', value: a.hommes, color: 'text-blue-600' },
                  { label: 'Femmes', value: a.femmes, color: 'text-pink-600' },
                  { label: 'Enfants', value: a.enfants, color: 'text-amber-600' },
                  { label: 'Total', value: a.total_participants, color: 'text-slate-900' },
                  { label: 'Visiteurs', value: a.visiteurs, color: 'text-green-600' },
                  { label: 'Durée', value: a.duree_minutes ? `${a.duree_minutes}min` : '—', color: 'text-slate-500' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t text-xs text-slate-500">
                {a.predicateur && <span>Prédicateur : <strong>{a.predicateur}</strong></span>}
                {a.moderateur && <span>Modérateur : <strong>{a.moderateur}</strong></span>}
                {a.priere_salut && <span className="badge bg-green-100 text-green-700">Prière du salut</span>}
                {a.sainte_cene && <span className="badge bg-purple-100 text-purple-700">Sainte-Cène ({a.nombre_sainte_cene})</span>}
              </div>
              {a.notes && <p className="text-xs text-slate-400 mt-2">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal Ajouter / Modifier */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editItem ? 'Modifier célébration' : 'Nouvelle célébration'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={form.date_activite} onChange={handleChange('date_activite')} />
          </div>
          <div>
            <label className="label">Durée (min) <span className="text-xs text-slate-400">(auto)</span></label>
            <input type="number" className="input bg-slate-50" readOnly value={form.duree_minutes} onChange={handleChange('duree_minutes')} />
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
            <label className="label">Hommes</label>
            <input type="number" min={0} className="input" value={form.hommes} onChange={handleChange('hommes')} />
          </div>
          <div>
            <label className="label">Femmes</label>
            <input type="number" min={0} className="input" value={form.femmes} onChange={handleChange('femmes')} />
          </div>
          <div>
            <label className="label">Enfants</label>
            <input type="number" min={0} className="input" value={form.enfants} onChange={handleChange('enfants')} />
          </div>
          <div className="flex items-end pb-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 w-full text-center">
              <p className="text-xs text-blue-500 uppercase font-medium">Total participants</p>
              <p className="text-2xl font-bold text-blue-700">{total}</p>
            </div>
          </div>
          <div>
            <label className="label">Visiteurs</label>
            <input type="number" min={0} className="input" value={form.visiteurs} onChange={handleChange('visiteurs')} />
          </div>
          <div>
            <label className="label">Comptage</label>
            <input className="input" value={form.comptage} onChange={handleChange('comptage')} />
          </div>
          <div className="col-span-2">
            <label className="label">Thème</label>
            <input className="input" value={form.theme} onChange={handleChange('theme')} />
          </div>
          <div>
            <label className="label">Prédicateur</label>
            <input className="input" value={form.predicateur} onChange={handleChange('predicateur')} />
          </div>
          <div>
            <label className="label">Modérateur</label>
            <input className="input" value={form.moderateur} onChange={handleChange('moderateur')} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="priere_salut" checked={form.priere_salut}
              onChange={e => setF('priere_salut', e.target.checked)} />
            <label htmlFor="priere_salut" className="text-sm">Prière du salut</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="sainte_cene" checked={form.sainte_cene}
              onChange={e => setF('sainte_cene', e.target.checked)} />
            <label htmlFor="sainte_cene" className="text-sm">Sainte-Cène</label>
          </div>
          {form.sainte_cene && (
            <div>
              <label className="label">Nombre Sainte-Cène</label>
              <input type="number" min={0} className="input" value={form.nombre_sainte_cene}
                onChange={handleChange('nombre_sainte_cene')} />
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input min-h-16 resize-none" value={form.notes} onChange={handleChange('notes')} />
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
      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Détail culte" size="md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <p className="font-bold text-slate-900 text-base">
              {format(new Date(viewItem.date_activite), 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
            {viewItem.theme && <p className="text-blue-600 italic">"{viewItem.theme}"</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><span className="label">Prédicateur</span><p>{viewItem.predicateur || '—'}</p></div>
              <div><span className="label">Modérateur</span><p>{viewItem.moderateur || '—'}</p></div>
              <div><span className="label">Heure début</span><p>{viewItem.heure_debut || '—'}</p></div>
              <div><span className="label">Heure fin</span><p>{viewItem.heure_fin || '—'}</p></div>
              <div><span className="label">Durée</span><p>{viewItem.duree_minutes ? `${viewItem.duree_minutes} min` : '—'}</p></div>
              <div><span className="label">Visiteurs</span><p>{viewItem.visiteurs || 0}</p></div>
            </div>
            <div className="grid grid-cols-4 gap-3 bg-slate-50 rounded p-3 text-center">
              <div><p className="text-xl font-bold text-blue-600">{viewItem.hommes}</p><p className="text-xs text-slate-400">H</p></div>
              <div><p className="text-xl font-bold text-pink-600">{viewItem.femmes}</p><p className="text-xs text-slate-400">F</p></div>
              <div><p className="text-xl font-bold text-amber-600">{viewItem.enfants}</p><p className="text-xs text-slate-400">E</p></div>
              <div><p className="text-xl font-bold text-slate-900">{viewItem.total_participants}</p><p className="text-xs text-slate-400">Total</p></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {viewItem.priere_salut && <span className="badge bg-green-100 text-green-700">Prière du salut</span>}
              {viewItem.sainte_cene && <span className="badge bg-purple-100 text-purple-700">Sainte-Cène ({viewItem.nombre_sainte_cene})</span>}
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
        title="Supprimer" message="Supprimer ce culte ?"
        confirmLabel="Supprimer" danger
      />
    </div>
  )
}
