import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Plus, UserMinus, Home } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'

export default function FamilleImpactFichePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [fi, setFI] = useState<any>(null)
  const [membres, setMembres] = useState<any[]>([])
  const [personnes, setPersonnes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ajoutModal, setAjoutModal] = useState(false)
  const [selectedPersonne, setSelectedPersonne] = useState('')

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const [{ data: fiData }, { data: membresData }, { data: pers }] = await Promise.all([
      supabase.from('familles_impact').select(`*, responsable:personnes!familles_impact_responsable_id_fkey(nom, prenom), copilote:personnes!familles_impact_copilote_id_fkey(nom, prenom)`).eq('id', id!).single(),
      supabase.from('membres_familles_impact').select(`*, personnes(id, nom, prenom, statut, telephone)`).eq('famille_id', id!).eq('actif', true),
      supabase.from('personnes').select('id, nom, prenom').eq('actif', true).order('nom')
    ])
    setFI(fiData)
    setMembres(membresData || [])
    setPersonnes(pers || [])
    setLoading(false)
  }

  const ajouterMembre = async () => {
    if (!selectedPersonne) return
    const { error } = await supabase.from('membres_familles_impact').upsert({
      famille_id: id, personne_id: selectedPersonne, actif: true, date_ajout: new Date().toISOString().split('T')[0]
    })
    if (error) return toast.error('Erreur')
    toast.success('Membre ajouté')
    setAjoutModal(false)
    setSelectedPersonne('')
    fetchAll()
  }

  const retirerMembre = async (membreId: string) => {
    await supabase.from('membres_familles_impact').update({ actif: false, date_depart: new Date().toISOString().split('T')[0] }).eq('id', membreId)
    toast.success('Membre retiré')
    fetchAll()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
  if (!fi) return <div className="text-center py-16 text-slate-500">FI introuvable</div>

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="page-title">{fi.nom}</h2>
          <p className="text-sm text-slate-500">{fi.quartier || 'Quartier non défini'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-3">Détails</h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Responsable', value: fi.responsable ? `${fi.responsable.prenom} ${fi.responsable.nom}` : '—' },
              { label: 'Copilote', value: fi.copilote ? `${fi.copilote.prenom} ${fi.copilote.nom}` : '—' },
              { label: 'Jour réunion', value: fi.jour_reunion || '—' },
              { label: 'Adresse', value: fi.adresse_maison_hote || '—' },
            ].map(item => (
              <div key={item.label} className="flex justify-between">
                <span className="text-slate-400">{item.label}</span>
                <span className="font-medium text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
          {fi.notes && <p className="mt-3 text-sm text-slate-500 bg-slate-50 rounded p-2">{fi.notes}</p>}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Membres ({membres.length})</h3>
            <button onClick={() => setAjoutModal(true)} className="btn-primary text-xs py-1"><Plus size={14} /> Ajouter</button>
          </div>
          <div className="space-y-2">
            {membres.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aucun membre</p>
            ) : membres.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 uppercase">
                  {m.personnes?.prenom?.[0]}{m.personnes?.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.personnes?.prenom} {m.personnes?.nom}</p>
                  <StatusBadge statut={m.personnes?.statut || 'nouveau'} size="sm" />
                </div>
                <button onClick={() => retirerMembre(m.id)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500">
                  <UserMinus size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={ajoutModal} onClose={() => setAjoutModal(false)} title="Ajouter un membre">
        <div className="space-y-4">
          <div>
            <label className="label">Personne</label>
            <select className="input" value={selectedPersonne} onChange={e => setSelectedPersonne(e.target.value)}>
              <option value="">— Choisir —</option>
              {personnes.filter((p: any) => !membres.find((m: any) => m.personne_id === p.id)).map((p: any) => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAjoutModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={ajouterMembre} className="btn-primary">Ajouter</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
