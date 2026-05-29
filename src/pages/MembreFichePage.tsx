import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Edit } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function MembreFichePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [membre, setMembre] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('membres').select('*, personnes(*)').eq('id', id!).single().then(({ data }) => {
      setMembre(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
  if (!membre) return <div className="text-center py-16 text-slate-500">Membre introuvable</div>

  const p = membre.personnes

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="page-title">{p?.prenom} {p?.nom}</h2>
            <StatusBadge statut={membre.statut} />
            {membre.numero_membre && <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{membre.numero_membre}</span>}
          </div>
        </div>
        <Link to={`/integration/${membre.personne_id}`} className="btn-secondary text-xs">Fiche intégration</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-4">Informations membre</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Numéro membre', value: membre.numero_membre || '—' },
              { label: 'Statut', value: <StatusBadge statut={membre.statut} size="sm" /> },
              { label: 'Département', value: membre.departement || '—' },
              { label: 'Date adhésion', value: membre.date_adhesion ? format(new Date(membre.date_adhesion), 'd MMMM yyyy', { locale: fr }) : '—' },
            ].map(item => (
              <div key={item.label} className="flex justify-between">
                <span className="text-slate-400">{item.label}</span>
                <span className="font-medium text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-4">Informations personnelles</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Téléphone', value: p?.telephone || '—' },
              { label: 'Email', value: p?.email || '—' },
              { label: 'Profession', value: p?.profession || '—' },
              { label: 'Nationalité', value: p?.nationalite || '—' },
            ].map(item => (
              <div key={item.label} className="flex justify-between">
                <span className="text-slate-400">{item.label}</span>
                <span className="font-medium text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
