import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, InteractionPhoning, Personne } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Phone, Search, MessageCircle, MapPin, Calendar, Filter, Plus } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'
import { format, isToday, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'

interface PersonneAvecSuivi extends Personne {
  derniere_interaction?: InteractionPhoning
  prochain_contact?: string
}

export default function PhoningPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'tous' | 'aujourd_hui' | 'a_rappeler'>('aujourd_hui')
  const [personnes, setPersonnes] = useState<PersonneAvecSuivi[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPersonne, setSelectedPersonne] = useState<PersonneAvecSuivi | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [phForm, setPhForm] = useState({ type_interaction: 'appel', statut_contact: 'joignable', issue: 'aucune', notes: '', prochain_contact: '' })

  useEffect(() => { fetchData() }, [activeTab, search])

  const fetchData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    let query = supabase.from('personnes').select(`
      *, 
      interactions_phoning(id, statut_contact, issue, prochain_contact, date_interaction, type_interaction)
    `).eq('actif', true).order('created_at', { ascending: false })

    if (search) query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%`)

    const { data } = await query

    let filtered = (data || []).map((p: any) => {
      const inters = p.interactions_phoning || []
      const derniere = inters.sort((a: any, b: any) => new Date(b.date_interaction).getTime() - new Date(a.date_interaction).getTime())[0]
      return { ...p, derniere_interaction: derniere, prochain_contact: derniere?.prochain_contact }
    })

    if (activeTab === 'aujourd_hui') {
      filtered = filtered.filter((p: any) => p.prochain_contact === today || !p.derniere_interaction)
    } else if (activeTab === 'a_rappeler') {
      filtered = filtered.filter((p: any) => p.derniere_interaction?.statut_contact === 'a_rappeler')
    }

    setPersonnes(filtered)
    setLoading(false)
  }

  const ouvrir = (p: PersonneAvecSuivi) => {
    setSelectedPersonne(p)
    setPhForm({ type_interaction: 'appel', statut_contact: 'joignable', issue: 'aucune', notes: '', prochain_contact: '' })
    setModalOpen(true)
  }

  const enregistrer = async () => {
    if (!selectedPersonne) return
    const { error } = await supabase.from('interactions_phoning').insert({
      personne_id: selectedPersonne.id, auteur_id: user?.id,
      type_interaction: phForm.type_interaction as 'appel' | 'whatsapp' | 'visite',
      statut_contact: phForm.statut_contact as 'joignable' | 'non_joignable' | 'a_rappeler',
      issue: phForm.issue as 'revient' | 'incertain' | 'fi' | 'liberation' | 'aucune',
      notes: phForm.notes || null,
      prochain_contact: phForm.prochain_contact || null
    })
    if (error) return toast.error('Erreur')
    await logEvent('phoning', 'ajout', `Phoning : ${selectedPersonne.prenom} ${selectedPersonne.nom}`, selectedPersonne.id)
    toast.success('Interaction enregistrée')
    setModalOpen(false)
    fetchData()
  }

  const TABS = [
    { id: 'aujourd_hui', label: 'Mes suivis du jour' },
    { id: 'a_rappeler', label: 'À rappeler' },
    { id: 'tous', label: 'Tous' },
  ]

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    appel: <Phone size={14} className="text-blue-600" />,
    whatsapp: <MessageCircle size={14} className="text-green-600" />,
    visite: <MapPin size={14} className="text-purple-600" />
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Phoning</h2>
          <p className="text-sm text-slate-500">{personnes.length} personne{personnes.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-4 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : personnes.length === 0 ? (
        <EmptyState icon={Phone} title="Aucun suivi" description="Aucune personne à contacter pour ce filtre." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {personnes.map(p => (
            <div key={p.id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0 uppercase">
                  {p.prenom?.[0]}{p.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/integration/${p.id}`} className="font-semibold text-slate-900 hover:text-blue-600 truncate block">{p.prenom} {p.nom}</Link>
                  <p className="text-sm text-slate-500">{p.telephone || '—'}</p>
                </div>
                <StatusBadge statut={p.statut} size="sm" />
              </div>

              {p.derniere_interaction ? (
                <div className="text-xs bg-slate-50 rounded p-2 space-y-1">
                  <div className="flex items-center gap-1">
                    {TYPE_ICONS[p.derniere_interaction.type_interaction]}
                    <span className="text-slate-500">{format(new Date(p.derniere_interaction.date_interaction), 'd MMM', { locale: fr })}</span>
                    <StatusBadge statut={p.derniere_interaction.statut_contact} size="sm" />
                  </div>
                  {p.prochain_contact && (
                    <p className="text-slate-400">Prochain : {format(new Date(p.prochain_contact), 'd MMM yyyy', { locale: fr })}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Aucun contact enregistré</p>
              )}

              <button onClick={() => ouvrir(p)} className="btn-primary w-full justify-center text-xs">
                <Phone size={14} /> Enregistrer un contact
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal interaction */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Contact — ${selectedPersonne?.prenom} ${selectedPersonne?.nom}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={phForm.type_interaction} onChange={e => setPhForm(p => ({ ...p, type_interaction: e.target.value }))}>
                <option value="appel">Appel</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="visite">Visite</option>
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input" value={phForm.statut_contact} onChange={e => setPhForm(p => ({ ...p, statut_contact: e.target.value }))}>
                <option value="joignable">Joignable</option>
                <option value="non_joignable">Non joignable</option>
                <option value="a_rappeler">À rappeler</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Issue</label>
            <select className="input" value={phForm.issue} onChange={e => setPhForm(p => ({ ...p, issue: e.target.value }))}>
              <option value="aucune">Aucune</option>
              <option value="revient">Revient</option>
              <option value="incertain">Incertain</option>
              <option value="fi">FI</option>
              <option value="liberation">Libération</option>
            </select>
          </div>
          <div>
            <label className="label">Prochain contact</label>
            <input type="date" className="input" value={phForm.prochain_contact} onChange={e => setPhForm(p => ({ ...p, prochain_contact: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-20 resize-none" value={phForm.notes} onChange={e => setPhForm(p => ({ ...p, notes: e.target.value }))} placeholder="Compte-rendu…" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={enregistrer} className="btn-primary">Enregistrer</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
