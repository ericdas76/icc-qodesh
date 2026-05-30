import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Eye, Edit2, Trash2, Download, FileText, Users, UserPlus, UserMinus } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel, exportPDF } from '../lib/export'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const emptyForm = {
  nom: '', quartier: '', adresse_maison_hote: '',
  responsable_id: '', copilote_id: '',
  jour_reunion: '', heure_reunion: '',
  date_creation: format(new Date(), 'yyyy-MM-dd'),
  notes: ''
}

const COLS_EXPORT = [
  { header: 'Nom FI', key: 'nom' },
  { header: 'Quartier', key: 'quartier' },
  { header: 'Responsable', key: 'responsable.prenom' },
  { header: 'Copilote', key: 'copilote.prenom' },
  { header: 'Nb membres', key: '_nbMembres' },
  { header: 'Jour réunion', key: 'jour_reunion' },
  { header: 'Heure réunion', key: 'heure_reunion' },
]

export default function FamillesImpactPage() {
  const { hasPermission, user } = useAuth()
  const [familles, setFamilles] = useState<any[]>([])
  const [personnesList, setPersonnesList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [membresModal, setMembresModal] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [gestionFI, setGestionFI] = useState<any | null>(null)
  const [desactiverDialog, setDesactiverDialog] = useState<any | null>(null)
  const [retirerDialog, setRetirerDialog] = useState<any | null>(null) // { fi, personne_id }

  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [ajoutPersonneId, setAjoutPersonneId] = useState('')

  const canCreate = hasPermission('familles_impact', 'creer')
  const canEdit = hasPermission('familles_impact', 'modifier')
  const canDelete = hasPermission('familles_impact', 'supprimer')
  const canExport = hasPermission('familles_impact', 'exporter')

  useEffect(() => {
    fetchFamilles()
    fetchPersonnes()
  }, [])

  const fetchFamilles = async () => {
    setLoading(true)
    const { data } = await supabase.from('familles_impact').select(`
      *,
      responsable:responsable_id(id, prenom, nom),
      copilote:copilote_id(id, prenom, nom),
      membres_familles_impact(id, personne_id, actif, date_ajout, personnes(id, prenom, nom, telephone))
    `).eq('actif', true).order('nom')
    setFamilles(data || [])
    setLoading(false)
  }

  const fetchPersonnes = async () => {
    const { data } = await supabase.from('personnes').select('id, prenom, nom, telephone').eq('actif', true).order('nom')
    setPersonnesList(data || [])
  }

  const getNbMembres = (fi: any) =>
    (fi.membres_familles_impact || []).filter((m: any) => m.actif).length

  const filtered = familles.filter(fi => {
    const s = search.toLowerCase()
    return !search ||
      fi.nom.toLowerCase().includes(s) ||
      (fi.quartier || '').toLowerCase().includes(s) ||
      (fi.responsable?.nom || '').toLowerCase().includes(s)
  })

  // Données enrichies pour export
  const filteredForExport = filtered.map(fi => ({
    ...fi,
    'responsable.prenom': fi.responsable ? `${fi.responsable.prenom} ${fi.responsable.nom}` : '—',
    'copilote.prenom': fi.copilote ? `${fi.copilote.prenom} ${fi.copilote.nom}` : '—',
    _nbMembres: getNbMembres(fi),
  }))

  // --- Ajouter ---
  const openAdd = () => { setForm({ ...emptyForm }); setAddModal(true) }

  const doAdd = async () => {
    if (!form.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { data, error } = await supabase.from('familles_impact').insert({
      nom: form.nom.trim(),
      quartier: form.quartier || null,
      adresse_maison_hote: form.adresse_maison_hote || null,
      responsable_id: form.responsable_id || null,
      copilote_id: form.copilote_id || null,
      jour_reunion: form.jour_reunion || null,
      heure_reunion: form.heure_reunion || null,
      date_creation: form.date_creation || null,
      notes: form.notes || null,
    }).select().single()
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('familles_impact', 'creer', data.id, `Création FI ${data.nom}`)
    toast.success('Famille d\'Impact créée')
    setAddModal(false)
    fetchFamilles()
  }

  // --- Modifier ---
  const openEdit = (fi: any) => {
    setEditItem(fi)
    setForm({
      nom: fi.nom, quartier: fi.quartier || '',
      adresse_maison_hote: fi.adresse_maison_hote || '',
      responsable_id: fi.responsable_id || '',
      copilote_id: fi.copilote_id || '',
      jour_reunion: fi.jour_reunion || '',
      heure_reunion: fi.heure_reunion || '',
      date_creation: fi.date_creation || '',
      notes: fi.notes || ''
    })
    setEditModal(true)
  }

  const doEdit = async () => {
    if (!editItem || !form.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    const { error } = await supabase.from('familles_impact').update({
      nom: form.nom.trim(),
      quartier: form.quartier || null,
      adresse_maison_hote: form.adresse_maison_hote || null,
      responsable_id: form.responsable_id || null,
      copilote_id: form.copilote_id || null,
      jour_reunion: form.jour_reunion || null,
      heure_reunion: form.heure_reunion || null,
      date_creation: form.date_creation || null,
      notes: form.notes || null,
    }).eq('id', editItem.id)
    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }
    await logEvent('familles_impact', 'modifier', editItem.id, `Modification FI ${form.nom}`)
    toast.success('Famille d\'Impact mise à jour')
    setEditModal(false)
    fetchFamilles()
  }

  // --- Visualiser ---
  const openView = (fi: any) => { setViewItem(fi); setViewModal(true) }

  // --- Désactiver ---
  const doDesactiver = async () => {
    if (!desactiverDialog) return
    const { error } = await supabase.from('familles_impact').update({ actif: false }).eq('id', desactiverDialog.id)
    if (error) { toast.error('Erreur'); return }
    await logEvent('familles_impact', 'supprimer', desactiverDialog.id, `Désactivation FI ${desactiverDialog.nom}`)
    toast.success('Famille d\'Impact désactivée')
    setDesactiverDialog(null)
    fetchFamilles()
  }

  // --- Gestion membres FI ---
  const openMembres = (fi: any) => { setGestionFI(fi); setAjoutPersonneId(''); setMembresModal(true) }

  const doAjouterMembre = async () => {
    if (!ajoutPersonneId || !gestionFI) { toast.error('Sélectionner une personne'); return }
    const { error } = await supabase.from('membres_familles_impact').upsert({
      famille_id: gestionFI.id,
      personne_id: ajoutPersonneId,
      actif: true,
      date_ajout: format(new Date(), 'yyyy-MM-dd'),
    }, { onConflict: 'famille_id,personne_id' })
    if (error) { toast.error('Erreur : ' + error.message); return }
    toast.success('Membre ajouté')
    setAjoutPersonneId('')
    fetchFamilles()
    // Refresh gestionFI
    const { data } = await supabase.from('familles_impact').select(`
      *, responsable:responsable_id(id, prenom, nom), copilote:copilote_id(id, prenom, nom),
      membres_familles_impact(id, personne_id, actif, date_ajout, personnes(id, prenom, nom, telephone))
    `).eq('id', gestionFI.id).single()
    if (data) setGestionFI(data)
  }

  const doRetirerMembre = async () => {
    if (!retirerDialog) return
    const { error } = await supabase.from('membres_familles_impact')
      .update({ actif: false })
      .eq('famille_id', retirerDialog.fi.id)
      .eq('personne_id', retirerDialog.personne_id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Membre retiré')
    setRetirerDialog(null)
    fetchFamilles()
    // Refresh gestionFI
    const { data } = await supabase.from('familles_impact').select(`
      *, responsable:responsable_id(id, prenom, nom), copilote:copilote_id(id, prenom, nom),
      membres_familles_impact(id, personne_id, actif, date_ajout, personnes(id, prenom, nom, telephone))
    `).eq('id', gestionFI.id).single()
    if (data) setGestionFI(data)
  }

  // --- Export ---
  const doExportExcel = () => exportExcel('Familles d\'Impact', COLS_EXPORT, filteredForExport, 'FamillesImpact')
  const doExportPDF = () => exportPDF('Familles d\'Impact', COLS_EXPORT, filteredForExport, `${filtered.length} famille(s)`)

  // --- Formulaire partagé ---
  const FIForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Nom de la FI *</label>
          <input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex : FI Espoir" />
        </div>
        <div>
          <label className="label">Quartier</label>
          <input className="input" value={form.quartier} onChange={e => setForm(f => ({ ...f, quartier: e.target.value }))} />
        </div>
        <div>
          <label className="label">Adresse maison hôte</label>
          <input className="input" value={form.adresse_maison_hote} onChange={e => setForm(f => ({ ...f, adresse_maison_hote: e.target.value }))} />
        </div>
        <div>
          <label className="label">Responsable</label>
          <select className="input" value={form.responsable_id} onChange={e => setForm(f => ({ ...f, responsable_id: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {personnesList.map((p: any) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Copilote</label>
          <select className="input" value={form.copilote_id} onChange={e => setForm(f => ({ ...f, copilote_id: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {personnesList.map((p: any) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Jour de réunion</label>
          <select className="input" value={form.jour_reunion} onChange={e => setForm(f => ({ ...f, jour_reunion: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Heure de réunion</label>
          <input type="time" className="input" value={form.heure_reunion} onChange={e => setForm(f => ({ ...f, heure_reunion: e.target.value }))} />
        </div>
        <div>
          <label className="label">Date de création</label>
          <input type="date" className="input" value={form.date_creation} onChange={e => setForm(f => ({ ...f, date_creation: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Familles d'Impact</h1>
          <p className="text-gray-500 text-sm">{filtered.length} famille{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canExport && (
            <>
              <button onClick={doExportPDF} className="btn btn-secondary flex items-center gap-1">
                <FileText size={16} /> PDF
              </button>
              <button onClick={doExportExcel} className="btn btn-secondary flex items-center gap-1">
                <Download size={16} /> Excel
              </button>
            </>
          )}
          {canCreate && (
            <button onClick={openAdd} className="btn btn-primary flex items-center gap-2">
              <Plus size={18} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Filtre */}
      <div className="card">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Nom, quartier, responsable..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Grille cartes */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState message="Aucune famille d'impact trouvée" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(fi => {
            const nb = getNbMembres(fi)
            return (
              <div key={fi.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{fi.nom}</h3>
                    {fi.quartier && <p className="text-sm text-gray-500">{fi.quartier}</p>}
                  </div>
                  <span className="badge badge-blue flex items-center gap-1">
                    <Users size={12} /> {nb} membre{nb > 1 ? 's' : ''}
                  </span>
                </div>
                {fi.responsable && (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Responsable :</span> {fi.responsable.prenom} {fi.responsable.nom}
                  </p>
                )}
                {fi.jour_reunion && (
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Réunion :</span> {fi.jour_reunion} {fi.heure_reunion ? `à ${fi.heure_reunion}` : ''}
                  </p>
                )}
                <div className="flex items-center gap-1 pt-3 border-t border-gray-100">
                  <button onClick={() => openView(fi)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Visualiser">
                    <Eye size={15} />
                  </button>
                  {canEdit && (
                    <button onClick={() => openEdit(fi)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                      <Edit2 size={15} />
                    </button>
                  )}
                  <button onClick={() => openMembres(fi)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Gérer les membres">
                    <UserPlus size={15} />
                  </button>
                  {canDelete && (
                    <button onClick={() => setDesactiverDialog(fi)} className="p-1.5 rounded hover:bg-red-50 text-red-500 ml-auto" title="Désactiver">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Ajouter */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Nouvelle Famille d'Impact" size="xl">
        <FIForm />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setAddModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doAdd} disabled={saving} className="btn btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* Modal Modifier */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={`Modifier — ${editItem?.nom}`} size="xl">
        <FIForm />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setEditModal(false)} className="btn btn-secondary">Annuler</button>
          <button onClick={doEdit} disabled={saving} className="btn btn-primary">
            {saving ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>
      </Modal>

      {/* Modal Visualiser */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title={`Détail — ${viewItem?.nom}`} size="lg">
        {viewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Nom', viewItem.nom],
                ['Quartier', viewItem.quartier || '—'],
                ['Adresse hôte', viewItem.adresse_maison_hote || '—'],
                ['Responsable', viewItem.responsable ? `${viewItem.responsable.prenom} ${viewItem.responsable.nom}` : '—'],
                ['Copilote', viewItem.copilote ? `${viewItem.copilote.prenom} ${viewItem.copilote.nom}` : '—'],
                ['Jour réunion', viewItem.jour_reunion || '—'],
                ['Heure réunion', viewItem.heure_reunion || '—'],
                ['Date création', viewItem.date_creation ? format(new Date(viewItem.date_creation), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Nb membres actifs', String(getNbMembres(viewItem))],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-gray-900">{val}</p>
                </div>
              ))}
            </div>
            {/* Liste membres */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Membres actifs</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(viewItem.membres_familles_impact || []).filter((m: any) => m.actif).length === 0
                  ? <p className="text-sm text-gray-400">Aucun membre</p>
                  : (viewItem.membres_familles_impact || []).filter((m: any) => m.actif).map((m: any) => (
                    <div key={m.personne_id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50">
                      <span className="w-2 h-2 bg-green-400 rounded-full" />
                      <span>{m.personnes?.prenom} {m.personnes?.nom}</span>
                      <span className="text-gray-400 text-xs">{m.personnes?.telephone || ''}</span>
                    </div>
                  ))}
              </div>
            </div>
            {viewItem.notes && (
              <div>
                <p className="text-xs text-gray-500 font-medium">Notes</p>
                <p className="text-gray-700 bg-gray-50 p-2 rounded text-sm">{viewItem.notes}</p>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setViewModal(false)} className="btn btn-secondary">Fermer</button>
        </div>
      </Modal>

      {/* Modal Gestion membres */}
      <Modal isOpen={membresModal} onClose={() => setMembresModal(false)} title={`Membres — ${gestionFI?.nom}`} size="lg">
        {gestionFI && (
          <div className="space-y-4">
            {/* Ajouter un membre */}
            <div className="flex gap-2">
              <select className="input flex-1" value={ajoutPersonneId} onChange={e => setAjoutPersonneId(e.target.value)}>
                <option value="">-- Sélectionner une personne à ajouter --</option>
                {personnesList
                  .filter((p: any) => !(gestionFI.membres_familles_impact || []).some((m: any) => m.personne_id === p.id && m.actif))
                  .map((p: any) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.telephone ? ` — ${p.telephone}` : ''}</option>)
                }
              </select>
              <button onClick={doAjouterMembre} className="btn btn-primary flex items-center gap-1">
                <UserPlus size={16} /> Ajouter
              </button>
            </div>

            {/* Liste membres actuels */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Membres actifs ({(gestionFI.membres_familles_impact || []).filter((m: any) => m.actif).length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(gestionFI.membres_familles_impact || []).filter((m: any) => m.actif).length === 0
                  ? <p className="text-sm text-gray-400 text-center py-4">Aucun membre</p>
                  : (gestionFI.membres_familles_impact || []).filter((m: any) => m.actif).map((m: any) => (
                    <div key={m.personne_id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                      <div>
                        <span className="font-medium text-sm">{m.personnes?.prenom} {m.personnes?.nom}</span>
                        {m.personnes?.telephone && <span className="text-gray-400 text-xs ml-2">{m.personnes.telephone}</span>}
                        {m.date_ajout && <span className="text-gray-400 text-xs ml-2">depuis {format(new Date(m.date_ajout), 'dd MMM yyyy', { locale: fr })}</span>}
                      </div>
                      <button
                        onClick={() => setRetirerDialog({ fi: gestionFI, personne_id: m.personne_id })}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="Retirer"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setMembresModal(false)} className="btn btn-secondary">Fermer</button>
        </div>
      </Modal>

      {/* Confirm désactiver FI */}
      <ConfirmDialog
        isOpen={!!desactiverDialog}
        onClose={() => setDesactiverDialog(null)}
        onConfirm={doDesactiver}
        title="Désactiver la Famille d'Impact"
        message={`Désactiver "${desactiverDialog?.nom}" ?`}
        confirmLabel="Désactiver"
        variant="danger"
      />

      {/* Confirm retirer membre */}
      <ConfirmDialog
        isOpen={!!retirerDialog}
        onClose={() => setRetirerDialog(null)}
        onConfirm={doRetirerMembre}
        title="Retirer le membre"
        message="Retirer ce membre de la Famille d'Impact ?"
        confirmLabel="Retirer"
        variant="danger"
      />
    </div>
  )
}
