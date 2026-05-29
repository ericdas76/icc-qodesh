import { useEffect, useState } from 'react'
import { supabase, ActiviteRNA } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../../lib/journal'
import { Radio } from 'lucide-react'

const emptyForm = { ordre: '', date_activite: '', responsable: '', type_activite: '', heure_debut: '', heure_fin: '', duree_minutes: '', effectif: 0, comptage: '', notes: '' }

export default function ActivitesRNA() {
  const { user, hasPermission } = useAuth()
  const [items, setItems] = useState<ActiviteRNA[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<ActiviteRNA | null>(null)
  const [deleteItem, setDeleteItem] = useState<ActiviteRNA | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase.from('activites_rna').select('*').eq('actif', true).order('date_activite', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const openEdit = (a: ActiviteRNA) => {
    setEditItem(a)
    setForm({ ordre: a.ordre?.toString() || '', date_activite: a.date_activite, responsable: a.responsable || '', type_activite: a.type_activite || '', heure_debut: a.heure_debut || '', heure_fin: a.heure_fin || '', duree_minutes: a.duree_minutes?.toString() || '', effectif: a.effectif, comptage: a.comptage || '', notes: a.notes || '' })
    setModal(true)
  }

  const save = async () => {
    if (!form.date_activite) return toast.error('Date requise')
    setSaving(true)
    const payload = { ordre: form.ordre ? parseInt(form.ordre) : null, date_activite: form.date_activite, responsable: form.responsable || null, type_activite: form.type_activite || null, heure_debut: form.heure_debut || null, heure_fin: form.heure_fin || null, duree_minutes: form.duree_minutes ? parseInt(form.duree_minutes) : null, effectif: form.effectif || 0, comptage: form.comptage || null, notes: form.notes || null, auteur_id: user?.id }
    const { error } = editItem
      ? await supabase.from('activites_rna').update(payload).eq('id', editItem.id)
      : await supabase.from('activites_rna').insert(payload)
    if (error) { toast.error('Erreur'); setSaving(false); return }
    await logEvent('activites', editItem ? 'modification' : 'creation', `RNA ${editItem ? 'modifié' : 'créé'} du ${form.date_activite}`, editItem?.id)
    toast.success('Enregistré'); setModal(false); fetchData(); setSaving(false)
  }

  const supprimer = async (a: ActiviteRNA) => {
    await supabase.from('activites_rna').update({ actif: false }).eq('id', a.id)
    toast.success('Supprimé'); fetchData()
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: field === 'effectif' ? parseInt(e.target.value) || 0 : e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">RNA — Activités</h3>
          <p className="text-sm text-slate-500">{items.length} activité{items.length > 1 ? 's' : ''}</p>
        </div>
        {hasPermission('activites', 'creer') && (
          <button onClick={() => { setEditItem(null); setForm(emptyForm); setModal(true) }} className="btn-primary"><Plus size={16} /> Nouveau</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Radio} title="Aucune activité RNA enregistrée" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  {['N°', 'Date', 'Responsable', 'Type', 'Horaires', 'Effectif', 'Comptage', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{a.ordre || '—'}</td>
                    <td className="px-3 py-2 font-medium">{format(new Date(a.date_activite), 'd MMM yyyy', { locale: fr })}</td>
                    <td className="px-3 py-2 text-slate-600">{a.responsable || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{a.type_activite || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{a.heure_debut && a.heure_fin ? `${a.heure_debut} – ${a.heure_fin}` : '—'}</td>
                    <td className="px-3 py-2 font-bold text-blue-600">{a.effectif}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{a.comptage || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><Edit size={14} /></button>
                        <button onClick={() => setDeleteItem(a)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Modifier RNA' : 'Nouvelle activité RNA'}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">N° Ordre</label><input className="input" value={form.ordre} onChange={set('ordre')} /></div>
          <div><label className="label">Date *</label><input type="date" className="input" value={form.date_activite} onChange={set('date_activite')} /></div>
          <div className="col-span-2"><label className="label">Responsable</label><input className="input" value={form.responsable} onChange={set('responsable')} /></div>
          <div className="col-span-2"><label className="label">Type d'activité</label><input className="input" value={form.type_activite} onChange={set('type_activite')} /></div>
          <div><label className="label">Heure début</label><input type="time" className="input" value={form.heure_debut} onChange={set('heure_debut')} /></div>
          <div><label className="label">Heure fin</label><input type="time" className="input" value={form.heure_fin} onChange={set('heure_fin')} /></div>
          <div><label className="label">Durée (min)</label><input type="number" className="input" value={form.duree_minutes} onChange={set('duree_minutes')} /></div>
          <div><label className="label">Effectif</label><input type="number" min={0} className="input" value={form.effectif} onChange={set('effectif')} /></div>
          <div><label className="label">Comptage</label><input className="input" value={form.comptage} onChange={set('comptage')} /></div>
          <div className="col-span-2"><label className="label">Notes</label><textarea className="input min-h-16 resize-none" value={form.notes} onChange={set('notes')} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving && <Loader size={14} className="animate-spin" />} Enregistrer</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={() => deleteItem && supprimer(deleteItem)} title="Supprimer" message="Supprimer cette activité ?" confirmLabel="Supprimer" danger />
    </div>
  )
}
