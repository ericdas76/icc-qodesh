import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase, Personne, InteractionPhoning, TacheSuivi } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Edit, Phone, MessageCircle, MapPin, User, Calendar, CheckCircle, Clock, Plus } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'

export default function PersonneFichePage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [personne, setPersonne] = useState<Personne | null>(null)
  const [interactions, setInteractions] = useState<InteractionPhoning[]>([])
  const [taches, setTaches] = useState<TacheSuivi[]>([])
  const [loading, setLoading] = useState(true)
  const [phoningModal, setPhoningModal] = useState(false)
  const [tacheModal, setTacheModal] = useState<TacheSuivi | null>(null)

  // Form phoning
  const [phForm, setPhForm] = useState({ type_interaction: 'appel', statut_contact: 'joignable', issue: 'aucune', notes: '', prochain_contact: '' })

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const [{ data: p }, { data: inter }, { data: tach }] = await Promise.all([
      supabase.from('personnes').select('*').eq('id', id!).single(),
      supabase.from('interactions_phoning').select('*, profils(nom, prenom)').eq('personne_id', id!).order('created_at', { ascending: false }),
      supabase.from('taches_suivi').select('*').eq('personne_id', id!).order('echeance')
    ])
    setPersonne(p)
    setInteractions(inter || [])
    setTaches(tach || [])
    setLoading(false)
  }

  const ajouterInteraction = async () => {
    const { error } = await supabase.from('interactions_phoning').insert({
      personne_id: id!, auteur_id: user?.id,
      type_interaction: phForm.type_interaction as 'appel' | 'whatsapp' | 'visite',
      statut_contact: phForm.statut_contact as 'joignable' | 'non_joignable' | 'a_rappeler',
      issue: phForm.issue as 'revient' | 'incertain' | 'fi' | 'liberation' | 'aucune',
      notes: phForm.notes || null,
      prochain_contact: phForm.prochain_contact || null
    })
    if (error) return toast.error('Erreur')
    await logEvent('phoning', 'ajout', `Interaction ajoutée pour ${personne?.prenom} ${personne?.nom}`, id)
    toast.success('Interaction enregistrée')
    setPhoningModal(false)
    fetchAll()
  }

  const terminerTache = async (tache: TacheSuivi) => {
    await supabase.from('taches_suivi').update({ statut: 'terminee', completed_at: new Date().toISOString() }).eq('id', tache.id)
    toast.success('Tâche terminée')
    fetchAll()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
  if (!personne) return <div className="text-center py-16 text-slate-500">Personne introuvable</div>

  const SEX_LABEL: Record<string, string> = { M: 'Masculin', F: 'Féminin' }
  const SIT_LABEL: Record<string, string> = { celibataire: 'Célibataire', marie: 'Marié(e)', divorce: 'Divorcé(e)', veuf: 'Veuf/Veuve' }

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="page-title">{personne.prenom} {personne.nom}</h2>
            <StatusBadge statut={personne.statut} />
          </div>
          <p className="text-sm text-slate-500">Arrivé(e) le {personne.date_premier_contact ? format(new Date(personne.date_premier_contact), 'd MMMM yyyy', { locale: fr }) : '—'}</p>
        </div>
        {hasPermission('membres', 'modifier') && (
          <Link to={`/integration/${id}/modifier`} className="btn-secondary">
            <Edit size={16} /> Modifier
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Infos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-4">Informations</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Sexe', value: SEX_LABEL[personne.sexe || ''] || '—' },
                { label: 'Nationalité', value: personne.nationalite },
                { label: 'Date naissance', value: personne.date_naissance ? format(new Date(personne.date_naissance), 'd MMMM yyyy', { locale: fr }) : '—' },
                { label: 'Lieu naissance', value: personne.lieu_naissance || '—' },
                { label: 'Téléphone', value: personne.telephone || '—' },
                { label: 'Email', value: personne.email || '—' },
                { label: 'Profession', value: personne.profession || '—' },
                { label: 'Situation', value: SIT_LABEL[personne.situation_familiale || ''] || '—' },
                { label: 'Enfants', value: personne.nombre_enfants?.toString() || '0' },
                { label: 'Quartier', value: personne.quartier || '—' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-slate-400 text-xs">{item.label}</p>
                  <p className="font-medium text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
            {personne.notes && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                <p className="font-medium mb-1">Notes</p>
                <p>{personne.notes}</p>
              </div>
            )}
          </div>

          {/* Historique interactions */}
          <div className="card">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 text-sm">Historique phoning ({interactions.length})</h3>
              <button onClick={() => setPhoningModal(true)} className="btn-primary text-xs py-1">
                <Plus size={14} /> Ajouter
              </button>
            </div>
            {interactions.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">Aucune interaction</p>
            ) : (
              <div className="divide-y">
                {interactions.map(inter => (
                  <div key={inter.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        inter.type_interaction === 'appel' ? 'bg-blue-100' : inter.type_interaction === 'whatsapp' ? 'bg-green-100' : 'bg-purple-100'
                      }`}>
                        {inter.type_interaction === 'appel' ? <Phone size={12} className="text-blue-600" /> : <MessageCircle size={12} className="text-green-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge statut={inter.statut_contact} size="sm" />
                          {inter.issue && inter.issue !== 'aucune' && <StatusBadge statut={inter.issue} size="sm" />}
                          <span className="text-xs text-slate-400">{format(new Date(inter.date_interaction), 'd MMM yyyy HH:mm', { locale: fr })}</span>
                        </div>
                        {inter.notes && <p className="text-sm text-slate-600 mt-1">{inter.notes}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tâches */}
        <div className="card h-fit">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-slate-700 text-sm">Tâches de suivi</h3>
          </div>
          <div className="divide-y">
            {taches.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">Aucune tâche</p>
            ) : taches.map(t => {
              const enRetard = t.statut === 'en_attente' && new Date(t.echeance) < new Date()
              return (
                <div key={t.id} className={`p-3 ${enRetard ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => t.statut === 'en_attente' && terminerTache(t)}
                      className={`mt-0.5 shrink-0 ${t.statut === 'terminee' ? 'text-green-500' : 'text-slate-300 hover:text-green-500'}`}
                    >
                      <CheckCircle size={16} />
                    </button>
                    <div>
                      <p className={`text-sm font-medium ${t.statut === 'terminee' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.titre}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={11} className={enRetard ? 'text-red-500' : 'text-slate-400'} />
                        <span className={`text-xs ${enRetard ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                          {format(new Date(t.echeance), 'd MMM', { locale: fr })}
                          {enRetard && ' — EN RETARD'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal phoning */}
      <Modal open={phoningModal} onClose={() => setPhoningModal(false)} title="Nouvelle interaction phoning">
        <div className="space-y-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={phForm.type_interaction} onChange={e => setPhForm(p => ({ ...p, type_interaction: e.target.value }))}>
              <option value="appel">Appel téléphonique</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="visite">Visite</option>
            </select>
          </div>
          <div>
            <label className="label">Statut contact</label>
            <select className="input" value={phForm.statut_contact} onChange={e => setPhForm(p => ({ ...p, statut_contact: e.target.value }))}>
              <option value="joignable">Joignable</option>
              <option value="non_joignable">Non joignable</option>
              <option value="a_rappeler">À rappeler</option>
            </select>
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
            <textarea className="input min-h-20 resize-none" value={phForm.notes} onChange={e => setPhForm(p => ({ ...p, notes: e.target.value }))} placeholder="Compte-rendu de l'échange…" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setPhoningModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={ajouterInteraction} className="btn-primary">Enregistrer</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
