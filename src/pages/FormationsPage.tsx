import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Eye, Edit2, Trash2, Download, FileText, BookOpen, Users } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel, exportPDF } from '../lib/export'

// Niveaux de classe
const TYPES_CLASSE = [
  { code: '001', label: '001 — Suis-Christ' },
  { code: '101', label: '101 — Fondations' },
  { code: '201', label: '201 — Maturité' },
  { code: '301', label: '301 — Ministère' },
]

// Génération du code classe : {TYPE}-{SLUGPROMO}-{ANNEE}
function genCode(type: string, promoNom: string, annee: number): string {
  const slug = promoNom.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return `${type}-${slug}-${annee}`
}

const emptyFormPromo = { nom: '', date_promotion: '' }
const emptyFormClasse = {
  classe: '001', promotion_id: '', enseignant: '', assistant: '',
  date_fin: '', annee: new Date().getFullYear(),
  description: ''
}

const COLS_EXPORT_CLASSES = [
  { header: 'Code', key: 'code' },
  { header: 'Niveau', key: 'classe' },
  { header: 'Promotion', key: 'promotions.nom' },
  { header: 'Enseignant', key: 'enseignant' },
  { header: 'Assistant', key: 'assistant' },
  { header: 'Date fin', key: 'date_fin' },
  { header: 'Année', key: 'annee' },
]

