import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Plus, AlertTriangle, CheckCircle } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'

export default function FormationFichePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const [formation, setFormation] = useState<any>(null)
  const [inscriptions, setInscriptions] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [personnes, setPersonnes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ajoutModal, setAjoutModal] = useState(false)
  const [selectedPersonne, setSelectedPersonne] = useState('')

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const [{ data: form }, { data: inscr }, { data: sess }, { data: pers }] = await Promise.all([
      supabase.from('formations').select('*').eq('id', id!).single(),
      supabase.from('inscriptions_formation').select(`*, personnes(id, nom, prenom, statut), absences_formation(*)`).eq('formation_id', id!),
      supabase.from('sessions_formation').select('*').eq('formation_id', id!).order('date_session'),
      supabase.from('personnes').select('id, nom, prenom').eq('actif', true).order('nom')
    ])
    setFormation(form)
    setInscriptions(inscr || [])
    setSessions(sess || [])
    setPersonnes(pers || [])
    setLoading(false)
  }

  const inscrire = async () => {
    if (!selectedPersonne) return
    const { error } = await supabase.from('inscriptions_formation').insert({
      formation_id: id, personne_id: selectedPersonne, auteur_id: user?.id
    })
    if (error?.code === '23505') return toast.error('Déjà inscrit')
    if (error) return toast.error('Erreur')
    await logEvent('formations', 'inscription', `Inscription à la formation`)
    toast.success('Inscription enregistrée')
    setAjoutModal(false)
    setSelectedPersonne('')
    fetchAll()
  }

  const changerStatut = async (inscId: string, statut: string) => {
    await supabase.from('inscriptions_formation').update({ statut }).eq('id', inscId)
    fetchAll()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
  if (!formation) return <div className="text-center py-16 text-slate-500">Formation introuvable</div>

  const CLASSE_LABELS: Record<string, string> = { '001': 'Classe 001', '101': 'Classe 101', '201': 'Classe 201', '301': 'Classe 301' }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h2 className="page-title">{formation.nom}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="badge bg-blue-100 text-blue-700">{CLASSE_LABELS[formation.classe]}</span>
            <span className="text-sm text-slate-400">Année {formation.annee}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Inscrits', value: inscriptions.filter(i => i.statut !== 'abandonne').length },
          { label: 'En cours', value: inscriptions.filter(i => i.statut === 'en_cours').length },
          { label: 'Terminé', value: inscriptions.filter(i => i.statut === 'termine').length },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{s.value}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Inscriptions */}
      <div className="card">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 text-sm">Inscriptions ({inscriptions.length})</h3>
          {hasPermission('formations', 'creer') && (
            <button onClick={() => setAjoutModal(true)} className="btn-primary text-xs py-1">
              <Plus size={14} /> Inscrire
            </button>
          )}
        </div>
        {inscriptions.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 text-center">Aucune inscription</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Personne</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Statut</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Absences</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inscriptions.map(i => {
                  const nbAbsences = (i.absences_formation || []).length
                  const alerte = nbAbsences >= 2
                  return (
                    <tr key={i.id} className={alerte ? 'bg-red-50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {alerte && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                          <p className="font-medium text-slate-800">{i.personnes?.prenom} {i.personnes?.nom}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2"><StatusBadge statut={i.statut} size="sm" /></td>
                      <td className="px-4 py-2">
                        <span className={`font-bold text-sm ${alerte ? 'text-red-600' : 'text-slate-500'}`}>{nbAbsences}</span>
                        {alerte && <span className="ml-1 text-xs text-red-500">⚠️</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs">
                        {format(new Date(i.date_inscription), 'd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={i.statut}
                          onChange={e => changerStatut(i.id, e.target.value)}
                          className="text-xs border rounded px-1 py-0.5 bg-white"
                        >
                          <option value="inscrit">Inscrit</option>
                          <option value="en_cours">En cours</option>
                          <option value="termine">Terminé</option>
                          <option value="abandonne">Abandonné</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={ajoutModal} onClose={() => setAjoutModal(false)} title="Inscrire une personne">
        <div className="space-y-4">
          <div>
            <label className="label">Personne</label>
            <select className="input" value={selectedPersonne} onChange={e => setSelectedPersonne(e.target.value)}>
              <option value="">— Choisir —</option>
              {personnes.filter((p: any) => !inscriptions.find(i => i.personne_id === p.id)).map((p: any) => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAjoutModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={inscrire} className="btn-primary">Inscrire</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
