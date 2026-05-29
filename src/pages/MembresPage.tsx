import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Search, Download, Eye } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export default function MembresPage() {
  const { hasPermission } = useAuth()
  const [membres, setMembres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  useEffect(() => { fetchMembres() }, [search, filterStatut])

  const fetchMembres = async () => {
    setLoading(true)
    let query = supabase.from('membres').select(`*, personnes(*)`).eq('actif', true).order('created_at', { ascending: false })
    if (filterStatut) query = query.eq('statut', filterStatut)
    const { data } = await query
    let filtered = data || []
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter((m: any) =>
        m.personnes?.nom?.toLowerCase().includes(s) ||
        m.personnes?.prenom?.toLowerCase().includes(s) ||
        m.numero_membre?.toLowerCase().includes(s)
      )
    }
    setMembres(filtered)
    setLoading(false)
  }

  const exportXLSX = () => {
    if (!hasPermission('membres', 'exporter')) return toast.error('Permission refusée')
    const data = membres.map((m: any) => ({
      'N° Membre': m.numero_membre || '',
      'Nom': m.personnes?.nom || '', 'Prénom': m.personnes?.prenom || '',
      'Téléphone': m.personnes?.telephone || '', 'Statut': m.statut,
      'Département': m.departement || '', 'Date adhésion': m.date_adhesion || ''
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Membres')
    XLSX.writeFile(wb, `icc-membres-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const STATUTS = ['', 'nouveau', 'fi', 'formation', 'star', 'departement', 'libere', 'inactif']
  const STATUT_LABELS: Record<string, string> = { '': 'Tous', nouveau: 'Nouveau', fi: 'FI', formation: 'Formation', star: 'STAR', departement: 'Département', libere: 'Libéré', inactif: 'Inactif' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Membres</h2>
          <p className="text-sm text-slate-500">{membres.length} membre{membres.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={exportXLSX} className="btn-secondary"><Download size={16} /> Export</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
        ) : membres.length === 0 ? (
          <EmptyState icon={Search} title="Aucun membre trouvé" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Membre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">N° Membre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Département</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Adhésion</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {membres.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 uppercase shrink-0">
                          {m.personnes?.prenom?.[0]}{m.personnes?.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{m.personnes?.prenom} {m.personnes?.nom}</p>
                          <p className="text-xs text-slate-400">{m.personnes?.telephone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono hidden md:table-cell">{m.numero_membre || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge statut={m.statut} size="sm" /></td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{m.departement || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                      {m.date_adhesion ? format(new Date(m.date_adhesion), 'd MMM yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/membres/${m.id}`} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 inline-block">
                        <Eye size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
