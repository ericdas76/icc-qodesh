import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit2, Loader, Download, Star } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel } from '../lib/export'

const DEPARTEMENTS = [
  'Louange', 'Intercession', 'Évangélisation', 'Technique',
  'Accueil', 'Administration', 'Jeunesse', 'Enfants', 'Pastoral'
]

const emptyForm = {
  membre_id: '',
  departement: '',
  formation_001: false,
  date_service: '',
  notes: '',
}

const COLS_EXPORT = [
  { header: 'Nom', key: 'membres.personnes.nom' },
  { header: 'Prénom', key: 'membres.personnes.prenom' },
  { header: 'Département', key: 'departement' },
  { header: 'Formation 001', key: '_formation' },
  { header: 'Date service', key: 'date_service' },
]

export default function MembresStar() {
  const { user, hasPermission } = useAuth()
  const [stars, setStars] = useState<any[]>([])
  const [membresList, setMembresList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [desactiverDialog, setDesactiverDialog] = useState<any | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData(); fetchMembres() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('membres_star')
      .select('*, membres(id, personnes(prenom, nom, telephone))')
      .eq('actif', true)
      .order('created_at', { ascending: false })
    setStars(data || [])
    setLoading(false)
  }

  const fetchMembres = async () => {
    const { data } = await supabase
      .from('membres')
      .select('id, personnes(prenom, nom, telephone)')
      .eq('actif', true)
      .order('created_at')
    setMembresList(data || [])
  }

  const filtered = stars.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    const p = s.membres?.personnes || {}
    return (p.nom || '').toLowerCase().includes(q) ||
      (p.prenom || '').toLowerCase().includes(q) ||
      (s.departement || '').toLowerCase().includes(q)
  })

  // Membres déjà STAR (pour exclure de la liste déroulante en création)
  const dejaStarIds = stars.map(s => s.membre_id)

  const openCreate = () => {
    setEditItem(null)
    setForm({ ...emptyForm })
    setModal(true)
  }

  const openEdit = (s: any) => {
    setEditItem(s)
    setForm({
      membre_id: s.membre_id || '',
      departement: s.departement || '',
      formation_001: s.formation_001 || false,
      date_service: s.date_service || '',
      notes: s.notes || '',
    })
    setModal(true)
  }

  const save = async () => {
    if (!form.membre_id) { toast.error('Sélectionner un membre'); return }
    if (!form.formation_001) {
      toast.error('Impossible : ce membre n\'a pas suivi la formation 001')
      return
    }
    setSaving(true)
    const payload = {
      membre_id: form.membre_id,
      departement: form.departement || null,
      formation_001: form.formation_001,
      date_service: form.date_service || null,
      notes: form.notes || null,
    }
    if (editItem) {
      const { error } = await supabase.from('membres_star').update(payload).eq('id', editItem.id)
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      await logEvent('membres_star', 'modifier', editItem.id, 'STAR modifié')
      toast.success('STAR mis à jour')
    } else {
      const { error } = await supabase.from('membres_star').insert(payload)
      if (error) {
        if (error.code === '23505') toast.error('Ce membre est déjà enregistré comme STAR')
        else toast.error('Erreur : ' + error.message)
        setSaving(false); return
      }
      await logEvent('membres_star', 'creer', '', 'Nouveau STAR ajouté')
      toast.success('STAR ajouté')
    }
    setSaving(false)
    setModal(false)
    fetchData()
  }

  const doDesactiver = async () => {
    if (!desactiverDialog) return
    await supabase.from('membres_star').update({ actif: false }).eq('id', desactiverDialog.id)
    toast.success('STAR retiré')
    setDesactiverDialog(null)
    fetchData()
  }

  const dataExport = filtered.map(s => ({
    ...s,
    'membres.personnes.nom': s.membres?.personnes?.nom || '',
    'membres.personnes.prenom': s.membres?.personnes?.prenom || '',
    _formation: s.formation_001 ? 'Oui' : 'Non',
  }))

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Star size={22} className="text-amber-500" /> Membres STAR
          </h1>
          <p className="text-slate-500 text-sm">{filtered.length} STAR{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportExcel('Membres STAR', COLS_EXPORT, dataExport, 'STAR')} className="btn-secondary flex items-center gap-1">
            <Download size={16} /> Excel
          </button>
          {hasPermission('membres', 'creer') && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Recherche */}
      <div className="card p-3">
        <input className="input" placeholder="Rechercher par nom, prénom, département..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="Aucun membre STAR enregistré" />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {['Nom complet', 'Téléphone', 'Département', 'Formation 001', 'Date service', 'Notes', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {s.membres?.personnes?.prenom} {s.membres?.personnes?.nom}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.membres?.personnes?.telephone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.departement || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${s.formation_001 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {s.formation_001 ? '✓ Oui' : '✗ Non'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {s.date_service ? format(new Date(s.date_service), 'd MMM yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-32 truncate">{s.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {hasPermission('membres', 'modifier') && (
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {hasPermission('membres', 'supprimer') && (
                          <button onClick={() => setDesactiverDialog(s)} className="p-1.5 rounded hover:bg-red-50 text-red-500 text-xs px-2">
                            Retirer
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

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Modifier STAR' : 'Nouveau membre STAR'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Membre *</label>
            {editItem ? (
              <p className="input bg-slate-50 text-slate-700">
                {editItem.membres?.personnes?.prenom} {editItem.membres?.personnes?.nom}
                <span className="text-xs text-slate-400 ml-2">(non modifiable)</span>
              </p>
            ) : (
              <select className="input" value={form.membre_id} onChange={e => setForm(f => ({ ...f, membre_id: e.target.value }))}>
                <option value="">-- Sélectionner un membre --</option>
                {membresList
                  .filter((m: any) => !dejaStarIds.includes(m.id))
                  .map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.personnes?.prenom} {m.personnes?.nom}
                      {m.personnes?.telephone ? ` — ${m.personnes.telephone}` : ''}
                    </option>
                  ))
                }
              </select>
            )}
          </div>

          <div>
            <label className="label">Département</label>
            <select className="input" value={form.departement} onChange={e => setForm(f => ({ ...f, departement: e.target.value }))}>
              <option value="">-- Sélectionner --</option>
              {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Date de service</label>
            <input type="date" className="input" value={form.date_service} onChange={e => setForm(f => ({ ...f, date_service: e.target.value }))} />
          </div>

          {/* Formation 001 — RÈGLE BLOQUANTE */}
          <div className={`rounded-lg p-4 border-2 ${form.formation_001 ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.formation_001}
                onChange={e => setForm(f => ({ ...f, formation_001: e.target.checked }))}
                className="w-5 h-5 rounded border-gray-300 text-green-600"
              />
              <div>
                <p className="font-semibold text-slate-800">A suivi la formation 001</p>
                <p className="text-xs text-slate-500">Condition obligatoire pour être STAR</p>
              </div>
            </label>
            {!form.formation_001 && (
              <p className="mt-2 text-xs text-orange-700 font-medium">
                ⚠️ Sans formation 001, l'ajout sera bloqué
              </p>
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
          <p className="text-xs text-slate-400 mt-1"><span className="text-red-500">*</span> Champ obligatoire</p>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving && <Loader size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!desactiverDialog}
        onClose={() => setDesactiverDialog(null)}
        onConfirm={doDesactiver}
        title="Retirer le membre STAR"
        message={`Retirer ${desactiverDialog?.membres?.personnes?.prenom} ${desactiverDialog?.membres?.personnes?.nom} des STAR ?`}
        confirmLabel="Retirer"
        variant="danger"
      />
    </div>
  )
}
