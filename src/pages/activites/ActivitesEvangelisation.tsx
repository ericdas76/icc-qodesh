import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit2, Loader, Download } from 'lucide-react'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../../lib/journal'
import { exportExcel } from '../../lib/export'

const emptyForm = {
  ordre: '', date_sortie: '', supervision: '',
  heure_debut: '', heure_fin: '', duree_minutes: '',
  effectif_membres: 0, nb_abordees: 0, nb_invitees: 0, nb_priere_salut: 0,
  comptage: '', notes: ''
}

const COLS_EXPORT = [
  { header: 'N°', key: 'ordre' },
  { header: 'Date', key: 'date_sortie' },
  { header: 'Supervision', key: 'supervision' },
  { header: 'Début', key: 'heure_debut' },
  { header: 'Fin', key: 'heure_fin' },
  { header: 'Durée (min)', key: 'duree_minutes' },
  { header: 'Effectif membres', key: 'effectif_membres' },
  { header: 'Nb abordées', key: 'nb_abordees' },
  { header: 'Nb invitées', key: 'nb_invitees' },
  { header: 'Prière salut', key: 'nb_priere_salut' },
  { header: 'Comptage', key: 'comptage' },
  { header: 'Notes', key: 'notes' },
]

function calcDuree(debut: string, fin: string): number {
  if (!debut || !fin) return 0
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  return Math.max(0, (fh * 60 + fm) - (dh * 60 + dm))
}

