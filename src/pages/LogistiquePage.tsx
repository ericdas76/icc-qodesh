import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit2, Loader, Download, Eye, Package } from 'lucide-react'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { logEvent } from '../lib/journal'
import { exportExcel } from '../lib/export'

const CATEGORIES = [
  'Son & Musique',
  'Vidéo & Projection',
  'Éclairage',
  'Mobilier',
  'Imprimerie & Bureau',
  'Décoration',
  'Cuisine & Restauration',
  'Sécurité',
  'Transport',
  'Informatique',
  'Communication',
  'Autre',
]

const ETATS = [
  { value: 'bon', label: 'Bon état', color: 'badge-green' },
  { value: 'usage', label: 'Usagé', color: 'badge-yellow' },
  { value: 'mauvais', label: 'Mauvais état', color: 'badge-orange' },
  { value: 'hors_service', label: 'Hors service', color: 'badge-red' },
]

const emptyForm = {
  categorie: '',
  designation: '',
  etat: 'bon',
  numero_serie: '',
  pret: false,
  maintenance: false,
  notes: '',
}

const COLS_EXPORT = [
  { header: 'Catégorie', key: 'categorie' },
  { header: 'Désignation', key: 'designation' },
  { header: 'État', key: '_etat_label' },
  { header: 'N° Série', key: 'numero_serie' },
  { header: 'En prêt', key: '_pret' },
  { header: 'En maintenance', key: '_maintenance' },
  { header: 'Notes', key: 'notes' },
]

function etatBadge(etat: string) {
  const found = ETATS.find(e => e.value === etat)
  return found ? found : { label: etat, color: 'badge-gray' }
}

