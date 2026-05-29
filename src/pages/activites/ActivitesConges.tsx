import { useEffect, useState } from 'react'
import { supabase, ActiviteConge } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { logEvent } from '../../lib/journal'
import { CalendarOff } from 'lucide-react'

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const emptyForm = { ordre: '', prenom_nom: '', sexe: '', categorie: '', departement: '', remarque_speciale: '', type_absence: '', annee: 2026, janvier: false, fevrier: false, mars: false, avril: false, mai: false, juin: false, juillet: false, aout: false, septembre: false, octobre: false, novembre: false, decembre: false }

export default function ActivitesConges() {
  const { user, hasPermission } = useAuth()
  const [items, setItems] = useState<ActiviteConge[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<ActiviteConge | null>(null)
  const [deleteItem, setDeleteItem] = useState<ActiviteConge | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterAnnee, setFilterAnnee] = useState(2026)

  useEffect(() => { fetchData() }, [filterAnnee])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase.from('activites_conges').select('*').eq('actif', true).eq('annee', filterAnnee).order('ordre', { nullsFirst: false })
    setItems(data || [])
    setLoading(false)
  }

  const openEdit = (a: ActiviteConge) => {
    setEditItem(a)
    setForm({ ordre: a.ordre?.toString() || '', prenom_nom: a.prenom_nom, sexe: a.sexe || '', categorie: a.categorie || '', departement: a.departement || '', remarque_speciale: a.remarque_speciale || '', type_absence: a.type_absence || '', annee: a.annee, janvier: a.janvier, fevrier: a.fevrier, mars: a.mars, avril: a.avril, mai: a.mai, juin: a.juin, juillet: a.juillet, aout: a.aout, septembre: a.septembre, octobre: a.octobre, novembre: a.novembre, decembre: a.decembre })
    setModal(true)
  }

  const save = async () => {
    if (!form.prenom_nom.trim()) return toast.error('Prénom & Nom requis')
    setSaving(true)
    const payload = { ...form, ordre: form.ordre ? parseInt(form.ordre) : null, sexe: (form.sexe as 'M' | 'F') || null, type_absence: (form.type_absence as 'conge' | 'sante') || null, auteur_id: user?.id }
    const { error } = editItem
      ? await supabase.from('activites_conges').update(payload).eq('id', editItem.id)
      : await supabase.from('activites_conges').insert(payload)
    if (error) { toast.error('Erreur'); setSaving(false); return }
    await logEvent('activites', editItem ? 'modification' : 'creation', `Congé ${editItem ? 'modifié' : 'créé'} : ${form.prenom_nom}`, editItem?.id)
    toast.success('Enregistré'); setModal(false); fetchData(); setSaving(false)
  }

  const supprimer = async (a: ActiviteConge) => {
    await supabase.from('activites_conges').update({ actif: false }).eq('id', a.id)
    toast.success('Supprimé'); fetchData()
  }

  const nbMoisAbsence = (a: ActiviteConge) => MOIS.filter(m => a[m as keyof ActiviteConge]).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Congés {filterAnnee}</h3>
          <p className="text-sm text-slate-500">{items.length} personne{items.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="input w-auto text-sm" value={filterAnnee} onChange={e => setFilterAnnee(parseInt(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {hasPermission('activites', 'creer') && (
            <button onClick={() => { setEditItem(null); setForm(emptyForm); setModal(true) }} className="btn-primary"><Plus size={16} /> Nouveau</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : items.length === 0 ? (
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
                  {MOIS_LABELS.map(m => (
                    <th key={m} className="px-1 py-2 text-center font-semibold text-slate-500 min-w-8">{m}</th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold text-slate-500">Total</th>
                  <th className="px-2 py-2 font-semibold text-slate-500">Type</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-slate-400">{a.ordre || '—'}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-800">{a.prenom_nom}</td>
                    <td className="px-2 py-1.5 text-slate-500">{a.sexe || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-500 max-w-20 truncate">{a.departement || '—'}</td>
                    {MOIS.map(m => (
                      <td key={m} className="px-1 py-1.5 text-center">
                        {a[m as keyof ActiviteConge] ? (
                          <div className={`w-5 h-5 rounded mx-auto ${a.type_absence === 'sante' ? 'bg-red-400' : 'bg-blue-400'}`} title={a.type_absence === 'sante' ? 'Santé' : 'Congé'} />
                        ) : <div className="w-5 h-5 rounded border border-slate-200 mx-auto" />}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-bold text-slate-700">{nbMoisAbsence(a)}</td>
                    <td className="px-2 py-1.5">
                      {a.type_absence && (
                        <span className={`badge ${a.type_absence === 'conge' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {a.type_absence === 'conge' ? 'Congé' : 'Santé'}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><Edit size={13} /></button>
                        <button onClick={() => setDeleteItem(a)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t text-xs text-slate-400 flex gap-4">
            <span><span className="inline-block w-3 h-3 rounded bg-blue-400 mr-1" />Congé</span>
            <span><span className="inline-block w-3 h-3 rounded bg-red-400 mr-1" />Santé</span>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Modifier' : 'Nouveau congé'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">N° Ordre</label><input className="input" value={form.ordre} onChange={e => setForm(p => ({ ...p, ordre: e.target.value }))} /></div>
          <div><label className="label">Année</label><input type="number" className="input" value={form.annee} onChange={e => setForm(p => ({ ...p, annee: parseInt(e.target.value) }))} /></div>
          <div className="col-span-2"><label className="label">Prénom & Nom *</label><input className="input" value={form.prenom_nom} onChange={e => setForm(p => ({ ...p, prenom_nom: e.target.value }))} placeholder="Jean RAKOTO" /></div>
          <div><label className="label">Sexe</label>
            <select className="input" value={form.sexe} onChange={e => setForm(p => ({ ...p, sexe: e.target.value }))}>
              <option value="">—</option><option value="M">M</option><option value="F">F</option>
            </select>
          </div>
          <div><label className="label">Type absence</label>
            <select className="input" value={form.type_absence} onChange={e => setForm(p => ({ ...p, type_absence: e.target.value }))}>
              <option value="">—</option><option value="conge">Congé</option><option value="sante">Santé</option>
            </select>
          </div>
          <div><label className="label">Catégorie</label><input className="input" value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))} /></div>
          <div><label className="label">Département</label><input className="input" value={form.departement} onChange={e => setForm(p => ({ ...p, departement: e.target.value }))} /></div>
        </div>
        <div className="mt-4">
          <label className="label">Mois d'absence</label>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2 mt-2">
            {MOIS.map((m, i) => (
              <label key={m} className="flex flex-col items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={form[m as keyof typeof form] as boolean} onChange={e => setForm(p => ({ ...p, [m]: e.target.checked }))} className="w-4 h-4" />
                <span className="text-xs text-slate-500">{MOIS_LABELS[i]}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-3"><label className="label">Remarque spéciale</label><textarea className="input min-h-12 resize-none" value={form.remarque_speciale} onChange={e => setForm(p => ({ ...p, remarque_speciale: e.target.value }))} /></div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving && <Loader size={14} className="animate-spin" />} Enregistrer</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={() => deleteItem && supprimer(deleteItem)} title="Supprimer" message="Supprimer cet enregistrement ?" confirmLabel="Supprimer" danger />
    </div>
  )
}