export default function ActivitesEvangelisation() {
  const { user, hasPermission } = useAuth()
  const [activites, setActivites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  useEffect(() => { fetchData() }, [filterFrom, filterTo])

  // Auto-calcul durée
  useEffect(() => {
    if (form.heure_debut && form.heure_fin) {
      const d = calcDuree(form.heure_debut, form.heure_fin)
      if (d > 0) setForm(f => ({ ...f, duree_minutes: String(d) }))
    }
  }, [form.heure_debut, form.heure_fin])

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('activites_evangelisation').select('*').eq('actif', true).order('date_sortie', { ascending: false })
    if (filterFrom) q = q.gte('date_sortie', filterFrom)
    if (filterTo) q = q.lte('date_sortie', filterTo)
    const { data } = await q
    setActivites(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({ ...emptyForm })
    setModal(true)
  }

  const openEdit = (a: any) => {
    setEditItem(a)
    setForm({
      ordre: a.ordre?.toString() || '',
      date_sortie: a.date_sortie || '',
      supervision: a.supervision || '',
      heure_debut: a.heure_debut || '',
      heure_fin: a.heure_fin || '',
      duree_minutes: a.duree_minutes?.toString() || '',
      effectif_membres: a.effectif_membres || 0,
      nb_abordees: a.nb_abordees || 0,
      nb_invitees: a.nb_invitees || 0,
      nb_priere_salut: a.nb_priere_salut || 0,
      comptage: a.comptage || '',
      notes: a.notes || '',
    })
    setModal(true)
  }

  const save = async () => {
    if (!form.date_sortie) { toast.error('Date requise'); return }
    setSaving(true)
    const payload = {
      ordre: form.ordre ? parseInt(form.ordre) : null,
      date_sortie: form.date_sortie,
      supervision: form.supervision || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      duree_minutes: form.duree_minutes ? parseInt(form.duree_minutes) : null,
      effectif_membres: Number(form.effectif_membres) || 0,
      nb_abordees: Number(form.nb_abordees) || 0,
      nb_invitees: Number(form.nb_invitees) || 0,
      nb_priere_salut: Number(form.nb_priere_salut) || 0,
      comptage: form.comptage || null,
      notes: form.notes || null,
      auteur_id: user?.id,
    }
    if (editItem) {
      const { error } = await supabase.from('activites_evangelisation').update(payload).eq('id', editItem.id)
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      await logEvent('activites', 'modification', `Évangélisation modifiée du ${form.date_sortie}`, editItem.id)
      toast.success('Sortie mise à jour')
    } else {
      const { error } = await supabase.from('activites_evangelisation').insert({ ...payload, actif: true })
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      await logEvent('activites', 'creation', `Nouvelle sortie évangélisation du ${form.date_sortie}`)
      toast.success('Sortie créée')
    }
    setSaving(false)
    setModal(false)
    fetchData()
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }))

  const setNum = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [field]: parseInt(e.target.value) || 0 }))

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Évangélisation</h3>
          <p className="text-sm text-slate-500">{activites.length} sortie{activites.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input w-auto text-xs" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <span className="text-slate-400 text-xs">au</span>
          <input type="date" className="input w-auto text-xs" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          <button onClick={() => exportExcel('Évangélisation', COLS_EXPORT, activites, 'Evangelisation')} className="btn-secondary flex items-center gap-1 text-xs">
            <Download size={14} /> Excel
          </button>
          {hasPermission('activites', 'creer') && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {activites.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Sorties', val: activites.length, color: 'text-blue-700' },
            { label: 'Abordées', val: activites.reduce((s, a) => s + (a.nb_abordees || 0), 0), color: 'text-slate-700' },
            { label: 'Invitées', val: activites.reduce((s, a) => s + (a.nb_invitees || 0), 0), color: 'text-green-700' },
            { label: 'Prière salut', val: activites.reduce((s, a) => s + (a.nb_priere_salut || 0), 0), color: 'text-amber-700' },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : activites.length === 0 ? (
        <EmptyState message="Aucune sortie enregistrée" />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {['N°', 'Date', 'Supervision', 'Horaires', 'Membres', 'Abordées', 'Invitées', 'Prière salut', 'Notes', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {activites.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{a.ordre || '—'}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{format(new Date(a.date_sortie), 'd MMM yyyy', { locale: fr })}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-32 truncate">{a.supervision || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                      {a.heure_debut && a.heure_fin ? `${a.heure_debut} – ${a.heure_fin}` : '—'}
                      {a.duree_minutes ? <span className="ml-1 text-slate-400">({a.duree_minutes}min)</span> : null}
                    </td>
                    <td className="px-3 py-2 text-blue-600 font-semibold">{a.effectif_membres}</td>
                    <td className="px-3 py-2 text-slate-700 font-semibold">{a.nb_abordees}</td>
                    <td className="px-3 py-2 text-green-700 font-semibold">{a.nb_invitees}</td>
                    <td className="px-3 py-2 text-amber-700 font-semibold">{a.nb_priere_salut}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs max-w-24 truncate">{a.notes || '—'}</td>
                    <td className="px-3 py-2">
                      {hasPermission('activites', 'modifier') && (
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Modifier sortie' : 'Nouvelle sortie évangélisation'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">N° Ordre</label>
            <input className="input" value={form.ordre} onChange={set('ordre')} placeholder="Auto" />
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.date_sortie} onChange={set('date_sortie')} />
          </div>
          <div className="col-span-2">
            <label className="label">Supervision / Conduite</label>
            <input className="input" value={form.supervision} onChange={set('supervision')} placeholder="Nom du responsable" />
          </div>
          <div>
            <label className="label">Heure début</label>
            <input type="time" className="input" value={form.heure_debut} onChange={set('heure_debut')} />
          </div>
          <div>
            <label className="label">Heure fin</label>
            <input type="time" className="input" value={form.heure_fin} onChange={set('heure_fin')} />
          </div>
          <div>
            <label className="label">Durée (min) — auto</label>
            <input type="number" className="input bg-slate-50" value={form.duree_minutes} onChange={set('duree_minutes')} />
          </div>
          <div>
            <label className="label">Effectif membres</label>
            <input type="number" min={0} className="input" value={form.effectif_membres} onChange={setNum('effectif_membres')} />
          </div>
          <div>
            <label className="label">Personnes abordées</label>
            <input type="number" min={0} className="input" value={form.nb_abordees} onChange={setNum('nb_abordees')} />
          </div>
          <div>
            <label className="label">Personnes invitées</label>
            <input type="number" min={0} className="input" value={form.nb_invitees} onChange={setNum('nb_invitees')} />
          </div>
          <div>
            <label className="label">Prière du salut</label>
            <input type="number" min={0} className="input" value={form.nb_priere_salut} onChange={setNum('nb_priere_salut')} />
          </div>
          <div>
            <label className="label">Comptage</label>
            <input className="input" value={form.comptage} onChange={set('comptage')} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={3} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
          <p className="text-xs text-slate-400 mt-1"><span className="text-red-500">*</span> Champ obligatoire</p>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving && <Loader size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  )
}
