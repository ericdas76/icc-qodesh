import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit2, Loader, Download, Eye } from 'lucide-react'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'
import { exportExcel } from '../lib/export'

type Onglet = 'sessions' | 'inscrits'

// Officiants fréquents (complétés par saisie libre)
const OFFICIANTS_SUGGERES = [
  'Pasteur Principal', 'Pasteur Adjoint', 'Ancien', 'Diacre'
]

const emptySession = { nom_session: '', date_session: '', notes: '' }

const emptyInscrit = {
  session_id: '', nom: '', prenom: '',
  date_naissance: '', date_arrivee_icc: '', date_conversion: '',
  date_cours: '', temoignage: false, detail_temoignage: '',
  date_bapteme: '', officiant: '', notes: '',
}

const COLS_EXPORT_INSCRITS = [
  { header: 'Session', key: '_session_nom' },
  { header: 'Nom', key: 'nom' },
  { header: 'Prénom', key: 'prenom' },
  { header: 'Date naissance', key: 'date_naissance' },
  { header: 'Arrivée ICC', key: 'date_arrivee_icc' },
  { header: 'Conversion', key: 'date_conversion' },
  { header: 'Cours', key: 'date_cours' },
  { header: 'Témoignage', key: '_temoignage' },
  { header: 'Date baptême', key: 'date_bapteme' },
  { header: 'Officiant', key: 'officiant' },
]

