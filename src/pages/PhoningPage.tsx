import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, InteractionPhoning, Personne } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Phone, Search, MessageCircle, MapPin, Calendar, Filter, Plus, History, Download } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel } from '../lib/export'

interface PersonneAvecSuivi extends Personne {
  derniere_interaction?: InteractionPhoning
  prochain_contact?: string
}

// Statuts exclus du phoning (personnes déjà intégrées)
const STATUTS_EXCLUS_PHONING = ['star', 'referent', 'référent', 'aide', 'departement', 'libere']

// Colonnes export historique
const COLS_HISTORIQUE = [
  { header: 'Nom', key: 'personnes.nom', width: 18 },
  { header: 'Prénom', key: 'personnes.prenom', width: 18 },
  { header: 'Téléphone', key: 'personnes.telephone', width: 16 },
  { header: 'Type appel', key: 'type_interaction', width: 14 },
  { header: 'Statut', key: 'statut_contact', width: 16 },
  { header: 'Issue', key: 'issue', width: 14 },
  { header: 'Date prochain contact', key: 'prochain_contact', width: 22 },
  { header: 'Date appel', key: 'date_interaction', width: 16 },
]

const PAGE_SIZE = 25

export default function PhoningPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'aujourd_hui' | 'a_rappeler' | 'tous' | 'historique'>('aujourd_hui')

  // ─── Onglets 1-3 : liste personnes ───────────────────────────────────────
  const [personnes, setPersonnes] = useState<PersonneAvecSuivi[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPersonne, setSelectedPersonne] = useState<PersonneAvecSuivi | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [phForm, setPhForm] = useState({
    type_interaction: 'appel',
    statut_contact: 'joignable',
    issue: 'aucune',
    notes: '',
    prochain_contact: ''
  })

  // ─── Onglet 4 : Historique ────────────────────────────────────────────────
  const [historique, setHistorique] = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histPage, setHistPage] = useState(1)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  useEffect(() => {
    if (activeTab !== 'historique') {
      fetchData()
    }
  }, [activeTab, search])

  useEffect(() => {
    if (activeTab === 'historique') {
      fetchHistorique()
    }
  }, [activeTab])

  // ─── Fetch liste phoning (onglets 1-3) ───────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    let query = supabase.from('personnes').select(`
      *, 
      interactions_phoning(id, statut_contact, issue, prochain_contact, date_interaction, type_interaction)
    `)
      .eq('actif', true)
      // Exclure les personnes déjà intégrées (star, référent, aide, département, libéré)
      .not('statut', 'in', `(${STATUTS_EXCLUS_PHONING.map(s => `"${s}"`).join(',')})`)
      .order('created_at', { ascending: false })

    if (search) query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%`)

    const { data } = await query

    let filtered = (data || []).map((p: any) => {
      const inters = p.interactions_phoning || []
      const derniere = inters.sort(
        (a: any, b: any) => new Date(b.date_interaction).getTime() - new Date(a.date_interaction).getTime()
      )[0]
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

  // ─── Fetch historique (onglet 4) ─────────────────────────────────────────
  const fetchHistorique = async () => {
    setHistLoading(true)
    setHistPage(1)

    let query = supabase
      .from('interactions_phoning')
      .select(`
        id, type_interaction, statut_contact, issue, prochain_contact, date_interaction, notes,
        personnes(nom, prenom, telephone)
      `)
      .order('date_interaction', { ascending: false })

    const { data, error } = await query

    if (error) {
      toast.error('Erreur chargement historique')
      setHistLoading(false)
      return
    }

    setHistorique(data || [])
    setHistLoading(false)
  }

  // ─── Modal enregistrement contact ────────────────────────────────────────
  const ouvrir = (p: PersonneAvecSuivi) => {
    setSelectedPersonne(p)
    setPhForm({
      type_interaction: 'appel',
      statut_contact: 'joignable',
      issue: 'aucune',
      notes: '',
      prochain_contact: ''
    })
    setModalOpen(true)
  }

  const enregistrer = async () => {
    if (!selectedPersonne) return
    const { error } = await supabase.from('interactions_phoning').insert({
      personne_id: selectedPersonne.id,
      auteur_id: user?.id,
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

  // ─── Export Excel historique ──────────────────────────────────────────────
  const handleExportExcel = () => {
    let donnees = historique

    // Filtre par date si précisé
    if (dateDebut || dateFin) {
      donnees = historique.filter(h => {
        const d = h.date_interaction?.split('T')[0] || ''
        if (dateDebut && d < dateDebut) return false
        if (dateFin && d > dateFin) return false
        return true
      })
    }

    if (donnees.length === 0) {
      toast.error('Aucune donnée à exporter pour cette période')
      return
    }

    // Transformer pour l'export (aplatir les relations)
    const rows = donnees.map((h: any) => ({
      'personnes.nom': h.personnes?.nom || '',
      'personnes.prenom': h.personnes?.prenom || '',
      'personnes.telephone': h.personnes?.telephone || '',
      type_interaction: h.type_interaction || '',
      statut_contact: h.statut_contact || '',
      issue: h.issue || '',
      prochain_contact: h.prochain_contact || '',
      date_interaction: h.date_interaction ? h.date_interaction.split('T')[0] : '',
    }))

    exportExcel('Historique_Phoning', COLS_HISTORIQUE, rows as any, 'Historique')
    toast.success(`${rows.length} ligne(s) exportées`)
  }

  // ─── Pagination historique ────────────────────────────────────────────────
  const histFiltré = historique
  const histTotal = histFiltré.length
  const histPage_data = histFiltré.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE)

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const TABS = [
    { id: 'aujourd_hui', label: 'Mes suivis du jour' },
    { id: 'a_rappeler', label: 'À rappeler' },
    { id: 'tous', label: 'Tous' },
    { id: 'historique', label: 'Historique Phoning' },
  ]

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    appel: <Phone size={14} className="text-blue-600" />,
    whatsapp: <MessageCircle size={14} className="text-green-600" />,
    visite: <MapPin size={14} className="text-purple-600" />
  }

  const TYPE_LABELS: Record<string, string> = {
    appel: 'Appel',
    whatsapp: 'WhatsApp',
    visite: 'Visite',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Phoning</h2>
          {activeTab !== 'historique' && (
            <p className="text-sm text-slate-500">
              {personnes.length} personne{personnes.length > 1 ? 's' : ''}
            </p>
          )}
          {activeTab === 'historique' && (
            <p className="text-sm text-slate-500">
              {histTotal} interaction{histTotal > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-4 w-fit flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.id === 'historique' ? (
              <span className="flex items-center gap-1.5">
                <History size={14} />
                {tab.label}
              </span>
            ) : tab.label}
          </button>
        ))}
      </div>

      {/* ── Onglets 1-3 : liste des personnes ── */}
      {activeTab !== 'historique' && (
        <>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
            </div>
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
                      <Link
                        to={`/integration/${p.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 truncate block"
                      >
                        {p.prenom} {p.nom}
                      </Link>
                      <p className="text-sm text-slate-500">{p.telephone || '—'}</p>
                    </div>
                    <StatusBadge statut={p.statut} size="sm" />
                  </div>

                  {p.derniere_interaction ? (
                    <div className="text-xs bg-slate-50 rounded p-2 space-y-1">
                      <div className="flex items-center gap-1">
                        {TYPE_ICONS[p.derniere_interaction.type_interaction]}
                        <span className="text-slate-500">
                          {format(new Date(p.derniere_interaction.date_interaction), 'd MMM', { locale: fr })}
                        </span>
                        <StatusBadge statut={p.derniere_interaction.statut_contact} size="sm" />
                      </div>
                      {p.prochain_contact && (
                        <p className="text-slate-400">
                          Prochain : {format(new Date(p.prochain_contact), 'd MMM yyyy', { locale: fr })}
                        </p>
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
        </>
      )}

      {/* ── Onglet 4 : Historique Phoning ── */}
      {activeTab === 'historique' && (
        <div className="card overflow-hidden">
          {/* Barre filtres + export */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Date début</label>
              <input
                type="date"
                className="input text-sm py-1.5 px-2 h-9"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Date fin</label>
              <input
                type="date"
                className="input text-sm py-1.5 px-2 h-9"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
              />
            </div>
            <button
              onClick={handleExportExcel}
              className="btn-primary text-sm h-9 flex items-center gap-2"
            >
              <Download size={15} />
              Exporter Excel
            </button>
            {(dateDebut || dateFin) && (
              <button
                onClick={() => { setDateDebut(''); setDateFin('') }}
                className="btn-secondary text-sm h-9"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {/* Tableau */}
          {histLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
            </div>
          ) : histTotal === 0 ? (
            <div className="p-8">
              <EmptyState icon={History} title="Aucune interaction" description="Aucun appel enregistré dans l'historique." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white text-xs">
                      <th className="text-left px-4 py-3 font-semibold">Nom</th>
                      <th className="text-left px-4 py-3 font-semibold">Prénom</th>
                      <th className="text-left px-4 py-3 font-semibold">Téléphone</th>
                      <th className="text-left px-4 py-3 font-semibold">Type appel</th>
                      <th className="text-left px-4 py-3 font-semibold">Statut</th>
                      <th className="text-left px-4 py-3 font-semibold">Issue</th>
                      <th className="text-left px-4 py-3 font-semibold">Date prochain contact</th>
                      <th className="text-left px-4 py-3 font-semibold">Date appel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {histPage_data.map((h: any, idx: number) => (
                      <tr
                        key={h.id}
                        className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-100/60'}
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {h.personnes?.nom || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {h.personnes?.prenom || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {h.personnes?.telephone || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            {TYPE_ICONS[h.type_interaction]}
                            <span className="text-slate-700">{TYPE_LABELS[h.type_interaction] || h.type_interaction}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge statut={h.statut_contact} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge statut={h.issue || 'aucune'} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {h.prochain_contact
                            ? format(new Date(h.prochain_contact), 'd MMM yyyy', { locale: fr })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {h.date_interaction
                            ? format(new Date(h.date_interaction), 'd MMM yyyy', { locale: fr })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                total={histTotal}
                page={histPage}
                pageSize={PAGE_SIZE}
                onPage={p => setHistPage(p)}
              />
            </>
          )}
        </div>
      )}

      {/* Modal interaction */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Contact — ${selectedPersonne?.prenom} ${selectedPersonne?.nom}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={phForm.type_interaction}
                onChange={e => setPhForm(p => ({ ...p, type_interaction: e.target.value }))}
              >
                <option value="appel">Appel</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="visite">Visite</option>
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select
                className="input"
                value={phForm.statut_contact}
                onChange={e => setPhForm(p => ({ ...p, statut_contact: e.target.value }))}
              >
                <option value="joignable">Joignable</option>
                <option value="non_joignable">Non joignable</option>
                <option value="a_rappeler">À rappeler</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Issue</label>
            <select
              className="input"
              value={phForm.issue}
              onChange={e => setPhForm(p => ({ ...p, issue: e.target.value }))}
            >
              <option value="aucune">Aucune</option>
              <option value="revient">Revient</option>
              <option value="incertain">Incertain</option>
              <option value="fi">FI</option>
              <option value="liberation">Libération</option>
            </select>
          </div>
          <div>
            <label className="label">Prochain contact</label>
            <input
              type="date"
              className="input"
              value={phForm.prochain_contact}
              onChange={e => setPhForm(p => ({ ...p, prochain_contact: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-20 resize-none"
              value={phForm.notes}
              onChange={e => setPhForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Compte-rendu…"
            />
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
