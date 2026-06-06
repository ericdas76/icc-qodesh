import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit, Trash2, Loader, Eye, FileText, FileSpreadsheet, CalendarOff, Calendar, User, Building2, Clock } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { logEvent } from '../../lib/journal'
import { exportPDF, exportExcel } from '../../lib/export'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES_CONGE = [
  { val: 'conge', label: 'Congé', color: 'bg-blue-100 text-blue-700' },
  { val: 'sante', label: 'Santé', color: 'bg-red-100 text-red-700' },
  { val: 'autre', label: 'Autre', color: 'bg-slate-100 text-slate-700' },
]

const STATUTS_CONGE = [
  { val: 'en_cours', label: 'En cours', color: 'bg-green-100 text-green-700' },
  { val: 'termine', label: 'Terminé', color: 'bg-blue-100 text-blue-700' },
  { val: 'annule', label: 'Annulé', color: 'bg-red-100 text-red-700' },
]



const emptyForm = {
  membre_id: '',
  prenom_nom: '',
  sexe: '',
  categorie: '',
  departement: '',
  type_conge: '',
  statut: 'en_cours',
  description: '',
  date_debut: '',
  date_fin: '',
  remarque_speciale: '',
  annee: new Date().getFullYear(),
}

const COLS_EXPORT = [
  { header: 'N°', key: 'ordre', width: 10 },
  { header: 'Prénom & Nom', key: 'prenom_nom', width: 28 },
  { header: 'Sexe', key: 'sexe', width: 8 },
  { header: 'Catégorie', key: 'categorie', width: 18 },
  { header: 'Département', key: 'departement', width: 20 },
  { header: 'Type', key: 'type_conge', width: 12 },
  { header: 'Statut', key: 'statut_conge', width: 12 },
  { header: 'Début', key: 'date_debut', width: 14 },
  { header: 'Fin', key: 'date_fin', width: 14 },
  { header: 'Durée (j)', key: '_duree', width: 10 },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Remarque', key: 'remarque_speciale', width: 30 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDuree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return '—'
  const d = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86400000) + 1
  return d > 0 ? `${d} j` : '—'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ActivitesConges() {
  const { user, hasPermission } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewItem, setViewItem] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear())
  const [filterType, setFilterType] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [search, setSearch] = useState('')

  // Membres Référents + Stars actifs
  const [membresOptions, setMembresOptions] = useState<any[]>([])
  const [loadingMembres, setLoadingMembres] = useState(false)

  useEffect(() => { fetchData(); fetchMembres() }, [filterAnnee])

  // ── Fetch congés ──
  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('activites_conges')
      .select('id, ordre, prenom_nom, sexe, categorie, departement, type_conge, statut, description, date_debut, date_fin, remarque_speciale, annee, annee_conge, mois, actif, auteur_id, created_at')
      .eq('actif', true)
      .eq('annee', filterAnnee)
      .order('ordre', { nullsFirst: false })
    setItems(data || [])
    setLoading(false)
  }

  // ── Fetch Référents + Stars actifs ──
  const fetchMembres = async () => {
    setLoadingMembres(true)
    const { data } = await supabase
      .from('membres')
      .select('id, categorie, departement, personnes(id, nom, prenom, sexe)')
      .eq('actif', true)
      .in('categorie', ['Référent', 'Star'])
      .order('id')
    setMembresOptions(data || [])
    setLoadingMembres(false)
  }

  // ── Générer le prochain N° ordre (entier) ──
  const genererOrdre = async (annee: number): Promise<number> => {
    const { count } = await supabase
      .from('activites_conges')
      .select('*', { count: 'exact', head: true })
      .eq('annee', annee)
    return (count || 0) + 1
  }

  // ── Affichage N° ordre → "CON-NNN" ──
  const fmtOrdre = (n: number | null | undefined): string => {
    if (!n) return '—'
    return `CON-${String(n).padStart(3, '0')}`
  }

  // ── Sélection d'un membre → auto-remplir dept, catégorie, sexe ──
  const handleMembreChange = (membreId: string) => {
    const membre = membresOptions.find(m => m.id === membreId)
    if (!membre) {
      setForm(f => ({ ...f, membre_id: '', prenom_nom: '', sexe: '', categorie: '', departement: '' }))
      return
    }
    const p = membre.personnes
    const prenomNom = `${p?.prenom || ''} ${p?.nom || ''}`.trim()
    setForm(f => ({
      ...f,
      membre_id: membreId,
      prenom_nom: prenomNom,
      sexe: p?.sexe || '',
      categorie: membre.categorie || '',
      departement: membre.departement || '',
    }))
  }

  // ── Filtres ──
  const filtered = items.filter(a => {
    if (filterType && a.type_conge !== filterType) return false
    if (filterStatut && a.statut !== filterStatut) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(a.prenom_nom || '').toLowerCase().includes(q) &&
          !(a.departement || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // ── Ouvrir formulaire Nouveau ──
  const openAdd = () => {
    setEditItem(null)
    setForm({ ...emptyForm })
    setModal(true)
  }

  // ── Ouvrir formulaire Modifier ──
  const openEdit = (a: any) => {
    setEditItem(a)
    setForm({
      membre_id: '',
      prenom_nom: a.prenom_nom || '',
      sexe: a.sexe || '',
      categorie: a.categorie || '',
      departement: a.departement || '',
      type_conge: a.type_conge || '',
      statut: a.statut || 'en_cours',
      description: a.description || '',
      date_debut: a.date_debut || '',
      date_fin: a.date_fin || '',
      remarque_speciale: a.remarque_speciale || '',
      annee: a.annee || new Date().getFullYear(),
    })
    setModal(true)
  }

  // ── Enregistrer ──
  const save = async () => {
    if (!form.membre_id && !editItem) return toast.error('Veuillez sélectionner une personne')
    if (!form.date_debut) return toast.error('Date de début obligatoire')
    if (!form.date_fin) return toast.error('Date de fin obligatoire')
    setSaving(true)

    let ordre: number | null = editItem?.ordre || null

    // Générer N° ordre automatique uniquement à la création
    if (!editItem) {
      ordre = await genererOrdre(form.annee)
    }

    const payload: any = {
      ordre,
      prenom_nom: form.prenom_nom.trim(),
      sexe: form.sexe || null,
      categorie: form.categorie || null,
      departement: form.departement || null,
      type_conge: form.type_conge || null,
      statut: form.statut || 'en_cours',
      description: form.description || null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
      remarque_speciale: form.remarque_speciale || null,
      annee: form.annee,
      annee_conge: form.annee,
      auteur_id: user?.id,
    }

    if (form.date_debut) {
      payload.mois = new Date(form.date_debut).getMonth() + 1
    }

    const { error } = editItem
      ? await supabase.from('activites_conges').update(payload).eq('id', editItem.id)
      : await supabase.from('activites_conges').insert({ ...payload, actif: true })

    if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }

    await logEvent('activites', editItem ? 'modifier' : 'creer',
      `Congé ${editItem ? 'modifié' : 'créé'} : ${form.prenom_nom} (${fmtOrdre(ordre)})`, editItem?.id)

    toast.success(editItem ? 'Congé mis à jour' : 'Congé enregistré')
    setModal(false)
    fetchData()
    setSaving(false)
  }

  // ── Supprimer ──
  const supprimer = async (a: any) => {
    await supabase.from('activites_conges').update({ actif: false }).eq('id', a.id)
    await logEvent('activites', 'supprimer', `Congé supprimé : ${a.prenom_nom}`, a.id)
    toast.success('Supprimé')
    fetchData()
  }

  // ── Badges ──
  const typeBadge = (t: string | null) => {
    const cfg = TYPES_CONGE.find(x => x.val === t)
    return cfg
      ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
      : <span className="text-slate-400">—</span>
  }

  const statutBadge = (s: string | null) => {
    const cfg = STATUTS_CONGE.find(x => x.val === s)
    return cfg
      ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">{s || '—'}</span>
  }

  // ── Export ──
  const doExportData = () => filtered.map(a => ({ ...a, _duree: calcDuree(a.date_debut, a.date_fin) }))
  const doExportPDF = () => exportPDF(`Congés ${filterAnnee}`, COLS_EXPORT, doExportData(), `${filtered.length} entrée(s) • Année ${filterAnnee}`)
  const doExportExcel = () => exportExcel(`Congés_${filterAnnee}`, COLS_EXPORT, doExportData(), `Congés ${filterAnnee}`)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Congés {filterAnnee}</h3>
          <p className="text-sm text-slate-500">{filtered.length} entrée{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Filtre année */}
          <select className="input w-auto text-sm" value={filterAnnee}
            onChange={e => setFilterAnnee(parseInt(e.target.value))}>
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Filtre type */}
          <select className="input w-auto text-sm" value={filterType}
            onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous types</option>
            {TYPES_CONGE.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
          </select>
          {/* Filtre statut */}
          <select className="input w-auto text-sm" value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            {STATUTS_CONGE.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
          </select>
          {/* Recherche */}
          <input className="input w-auto text-sm" placeholder="Recherche…" value={search}
            onChange={e => setSearch(e.target.value)} />
          {/* Exports */}
          <button onClick={doExportPDF} className="btn-secondary text-xs" title="Export PDF">
            <FileText size={14} />
          </button>
          <button onClick={doExportExcel} className="btn-secondary text-xs" title="Export Excel">
            <FileSpreadsheet size={14} />
          </button>
          {/* Nouveau */}
          {hasPermission('activites', 'creer') && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-1">
              <Plus size={16} /> Nouveau
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-700" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarOff} title="Aucun congé enregistré" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">N°</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Prénom & Nom</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Catégorie</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Département</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Type</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Statut</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Début</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Fin</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Durée</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(a => (
                  <tr key={a.id} className={`hover:bg-slate-50 ${a.statut === 'annule' ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-1.5 text-slate-400 font-mono">{fmtOrdre(a.ordre)}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-800">{a.prenom_nom}</td>
                    <td className="px-3 py-1.5 text-slate-500">{a.categorie || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500 max-w-24 truncate">{a.departement || '—'}</td>
                    <td className="px-3 py-1.5">{typeBadge(a.type_conge)}</td>
                    <td className="px-3 py-1.5">{statutBadge(a.statut)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{fmtDate(a.date_debut)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{fmtDate(a.date_fin)}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-700">{calcDuree(a.date_debut, a.date_fin)}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setViewItem(a); setViewModal(true) }}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400" title="Voir">
                          <Eye size={13} />
                        </button>
                        {hasPermission('activites', 'modifier') && (
                          <button onClick={() => openEdit(a)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400" title="Modifier">
                            <Edit size={13} />
                          </button>
                        )}
                        {hasPermission('activites', 'supprimer') && (
                          <button onClick={() => setDeleteItem(a)}
                            className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500" title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Ajouter / Modifier ── */}
      <Modal isOpen={modal} onClose={() => setModal(false)}
        title={editItem ? `Modifier — ${editItem.prenom_nom}` : 'Nouveau congé'} size="lg">
        <div className="space-y-4">

          {/* N° Ordre — lecture seule à la création */}
          {editItem && (
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-violet-500 font-medium">N° Ordre</span>
              <span className="font-mono font-bold text-violet-700">{fmtOrdre(editItem.ordre)}</span>
            </div>
          )}
          {!editItem && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">N° Ordre</span>
              <span className="font-mono text-slate-400 text-sm">CON-*** (généré automatiquement)</span>
            </div>
          )}

          {/* Sélection personne — uniquement à la création */}
          {!editItem ? (
            <div>
              <label className="label">Personne en congé * <span className="text-slate-400 font-normal">(Référents & Stars actifs)</span></label>
              {loadingMembres ? (
                <div className="input flex items-center gap-2 text-slate-400">
                  <Loader size={14} className="animate-spin" /> Chargement...
                </div>
              ) : (
                <select className="input" value={form.membre_id} onChange={e => handleMembreChange(e.target.value)}>
                  <option value="">— Sélectionner une personne —</option>
                  {membresOptions.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.personnes?.prenom} {m.personnes?.nom} — {m.categorie}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            // En modification : personne non modifiable
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">Personne</span>
              <span className="font-medium text-slate-700">{editItem.prenom_nom}</span>
              <span className="text-xs text-slate-400">(non modifiable)</span>
            </div>
          )}

          {/* Champs auto-remplis — lecture seule */}
          {(form.membre_id || editItem) && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Sexe</label>
                <div className="input bg-slate-50 text-slate-600 cursor-not-allowed">
                  {form.sexe === 'M' ? 'Homme' : form.sexe === 'F' ? 'Femme' : '—'}
                </div>
              </div>
              <div>
                <label className="label">Catégorie</label>
                <div className="input bg-slate-50 text-slate-600 cursor-not-allowed">
                  {form.categorie || '—'}
                </div>
              </div>
              <div>
                <label className="label">Département</label>
                <div className="input bg-slate-50 text-slate-600 cursor-not-allowed truncate">
                  {form.departement || '—'}
                </div>
              </div>
            </div>
          )}

          {/* Type + Statut + Année */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Type congé</label>
              <select className="input" value={form.type_conge}
                onChange={e => setForm(p => ({ ...p, type_conge: e.target.value }))}>
                <option value="">— Choisir —</option>
                {TYPES_CONGE.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Statut congé</label>
              <select className="input" value={form.statut}
                onChange={e => setForm(p => ({ ...p, statut: e.target.value }))}>
                {STATUTS_CONGE.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Année</label>
              <input type="number" className="input" value={form.annee}
                onChange={e => setForm(p => ({ ...p, annee: parseInt(e.target.value) }))} />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date début *</label>
              <input type="date" className="input" value={form.date_debut}
                onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date fin *</label>
              <input type="date" className="input" value={form.date_fin}
                onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} />
            </div>
          </div>

          {/* Durée calculée */}
          {form.date_debut && form.date_fin && (
            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-sm text-violet-700 text-center">
              Durée calculée : <strong>{calcDuree(form.date_debut, form.date_fin)}</strong>
            </div>
          )}

          {/* Description & Remarque */}
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Motif du congé..." />
          </div>
          <div>
            <label className="label">Remarque spéciale</label>
            <textarea className="input resize-none" rows={2} value={form.remarque_speciale}
              onChange={e => setForm(p => ({ ...p, remarque_speciale: e.target.value }))} />
          </div>

          <p className="text-xs text-slate-400"><span className="text-red-500">*</span> Champs obligatoires</p>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Loader size={14} className="animate-spin" />}
            {editItem ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* ── Modal Visualiser ── */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="" size="md">
        {viewItem && (
          <div className="-m-4 -mt-4">
            {/* Header green/teal */}
            <div className="bg-gradient-to-r from-green-600 to-teal-700 px-6 pt-5 pb-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {viewItem.prenom_nom?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{viewItem.prenom_nom}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-green-100 text-sm">{fmtOrdre(viewItem.ordre)}</span>
                    {statutBadge(viewItem.statut)}
                    {typeBadge(viewItem.type_conge)}
                  </div>
                </div>
              </div>
            </div>
            {/* Contenu */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1"><User size={11} /> Sexe</p>
                  <p className="font-semibold text-green-900 text-sm mt-0.5">{viewItem.sexe === 'M' ? 'Homme' : viewItem.sexe === 'F' ? 'Femme' : '—'}</p>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-green-400 font-medium">Catégorie</p>
                  <p className="font-semibold text-green-900 text-sm mt-0.5">{viewItem.categorie || '—'}</p>
                </div>
                <div className="bg-teal-50 rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-xs text-teal-400 font-medium flex items-center gap-1"><Building2 size={11} /> Département</p>
                  <p className="font-semibold text-teal-900 text-sm mt-0.5">{viewItem.departement || '—'}</p>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1"><Calendar size={11} /> Date début</p>
                  <p className="font-semibold text-green-900 text-sm mt-0.5">{fmtDate(viewItem.date_debut)}</p>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1"><Calendar size={11} /> Date fin</p>
                  <p className="font-semibold text-green-900 text-sm mt-0.5">{fmtDate(viewItem.date_fin)}</p>
                </div>
              </div>
              {/* Durée */}
              <div className="bg-teal-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-teal-700">{calcDuree(viewItem.date_debut, viewItem.date_fin)}</p>
                <p className="text-xs text-teal-400 mt-0.5">durée totale</p>
              </div>
              {viewItem.description && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium">Description</p>
                  <p className="text-gray-700 text-sm mt-0.5">{viewItem.description}</p>
                </div>
              )}
              {viewItem.remarque_speciale && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium">Remarque spéciale</p>
                  <p className="text-gray-700 text-sm mt-0.5">{viewItem.remarque_speciale}</p>
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button onClick={() => setViewModal(false)} className="btn-secondary">Fermer</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm suppression ── */}
      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && supprimer(deleteItem)}
        title="Supprimer ce congé"
        message={`Supprimer le congé de ${deleteItem?.prenom_nom} ?`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
