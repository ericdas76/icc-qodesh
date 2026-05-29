import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, Personne } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Filter, Download, Eye, Edit, UserX } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import * as XLSX from 'xlsx'

const STATUTS = ['', 'nouveau', 'fi', 'formation', 'star', 'departement', 'libere', 'inactif']

export default function PersonnesPage() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [personnes, setPersonnes] = useState<Personne[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [desactiverDialog, setDesactiverDialog] = useState<Personne | null>(null)

  const canCreate = hasPermission('membres', 'creer')
  const canEdit = hasPermission('membres', 'modifier')
  const canDelete = hasPermission('membres', 'supprimer')
  const canExport = hasPermission('membres', 'exporter')

  useEffect(() => { fetchPersonnes() }, [search, filterStatut])

  const fetchPersonnes = async () => {
    setLoading(true)
    let query = supabase.from('personnes').select('*').eq('actif', true).order('created_at', { ascending: false })
    if (filterStatut) query = query.eq('statut', filterStatut)
    if (search) query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,telephone.ilike.%${search}%`)
    const { data } = await query
    setPersonnes(data || [])
    setLoading(false)
  }

  const desactiver = async (personne: Personne) => {
    const { error } = await supabase.from('personnes').update({ actif: false }).eq('id', personne.id)
    if (error) return toast.error('Erreur lors de la désactivation')
    await logEvent('integration', 'desactivation', `Désactivation : ${personne.prenom} ${personne.nom}`, personne.id)
    toast.success('Personne désactivée')
    fetchPersonnes()
  }

  const exportXLSX = () => {
    if (!canExport) return toast.error('Permission refusée')
    const data = personnes.map(p => ({
      'Nom': p.nom, 'Prénom': p.prenom, 'Téléphone': p.telephone || '',
      'Email': p.email || '', 'Statut': p.statut, 'Sexe': p.sexe || '',
      'Nationalité': p.nationalite, 'Date arrivée': p.date_premier_contact || ''
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Intégration')
    XLSX.writeFile(wb, `icc-integration-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const STATUT_LABELS: Record<string, string> = {
    '': 'Tous les statuts', nouveau: 'Nouveau', fi: 'FI', formation: 'Formation',
    star: 'STAR', departement: 'Département', libere: 'Libéré', inactif: 'Inactif'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Intégration</h2>
          <p className="text-sm text-slate-500 mt-0.5">{personnes.length} personne{personnes.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button onClick={exportXLSX} className="btn-secondary">
              <Download size={16} /> Export
            </button>
          )}
          {canCreate && (
            <Link to="/integration/nouveau" className="btn-primary">
              <Plus size={16} /> Nouvelle fiche
            </Link>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher nom, prénom, téléphone…"
            className="input pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
        ) : personnes.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Aucune personne trouvée"
            description={search || filterStatut ? "Modifiez vos critères de recherche." : "Commencez par créer une première fiche."}
            action={canCreate ? <Link to="/integration/nouveau" className="btn-primary">Créer une fiche</Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Personne</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Téléphone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Profession</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Arrivée</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {personnes.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0 uppercase">
                          {p.prenom?.[0]}{p.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{p.prenom} {p.nom}</p>
                          <p className="text-xs text-slate-400 md:hidden">{p.telephone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{p.telephone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{p.profession || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge statut={p.statut} size="sm" /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                      {p.date_premier_contact ? format(new Date(p.date_premier_contact), 'd MMM yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link to={`/integration/${p.id}`} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600">
                          <Eye size={15} />
                        </Link>
                        {canEdit && (
                          <Link to={`/integration/${p.id}/modifier`} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600">
                            <Edit size={15} />
                          </Link>
                        )}
                        {canDelete && (
                          <button onClick={() => setDesactiverDialog(p)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-500">
                            <UserX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!desactiverDialog}
        onClose={() => setDesactiverDialog(null)}
        onConfirm={() => desactiverDialog && desactiver(desactiverDialog)}
        title="Désactiver la fiche"
        message={`Êtes-vous sûr de vouloir désactiver ${desactiverDialog?.prenom} ${desactiverDialog?.nom} ? La fiche sera masquée mais conservée.`}
        confirmLabel="Désactiver"
        danger
      />
    </div>
  )
}
