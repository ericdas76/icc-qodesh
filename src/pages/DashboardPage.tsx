import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, UserPlus, Phone, Home, BookOpen, Clock, AlertCircle, TrendingUp, CalendarOff, X, Building2 } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { format, differenceInDays, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Stats {
  total_personnes: number
  arrivants_ce_mois: number
  membres_actifs: number
  total_fi: number
  appels_semaine: number
  inscrits_formation: number
  taches_en_retard: number
  conges_en_cours: number
}

interface CongeEnCours {
  id: string
  prenom_nom: string
  departement: string
  date_debut: string
  date_fin: string
  duree: number
}

export default function DashboardPage() {
  const { profil } = useAuth()
  const [stats, setStats] = useState<Stats>({
    total_personnes: 0,
    arrivants_ce_mois: 0,
    membres_actifs: 0,
    total_fi: 0,
    appels_semaine: 0,
    inscrits_formation: 0,
    taches_en_retard: 0,
    conges_en_cours: 0
  })
  const [arrivants, setArrivants] = useState<any[]>([])
  const [tachesEnRetard, setTachesEnRetard] = useState<any[]>([])
  const [activiteRecente, setActiviteRecente] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal congés en cours
  const [congesModal, setCongesModal] = useState(false)
  const [congesList, setCongesList] = useState<CongeEnCours[]>([])
  const [loadingConges, setLoadingConges] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const now = new Date()
    const annee = now.getFullYear()
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const debutSemaine = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const today = now.toISOString().split('T')[0]

    const [
      { count: totalPersonnes },
      { count: arrivantsMois },
      { count: membresActifs },
      { count: totalFI },
      { count: appelsSemaine },
      { count: inscritsFormation },
      { count: tachesRetard },
      { count: congesEnCours },
      { data: arrivantsList },
      { data: tachesList },
      { data: journal }
    ] = await Promise.all([
      supabase.from('personnes').select('*', { count: 'exact', head: true }).eq('actif', true),
      supabase.from('personnes').select('*', { count: 'exact', head: true }).eq('actif', true).gte('created_at', debutMois),
      supabase.from('membres').select('*', { count: 'exact', head: true }).eq('actif', true).neq('statut', 'libere').neq('statut', 'inactif'),
      supabase.from('familles_impact').select('*', { count: 'exact', head: true }).eq('actif', true),
      supabase.from('interactions_phoning').select('*', { count: 'exact', head: true }).gte('created_at', debutSemaine),
      supabase.from('inscriptions_formation').select('*', { count: 'exact', head: true }).in('statut', ['inscrit', 'en_cours']),
      supabase.from('taches_suivi').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente').lt('echeance', today),
      supabase.from('activites_conges').select('*', { count: 'exact', head: true })
        .eq('statut_conge', 'en_cours')
        .eq('annee', annee),
      supabase.from('personnes').select('id, nom, prenom, statut, created_at, nationalite').eq('actif', true).order('created_at', { ascending: false }).limit(5),
      supabase.from('taches_suivi').select('*, personnes(nom, prenom)').eq('statut', 'en_attente').lt('echeance', today).order('echeance').limit(5),
      supabase.from('journal_evenements').select('*, profils(nom, prenom)').order('created_at', { ascending: false }).limit(8)
    ])

    setStats({
      total_personnes: totalPersonnes || 0,
      arrivants_ce_mois: arrivantsMois || 0,
      membres_actifs: membresActifs || 0,
      total_fi: totalFI || 0,
      appels_semaine: appelsSemaine || 0,
      inscrits_formation: inscritsFormation || 0,
      taches_en_retard: tachesRetard || 0,
      conges_en_cours: congesEnCours || 0
    })
    setArrivants(arrivantsList || [])
    setTachesEnRetard(tachesList || [])
    setActiviteRecente(journal || [])
    setLoading(false)
  }

  const fetchCongesEnCours = async () => {
    setLoadingConges(true)
    const annee = new Date().getFullYear()
    const { data } = await supabase
      .from('activites_conges')
      .select('id, prenom_nom, departement, date_debut, date_fin, duree')
      .eq('statut_conge', 'en_cours')
      .eq('annee', annee)
      .order('date_debut', { ascending: true })

    setCongesList(
      (data || []).map(c => ({
        id: c.id,
        prenom_nom: c.prenom_nom || '—',
        departement: c.departement || '—',
        date_debut: c.date_debut || '',
        date_fin: c.date_fin || '',
        duree: c.duree || 0
      }))
    )
    setLoadingConges(false)
  }

  const handleCongesTileClick = () => {
    setCongesModal(true)
    fetchCongesEnCours()
  }

  const dureeRestante = (dateFin: string): string => {
    if (!dateFin) return '—'
    const fin = new Date(dateFin)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = differenceInDays(fin, today)
    if (diff < 0) return 'Terminé'
    if (diff === 0) return 'Dernier jour'
    return `${diff} jour${diff > 1 ? 's' : ''}`
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
    </div>
  )

  const statCards = [
    { label: 'Personnes suivies', value: stats.total_personnes, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', onClick: undefined },
    { label: 'Arrivants ce mois', value: stats.arrivants_ce_mois, icon: UserPlus, color: 'text-green-600', bg: 'bg-green-50', onClick: undefined },
    { label: 'Membres actifs', value: stats.membres_actifs, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', onClick: undefined },
    { label: 'Familles d\'Impact', value: stats.total_fi, icon: Home, color: 'text-amber-600', bg: 'bg-amber-50', onClick: undefined },
    { label: 'Appels (7 jours)', value: stats.appels_semaine, icon: Phone, color: 'text-cyan-600', bg: 'bg-cyan-50', onClick: undefined },
    { label: 'En formation', value: stats.inscrits_formation, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', onClick: undefined },
    { label: 'Tâches en retard', value: stats.taches_en_retard, icon: AlertCircle, color: stats.taches_en_retard > 0 ? 'text-red-600' : 'text-slate-400', bg: stats.taches_en_retard > 0 ? 'bg-red-50' : 'bg-slate-50', onClick: undefined },
    {
      label: 'Personnes en congé',
      value: stats.conges_en_cours,
      icon: CalendarOff,
      color: stats.conges_en_cours > 0 ? 'text-orange-600' : 'text-slate-400',
      bg: stats.conges_en_cours > 0 ? 'bg-orange-50' : 'bg-slate-50',
      onClick: handleCongesTileClick,
      clickable: true
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Bonjour, {profil?.prenom} 👋
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {statCards.map(card => (
          <div
            key={card.label}
            className={`card p-4 ${card.clickable ? 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-orange-300 transition-all' : ''}`}
            onClick={card.onClick}
            title={card.clickable ? 'Cliquer pour voir la liste' : undefined}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center shrink-0`}>
                <card.icon size={20} className={card.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500 leading-tight">{card.label}</p>
              </div>
              {card.clickable && (
                <div className="text-orange-400 text-xs font-medium shrink-0">
                  ›
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Arrivants récents */}
        <div className="card">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Arrivants récents</h3>
            <Link to="/integration" className="text-xs text-blue-600 hover:underline">Voir tout</Link>
          </div>
          <div className="divide-y">
            {arrivants.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">Aucun arrivant</p>
            ) : arrivants.map(p => (
              <Link key={p.id} to={`/integration/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0 uppercase">
                  {p.prenom?.[0]}{p.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.prenom} {p.nom}</p>
                  <p className="text-xs text-slate-400">{format(new Date(p.created_at), 'd MMM', { locale: fr })}</p>
                </div>
                <StatusBadge statut={p.statut} size="sm" />
              </Link>
            ))}
          </div>
        </div>

        {/* Tâches en retard */}
        <div className="card">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              Tâches en retard
              {stats.taches_en_retard > 0 && (
                <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{stats.taches_en_retard}</span>
              )}
            </h3>
          </div>
          <div className="divide-y">
            {tachesEnRetard.length === 0 ? (
              <div className="p-4 text-sm text-green-600 text-center flex items-center justify-center gap-2">
                <span>✅</span> Aucun retard
              </div>
            ) : tachesEnRetard.map(t => (
              <Link key={t.id} to={`/integration/${t.personne_id}`} className="block p-3 hover:bg-slate-50">
                <p className="text-sm font-medium text-slate-800 truncate">{t.titre}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">{t.personnes?.prenom} {t.personnes?.nom}</span>
                  <span className="text-xs text-red-500 font-medium">• Échu le {format(new Date(t.echeance), 'd MMM', { locale: fr })}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="card">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-slate-800 text-sm">Activité récente</h3>
          </div>
          <div className="divide-y">
            {activiteRecente.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">Aucune activité</p>
            ) : activiteRecente.map(j => (
              <div key={j.id} className="p-3">
                <p className="text-xs text-slate-700">{j.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">{j.profils?.prenom} {j.profils?.nom}</span>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs text-slate-400">{format(new Date(j.created_at), 'd MMM HH:mm', { locale: fr })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== MODAL CONGÉS EN COURS ===== */}
      {congesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-orange-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
                  <CalendarOff size={18} className="text-orange-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Personnes en congé</h2>
                  <p className="text-xs text-slate-500">Congés « En cours » — {new Date().getFullYear()}</p>
                </div>
              </div>
              <button onClick={() => setCongesModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingConges ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                </div>
              ) : congesList.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CalendarOff size={40} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">Aucun congé en cours</p>
                  <p className="text-xs mt-1">Tous les membres sont présents</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Compteur */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {congesList.length} personne{congesList.length > 1 ? 's' : ''} en congé
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Nom</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Département</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Date début</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Date fin</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">Restant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {congesList.map(c => {
                          const restant = dureeRestante(c.date_fin)
                          const isTermine = restant === 'Terminé'
                          const isDernierJour = restant === 'Dernier jour'
                          return (
                            <tr key={c.id} className="hover:bg-orange-50/40 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-medium text-slate-800">{c.prenom_nom}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <Building2 size={13} className="text-slate-400 shrink-0" />
                                  <span className="text-xs">{c.departement}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">
                                {c.date_debut
                                  ? format(new Date(c.date_debut), 'd MMM yyyy', { locale: fr })
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">
                                {c.date_fin
                                  ? format(new Date(c.date_fin), 'd MMM yyyy', { locale: fr })
                                  : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full
                                  ${isTermine ? 'bg-slate-100 text-slate-500'
                                    : isDernierJour ? 'bg-amber-100 text-amber-700'
                                    : 'bg-green-100 text-green-700'}`}>
                                  {restant}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t bg-slate-50 rounded-b-xl flex justify-end">
              <button onClick={() => setCongesModal(false)} className="btn-secondary text-sm px-5">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
