import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, FamilleImpact } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Home, Eye, Edit, Loader } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { logEvent } from '../lib/journal'

export default function FamillesImpactPage() {
  const { user, hasPermission } = useAuth()
  const [familles, setFamilles] = useState<any[]>([])
  const [personnes, setPersonnes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nom: '', quartier: '', adresse_maison_hote: '', responsable_id: '', copilote_id: '', jour_reunion: '', notes: '' })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: fi }, { data: pers }] = await Promise.all([
      supabase.from('familles_impact').select(`*, responsable:personnes!familles_impact_responsable_id_fkey(nom, prenom), copilote:personnes!familles_impact_copilote_id_fkey(nom, prenom), membres_familles_impact(actif)`).eq('actif', true).order('nom'),
      supabase.from('personnes').select('id, nom, prenom').eq('actif', true).order('nom')
    ])
    setFamilles(fi || [])
    setPersonnes(pers || [])
    setLoading(false)
  }

  const creer = async () => {
    if (!form.nom.trim()) return toast.error('Nom requis')
    setSaving(true)
    const { error } = await supabase.from('familles_impact').insert({
      nom: form.nom, quartier: form.quartier || null,
      adresse_maison_hote: form.adresse_maison_hote || null,
      responsable_id: form.responsable_id || null, copilote_id: form.copilote_id || null,
      jour_reunion: form.jour_reunion || null, notes: form.notes || null
    })
    if (error) { toast.error('Erreur'); setSaving(false); return }
    await logEvent('fi', 'creation', `Nouvelle FI créée : ${form.nom}`)
    toast.success('Famille d\'Impact créée')
    setCreateModal(false)
    setForm({ nom: '', quartier: '', adresse_maison_hote: '', responsable_id: '', copilote_id: '', jour_reunion: '', notes: '' })
    fetchAll()
    setSaving(false)
  }

  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Familles d'Impact</h2>
          <p className="text-sm text-slate-500">{familles.length} famille{familles.length > 1 ? 's' : ''}</p>
        </div>
        {hasPermission('membres', 'creer') && (
          <button onClick={() => setCreateModal(true)} className="btn-primary">
            <Plus size={16} /> Nouvelle FI
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : familles.length === 0 ? (
        <EmptyState icon={Home} title="Aucune Famille d'Impact" description="Créez la première FI pour démarrer." action={<button onClick={() => setCreateModal(true)} className="btn-primary">Créer une FI</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {familles.map(fi => {
            const nbMembres = (fi.membres_familles_impact || []).filter((m: any) => m.actif).length
            return (
              <div key={fi.id} className="card p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <Home size={18} className="text-amber-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{fi.nom}</h3>
                      <p className="text-xs text-slate-400">{fi.quartier || 'Quartier non défini'}</p>
                    </div>
                  </div>
                  <Link to={`/familles-impact/${fi.id}`} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600">
                    <Eye size={15} />
                  </Link>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Responsable</span>
                    <span className="text-slate-700 font-medium">
                      {fi.responsable ? `${fi.responsable.prenom} ${fi.responsable.nom}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Copilote</span>
                    <span className="text-slate-700">{fi.copilote ? `${fi.copilote.prenom} ${fi.copilote.nom}` : '—'}</span>
                  </div>
                  {fi.jour_reunion && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Réunion</span>
                      <span className="text-slate-700">{fi.jour_reunion}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-slate-400">Membres</span>
                    <span className="font-bold text-blue-600">{nbMembres}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nouvelle Famille d'Impact">
        <div className="space-y-4">
          <div>
            <label className="label">Nom *</label>
            <input className="input" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="FI Ambohimanarina" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quartier</label>
              <input className="input" value={form.quartier} onChange={e => setForm(p => ({ ...p, quartier: e.target.value }))} />
            </div>
            <div>
              <label className="label">Jour de réunion</label>
              <select className="input" value={form.jour_reunion} onChange={e => setForm(p => ({ ...p, jour_reunion: e.target.value }))}>
                <option value="">—</option>
                {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Adresse maison hôte</label>
            <input className="input" value={form.adresse_maison_hote} onChange={e => setForm(p => ({ ...p, adresse_maison_hote: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Responsable</label>
              <select className="input" value={form.responsable_id} onChange={e => setForm(p => ({ ...p, responsable_id: e.target.value }))}>
                <option value="">— Aucun —</option>
                {personnes.map((p: any) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Copilote</label>
              <select className="input" value={form.copilote_id} onChange={e => setForm(p => ({ ...p, copilote_id: e.target.value }))}>
                <option value="">— Aucun —</option>
                {personnes.map((p: any) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-16 resize-none" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={creer} disabled={saving} className="btn-primary">
              {saving && <Loader size={14} className="animate-spin" />} Créer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