export default function BaptemesSessions() {
  const { user, hasPermission } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('sessions')

  // Sessions
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionModal, setSessionModal] = useState(false)
  const [editSession, setEditSession] = useState<any | null>(null)
  const [formSession, setFormSession] = useState({ ...emptySession })
  const [deleteSessionDialog, setDeleteSessionDialog] = useState<any | null>(null)

  // Inscrits
  const [inscrits, setInscrits] = useState<any[]>([])
  const [loadingInscrits, setLoadingInscrits] = useState(true)
  const [inscritModal, setInscritModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [editInscrit, setEditInscrit] = useState<any | null>(null)
  const [viewInscrit, setViewInscrit] = useState<any | null>(null)
  const [formInscrit, setFormInscrit] = useState({ ...emptyInscrit })
  const [filterSession, setFilterSession] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSessions(); fetchInscrits() }, [])
  useEffect(() => { fetchInscrits() }, [filterSession])

  const fetchSessions = async () => {
    setLoadingSessions(true)
    const { data } = await supabase.from('sessions_bapteme').select('*').eq('actif', true).order('date_session', { ascending: false })
    setSessions(data || [])
    setLoadingSessions(false)
  }

  const fetchInscrits = async () => {
    setLoadingInscrits(true)
    let q = supabase.from('inscrits_bapteme').select('*, sessions_bapteme(nom_session, date_session)').eq('actif', true).order('created_at', { ascending: false })
    if (filterSession) q = q.eq('session_id', filterSession)
    const { data } = await q
    setInscrits(data || [])
    setLoadingInscrits(false)
  }

  // ===== SESSIONS =====
  const openAddSession = () => { setEditSession(null); setFormSession({ ...emptySession }); setSessionModal(true) }
  const openEditSession = (s: any) => {
    setEditSession(s)
    setFormSession({ nom_session: s.nom_session, date_session: s.date_session || '', notes: s.notes || '' })
    setSessionModal(true)
  }

  const saveSession = async () => {
    if (!formSession.nom_session.trim() || !formSession.date_session) { toast.error('Nom et date requis'); return }
    setSaving(true)
    const payload = { nom_session: formSession.nom_session.trim(), date_session: formSession.date_session, notes: formSession.notes || null }
    if (editSession) {
      const { error } = await supabase.from('sessions_bapteme').update(payload).eq('id', editSession.id)
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      toast.success('Session mise à jour')
    } else {
      const { error } = await supabase.from('sessions_bapteme').insert(payload)
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      toast.success('Session créée')
    }
    setSaving(false); setSessionModal(false); fetchSessions()
  }

  const deleteSession = async () => {
    if (!deleteSessionDialog) return
    await supabase.from('sessions_bapteme').update({ actif: false }).eq('id', deleteSessionDialog.id)
    toast.success('Session désactivée')
    setDeleteSessionDialog(null); fetchSessions()
  }

  // ===== INSCRITS =====
  const openAddInscrit = () => {
    setEditInscrit(null)
    setFormInscrit({ ...emptyInscrit, session_id: filterSession || '' })
    setInscritModal(true)
  }

  const openEditInscrit = (i: any) => {
    setEditInscrit(i)
    setFormInscrit({
      session_id: i.session_id || '',
      nom: i.nom || '', prenom: i.prenom || '',
      date_naissance: i.date_naissance || '',
      date_arrivee_icc: i.date_arrivee_icc || '',
      date_conversion: i.date_conversion || '',
      date_cours: i.date_cours || '',
      temoignage: i.temoignage || false,
      detail_temoignage: i.detail_temoignage || '',
      date_bapteme: i.date_bapteme || '',
      officiant: i.officiant || '',
      notes: i.notes || '',
    })
    setInscritModal(true)
  }

  const saveInscrit = async () => {
    if (!formInscrit.nom.trim() || !formInscrit.prenom.trim()) { toast.error('Nom et prénom requis'); return }
    if (!formInscrit.session_id) { toast.error('Sélectionner une session'); return }
    setSaving(true)
    const payload = {
      session_id: formInscrit.session_id,
      nom: formInscrit.nom.trim(),
      prenom: formInscrit.prenom.trim(),
      date_naissance: formInscrit.date_naissance || null,
      date_arrivee_icc: formInscrit.date_arrivee_icc || null,
      date_conversion: formInscrit.date_conversion || null,
      date_cours: formInscrit.date_cours || null,
      temoignage: formInscrit.temoignage,
      detail_temoignage: formInscrit.detail_temoignage || null,
      date_bapteme: formInscrit.date_bapteme || null,
      officiant: formInscrit.officiant || null,
      notes: formInscrit.notes || null,
    }
    if (editInscrit) {
      const { error } = await supabase.from('inscrits_bapteme').update(payload).eq('id', editInscrit.id)
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      toast.success('Inscrit mis à jour')
    } else {
      const { error } = await supabase.from('inscrits_bapteme').insert(payload)
      if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
      toast.success('Inscrit ajouté')
    }
    setSaving(false); setInscritModal(false); fetchInscrits()
  }

  const dataExport = inscrits.map(i => ({
    ...i,
    _session_nom: i.sessions_bapteme?.nom_session || '—',
    _temoignage: i.temoignage ? 'Oui' : 'Non',
  }))

  // Formulaire inscrit
  const InscritForm = () => (
    <div className="space-y-4">
      <div>
        <label className="label">Session *</label>
        <select className="input" value={formInscrit.session_id} onChange={e => setFormInscrit(f => ({ ...f, session_id: e.target.value }))}>
          <option value="">-- Sélectionner une session --</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.nom_session} — {s.date_session ? format(new Date(s.date_session), 'dd MMM yyyy', { locale: fr }) : ''}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nom *</label>
          <input className="input" value={formInscrit.nom} onChange={e => setFormInscrit(f => ({ ...f, nom: e.target.value }))} />
        </div>
        <div>
          <label className="label">Prénom *</label>
          <input className="input" value={formInscrit.prenom} onChange={e => setFormInscrit(f => ({ ...f, prenom: e.target.value }))} />
        </div>
        <div>
          <label className="label">Date de naissance</label>
          <input type="date" className="input" value={formInscrit.date_naissance} onChange={e => setFormInscrit(f => ({ ...f, date_naissance: e.target.value }))} />
        </div>
        <div>
          <label className="label">Arrivée à ICC</label>
          <input type="date" className="input" value={formInscrit.date_arrivee_icc} onChange={e => setFormInscrit(f => ({ ...f, date_arrivee_icc: e.target.value }))} />
        </div>
        <div>
          <label className="label">Date conversion</label>
          <input type="date" className="input" value={formInscrit.date_conversion} onChange={e => setFormInscrit(f => ({ ...f, date_conversion: e.target.value }))} />
        </div>
        <div>
          <label className="label">Date cours baptême</label>
          <input type="date" className="input" value={formInscrit.date_cours} onChange={e => setFormInscrit(f => ({ ...f, date_cours: e.target.value }))} />
        </div>
        <div>
          <label className="label">Date baptême</label>
          <input type="date" className="input" value={formInscrit.date_bapteme} onChange={e => setFormInscrit(f => ({ ...f, date_bapteme: e.target.value }))} />
        </div>
        <div>
          <label className="label">Officiant</label>
          <input
            className="input" list="officiants-list"
            value={formInscrit.officiant}
            onChange={e => setFormInscrit(f => ({ ...f, officiant: e.target.value }))}
            placeholder="Saisir ou choisir..."
          />
          <datalist id="officiants-list">
            {OFFICIANTS_SUGGERES.map(o => <option key={o} value={o} />)}
          </datalist>
        </div>
      </div>
      <div className={`rounded-lg p-3 border ${formInscrit.temoignage ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={formInscrit.temoignage} onChange={e => setFormInscrit(f => ({ ...f, temoignage: e.target.checked }))} className="w-4 h-4" />
          <span className="font-medium text-slate-800 text-sm">Témoignage effectué</span>
        </label>
        {formInscrit.temoignage && (
          <div className="mt-2">
            <label className="label text-xs">Détail du témoignage</label>
            <textarea className="input resize-none text-sm" rows={2} value={formInscrit.detail_temoignage} onChange={e => setFormInscrit(f => ({ ...f, detail_temoignage: e.target.value }))} />
          </div>
        )}
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={formInscrit.notes} onChange={e => setFormInscrit(f => ({ ...f, notes: e.target.value }))} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Baptêmes</h1>
      </div>

      {/* Onglets */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {[{ id: 'sessions', label: '📋 Sessions', count: sessions.length }, { id: 'inscrits', label: '👤 Inscrits', count: inscrits.length }].map(t => (
            <button key={t.id} onClick={() => setOnglet(t.id as Onglet)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${onglet === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label} <span className="ml-1 text-xs bg-slate-100 rounded-full px-1.5">{t.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ===== SESSIONS ===== */}
      {onglet === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {hasPermission('baptemes', 'creer') && (
              <button onClick={openAddSession} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nouvelle session</button>
            )}
          </div>
          {loadingSessions ? (
            <div className="flex justify-center h-32 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
          ) : sessions.length === 0 ? <EmptyState message="Aucune session de baptême" /> : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {['Nom session', 'Date', 'Inscrits', 'Notes', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.map(s => {
                    const nb = inscrits.filter(i => i.session_id === s.id).length
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{s.nom_session}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.date_session ? format(new Date(s.date_session), 'd MMMM yyyy', { locale: fr }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge bg-blue-100 text-blue-700">{nb} inscrit{nb > 1 ? 's' : ''}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-48 truncate">{s.notes || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setFilterSession(s.id); setOnglet('inscrits') }} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                              Voir inscrits
                            </button>
                            {hasPermission('baptemes', 'modifier') && (
                              <button onClick={() => openEditSession(s)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600"><Edit2 size={14} /></button>
                            )}
                            {hasPermission('baptemes', 'supprimer') && (
                              <button onClick={() => setDeleteSessionDialog(s)} className="p-1.5 rounded hover:bg-red-50 text-red-500 text-xs px-2">Désact.</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== INSCRITS ===== */}
      {onglet === 'inscrits' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select className="input w-auto" value={filterSession} onChange={e => setFilterSession(e.target.value)}>
              <option value="">Toutes les sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.nom_session}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => exportExcel('Inscrits Baptême', COLS_EXPORT_INSCRITS, dataExport, 'Baptemes')} className="btn-secondary flex items-center gap-1 text-sm">
                <Download size={14} /> Excel
              </button>
              {hasPermission('baptemes', 'creer') && (
                <button onClick={openAddInscrit} className="btn-primary flex items-center gap-2"><Plus size={18} /> Ajouter inscrit</button>
              )}
            </div>
          </div>

          {loadingInscrits ? (
            <div className="flex justify-center h-32 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>
          ) : inscrits.length === 0 ? <EmptyState message="Aucun inscrit" /> : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {['Nom complet', 'Session', 'Naissance', 'Cours', 'Témoignage', 'Baptême', 'Officiant', ''].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inscrits.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{i.prenom} {i.nom}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{i.sessions_bapteme?.nom_session || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          {i.date_naissance ? format(new Date(i.date_naissance), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          {i.date_cours ? format(new Date(i.date_cours), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`badge ${i.temoignage ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {i.temoignage ? '✓ Oui' : 'Non'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          {i.date_bapteme ? format(new Date(i.date_bapteme), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{i.officiant || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => { setViewInscrit(i); setViewModal(true) }} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Eye size={14} /></button>
                            {hasPermission('baptemes', 'modifier') && (
                              <button onClick={() => openEditInscrit(i)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600"><Edit2 size={14} /></button>
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
        </div>
      )}

      {/* Modal Session */}
      <Modal open={sessionModal} onClose={() => setSessionModal(false)} title={editSession ? 'Modifier session' : 'Nouvelle session de baptême'} size="md">
        <div className="space-y-3">
          <div>
            <label className="label">Nom de la session *</label>
            <input className="input" value={formSession.nom_session} onChange={e => setFormSession(f => ({ ...f, nom_session: e.target.value }))} placeholder="Ex : Baptême Décembre 2025" />
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={formSession.date_session} onChange={e => setFormSession(f => ({ ...f, date_session: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={formSession.notes} onChange={e => setFormSession(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button onClick={() => setSessionModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={saveSession} disabled={saving} className="btn-primary">
            {saving && <Loader size={14} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </Modal>

      {/* Modal Inscrit Ajouter/Modifier */}
      <Modal open={inscritModal} onClose={() => setInscritModal(false)} title={editInscrit ? `Modifier — ${editInscrit.prenom} ${editInscrit.nom}` : 'Nouvel inscrit'} size="xl">
        <InscritForm />
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button onClick={() => setInscritModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={saveInscrit} disabled={saving} className="btn-primary">
            {saving && <Loader size={14} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </Modal>

      {/* Modal Visualiser Inscrit */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title={`Fiche — ${viewInscrit?.prenom} ${viewInscrit?.nom}`} size="md">
        {viewInscrit && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Session', viewInscrit.sessions_bapteme?.nom_session || '—'],
                ['Nom complet', `${viewInscrit.prenom} ${viewInscrit.nom}`],
                ['Date naissance', viewInscrit.date_naissance ? format(new Date(viewInscrit.date_naissance), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Arrivée ICC', viewInscrit.date_arrivee_icc ? format(new Date(viewInscrit.date_arrivee_icc), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Conversion', viewInscrit.date_conversion ? format(new Date(viewInscrit.date_conversion), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Cours baptême', viewInscrit.date_cours ? format(new Date(viewInscrit.date_cours), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Témoignage', viewInscrit.temoignage ? '✓ Oui' : 'Non'],
                ['Date baptême', viewInscrit.date_bapteme ? format(new Date(viewInscrit.date_bapteme), 'dd MMMM yyyy', { locale: fr }) : '—'],
                ['Officiant', viewInscrit.officiant || '—'],
              ].map(([l, v]) => (
                <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            {viewInscrit.temoignage && viewInscrit.detail_temoignage && (
              <div><p className="text-xs text-slate-500">Détail témoignage</p><p className="bg-green-50 p-2 rounded text-sm">{viewInscrit.detail_temoignage}</p></div>
            )}
            {viewInscrit.notes && <div><p className="text-xs text-slate-500">Notes</p><p className="bg-slate-50 p-2 rounded text-sm">{viewInscrit.notes}</p></div>}
          </div>
        )}
        <div className="flex justify-end mt-4"><button onClick={() => setViewModal(false)} className="btn-secondary">Fermer</button></div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteSessionDialog} onClose={() => setDeleteSessionDialog(null)} onConfirm={deleteSession}
        title="Désactiver la session" message={`Désactiver "${deleteSessionDialog?.nom_session}" ?`} confirmLabel="Désactiver" variant="danger" />
    </div>
  )
}
