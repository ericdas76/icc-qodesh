import { useEffect, useState } from 'react'
import { supabase, JournalEvenement } from '../lib/supabase'
import { Search, Filter, History } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const MODULES = ['', 'integration', 'phoning', 'membres', 'fi', 'formations', 'activites', 'administration']
const MODULES_LABELS: Record<string, string> = { '': 'Tous les modules', integration: 'Intégration', phoning: 'Phoning', membres: 'Membres', fi: 'Familles d\'Impact', formations: 'Formation', activites: 'Activités', administration: 'Administration' }

const MODULE_COLORS: Record<string, string> = {
  integration: 'bg-blue-100 text-blue-700',
  phoning: 'bg-green-100 text-green-700',
  membres: 'bg-purple-100 text-purple-700',
  fi: 'bg-amber-100 text-amber-700',
  formations: 'bg-indigo-100 text-indigo-700',
  activites: 'bg-cyan-100 text-cyan-700',
  administration: 'bg-red-100 text-red-700',
}

export default function HistoriquePage() {
  const [journal, setJournal] = useState<JournalEvenement[]>([])
  const [loading, setLoading] = useState(true)
  const [filterModule, setFilterModule] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 30

  useEffect(() => { setPage(0) }, [filterModule, filterDate, search])
  useEffect(() => { fetchJournal() }, [filterModule, filterDate, search, page])

  const fetchJournal = async () => {
    setLoading(true)
    let query = supabase.from('journal_evenements').select('*, profils(nom, prenom)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (filterModule) query = query.eq('module', filterModule)
    if (filterDate) query = query.gte('created_at', filterDate).lte('created_at', filterDate + 'T23:59:59')
    if (search) query = query.ilike('description', `%${search}%`)
    const { data, count } = await query
    setJournal(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Historique</h2>
          <p className="text-sm text-slate-500">{total} événement{total > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Rechercher dans les événements…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterModule} onChange={e => setFilterModule(e.target.value)}>
          {MODULES.map(m => <option key={m} value={m}>{MODULES_LABELS[m]}</option>)}
        </select>
        <input type="date" className="input w-auto" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        {(filterModule || filterDate || search) && (
          <button onClick={() => { setFilterModule(''); setFilterDate(''); setSearch('') }} className="btn-secondary text-xs">Réinitialiser</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
      ) : journal.length === 0 ? (
        <EmptyState icon={History} title="Aucun événement" description="L'historique est vide pour ces critères." />
      ) : (
        <div className="card divide-y">
          {journal.map(j => (
            <div key={j.id} className="p-3 hover:bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`badge text-xs ${MODULE_COLORS[j.module] || 'bg-slate-100 text-slate-600'}`}>{MODULES_LABELS[j.module] || j.module}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 badge">{j.action}</span>
                  </div>
                  <p className="text-sm text-slate-700">{j.description || '—'}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {j.profils && (
                      <span className="text-xs text-slate-400">{(j.profils as any).prenom} {(j.profils as any).nom}</span>
                    )}
                    <span className="text-xs text-slate-300">•</span>
                    <span className="text-xs text-slate-400">{format(new Date(j.created_at), 'd MMMM yyyy à HH:mm', { locale: fr })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-secondary disabled:opacity-40">Précédent</button>
          <span className="text-sm text-slate-500">Page {page + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  )
}
