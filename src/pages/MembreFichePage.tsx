import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, User, Phone, Mail, Briefcase, Globe, Hash, Calendar, Building2 } from 'lucide-react'
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
    </div>
  )
  if (!membre) return <div className="text-center py-16 text-slate-500">Membre introuvable</div>

  const p = membre.personnes

  return (
    <div className="max-w-3xl space-y-0">

      {/* Bouton retour */}
      <div className="mb-4">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={16} /> Retour
        </button>
      </div>

      {/* ── En-tête coloré ── */}
      <div className="rounded-t-2xl bg-gradient-to-r from-blue-600 to-indigo-700 px-6 pt-6 pb-8 text-white shadow-md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Avatar initiales */}
            <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
              {p?.prenom?.[0]?.toUpperCase()}{p?.nom?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {p?.prenom} {p?.nom}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusBadge statut={membre.statut} />
                {membre.numero_membre && (
                  <span className="flex items-center gap-1 bg-white/20 text-white text-xs font-mono px-2.5 py-0.5 rounded-full">
                    <Hash size={11} /> {membre.numero_membre}
                  </span>
                )}
                {membre.departement && (
                  <span className="flex items-center gap-1 bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full">
                    <Building2 size={11} /> {membre.departement}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link to={`/integration/${membre.personne_id}`}
            className="text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-1.5 rounded-lg transition-colors">
            Fiche intégration
          </Link>
        </div>
      </div>

      {/* ── Corps de la fiche ── */}
      <div className="rounded-b-2xl bg-white shadow-md border border-gray-100 divide-y divide-gray-100">

        {/* Section — Informations membre */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              <User size={14} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              Informations membre
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-400 font-medium mb-0.5">Numéro membre</p>
              <p className="font-semibold text-blue-900 font-mono">{membre.numero_membre || '—'}</p>
            </div>
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-400 font-medium mb-0.5">Statut</p>
              <StatusBadge statut={membre.statut} size="sm" />
            </div>
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-400 font-medium mb-0.5">Département</p>
              <p className="font-semibold text-blue-900">{membre.departement || '—'}</p>
            </div>
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-400 font-medium mb-1">
                <Calendar size={11} className="inline mr-1" />Date d'adhésion
              </p>
              <p className="font-semibold text-blue-900">
                {membre.date_adhesion
                  ? format(new Date(membre.date_adhesion), 'd MMMM yyyy', { locale: fr })
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Section — Informations personnelles */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
              <Phone size={14} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              Informations personnelles
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl px-4 py-3 flex items-start gap-3">
              <Phone size={15} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-green-500 font-medium mb-0.5">Téléphone</p>
                <p className="font-semibold text-green-900">{p?.telephone || '—'}</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl px-4 py-3 flex items-start gap-3">
              <Mail size={15} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-green-500 font-medium mb-0.5">Email</p>
                <p className="font-semibold text-green-900 break-all">{p?.email || '—'}</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl px-4 py-3 flex items-start gap-3">
              <Briefcase size={15} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-green-500 font-medium mb-0.5">Profession</p>
                <p className="font-semibold text-green-900">{p?.profession || '—'}</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl px-4 py-3 flex items-start gap-3">
              <Globe size={15} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-green-500 font-medium mb-0.5">Nationalité</p>
                <p className="font-semibold text-green-900">{p?.nationalite || '—'}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