export default function LogistiquePage() {
  const { user, hasPermission } = useAuth()

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)

  // Filtres
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [filtreEtat, setFiltreEtat] = useState('')
  const [filtrePret, setFiltrePret] = useState<'' | 'true' | 'false'>('')
  const [filtreMaintenance, setFiltreMaintenance] = useState<'' | 'true' | 'false'>('')
  const [recherche, setRecherche] = useState('')

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('logistique')
      .select('*')
      .eq('actif', true)
      .order('categorie')
      .order('designation')
    if (error) toast.error('Erreur chargement logistique')
    else setItems(data || [])
    setLoading(false)
  }

  // ─── Données filtrées ──────────────────────────────────────────────────────
  const itemsFiltres = items.filter(item => {
    if (filtreCategorie && item.categorie !== filtreCategorie) return false
    if (filtreEtat && item.etat !== filtreEtat) return false
    if (filtrePret === 'true' && !item.pret) return false
    if (filtrePret === 'false' && item.pret) return false
    if (filtreMaintenance === 'true' && !item.maintenance) return false
    if (filtreMaintenance === 'false' && item.maintenance) return false
    if (recherche) {
      const q = recherche.toLowerCase()
      const match = (item.designation || '').toLowerCase().includes(q)
        || (item.numero_serie || '').toLowerCase().includes(q)
        || (item.notes || '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm })
    setModal(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      categorie: item.categorie || '',
      designation: item.designation || '',
      etat: item.etat || 'bon',
      numero_serie: item.numero_serie || '',
      pret: item.pret || false,
      maintenance: item.maintenance || false,
      notes: item.notes || '',
    })
    setModal(true)
  }

  async function save() {
    if (!form.designation.trim()) {
      toast.error('La désignation est obligatoire')
      return
    }
    if (!form.categorie) {
      toast.error('La catégorie est obligatoire')
      return
    }
    setSaving(true)
    const payload = {
      categorie: form.categorie,
      designation: form.designation.trim(),
      etat: form.etat,
      numero_serie: form.numero_serie.trim() || null,
      pret: form.pret,
      maintenance: form.maintenance,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      const { error } = await supabase
        .from('logistique')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      if (error) { toast.error('Erreur modification : ' + error.message); setSaving(false); return }
      toast.success('Article modifié')
      await logEvent('logistique', 'modification', `${form.designation} modifié`, editing.id)
    } else {
      const { error } = await supabase
        .from('logistique')
        .insert({ ...payload, actif: true, auteur_id: user?.id })
      if (error) { toast.error('Erreur ajout article : ' + error.message); setSaving(false); return }
      toast.success('Article ajouté')
      await logEvent('logistique', 'creation', `${form.designation} ajouté`)
    }
    setSaving(false)
    setModal(false)
    loadItems()
  }

  async function deleteItem(item: any) {
    const { error } = await supabase
      .from('logistique')
      .update({ actif: false, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) { toast.error('Erreur suppression'); return }
    toast.success('Article retiré')
    await logEvent('logistique', 'suppression', `${item.designation} supprimé`, item.id)
    setConfirmDelete(null)
    loadItems()
  }

  function doExport() {
    const rows = itemsFiltres.map(item => ({
      ...item,
      _etat_label: ETATS.find(e => e.value === item.etat)?.label || item.etat,
      _pret: item.pret ? 'Oui' : 'Non',
      _maintenance: item.maintenance ? 'Oui' : 'Non',
    }))
    exportExcel('Logistique — Inventaire', COLS_EXPORT, rows)
    toast.success('Export Excel généré')
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const nbTotal = items.length
  const nbBon = items.filter(i => i.etat === 'bon').length
  const nbPret = items.filter(i => i.pret).length
  const nbMaintenance = items.filter(i => i.maintenance).length
  const nbHorsService = items.filter(i => i.etat === 'hors_service').length

  // ─── Groupement par catégorie (pour affichage) ─────────────────────────────
  const parCategorie: Record<string, any[]> = {}
  itemsFiltres.forEach(item => {
    const cat = item.categorie || 'Autre'
    if (!parCategorie[cat]) parCategorie[cat] = []
    parCategorie[cat].push(item)
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={24} className="text-gray-600" />
            Logistique
          </h1>
          <p className="text-sm text-gray-500 mt-1">Inventaire et gestion du matériel de l'église</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('logistique', 'export') && (
            <button onClick={doExport} className="btn btn-secondary flex items-center gap-2">
              <Download size={16} /> Export Excel
            </button>
          )}
          {hasPermission('logistique', 'create') && (
            <button onClick={openAdd} className="btn btn-primary flex items-center gap-2">
              <Plus size={16} /> Ajouter un article
            </button>
          )}
        </div>
      </div>

      {/* Cartes stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-500 font-medium uppercase">Total articles</p>
          <p className="text-3xl font-bold text-gray-800">{nbTotal}</p>
        </div>
        <div className="card bg-green-50 border border-green-200">
          <p className="text-xs text-green-600 font-medium uppercase">Bon état</p>
          <p className="text-3xl font-bold text-green-700">{nbBon}</p>
        </div>
        <div className="card bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-600 font-medium uppercase">En prêt</p>
          <p className="text-3xl font-bold text-blue-700">{nbPret}</p>
        </div>
        <div className="card bg-yellow-50 border border-yellow-200">
          <p className="text-xs text-yellow-600 font-medium uppercase">Maintenance</p>
          <p className="text-3xl font-bold text-yellow-700">{nbMaintenance}</p>
        </div>
        <div className="card bg-red-50 border border-red-200">
          <p className="text-xs text-red-600 font-medium uppercase">Hors service</p>
          <p className="text-3xl font-bold text-red-700">{nbHorsService}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text"
            className="input col-span-2 md:col-span-1"
            placeholder="Rechercher..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
          />
          <select
            className="input"
            value={filtreCategorie}
            onChange={e => setFiltreCategorie(e.target.value)}
          >
            <option value="">Toutes catégories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="input"
            value={filtreEtat}
            onChange={e => setFiltreEtat(e.target.value)}
          >
            <option value="">Tous états</option>
            {ETATS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select
            className="input"
            value={filtrePret}
            onChange={e => setFiltrePret(e.target.value as '' | 'true' | 'false')}
          >
            <option value="">Prêt : tous</option>
            <option value="true">En prêt</option>
            <option value="false">Disponible</option>
          </select>
          <select
            className="input"
            value={filtreMaintenance}
            onChange={e => setFiltreMaintenance(e.target.value as '' | 'true' | 'false')}
          >
            <option value="">Maintenance : tous</option>
            <option value="true">En maintenance</option>
            <option value="false">Opérationnel</option>
          </select>
        </div>
        {(filtreCategorie || filtreEtat || filtrePret || filtreMaintenance || recherche) && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-gray-500">{itemsFiltres.length} résultat(s)</span>
            <button
              onClick={() => {
                setFiltreCategorie(''); setFiltreEtat('')
                setFiltrePret(''); setFiltreMaintenance(''); setRecherche('')
              }}
              className="text-xs text-red-500 hover:underline"
            >
              Effacer les filtres
            </button>
          </div>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size={32} className="animate-spin text-gray-400" />
        </div>
      ) : itemsFiltres.length === 0 ? (
        <EmptyState
          title="Aucun article trouvé"
          description={nbTotal === 0
            ? "Commencez par ajouter le premier article à l'inventaire."
            : "Aucun article ne correspond aux filtres sélectionnés."}
          action={nbTotal === 0 && hasPermission('logistique', 'create')
            ? { label: 'Ajouter un article', onClick: openAdd }
            : undefined}
        />
      ) : (
        /* Affichage par catégorie */
        <div className="space-y-6">
          {Object.entries(parCategorie).map(([categorie, articlesCat]) => (
            <div key={categorie}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-gray-200" />
                {categorie} ({articlesCat.length})
                <span className="h-px flex-1 bg-gray-200" />
              </h3>
              <div className="card overflow-hidden p-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Désignation', 'État', 'N° Série', 'Prêt', 'Maintenance', 'Notes', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {articlesCat.map(item => {
                      const badge = etatBadge(item.etat)
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.designation}</td>
                          <td className="px-4 py-3">
                            <span className={`badge ${badge.color}`}>{badge.label}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                            {item.numero_serie || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {item.pret ? (
                              <span className="badge badge-blue">En prêt</span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.maintenance ? (
                              <span className="badge badge-yellow">En cours</span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                            {item.notes || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setViewing(item)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Voir"
                              >
                                <Eye size={16} />
                              </button>
                              {hasPermission('logistique', 'update') && (
                                <button
                                  onClick={() => openEdit(item)}
                                  className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                                  title="Modifier"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {hasPermission('logistique', 'delete') && (
                                <button
                                  onClick={() => setConfirmDelete(item)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Supprimer"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL Ajouter / Modifier
      ══════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Modifier l\'article' : 'Ajouter un article'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Catégorie <span className="text-red-500">*</span></label>
            <select
              className="input"
              value={form.categorie}
              onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
            >
              <option value="">-- Sélectionner une catégorie --</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Désignation <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input"
              value={form.designation}
              onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
              placeholder="Nom ou description de l'article"
            />
          </div>

          <div>
            <label className="label">État</label>
            <div className="grid grid-cols-2 gap-2">
              {ETATS.map(e => (
                <label
                  key={e.value}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    form.etat === e.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="etat"
                    value={e.value}
                    checked={form.etat === e.value}
                    onChange={() => setForm(f => ({ ...f, etat: e.value }))}
                    className="sr-only"
                  />
                  <span className={`badge ${e.color} text-xs`}>{e.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Numéro de série / Référence</label>
            <input
              type="text"
              className="input font-mono"
              value={form.numero_serie}
              onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))}
              placeholder="SN-XXXX ou référence interne"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.pret}
                onChange={e => setForm(f => ({ ...f, pret: e.target.checked }))}
                className="w-4 h-4 accent-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">En prêt</span>
                <p className="text-xs text-gray-400">Article actuellement prêté</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.maintenance}
                onChange={e => setForm(f => ({ ...f, maintenance: e.target.checked }))}
                className="w-4 h-4 accent-yellow-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">En maintenance</span>
                <p className="text-xs text-gray-400">En cours de réparation</p>
              </div>
            </label>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Informations complémentaires, localisation, responsable..."
            />
          </div>

          <p className="text-xs text-slate-400 mt-1"><span className="text-red-500">*</span> Champ obligatoire</p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn btn-secondary">Annuler</button>
            <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving && <Loader size={14} className="animate-spin" />}
              {editing ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Visualiser */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Détail article logistique"
      >
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="label">Catégorie</span>
                <p className="font-medium">{viewing.categorie}</p>
              </div>
              <div>
                <span className="label">Désignation</span>
                <p className="font-bold text-gray-900">{viewing.designation}</p>
              </div>
              <div>
                <span className="label">État</span>
                <p>
                  <span className={`badge ${etatBadge(viewing.etat).color}`}>
                    {etatBadge(viewing.etat).label}
                  </span>
                </p>
              </div>
              <div>
                <span className="label">N° Série / Réf.</span>
                <p className="font-mono">{viewing.numero_serie || '-'}</p>
              </div>
              <div>
                <span className="label">En prêt</span>
                <p>{viewing.pret ? '✅ Oui' : '❌ Non'}</p>
              </div>
              <div>
                <span className="label">En maintenance</span>
                <p>{viewing.maintenance ? '🔧 Oui' : '✅ Non'}</p>
              </div>
            </div>
            {viewing.notes && (
              <div>
                <span className="label">Notes</span>
                <p className="text-gray-600 mt-1 p-2 bg-gray-50 rounded">{viewing.notes}</p>
              </div>
            )}
            <div className="flex justify-between pt-2">
              {hasPermission('logistique', 'update') && (
                <button
                  onClick={() => { setViewing(null); openEdit(viewing) }}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Edit2 size={14} /> Modifier
                </button>
              )}
              <button onClick={() => setViewing(null)} className="btn btn-primary">Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteItem(confirmDelete)}
        title="Supprimer un article"
        message={confirmDelete ? `Supprimer "${confirmDelete.designation}" de l'inventaire ?` : ''}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
