import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, Formation } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, BookOpen, Eye, Loader } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { logEvent } from '../lib/journal'

export default function FormationsPage() {
  const { hasPermission } = useAuth()
  const [formations, setFormations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ classe: '001', nom: '', description: '', annee: new Date().getFullYear() })

  useEffect(() => { fetchFormations() }, [])

  const fetchFormations = async () => {
    const { data } = await supabase.from('formations').select(`
      *, 
      inscriptions_formation(statut)
    `).eq('actif', true).order('classe')
    setFormations(data || [])
    setLoading(false)
  }

  const creer = async () => {
    if (!form.nom.trim()) return toast.error('Nom requis')
    setSaving(true)
    const { error } = await supabase.from('formations').insert(form)
    if (error) { toast.error('Erreur'); setSaving(false); return }
    await logEvent('formations', 'creation', `Formation créée : ${form.nom}`)
    toast.success('Formation créée')
    setCreateModal(false)
    setForm({ classe: '001', nom: '', description: '', annee: new Date().getFullYear() })
    fetchFormations()
    setSaving(false)
  }

  const CLASSES: Record<string, { label: string; color: string }> = {
    '001': { label: 'Classe 001', color: 'bg-slate-100 text-slate-700' },
    '101': { label: 'Classe 101', color: 'bg-blue-100 text-blue-700' },
    '201': { label: 'Classe 201', color: 'bg-purple-100 text-purple-700' },
    '301': { label: 'Classe 301', color: 'bg-amber-100 text-amber-700' },
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Formation</h2>
          <p className="text-sm text-slate-500">{formations.length} classe{formations.length > 1 ? 's' : ''}</p>
        </div>
        {hasPermission('formations', 'creer') && (
          <button onClick={() => setCreateModal(true)} className="btn-primary">
            <Plus size={16} /> Nouvelle classe
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : formations.length === 0 ? (
        <EmptyState icon={BookOpen} title="Aucune formation" description="Créez la première classe de formation." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formations.map(f => {
            const inscrits = (f.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length
            const cfg = CLASSES[f.classe] || CLASSES['001']
            return (
              <div key={f.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <BookOpen size={22} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{f.nom}</h3>
                        <span className={`badge ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm text-slate-400">Année {f.annee}</p>
                    </div>
                  </div>
                  <Link to={`/formations/${f.id}`} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600">
                    <Eye size={16} />
                  </Link>
                </div>
                {f.description && <p className="text-sm text-slate-500 mt-3">{f.description}</p>}
                <div className="mt-4 pt-3 border-t flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{inscrits}</p>
                    <p className="text-xs text-slate-400">Inscrit{inscrits > 1 ? 's' : ''}</p>
                  </div>
                  <Link to={`/formations/${f.id}`} className="btn-secondary text-xs ml-auto">Gérer</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nouvelle classe de formation">
        <div className="space-y-4">
          <div>
            <label className="label">Classe</label>
            <select className="input" value={form.classe} onChange={e => setForm(p => ({ ...p, classe: e.target.value }))}>
              <option value="001">001 — Démarrage en foi</option>
              <option value="101">101 — Fondements</option>
              <option value="201">201 — Maturité spirituelle</option>
              <option value="301">301 — Leadership</option>
            </select>
          </div>
          <div>
            <label className="label">Nom *</label>
            <input className="input" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Classe 101 — Session 2025" />
          </div>
          <div>
            <label className="label">Année</label>
            <input type="number" className="input" value={form.annee} onChange={e => setForm(p => ({ ...p, annee: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-16 resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
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
