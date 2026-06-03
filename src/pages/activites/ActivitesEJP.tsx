import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit, Trash2, Loader, Eye, FileSpreadsheet, Users, Calendar, X, Check } from 'lucide-react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import toast from 'react-hot-toast'
import { logEvent } from '../../lib/journal'
import { exportExcel } from '../../lib/export'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

function calcAge(dateNaissance: string | null): number | null {
  if (!dateNaissance) return null
  const today = new Date()
  const birth = new Date(dateNaissance)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function calcDuree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return '—'
  const [hd, md] = debut.split(':').map(Number)
  const [hf, mf] = fin.split(':').map(Number)
  const totalMin = (hf * 60 + mf) - (hd * 60 + md)
  if (totalMin <= 0) return '—'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

// ─── Onglet Membres EJP ───────────────────────────────────────────────────────

const EMPTY_MEMBRE = {
  nom: '', prenom: '', date_naissance: '', lieu_naissance: '', sexe: '',
  nationalite: '', langue_parlee: '', telephone1: '', whatsapp: '', email: '',
  origine: '', source_contact: '', de_passage: false,
  departement_ejp_id: '', bapteme: false, date_bapteme: '',
  formation_pcnc_id: '', note: ''
}

const COLS_MEMBRES = [
  { header: 'Code', key: 'code_membre_ejp', width: 16 },
  { header: 'Nom', key: 'nom', width: 20 },
  { header: 'Prénom', key: 'prenom', width: 20 },
  { header: 'Sexe', key: 'sexe', width: 10 },
  { header: 'Date Naissance', key: 'date_naissance', width: 16 },
  { header: 'Âge', key: '_age', width: 8 },
  { header: 'Lieu Naissance', key: 'lieu_naissance', width: 20 },
  { header: 'Nationalité', key: 'nationalite', width: 16 },
  { header: 'Langue', key: 'langue_parlee', width: 14 },
  { header: 'Téléphone', key: 'telephone1', width: 16 },
  { header: 'WhatsApp', key: 'whatsapp', width: 16 },
  { header: 'Email', key: 'email', width: 24 },
  { header: 'Origine', key: 'origine', width: 18 },
  { header: 'Source contact', key: 'source_contact', width: 18 },
  { header: 'De passage', key: 'de_passage', width: 12 },
  { header: 'Département EJP', key: '_dept_nom', width: 18 },
  { header: 'Baptême', key: 'bapteme', width: 10 },
  { header: 'Date Baptême', key: 'date_bapteme', width: 14 },
  { header: 'Formation PCNC', key: '_pcnc_code', width: 14 },
  { header: 'Note', key: 'note', width: 30 },
]

function MembresEJPTab() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewItem, setViewItem] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_MEMBRE)
  const [saving, setSaving] = useState(false)
  const [confirmDesactiver, setConfirmDesactiver] = useState<any>(null)
  const [page, setPage] = useState(1)

  // Listes paramétrables
  const [departements, setDepartements] = useState<any[]>([])
  const [formationsPCNC, setFormationsPCNC] = useState<any[]>([])
  const [langues, setLangues] = useState<string[]>([])
  const [sourcesContact, setSourcesContact] = useState<string[]>([])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: membres },
      { data: depts },
      { data: pcnc },
      { data: lng },
      { data: src }
    ] = await Promise.all([
      supabase.from('ejp_membres').select('*, ejp_departements(nom), ejp_formations_pcnc(code, libelle)').order('nom'),
      supabase.from('ejp_departements').select('*').eq('actif', true).order('nom'),
      supabase.from('ejp_formations_pcnc').select('*').eq('actif', true).order('code'),
      supabase.from('listes_parametrables').select('valeur').eq('categorie', 'langue').eq('actif', true).order('ordre'),
      supabase.from('listes_parametrables').select('valeur').eq('categorie', 'source_contact').eq('actif', true).order('ordre'),
    ])
    setItems(membres || [])
    setDepartements(depts || [])
    setFormationsPCNC(pcnc || [])
    setLangues((lng || []).map((l: any) => l.valeur))
    setSourcesContact((src || []).map((s: any) => s.valeur))
    setLoading(false)
  }

  // Génération code EJP-YYYY-NNN
  const genCode = async (): Promise<string> => {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('ejp_membres')
      .select('code_membre_ejp')
      .like('code_membre_ejp', `EJP-${year}-%`)
      .order('code_membre_ejp', { ascending: false })
      .limit(1)
    let next = 1
    if (data && data.length > 0) {
      const last = data[0].code_membre_ejp
      const num = parseInt(last.split('-')[2], 10)
      if (!isNaN(num)) next = num + 1
    }
    return `EJP-${year}-${String(next).padStart(3, '0')}`
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ ...EMPTY_MEMBRE })
    setModal(true)
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setForm({
      nom: item.nom || '', prenom: item.prenom || '',
      date_naissance: item.date_naissance || '', lieu_naissance: item.lieu_naissance || '',
      sexe: item.sexe || '', nationalite: item.nationalite || '',
      langue_parlee: item.langue_parlee || '', telephone1: item.telephone1 || '',
      whatsapp: item.whatsapp || '', email: item.email || '',
      origine: item.origine || '', source_contact: item.source_contact || '',
      de_passage: item.de_passage || false,
      departement_ejp_id: item.departement_ejp_id || '',
      bapteme: item.bapteme || false, date_bapteme: item.date_bapteme || '',
      formation_pcnc_id: item.formation_pcnc_id || '', note: item.note || ''
    })
    setModal(true)
  }

  const save = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) return toast.error('Nom et prénom obligatoires')
    setSaving(true)
    try {
      const payload: any = {
        nom: form.nom.trim().toUpperCase(),
        prenom: form.prenom.trim(),
        date_naissance: form.date_naissance || null,
        lieu_naissance: form.lieu_naissance || null,
        sexe: form.sexe || null,
        nationalite: form.nationalite || null,
        langue_parlee: form.langue_parlee || null,
        telephone1: form.telephone1 || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        origine: form.origine || null,
        source_contact: form.source_contact || null,
        de_passage: form.de_passage,
        departement_ejp_id: form.departement_ejp_id || null,
        bapteme: form.bapteme,
        date_bapteme: form.bapteme ? (form.date_bapteme || null) : null,
        formation_pcnc_id: form.formation_pcnc_id || null,
        note: form.note || null,
        updated_at: new Date().toISOString()
      }

      if (editItem) {
        const { error } = await supabase.from('ejp_membres').update(payload).eq('id', editItem.id)
        if (error) throw error
        await logEvent('ejp_membres', 'modification', `Membre EJP modifié : ${payload.prenom} ${payload.nom}`)
        toast.success('Membre modifié')
      } else {
        payload.code_membre_ejp = await genCode()
        const { error } = await supabase.from('ejp_membres').insert(payload)
        if (error) throw error
        await logEvent('ejp_membres', 'ajout', `Nouveau membre EJP : ${payload.prenom} ${payload.nom} — ${payload.code_membre_ejp}`)
        toast.success(`Membre ajouté — ${payload.code_membre_ejp}`)
      }
      setModal(false)
      fetchAll()
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActif = async (item: any) => {
    const { error } = await supabase.from('ejp_membres').update({ actif: !item.actif }).eq('id', item.id)
    if (error) { toast.error('Erreur'); return }
    toast.success(item.actif ? 'Membre désactivé' : 'Membre réactivé')
    setConfirmDesactiver(null)
    fetchAll()
  }

  const doExport = () => {
    const data = paginated.map((m, i) => ({
      ...m,
      _age: calcAge(m.date_naissance) ?? '',
      _dept_nom: m.ejp_departements?.nom || '',
      _pcnc_code: m.ejp_formations_pcnc?.code || '',
      date_naissance: fmtDate(m.date_naissance),
    }))
    exportExcel('EJP - Membres', COLS_MEMBRES, data as any)
  }

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [items, page])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.filter(m => m.actif).length} membre(s) actif(s)</p>
        <div className="flex gap-2">
          <button onClick={doExport} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>

      {/* Tableau */}
      {items.length === 0 ? (
        <EmptyState icon={Users} title="Aucun membre EJP" description="Cliquez sur Ajouter pour enregistrer le premier membre." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  {['Code', 'Nom & Prénom', 'Sexe', 'Âge', 'Téléphone', 'Département', 'Baptême', 'Formation PCNC', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map(m => (
                  <tr key={m.id} className={`hover:bg-slate-50 ${!m.actif ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs text-purple-700">{m.code_membre_ejp}</td>
                    <td className="px-4 py-2 font-medium">{m.prenom} {m.nom}</td>
                    <td className="px-4 py-2 text-slate-500">{m.sexe || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{calcAge(m.date_naissance) ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{m.telephone1 || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{m.ejp_departements?.nom || '—'}</td>
                    <td className="px-4 py-2">
                      {m.bapteme ? <span className="badge bg-green-100 text-green-700">Oui</span> : <span className="text-slate-400 text-xs">Non</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{m.ejp_formations_pcnc?.code || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`badge ${m.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setViewItem(m); setViewModal(true) }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-purple-600" title="Voir">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Modifier">
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => m.actif ? setConfirmDesactiver(m) : toggleActif(m)}
                          className={`p-1.5 rounded text-slate-400 ${m.actif ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-green-50 hover:text-green-600'}`}
                          title={m.actif ? 'Désactiver' : 'Réactiver'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={items.length} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {/* Modal Vue */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title={`Fiche — ${viewItem?.prenom} ${viewItem?.nom}`} size="lg">
        {viewItem && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-400 text-xs">Code</span><p className="font-mono text-purple-700">{viewItem.code_membre_ejp}</p></div>
              <div><span className="text-slate-400 text-xs">Statut</span><p>{viewItem.actif ? 'Actif' : 'Inactif'}</p></div>
              <div><span className="text-slate-400 text-xs">Nom</span><p className="font-medium">{viewItem.nom}</p></div>
              <div><span className="text-slate-400 text-xs">Prénom</span><p>{viewItem.prenom}</p></div>
              <div><span className="text-slate-400 text-xs">Date naissance</span><p>{fmtDate(viewItem.date_naissance)}</p></div>
              <div><span className="text-slate-400 text-xs">Âge</span><p>{calcAge(viewItem.date_naissance) ?? '—'} ans</p></div>
              <div><span className="text-slate-400 text-xs">Lieu naissance</span><p>{viewItem.lieu_naissance || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Sexe</span><p>{viewItem.sexe || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Nationalité</span><p>{viewItem.nationalite || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Langue</span><p>{viewItem.langue_parlee || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Téléphone</span><p>{viewItem.telephone1 || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">WhatsApp</span><p>{viewItem.whatsapp || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Email</span><p>{viewItem.email || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Origine</span><p>{viewItem.origine || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Source contact</span><p>{viewItem.source_contact || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">De passage</span><p>{viewItem.de_passage ? 'Oui' : 'Non'}</p></div>
              <div><span className="text-slate-400 text-xs">Département EJP</span><p>{viewItem.ejp_departements?.nom || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Baptême</span><p>{viewItem.bapteme ? 'Oui' : 'Non'}</p></div>
              {viewItem.bapteme && <div><span className="text-slate-400 text-xs">Date baptême</span><p>{viewItem.date_bapteme || '—'}</p></div>}
              <div><span className="text-slate-400 text-xs">Formation PCNC</span><p>{viewItem.ejp_formations_pcnc?.code || '—'}</p></div>
            </div>
            {viewItem.note && <div><span className="text-slate-400 text-xs">Note</span><p className="mt-1 text-slate-700">{viewItem.note}</p></div>}
          </div>
        )}
      </Modal>

      {/* Modal Formulaire */}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? `Modifier — ${editItem.prenom} ${editItem.nom}` : 'Nouveau membre EJP'} size="xl">
        <div className="space-y-5">
          {/* Identité */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identité</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Nom *</label><input className="input uppercase" value={form.nom} onChange={e => setForm((f: any) => ({ ...f, nom: e.target.value }))} /></div>
              <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e => setForm((f: any) => ({ ...f, prenom: e.target.value }))} /></div>
              <div>
                <label className="label">Sexe</label>
                <select className="input" value={form.sexe} onChange={e => setForm((f: any) => ({ ...f, sexe: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
              </div>
              <div>
                <label className="label">Date de naissance</label>
                <input type="date" className="input" value={form.date_naissance} onChange={e => setForm((f: any) => ({ ...f, date_naissance: e.target.value }))} />
                {form.date_naissance && <p className="text-xs text-slate-400 mt-1">Âge : {calcAge(form.date_naissance)} ans</p>}
              </div>
              <div><label className="label">Lieu de naissance</label><input className="input" value={form.lieu_naissance} onChange={e => setForm((f: any) => ({ ...f, lieu_naissance: e.target.value }))} /></div>
              <div><label className="label">Nationalité</label><input className="input" value={form.nationalite} onChange={e => setForm((f: any) => ({ ...f, nationalite: e.target.value }))} /></div>
              <div>
                <label className="label">Langue parlée</label>
                <select className="input" value={form.langue_parlee} onChange={e => setForm((f: any) => ({ ...f, langue_parlee: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {langues.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Téléphone</label><input className="input" value={form.telephone1} onChange={e => setForm((f: any) => ({ ...f, telephone1: e.target.value }))} /></div>
              <div><label className="label">WhatsApp</label><input className="input" value={form.whatsapp} onChange={e => setForm((f: any) => ({ ...f, whatsapp: e.target.value }))} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
            </div>
          </div>

          {/* Suivi pastoral */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Suivi pastoral</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Origine</label>
                <select className="input" value={form.origine} onChange={e => setForm((f: any) => ({ ...f, origine: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  <option value="Nouvel arrivant">Nouvel arrivant</option>
                  <option value="Nouveau converti">Nouveau converti</option>
                </select>
              </div>
              <div>
                <label className="label">Source contact</label>
                <select className="input" value={form.source_contact} onChange={e => setForm((f: any) => ({ ...f, source_contact: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {sourcesContact.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">De passage</label>
                <select className="input" value={form.de_passage ? 'oui' : 'non'} onChange={e => setForm((f: any) => ({ ...f, de_passage: e.target.value === 'oui' }))}>
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </div>
              <div>
                <label className="label">Département EJP</label>
                <select className="input" value={form.departement_ejp_id} onChange={e => setForm((f: any) => ({ ...f, departement_ejp_id: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Baptême & Formation */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Baptême & Formation</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Baptême</label>
                <select className="input" value={form.bapteme ? 'oui' : 'non'} onChange={e => setForm((f: any) => ({ ...f, bapteme: e.target.value === 'oui' }))}>
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </div>
              {form.bapteme && (
                <div>
                  <label className="label">Date ou année de baptême</label>
                  <input className="input" placeholder="Ex: 2023 ou 15/06/2023" value={form.date_bapteme} onChange={e => setForm((f: any) => ({ ...f, date_bapteme: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="label">Formation PCNC</label>
                <select className="input" value={form.formation_pcnc_id} onChange={e => setForm((f: any) => ({ ...f, formation_pcnc_id: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {formationsPCNC.map(f => <option key={f.id} value={f.id}>{f.code}{f.libelle ? ` — ${f.libelle}` : ''}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="label">Note</label>
            <textarea className="input" rows={3} value={form.note} onChange={e => setForm((f: any) => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader size={14} className="animate-spin" /> Enregistrement...</> : <><Check size={14} /> Enregistrer</>}
          </button>
        </div>
      </Modal>

      {/* Confirm désactivation */}
      <ConfirmDialog
        open={!!confirmDesactiver}
        onClose={() => setConfirmDesactiver(null)}
        onConfirm={() => confirmDesactiver && toggleActif(confirmDesactiver)}
        title="Désactiver le membre ?"
        message={`Voulez-vous désactiver ${confirmDesactiver?.prenom} ${confirmDesactiver?.nom} ?`}
        confirmLabel="Désactiver"
        danger={true}
      />
    </div>
  )
}

// ─── Onglet Activités EJP ─────────────────────────────────────────────────────

const EMPTY_ACTIVITE = {
  date_activite: '', heure_debut: '', heure_fin: '',
  type_rencontre_id: '', theme: '', predicateur: '', moderateur: '',
  hommes: 0, femmes: 0, visiteurs: 0, comptage: 0,
  priere_salut: false, sainte_cene: false, notes: '',
  membres_ids: [] as string[]
}

const COLS_ACTIVITES = [
  { header: 'Code', key: 'code_activite', width: 16 },
  { header: 'Date', key: '_date_fmt', width: 14 },
  { header: 'Type', key: '_type_nom', width: 16 },
  { header: 'Thème', key: 'theme', width: 24 },
  { header: 'Prédicateur', key: 'predicateur', width: 20 },
  { header: 'Modérateur', key: 'moderateur', width: 20 },
  { header: 'Heure début', key: 'heure_debut', width: 12 },
  { header: 'Heure fin', key: 'heure_fin', width: 12 },
  { header: 'Durée', key: '_duree', width: 10 },
  { header: 'Hommes', key: 'hommes', width: 10 },
  { header: 'Femmes', key: 'femmes', width: 10 },
  { header: 'Total', key: 'total_participants', width: 10 },
  { header: 'Visiteurs', key: 'visiteurs', width: 10 },
  { header: 'Comptage', key: 'comptage', width: 10 },
  { header: 'Prière salut', key: 'priere_salut', width: 12 },
  { header: 'Sainte-Cène', key: 'sainte_cene', width: 12 },
  { header: 'Notes', key: 'notes', width: 30 },
]

function ActivitesEJPTab() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewItem, setViewItem] = useState<any>(null)
  const [viewParticipants, setViewParticipants] = useState<any[]>([])
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_ACTIVITE)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [page, setPage] = useState(1)

  const [typesRencontre, setTypesRencontre] = useState<any[]>([])
  const [membresList, setMembresList] = useState<any[]>([])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: activites },
      { data: types },
      { data: membres }
    ] = await Promise.all([
      supabase.from('ejp_activites').select('*, ejp_types_rencontre(nom)').order('date_activite', { ascending: false }),
      supabase.from('ejp_types_rencontre').select('*').eq('actif', true).order('nom'),
      supabase.from('ejp_membres').select('id, nom, prenom, code_membre_ejp').eq('actif', true).order('nom'),
    ])
    setItems(activites || [])
    setTypesRencontre(types || [])
    setMembresList(membres || [])
    setLoading(false)
  }

  const genCode = async (): Promise<string> => {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('ejp_activites')
      .select('code_activite')
      .like('code_activite', `EJP-${year}-%`)
      .order('code_activite', { ascending: false })
      .limit(1)
    let next = 1
    if (data && data.length > 0) {
      const last = data[0].code_activite
      const num = parseInt(last.split('-')[2], 10)
      if (!isNaN(num)) next = num + 1
    }
    return `EJP-${year}-${String(next).padStart(3, '0')}`
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ ...EMPTY_ACTIVITE, membres_ids: [] })
    setModal(true)
  }

  const openEdit = async (item: any) => {
    setEditItem(item)
    // Charger les participants
    const { data: parts } = await supabase
      .from('ejp_activite_membres')
      .select('membre_id')
      .eq('activite_id', item.id)
    const ids = (parts || []).map((p: any) => p.membre_id)
    setForm({
      date_activite: item.date_activite || '',
      heure_debut: item.heure_debut || '',
      heure_fin: item.heure_fin || '',
      type_rencontre_id: item.type_rencontre_id || '',
      theme: item.theme || '',
      predicateur: item.predicateur || '',
      moderateur: item.moderateur || '',
      hommes: item.hommes || 0,
      femmes: item.femmes || 0,
      visiteurs: item.visiteurs || 0,
      comptage: item.comptage || 0,
      priere_salut: item.priere_salut || false,
      sainte_cene: item.sainte_cene || false,
      notes: item.notes || '',
      membres_ids: ids
    })
    setModal(true)
  }

  const openView = async (item: any) => {
    setViewItem(item)
    const { data: parts } = await supabase
      .from('ejp_activite_membres')
      .select('*, ejp_membres(nom, prenom, code_membre_ejp)')
      .eq('activite_id', item.id)
    setViewParticipants(parts || [])
    setViewModal(true)
  }

  const toggleMembre = (id: string) => {
    setForm((f: any) => ({
      ...f,
      membres_ids: f.membres_ids.includes(id)
        ? f.membres_ids.filter((x: string) => x !== id)
        : [...f.membres_ids, id]
    }))
  }

  const total = (form.hommes || 0) + (form.femmes || 0)
  const duree = calcDuree(form.heure_debut, form.heure_fin)

  const save = async () => {
    if (!form.date_activite) return toast.error('Date obligatoire')
    setSaving(true)
    try {
      const payload: any = {
        date_activite: form.date_activite,
        heure_debut: form.heure_debut || null,
        heure_fin: form.heure_fin || null,
        duree: calcDuree(form.heure_debut, form.heure_fin),
        type_rencontre_id: form.type_rencontre_id || null,
        theme: form.theme || null,
        predicateur: form.predicateur || null,
        moderateur: form.moderateur || null,
        hommes: form.hommes || 0,
        femmes: form.femmes || 0,
        total_participants: (form.hommes || 0) + (form.femmes || 0),
        visiteurs: form.visiteurs || 0,
        comptage: form.comptage || 0,
        priere_salut: form.priere_salut,
        sainte_cene: form.sainte_cene,
        notes: form.notes || null,
        updated_at: new Date().toISOString()
      }

      let activiteId = editItem?.id
      if (editItem) {
        const { error } = await supabase.from('ejp_activites').update(payload).eq('id', editItem.id)
        if (error) throw error
        await logEvent('ejp_activites', 'modification', `Activité EJP modifiée : ${payload.code_activite || editItem.code_activite}`)
      } else {
        payload.code_activite = await genCode()
        const { data, error } = await supabase.from('ejp_activites').insert(payload).select().single()
        if (error) throw error
        activiteId = data.id
        await logEvent('ejp_activites', 'ajout', `Nouvelle activité EJP : ${payload.code_activite}`)
        toast.success(`Activité ajoutée — ${payload.code_activite}`)
      }

      // Mettre à jour les participants
      await supabase.from('ejp_activite_membres').delete().eq('activite_id', activiteId)
      if (form.membres_ids.length > 0) {
        await supabase.from('ejp_activite_membres').insert(
          form.membres_ids.map((mid: string) => ({ activite_id: activiteId, membre_id: mid }))
        )
      }

      if (editItem) toast.success('Activité modifiée')
      setModal(false)
      fetchAll()
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async (item: any) => {
    const { error } = await supabase.from('ejp_activites').delete().eq('id', item.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Activité supprimée')
    setConfirmDelete(null)
    fetchAll()
  }

  const doExport = () => {
    const data = paginated.map(a => ({
      ...a,
      _date_fmt: fmtDate(a.date_activite),
      _type_nom: a.ejp_types_rencontre?.nom || '',
      _duree: calcDuree(a.heure_debut, a.heure_fin),
    }))
    exportExcel('EJP - Activités', COLS_ACTIVITES, data as any)
  }

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [items, page])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} activité(s)</p>
        <div className="flex gap-2">
          <button onClick={doExport} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Calendar} title="Aucune activité EJP" description="Cliquez sur Ajouter pour enregistrer la première activité." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  {['Code', 'Date', 'Type', 'Thème', 'Prédicateur', 'H', 'F', 'Total', 'Durée', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-purple-700">{a.code_activite}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fmtDate(a.date_activite)}</td>
                    <td className="px-4 py-2 text-slate-500">{a.ejp_types_rencontre?.nom || '—'}</td>
                    <td className="px-4 py-2 text-slate-700 max-w-[180px] truncate">{a.theme || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{a.predicateur || '—'}</td>
                    <td className="px-4 py-2 text-center">{a.hommes}</td>
                    <td className="px-4 py-2 text-center">{a.femmes}</td>
                    <td className="px-4 py-2 text-center font-semibold">{a.total_participants}</td>
                    <td className="px-4 py-2 text-slate-500">{calcDuree(a.heure_debut, a.heure_fin)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openView(a)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-purple-600" title="Voir"><Eye size={14} /></button>
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Modifier"><Edit size={14} /></button>
                        <button onClick={() => setConfirmDelete(a)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Supprimer"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={items.length} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}

      {/* Modal Vue activité */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title={`Activité — ${viewItem?.code_activite}`} size="lg">
        {viewItem && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-400 text-xs">Code</span><p className="font-mono text-purple-700">{viewItem.code_activite}</p></div>
              <div><span className="text-slate-400 text-xs">Date</span><p>{fmtDate(viewItem.date_activite)}</p></div>
              <div><span className="text-slate-400 text-xs">Type rencontre</span><p>{viewItem.ejp_types_rencontre?.nom || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Durée</span><p>{calcDuree(viewItem.heure_debut, viewItem.heure_fin)}</p></div>
              <div><span className="text-slate-400 text-xs">Heure début</span><p>{viewItem.heure_debut || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Heure fin</span><p>{viewItem.heure_fin || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Thème</span><p>{viewItem.theme || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Prédicateur</span><p>{viewItem.predicateur || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Modérateur</span><p>{viewItem.moderateur || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">Hommes</span><p>{viewItem.hommes}</p></div>
              <div><span className="text-slate-400 text-xs">Femmes</span><p>{viewItem.femmes}</p></div>
              <div><span className="text-slate-400 text-xs">Total participants</span><p className="font-semibold">{viewItem.total_participants}</p></div>
              <div><span className="text-slate-400 text-xs">Visiteurs</span><p>{viewItem.visiteurs}</p></div>
              <div><span className="text-slate-400 text-xs">Comptage</span><p>{viewItem.comptage}</p></div>
              <div><span className="text-slate-400 text-xs">Prière du salut</span><p>{viewItem.priere_salut ? 'Oui' : 'Non'}</p></div>
              <div><span className="text-slate-400 text-xs">Sainte-Cène</span><p>{viewItem.sainte_cene ? 'Oui' : 'Non'}</p></div>
            </div>
            {viewItem.notes && <div><span className="text-slate-400 text-xs">Notes</span><p className="mt-1 text-slate-700">{viewItem.notes}</p></div>}
            {viewParticipants.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Membres participants ({viewParticipants.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewParticipants.map((p: any) => (
                    <span key={p.id} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                      {p.ejp_membres?.prenom} {p.ejp_membres?.nom}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Formulaire activité */}
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? `Modifier activité — ${editItem.code_activite}` : 'Nouvelle activité EJP'} size="xl">
        <div className="space-y-5">
          {/* Informations générales */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Informations générales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Date *</label><input type="date" className="input" value={form.date_activite} onChange={e => setForm((f: any) => ({ ...f, date_activite: e.target.value }))} /></div>
              <div>
                <label className="label">Type de rencontre</label>
                <select className="input" value={form.type_rencontre_id} onChange={e => setForm((f: any) => ({ ...f, type_rencontre_id: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {typesRencontre.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Heure début</label>
                <input type="time" className="input" value={form.heure_debut} onChange={e => setForm((f: any) => ({ ...f, heure_debut: e.target.value }))} />
              </div>
              <div>
                <label className="label">Heure fin</label>
                <input type="time" className="input" value={form.heure_fin} onChange={e => setForm((f: any) => ({ ...f, heure_fin: e.target.value }))} />
                {duree !== '—' && <p className="text-xs text-slate-400 mt-1">Durée : {duree}</p>}
              </div>
              <div className="md:col-span-2"><label className="label">Thème</label><input className="input" value={form.theme} onChange={e => setForm((f: any) => ({ ...f, theme: e.target.value }))} /></div>
              <div><label className="label">Prédicateur</label><input className="input" value={form.predicateur} onChange={e => setForm((f: any) => ({ ...f, predicateur: e.target.value }))} /></div>
              <div><label className="label">Modérateur</label><input className="input" value={form.moderateur} onChange={e => setForm((f: any) => ({ ...f, moderateur: e.target.value }))} /></div>
            </div>
          </div>

          {/* Statistiques */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Statistiques</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Hommes</label>
                <input type="number" min={0} className="input" value={form.hommes} onChange={e => setForm((f: any) => ({ ...f, hommes: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Femmes</label>
                <input type="number" min={0} className="input" value={form.femmes} onChange={e => setForm((f: any) => ({ ...f, femmes: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Total participants</label>
                <input type="number" className="input bg-slate-50" value={total} readOnly />
              </div>
              <div>
                <label className="label">Visiteurs</label>
                <input type="number" min={0} className="input" value={form.visiteurs} onChange={e => setForm((f: any) => ({ ...f, visiteurs: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Comptage</label>
                <input type="number" min={0} className="input" value={form.comptage} onChange={e => setForm((f: any) => ({ ...f, comptage: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Prière du salut</label>
                <select className="input" value={form.priere_salut ? 'oui' : 'non'} onChange={e => setForm((f: any) => ({ ...f, priere_salut: e.target.value === 'oui' }))}>
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </div>
              <div>
                <label className="label">Sainte-Cène</label>
                <select className="input" value={form.sainte_cene ? 'oui' : 'non'} onChange={e => setForm((f: any) => ({ ...f, sainte_cene: e.target.value === 'oui' }))}>
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </div>
            </div>
          </div>

          {/* Membres participants */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Membres participants ({form.membres_ids.length} sélectionné(s))
            </h4>
            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
              {membresList.length === 0 ? (
                <p className="p-3 text-xs text-slate-400">Aucun membre EJP actif</p>
              ) : (
                membresList.map((m: any) => (
                  <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.membres_ids.includes(m.id)}
                      onChange={() => toggleMembre(m.id)}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm">{m.prenom} {m.nom}</span>
                    <span className="text-xs text-slate-400 font-mono ml-auto">{m.code_membre_ejp}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader size={14} className="animate-spin" /> Enregistrement...</> : <><Check size={14} /> Enregistrer</>}
          </button>
        </div>
      </Modal>

      {/* Confirm suppression */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        title="Supprimer l'activité ?"
        message={`Supprimer l'activité ${confirmDelete?.code_activite} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger={true}
      />
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

type EJPTab = 'membres' | 'activites'

export default function ActivitesEJP() {
  const [tab, setTab] = useState<EJPTab>('membres')

  const TABS = [
    { id: 'membres', label: 'Membres EJP', icon: <Users size={15} /> },
    { id: 'activites', label: 'Activités EJP', icon: <Calendar size={15} /> },
  ]

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <Users size={20} className="text-purple-700" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">Église des Jeunes Prodiges</h3>
          <p className="text-xs text-slate-400">Gestion des membres et activités EJP</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as EJPTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-purple-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === 'membres' && <MembresEJPTab />}
      {tab === 'activites' && <ActivitesEJPTab />}
    </div>
  )
}