export default function FormationsPage() {
  const { hasPermission, user } = useAuth()
  const [onglet, setOnglet] = useState<'promotions' | 'classes'>('promotions')

  // Promotions
  const [promotions, setPromotions] = useState<any[]>([])
  const [loadingPromos, setLoadingPromos] = useState(true)
  const [addPromoModal, setAddPromoModal] = useState(false)
  const [editPromoModal, setEditPromoModal] = useState(false)
  const [viewPromoModal, setViewPromoModal] = useState(false)
  const [editPromo, setEditPromo] = useState<any | null>(null)
  const [viewPromo, setViewPromo] = useState<any | null>(null)
  const [deletePromoDialog, setDeletePromoDialog] = useState<any | null>(null)
  const [formPromo, setFormPromo] = useState({ ...emptyFormPromo })

  // Classes
  const [formations, setFormations] = useState<any[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [addClasseModal, setAddClasseModal] = useState(false)
  const [editClasseModal, setEditClasseModal] = useState(false)
  const [viewClasseModal, setViewClasseModal] = useState(false)
  const [apprenantModal, setApprenantModal] = useState(false)
  const [editClasse, setEditClasse] = useState<any | null>(null)
  const [viewClasse, setViewClasse] = useState<any | null>(null)
  const [gestionClasse, setGestionClasse] = useState<any | null>(null)
  const [deleteClasseDialog, setDeleteClasseDialog] = useState<any | null>(null)
  const [formClasse, setFormClasse] = useState({ ...emptyFormClasse })
  const [codePreview, setCodePreview] = useState('')

  // Apprenants
  const [personnesList, setPersonnesList] = useState<any[]>([])
  const [selectedApprenants, setSelectedApprenants] = useState<string[]>([])
  const [inscriptions, setInscriptions] = useState<any[]>([])

  const [saving, setSaving] = useState(false)

  const canCreate = hasPermission('formations', 'creer')
  const canEdit = hasPermission('formations', 'modifier')
  const canDelete = hasPermission('formations', 'supprimer')
  const canExport = hasPermission('formations', 'exporter')

  useEffect(() => { fetchPromotions(); fetchFormations(); fetchPersonnes() }, [])

  // Mise à jour code preview
  useEffect(() => {
    if (formClasse.promotion_id && formClasse.classe) {
      const promo = promotions.find(p => p.id === formClasse.promotion_id)
      if (promo) setCodePreview(genCode(formClasse.classe, promo.nom, formClasse.annee))
    } else setCodePreview('')
  }, [formClasse.classe, formClasse.promotion_id, formClasse.annee, promotions])

  const fetchPromotions = async () => {
    setLoadingPromos(true)
    const { data } = await supabase.from('promotions').select('*').eq('actif', true).order('date_promotion', { ascending: false })
    setPromotions(data || [])
    setLoadingPromos(false)
  }

  const fetchFormations = async () => {
    setLoadingClasses(true)
    const { data } = await supabase.from('formations').select(`
      *, promotions(*), inscriptions_formation(id, personne_id, statut, personnes(id, prenom, nom))
    `).eq('actif', true).order('annee', { ascending: false })
    setFormations(data || [])
    setLoadingClasses(false)
  }

  const fetchPersonnes = async () => {
    const { data } = await supabase.from('personnes').select('id, prenom, nom').eq('actif', true).order('nom')
    setPersonnesList(data || [])
  }

  // =========== PROMOTIONS ===========

  const openAddPromo = () => { setFormPromo({ ...emptyFormPromo }); setAddPromoModal(true) }

  const doAddPromo = async () => {
    if (!formPromo.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { data, error } = await supabase.from('promotions').insert({
      nom: formPromo.nom.trim(),
      date_promotion: formPromo.date_promotion || null
    }).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('formations', 'creer', data.id, `Promotion créée : ${data.nom}`)
    toast.success('Promotion créée')
    setAddPromoModal(false)
    fetchPromotions()
  }

  const openEditPromo = (p: any) => {
    setEditPromo(p)
    setFormPromo({ nom: p.nom, date_promotion: p.date_promotion || '' })
    setEditPromoModal(true)
  }

  const doEditPromo = async () => {
    if (!editPromo || !formPromo.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { error } = await supabase.from('promotions').update({
      nom: formPromo.nom.trim(),
      date_promotion: formPromo.date_promotion || null
    }).eq('id', editPromo.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('formations', 'modifier', editPromo.id, `Promotion modifiée : ${formPromo.nom}`)
    toast.success('Promotion mise à jour')
    setEditPromoModal(false)
    fetchPromotions()
  }

  const doDeletePromo = async () => {
    if (!deletePromoDialog) return
    const { error } = await supabase.from('promotions').update({ actif: false }).eq('id', deletePromoDialog.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Promotion désactivée')
    setDeletePromoDialog(null)
    fetchPromotions()
  }

  // =========== CLASSES ===========

  const openAddClasse = () => {
    setFormClasse({ ...emptyFormClasse })
    setEditClasse(null)
    setAddClasseModal(true)
  }

  const doAddClasse = async () => {
    if (!formClasse.promotion_id) { toast.error('Sélectionner une promotion'); return }
    // Règle métier : unicité type/promotion
    const existe = formations.find(f =>
      f.promotion_id === formClasse.promotion_id &&
      f.classe === formClasse.classe &&
      f.actif
    )
    if (existe) { toast.error(`Il existe déjà une classe ${formClasse.classe} pour cette promotion`); return }
    const promo = promotions.find(p => p.id === formClasse.promotion_id)
    const code = promo ? genCode(formClasse.classe, promo.nom, formClasse.annee) : null
    setSaving(true)
    const { data, error } = await supabase.from('formations').insert({
      classe: formClasse.classe,
      nom: promo?.nom || '',
      promotion_id: formClasse.promotion_id,
      code,
      enseignant: formClasse.enseignant || null,
      assistant: formClasse.assistant || null,
      date_fin: formClasse.date_fin || null,
      annee: formClasse.annee,
      description: formClasse.description || null,
    }).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('formations', 'creer', data.id, `Classe créée : ${code}`)
    toast.success('Classe créée')
    setAddClasseModal(false)
    fetchFormations()
  }

  const openEditClasse = (f: any) => {
    setEditClasse(f)
    setFormClasse({
      classe: f.classe,
      promotion_id: f.promotion_id || '',
      enseignant: f.enseignant || '',
      assistant: f.assistant || '',
      date_fin: f.date_fin || '',
      annee: f.annee,
      description: f.description || ''
    })
    setEditClasseModal(true)
  }

  const doEditClasse = async () => {
    if (!editClasse) return
    // Règle métier unicité (en excluant l'élément courant)
    const existe = formations.find(f =>
      f.promotion_id === formClasse.promotion_id &&
      f.classe === formClasse.classe &&
      f.actif &&
      f.id !== editClasse.id
    )
    if (existe) { toast.error(`Il existe déjà une classe ${formClasse.classe} pour cette promotion`); return }
    const promo = promotions.find(p => p.id === formClasse.promotion_id)
    const code = promo ? genCode(formClasse.classe, promo.nom, formClasse.annee) : editClasse.code
    setSaving(true)
    const { error } = await supabase.from('formations').update({
      classe: formClasse.classe,
      promotion_id: formClasse.promotion_id || null,
      code,
      enseignant: formClasse.enseignant || null,
      assistant: formClasse.assistant || null,
      date_fin: formClasse.date_fin || null,
      annee: formClasse.annee,
      description: formClasse.description || null,
    }).eq('id', editClasse.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('formations', 'modifier', editClasse.id, `Classe modifiée : ${code}`)
    toast.success('Classe mise à jour')
    setEditClasseModal(false)
    fetchFormations()
  }

  const doDeleteClasse = async () => {
    if (!deleteClasseDialog) return
    const { error } = await supabase.from('formations').update({ actif: false }).eq('id', deleteClasseDialog.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Classe désactivée')
    setDeleteClasseDialog(null)
    fetchFormations()
  }

  // =========== APPRENANTS ===========

  const openApprenants = async (f: any) => {
    setGestionClasse(f)
    const inscrits = (f.inscriptions_formation || []).map((i: any) => i.personne_id)
    setSelectedApprenants(inscrits)
    setApprenantModal(true)
  }

  const doSauvegarderApprenants = async () => {
    if (!gestionClasse) return
    setSaving(true)
    const inscritsActuels = (gestionClasse.inscriptions_formation || []).map((i: any) => i.personne_id)

    // Ajouter les nouveaux
    const aAjouter = selectedApprenants.filter(id => !inscritsActuels.includes(id))
    for (const pid of aAjouter) {
      await supabase.from('inscriptions_formation').upsert({
        formation_id: gestionClasse.id,
        personne_id: pid,
        statut: 'inscrit',
      }, { onConflict: 'formation_id,personne_id' })
    }

    // Désactiver (annuler) les retirés — on met statut 'abandonne'
    const aRetirer = inscritsActuels.filter((id: string) => !selectedApprenants.includes(id))
    for (const pid of aRetirer) {
      await supabase.from('inscriptions_formation')
        .update({ statut: 'abandonne' })
        .eq('formation_id', gestionClasse.id)
        .eq('personne_id', pid)
    }

    setSaving(false)
    toast.success('Apprenants mis à jour')
    setApprenantModal(false)
    fetchFormations()
  }

  const toggleApprenant = (id: string) => {
    setSelectedApprenants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Export
  const doExportExcel = () => {
    const data = formations.map(f => ({
      ...f,
      'promotions.nom': f.promotions?.nom || '—',
    }))
    exportExcel('Classes de Formation', COLS_EXPORT_CLASSES, data, 'Classes')
  }
  const doExportPDF = () => {
    const data = formations.map(f => ({
      ...f,
      'promotions.nom': f.promotions?.nom || '—',
    }))
    exportPDF('Classes de Formation', COLS_EXPORT_CLASSES, data, `${formations.length} classe(s)`)
  }

  // Formulaire Promotion
  const PromoForm = () => (
    <div className="space-y-4">
      <div>
        <label className="label">Nom de la promotion *</label>
        <input className="input" value={formPromo.nom} onChange={e => setFormPromo(f => ({ ...f, nom: e.target.value }))} placeholder="Ex : Suis-Christ 2025" />
      </div>
      <div>
        <label className="label">Date de la promotion</label>
        <input type="date" className="input" value={formPromo.date_promotion} onChange={e => setFormPromo(f => ({ ...f, date_promotion: e.target.value }))} />
      </div>
    </div>
  )

  // Formulaire Classe
  const ClasseForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Niveau / Type *</label>
          <select className="input" value={formClasse.classe} onChange={e => setFormClasse(f => ({ ...f, classe: e.target.value }))}>
            {TYPES_CLASSE.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Promotion *</label>
          <select className="input" value={formClasse.promotion_id} onChange={e => setFormClasse(f => ({ ...f, promotion_id: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {promotions.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Année</label>
          <input type="number" className="input" value={formClasse.annee} onChange={e => setFormClasse(f => ({ ...f, annee: Number(e.target.value) }))} min={2020} max={2030} />
        </div>
        <div>
          <label className="label">Code (auto-généré)</label>
          <input className="input bg-gray-50 font-mono text-xs" value={codePreview} readOnly placeholder="Sélectionner promotion + type" />
        </div>
        <div>
          <label className="label">Enseignant</label>
          <input className="input" value={formClasse.enseignant} onChange={e => setFormClasse(f => ({ ...f, enseignant: e.target.value }))} />
        </div>
        <div>
          <label className="label">Assistant</label>
          <input className="input" value={formClasse.assistant} onChange={e => setFormClasse(f => ({ ...f, assistant: e.target.value }))} />
        </div>
        <div>
          <label className="label">Date de fin</label>
          <input type="date" className="input" value={formClasse.date_fin} onChange={e => setFormClasse(f => ({ ...f, date_fin: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={2} value={formClasse.description} onChange={e => setFormClasse(f => ({ ...f, description: e.target.value }))} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-500 text-sm">Promotions et classes de formation</p>
        </div>
        {onglet === 'classes' && canExport && (
          <div className="flex gap-2">
            <button onClick={doExportPDF} className="btn btn-secondary flex items-center gap-1">
              <FileText size={16} /> PDF
            </button>
            <button onClick={doExportExcel} className="btn btn-secondary flex items-center gap-1">
              <Download size={16} /> Excel
            </button>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {(['promotions', 'classes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setOnglet(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                onglet === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'promotions' ? '📋 Promotions' : '🎓 Classes'}
              <span className="ml-2 text-xs bg-gray-100 rounded-full px-2 py-0.5">
                {tab === 'promotions' ? promotions.length : formations.length}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* ==================== ONGLET PROMOTIONS ==================== */}
      {onglet === 'promotions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canCreate && (
              <button onClick={openAddPromo} className="btn btn-primary flex items-center gap-2">
                <Plus size={18} /> Nouvelle promotion
              </button>
            )}
          </div>

          {loadingPromos ? (
            <div className="p-8 text-center text-gray-400">Chargement...</div>
          ) : promotions.length === 0 ? (
            <EmptyState message="Aucune promotion" />
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedPromos.map(p => {
                const nbClasses = formations.filter(f => f.promotion_id === p.id).length
                return (
                  <div key={p.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-900">{p.nom}</h3>
                      <span className="badge badge-blue text-xs">{nbClasses} classe{nbClasses > 1 ? 's' : ''}</span>
                    </div>
                    {p.date_promotion && (
                      <p className="text-sm text-gray-500 mb-3">
                        {format(new Date(p.date_promotion), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    )}
                    <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                      <button onClick={() => { setViewPromo(p); setViewPromoModal(true) }} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Visualiser">
                        <Eye size={15} />
                      </button>
                      {canEdit && (
                        <button onClick={() => openEditPromo(p)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                          <Edit2 size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletePromoDialog(p)} className="p-1.5 rounded hover:bg-red-50 text-red-500 ml-auto" title="Désactiver">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <Pagination total={promotions.length} page={pagePromos} pageSize={PAGE_SIZE} onPage={setPagePromos} />
            </>
          )}
        </div>
      )}

      {/* ==================== ONGLET CLASSES ==================== */}
      {onglet === 'classes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canCreate && (
              <button onClick={openAddClasse} className="btn btn-primary flex items-center gap-2">
                <Plus size={18} /> Nouvelle classe
              </button>
            )}
          </div>

          {loadingClasses ? (
            <div className="p-8 text-center text-gray-400">Chargement...</div>
          ) : formations.length === 0 ? (
            <EmptyState message="Aucune classe de formation" />
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Niveau</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Promotion</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Enseignant</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Apprenants</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date fin</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedClasses.map(f => {
                      const nbApp = (f.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length
                      return (
                        <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-blue-700 font-bold">{f.code || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="badge badge-gray">{f.classe}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{f.promotions?.nom || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{f.enseignant || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-green-700">
                              <Users size={13} /> {nbApp}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {f.date_fin ? format(new Date(f.date_fin), 'dd MMM yyyy', { locale: fr }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setViewClasse(f); setViewClasseModal(true) }} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Visualiser">
                                <Eye size={15} />
                              </button>
                              <button onClick={() => openApprenants(f)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Gérer apprenants">
                                <Users size={15} />
                              </button>
                              {canEdit && (
                                <button onClick={() => openEditClasse(f)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                                  <Edit2 size={15} />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => setDeleteClasseDialog(f)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Désactiver">
                                  <Trash2 size={15} />
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
              <Pagination total={formations.length} page={pageClasses} pageSize={PAGE_SIZE} onPage={setPageClasses} />
            </div>
          )}
        </div>
      )}

      {/* ===== MODALS PROMOTIONS ===== */}
      <Modal isOpen={addPromoModal} onClose={() => setAddPromoModal(false)} title="Nouvelle promotion" size="md">
        <PromoForm />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddPromoModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doAddPromo} disabled={saving} className="btn btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </Modal>

      <Modal isOpen={editPromoModal} onClose={() => setEditPromoModal(false)} title={`Modifier — ${editPromo?.nom}`} size="md">
        <PromoForm />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditPromoModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doEditPromo} disabled={saving} className="btn btn-primary">{saving ? 'Enregistrement...' : 'Mettre à jour'}</button>
        </div>
      </Modal>

      <Modal isOpen={viewPromoModal} onClose={() => setViewPromoModal(false)} title={`Promotion — ${viewPromo?.nom}`} size="md">
        {viewPromo && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">Nom</p><p className="font-medium">{viewPromo.nom}</p></div>
              <div><p className="text-xs text-gray-500">Date</p><p>{viewPromo.date_promotion ? format(new Date(viewPromo.date_promotion), 'dd MMMM yyyy', { locale: fr }) : '—'}</p></div>
              <div><p className="text-xs text-gray-500">Classes associées</p><p>{formations.filter(f => f.promotion_id === viewPromo.id).length}</p></div>
            </div>
            <div className="pt-2">
              <p className="text-xs text-gray-500 font-medium mb-1">Classes</p>
              {formations.filter(f => f.promotion_id === viewPromo.id).map(f => (
                <div key={f.id} className="text-sm py-1 border-b border-gray-50 flex gap-2">
                  <span className="font-mono text-blue-700 text-xs">{f.code}</span>
                  <span className="text-gray-600">{TYPES_CLASSE.find(t => t.code === f.classe)?.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setViewPromoModal(false)} className="btn btn-secondary">Fermer</button>
        </div>
      </Modal>

      {/* ===== MODALS CLASSES ===== */}
      <Modal isOpen={addClasseModal} onClose={() => setAddClasseModal(false)} title="Nouvelle classe" size="lg">
        <ClasseForm />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddClasseModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doAddClasse} disabled={saving} className="btn btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </Modal>

      <Modal isOpen={editClasseModal} onClose={() => setEditClasseModal(false)} title={`Modifier classe — ${editClasse?.code}`} size="lg">
        <ClasseForm />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditClasseModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doEditClasse} disabled={saving} className="btn btn-primary">{saving ? 'Enregistrement...' : 'Mettre à jour'}</button>
        </div>
      </Modal>

      <Modal isOpen={viewClasseModal} onClose={() => setViewClasseModal(false)} title={`Classe — ${viewClasse?.code}`} size="lg">
        {viewClasse && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Code', viewClasse.code || '—'],
                ['Niveau', TYPES_CLASSE.find(t => t.code === viewClasse.classe)?.label || viewClasse.classe],
                ['Promotion', viewClasse.promotions?.nom || '—'],
                ['Année', String(viewClasse.annee)],
                ['Enseignant', viewClasse.enseignant || '—'],
                ['Assistant', viewClasse.assistant || '—'],
                ['Date de fin', viewClasse.date_fin ? format(new Date(viewClasse.date_fin), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Nb apprenants', String((viewClasse.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length)],
              ].map(([l, v]) => (
                <div key={l}><p className="text-xs text-gray-500">{l}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            {viewClasse.description && <div><p className="text-xs text-gray-500">Description</p><p className="bg-gray-50 rounded p-2">{viewClasse.description}</p></div>}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Apprenants</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(viewClasse.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').map((i: any) => (
                  <div key={i.personne_id} className="flex gap-2 py-1 border-b border-gray-50 text-sm">
                    <span className="w-2 h-2 mt-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                    <span>{i.personnes?.prenom} {i.personnes?.nom}</span>
                    <span className="text-gray-400 text-xs">{i.statut}</span>
                  </div>
                ))}
                {(viewClasse.inscriptions_formation || []).filter((i: any) => i.statut !== 'abandonne').length === 0 && (
                  <p className="text-gray-400 text-xs">Aucun apprenant</p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setViewClasseModal(false)} className="btn btn-secondary">Fermer</button>
        </div>
      </Modal>

      {/* Modal Apprenants */}
      <Modal isOpen={apprenantModal} onClose={() => setApprenantModal(false)} title={`Apprenants — ${gestionClasse?.code}`} size="lg">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Cocher/décocher les personnes inscrites à cette classe.</p>
          <div className="max-h-80 overflow-y-auto space-y-1 border rounded-lg p-2">
            {personnesList.map((p: any) => (
              <label key={p.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedApprenants.includes(p.id)}
                  onChange={() => toggleApprenant(p.id)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm">{p.prenom} {p.nom}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">{selectedApprenants.length} apprenant{selectedApprenants.length > 1 ? 's' : ''} sélectionné{selectedApprenants.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <button onClick={() => setApprenantModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doSauvegarderApprenants} disabled={saving} className="btn btn-primary">
            {saving ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        </div>
      </Modal>

      {/* Confirms */}
      <ConfirmDialog isOpen={!!deletePromoDialog} onClose={() => setDeletePromoDialog(null)} onConfirm={doDeletePromo}
        title="Désactiver la promotion" message={`Désactiver "${deletePromoDialog?.nom}" ?`} confirmLabel="Désactiver" variant="danger" />
      <ConfirmDialog isOpen={!!deleteClasseDialog} onClose={() => setDeleteClasseDialog(null)} onConfirm={doDeleteClasse}
        title="Désactiver la classe" message={`Désactiver la classe "${deleteClasseDialog?.code}" ?`} confirmLabel="Désactiver" variant="danger" />
    </div>
  )
}
