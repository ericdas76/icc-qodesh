import { useEffect, useState } from 'react'
import { supabase, ActiviteADG } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader, Filter } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../../lib/journal'
import { Activity } from 'lucide-react'

const emptyForm = {
  ordre: '', date_activite: '', conducteurs: '', heure_debut: '', heure_fin: '',
  duree_minutes: '', hommes: 0, femmes: 0, enfants: 0, comptage: '', notes: ''
}

export default function ActivitesADG() {
  const { user, hasPermission } = useAuth()
  const [activites, setActivites] = useState<ActiviteADG[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<ActiviteADG | null>(null)
  const [deleteItem, setDeleteItem] = useState<ActiviteADG | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  useEffect(() => { fetch() }, [filterFrom, filterTo])

  const handleFilterFrom = (v: string) => { setFilterFrom(v); setPage(1) }
  const handleFilterTo = (v: string) => { setFilterTo(v); setPage(1) }

  const fetch = async () => {
    setLoading(true)
    let q = supabase.from('activites_adg').select('*').eq('actif', true).order('date_activite', { ascending: false })
    if (filterFrom) q = q.gte('date_activite', filterFrom)
    if (filterTo) q = q.lte('date_activite', filterTo)
    const { data } = await q
    setActivites(data || [])
    setLoading(false)
  }

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setModal(true) }
  const openEdit = (a: ActiviteADG) => {
    setEditItem(a)
    setForm({
      ordre: a.ordre?.toString() || '', date_activite: a.date_activite, conducteurs: a.conducteurs || '',
      heure_debut: a.heure_debut || '', heure_fin: a.heure_fin || '',
      duree_minutes: a.duree_minutes?.toString() || '',
      hommes: a.hommes, femmes: a.femmes, enfants: a.enfants,
      comptage: a.comptage || '', notes: a.notes || ''
    })
    setModal(true)
  }

  const save = async () => {
    if (!form.date_activite) return toast.error('Date requise')
    setSaving(true)
    const payload = {
      ordre: form.ordre ? parseInt(form.ordre) : null,
      date_activite: form.date_activite, conducteurs: form.conducteurs || null,
      heure_debut: form.heure_debut || null, heure_fin: form.heure_fin || null,
      duree_minutes: form.duree_minutes ? parseInt(form.duree_minutes) : null,
      hommes: form.hommes || 0, femmes: form.femmes || 0, enfants: form.enfants || 0,
      comptage: form.comptage || null, notes: form.notes || null,
      auteur_id: user?.id
    }
    if (editItem) {
      const { error } = await supabase.from('activites_adg').update(payload).eq('id', editItem.id)
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      await logEvent('activites', 'modification', `ADG modifié du ${form.date_activite}`, editItem.id)
      toast.success('ADG mis à jour')
    } else {
      const { error } = await supabase.from('activites_adg').insert({ ...payload, actif: true })
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      await logEvent('activites', 'creation', `Nouveau ADG du ${form.date_activite}`)
      toast.success('ADG créé')
    }
    setModal(false); fetch(); setSaving(false)
  }

  const supprimer = async (a: ActiviteADG) => {
    await supabase.from('activites_adg').update({ actif: false }).eq('id', a.id)
    await logEvent('activites', 'suppression', `ADG supprimé du ${a.date_activite}`, a.id)
    toast.success('ADG supprimé')
    fetch()
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: field === 'hommes' || field === 'femmes' || field === 'enfants' ? parseInt(e.target.value) || 0 : e.target.value }))

  const total = (f: typeof form) => (f.hommes || 0) + (f.femmes || 0) + (f.enfants || 0)
  const paginated = activites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">ADG — Assemblée de Groupe</h3>
          <p className="text-sm text-slate-500">{activites.length} séance{activites.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto text-xs" value={filterFrom} onChange={e => handleFilterFrom(e.target.value)} placeholder="Du" />
          <input type="date" className="input w-auto text-xs" value={filterTo} onChange={e => handleFilterTo(e.target.value)} placeholder="Au" />
          {hasPermission('activites', 'creer') && (
            <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nouveau</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : activites.length === 0 ? (
        <EmptyState icon={Activity} title="Aucun ADG enregistré" action={<button onClick={openCreate} className="btn-primary">Créer</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  {['N°', 'Date', 'Conducteurs', 'Horaires', 'H', 'F', 'E', 'Total', 'Comptage', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{a.ordre || '—'}</td>
                    <td className="px-3 py-2 font-medium">{format(new Date(a.date_activite), 'd MMM yyyy', { locale: fr })}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-32 truncate">{a.conducteurs || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {a.heure_debut && a.heure_fin ? `${a.heure_debut} – ${a.heure_fin}` : '—'}
                      {a.duree_minutes && <span className="ml-1 text-slate-400">({a.duree_minutes}min)</span>}
                    </td>
                    <td className="px-3 py-2 text-blue-600 font-semibold">{a.hommes}</td>
                    <td className="px-3 py-2 text-pink-600 font-semibold">{a.femmes}</td>
                    <td className="px-3 py-2 text-amber-600 font-semibold">{a.enfants}</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{a.total_participants}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{a.comptage || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {hasPermission('activites', 'modifier') && (
                          <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><Edit size={14} /></button>
                        )}
                        {hasPermission('activites', 'modifier') && (
                          <button onClick={() => setDeleteItem(a)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={activites.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Modifier ADG' : 'Nouveau ADG'}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">N° Ordre</label><input className="input" value={form.ordre} onChange={set('ordre')} placeholder="1" /></div>
          <div><label className="label">Date *</label><input type="date" className="input" value={form.date_activite} onChange={set('date_activite')} /></div>
          <div className="col-span-2"><label className="label">Conducteurs</label><input className="input" value={form.conducteurs} onChange={set('conducteurs')} /></div>
          <div><label className="label">Heure début</label><input type="time" className="input" value={form.heure_debut} onChange={set('heure_debut')} /></div>
          <div><label className="label">Heure fin</label><input type="time" className="input" value={form.heure_fin} onChange={set('heure_fin')} /></div>
          <div><label className="label">Durée (min)</label><input type="number" className="input" value={form.duree_minutes} onChange={set('duree_minutes')} /></div>
          <div><label className="label">Comptage</label><input className="input" value={form.comptage} onChange={set('comptage')} /></div>
          <div><label className="label">Hommes</label><input type="number" min={0} className="input" value={form.hommes} onChange={set('hommes')} /></div>
          <div><label className="label">Femmes</label><input type="number" min={0} className="input" value={form.femmes} onChange={set('femmes')} /></div>
          <div><label className="label">Enfants</label><input type="number" min={0} className="input" value={form.enfants} onChange={set('enfants')} /></div>
          <div className="flex items-end pb-2"><span className="text-sm font-bold text-blue-700">Total : {total(form)}</span></div>
          <div className="col-span-2"><label className="label">Notes</label><textarea className="input min-h-16 resize-none" value={form.notes} onChange={set('notes')} /></div>
        </div>
          <p className="text-xs text-slate-400 mt-1"><span className="text-red-500">*</span> Champ obligatoire</p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving && <Loader size={14} className="animate-spin" />} Enregistrer</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={() => deleteItem && supprimer(deleteItem)} title="Supprimer ADG" message={`Supprimer l'ADG du ${deleteItem?.date_activite} ?`} confirmLabel="Supprimer" danger />
    </div>
  )
}
