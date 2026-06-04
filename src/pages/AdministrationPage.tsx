import { useEffect, useState } from 'react'
import { supabase, Profil, Role, ListeParametrable } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit, Trash2, Users, List, Shield, Loader, Save, Search, UserCog, Church } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'

type AdminTab = 'utilisateurs' | 'listes' | 'roles' | 'personnes' | 'ejp'

export default function AdministrationPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<AdminTab>('utilisateurs')

  // Accès si admin OU si aucun rôle configuré (setup initial)
  const { profil } = useAuth()
  if (!isAdmin() && profil?.role_id) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      <div className="text-center">
        <Shield size={40} className="mx-auto mb-3 text-slate-300" />
        <p className="font-medium">Accès réservé aux administrateurs</p>
      </div>
    </div>
  )

  const TABS = [
    { id: 'utilisateurs', label: 'Utilisateurs', icon: <Users size={16} /> },
    { id: 'listes', label: 'Listes paramétrables', icon: <List size={16} /> },
    { id: 'roles', label: 'Rôles', icon: <Shield size={16} /> },
    { id: 'personnes', label: 'Personnes', icon: <UserCog size={16} /> },
    { id: 'ejp', label: 'Listes EJP', icon: <Church size={16} /> },
  ]

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Administration</h2>
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as AdminTab)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'utilisateurs' && <UtilisateursTab />}
      {tab === 'listes' && <ListesTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'personnes' && <PersonnesTab />}
      {tab === 'ejp' && <EJPListesTab />}
    </div>
  )
}

function UtilisateursTab() {
  const [profils, setProfils] = useState<any[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editProfil, setEditProfil] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ prenom: '', nom: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('profils').select('*, roles(nom)').order('email'),  // tri stable par email
      supabase.from('roles').select('*').order('nom')
    ])
    setProfils(p || [])
    setRoles(r || [])
    setLoading(false)
  }

  const changerRole = async (profilId: string, roleId: string) => {
    await supabase.from('profils').update({ role_id: roleId || null }).eq('id', profilId)
    toast.success('Rôle mis à jour')
    await logEvent('administration', 'modification', `Rôle utilisateur modifié`)
    fetchData()
  }

  const toggleActif = async (profilId: string, actif: boolean) => {
    await supabase.from('profils').update({ actif: !actif }).eq('id', profilId)
    toast.success(actif ? 'Utilisateur désactivé' : 'Utilisateur activé')
    fetchData()
  }

  const openEdit = (p: any) => {
    setEditProfil(p)
    setEditForm({ prenom: p.prenom || '', nom: p.nom || '' })
  }

  const saveEdit = async () => {
    if (!editForm.prenom.trim() && !editForm.nom.trim()) {
      toast.error('Au moins un champ requis')
      return
    }
    setSaving(true)
    try {
      const { error, count } = await supabase.from('profils')
        .update({ prenom: editForm.prenom.trim(), nom: editForm.nom.trim().toUpperCase() })
        .eq('id', editProfil.id)
        .select()
      if (error) throw error
      if (!count || count === 0) {
        throw new Error('Modification bloquée par les permissions (RLS). Contactez l\'administrateur système.')
      }
      // Mise à jour locale immédiate pour éviter le bug d'affichage
      setProfils(prev => prev.map(u =>
        u.id === editProfil.id
          ? { ...u, prenom: editForm.prenom.trim(), nom: editForm.nom.trim().toUpperCase() }
          : u
      ))
      toast.success('Nom modifié avec succès')
      await logEvent('administration', 'modification', `Nom/prénom utilisateur modifié : ${editForm.prenom} ${editForm.nom}`)
      setEditProfil(null)
      fetchData()
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>

  return (
    <>
    <div className="card overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-slate-700">Utilisateurs ({profils.length})</h3>
        <p className="text-xs text-slate-400 mt-0.5">Les comptes sont créés via Supabase Auth. Assignez ici les rôles et modifiez les noms.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              {['Utilisateur', 'Email', 'Rôle', 'Statut', 'Depuis', ''].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {profils.map(p => (
              <tr key={p.id} className={`hover:bg-slate-50 ${!p.actif ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 uppercase">{p.prenom?.[0]}{p.nom?.[0]}</div>
                    <p className="font-medium">{p.prenom} {p.nom}</p>
                  </div>
                </td>
                <td className="px-4 py-2 text-slate-500">{p.email}</td>
                <td className="px-4 py-2">
                  <select value={p.role_id || ''} onChange={e => changerRole(p.id, e.target.value)} className="text-xs border rounded px-1.5 py-1 bg-white">
                    <option value="">— Aucun —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <span className={`badge ${p.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.actif ? 'Actif' : 'Inactif'}</span>
                </td>
                <td className="px-4 py-2 text-slate-400 text-xs">{format(new Date(p.created_at), 'd MMM yyyy', { locale: fr })}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1">
                      <Edit size={11} /> Modifier
                    </button>
                    <button onClick={() => toggleActif(p.id, p.actif)} className={`text-xs px-2 py-1 rounded ${p.actif ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {p.actif ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Modal édition Prénom / Nom */}
    <Modal isOpen={!!editProfil} onClose={() => setEditProfil(null)} title="Modifier l'utilisateur" size="sm">
      {editProfil && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Email : <span className="font-medium text-slate-600">{editProfil.email}</span></p>
          <div>
            <label className="label">Prénom</label>
            <input
              className="input"
              value={editForm.prenom}
              onChange={e => setEditForm(f => ({ ...f, prenom: e.target.value }))}
              placeholder="Prénom"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
            />
          </div>
          <div>
            <label className="label">Nom</label>
            <input
              className="input uppercase"
              value={editForm.nom}
              onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="NOM"
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditProfil(null)} className="btn-secondary" disabled={saving}>Annuler</button>
            <button onClick={saveEdit} className="btn-primary flex items-center gap-2" disabled={saving}>
              {saving ? <><Loader size={14} className="animate-spin" /> Enregistrement…</> : <><Save size={14} /> Enregistrer</>}
            </button>
          </div>
        </div>
      )}
    </Modal>
    </>
  )
}

const CATEGORIES = ['statut_membre', 'departement', 'situation_familiale', 'nationalite', 'origine', 'langue', 'source_contact', 'issue_phoning', 'type_appel', 'type_activite_rna']
const CATEGORIES_LABELS: Record<string, string> = {
  statut_membre: 'Catégories membres',
  departement: 'Départements',
  situation_familiale: 'Situations familiales',
  nationalite: 'Nationalités',
  origine: 'Origines',
  langue: 'Langues',
  issue_phoning: 'Issues phoning',
  type_appel: 'Types appel',
  source_contact: 'Sources contact',
  type_activite_rna: 'Types activité RNA',
}

function ListesTab() {
  const [listes, setListes] = useState<ListeParametrable[]>([])
  const [selectedCat, setSelectedCat] = useState('statut_membre')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<ListeParametrable | null>(null)
  const [form, setForm] = useState({ valeur: '', ordre: 0 })
  const [confirmDesactiver, setConfirmDesactiver] = useState<ListeParametrable | null>(null)

  useEffect(() => { fetchListes() }, [selectedCat])

  const fetchListes = async () => {
    setLoading(true)
    // Afficher toutes les entrées (actives ET inactives) pour permettre la réactivation
    const { data } = await supabase.from('listes_parametrables').select('*').eq('categorie', selectedCat).order('ordre')
    setListes(data || [])
    setLoading(false)
  }

  const save = async () => {
    if (!form.valeur.trim()) return toast.error('Valeur requise')
    if (editItem) {
      const { error } = await supabase.from('listes_parametrables').update({ valeur: form.valeur, ordre: form.ordre }).eq('id', editItem.id)
      if (error) { toast.error('Erreur : ' + error.message); return }
    } else {
      const { error } = await supabase.from('listes_parametrables').insert({ categorie: selectedCat, valeur: form.valeur, ordre: form.ordre, actif: true })
      if (error) { toast.error('Erreur : ' + error.message); return }
    }
    toast.success('Enregistré')
    setModal(false)
    fetchListes()
  }

  const toggleActif = async (item: ListeParametrable) => {
    const { error } = await supabase.from('listes_parametrables').update({ actif: !item.actif }).eq('id', item.id)
    if (error) { toast.error('Erreur'); return }
    toast.success(item.actif ? 'Entrée désactivée' : 'Entrée réactivée')
    setConfirmDesactiver(null)
    fetchListes()
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setSelectedCat(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCat === c ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {CATEGORIES_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-700">{CATEGORIES_LABELS[selectedCat]}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{listes.filter(l => l.actif).length} active(s) · {listes.filter(l => !l.actif).length} inactive(s)</p>
          </div>
          <button
            onClick={() => { setEditItem(null); setForm({ valeur: '', ordre: listes.length + 1 }); setModal(true) }}
            className="btn-primary flex items-center gap-1 text-xs py-1.5"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700" /></div>
        ) : (
          <div className="divide-y">
            {listes.map(l => (
              <div key={l.id} className={`flex items-center justify-between p-3 ${!l.actif ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-6 text-right">{l.ordre}</span>
                  <span className={`font-medium ${l.actif ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{l.valeur}</span>
                  {!l.actif && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">Inactif</span>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditItem(l); setForm({ valeur: l.valeur, ordre: l.ordre }); setModal(true) }}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    title="Modifier"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => l.actif ? setConfirmDesactiver(l) : toggleActif(l)}
                    className={`p-1.5 rounded text-xs ${
                      l.actif
                        ? 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                        : 'hover:bg-green-50 text-slate-400 hover:text-green-600'
                    }`}
                    title={l.actif ? 'Désactiver' : 'Réactiver'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {listes.length === 0 && (
              <p className="p-6 text-sm text-slate-500 text-center">Aucune entrée — cliquez sur Ajouter pour commencer</p>
            )}
          </div>
        )}
      </div>

      {/* Modal ajout/modif */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editItem ? `Modifier — ${editItem.valeur}` : `Nouvelle entrée — ${CATEGORIES_LABELS[selectedCat]}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Valeur *</label>
            <input
              className="input"
              value={form.valeur}
              onChange={e => setForm(p => ({ ...p, valeur: e.target.value }))}
              placeholder="Ex : Louange"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Ordre d'affichage</label>
            <input
              type="number"
              className="input"
              value={form.ordre}
              onChange={e => setForm(p => ({ ...p, ordre: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
            <button onClick={save} className="btn-primary flex items-center gap-1">
              <Save size={14} /> Enregistrer
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm désactivation */}
      <ConfirmDialog
        open={!!confirmDesactiver}
        onClose={() => setConfirmDesactiver(null)}
        onConfirm={() => confirmDesactiver && toggleActif(confirmDesactiver)}
        title="Désactiver cette entrée"
        message={`Désactiver "${confirmDesactiver?.valeur}" ? Elle n'apparaîtra plus dans les listes de saisie.`}
        confirmLabel="Désactiver"
        danger
      />
    </div>
  )
}

function RolesTab() {
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('roles').select('*, roles_permissions(permissions(module, action))').then(({ data }) => {
      setRoles(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>

  return (
    <div className="space-y-4">
      {roles.map(role => {
        const perms = (role.roles_permissions || []).map((rp: any) => rp.permissions).filter(Boolean)
        const modules = [...new Set(perms.map((p: any) => p.module))] as string[]
        return (
          <div key={role.id} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-blue-600" />
              <h3 className="font-bold text-slate-900 capitalize">{role.nom}</h3>
              <span className="text-sm text-slate-400">— {role.description}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {modules.map(mod => {
                const actions = perms.filter((p: any) => p.module === mod).map((p: any) => p.action)
                return (
                  <div key={mod} className="bg-slate-50 rounded px-2 py-1 text-xs">
                    <span className="font-medium text-slate-700 capitalize">{mod}</span>
                    <span className="text-slate-400 ml-1">({actions.join(', ')})</span>
                  </div>
                )
              })}
              {modules.length === 0 && <span className="text-sm text-slate-400">Aucune permission</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Onglet Personnes ─────────────────────────────────────────────────────────

const SITUATIONS = ['celibataire', 'marie', 'divorce', 'veuf']
const SOURCES = ['culte', 'ami', 'internet', 'autre']

function PersonnesTab() {
  const [personnes, setPersonnes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState<any | null>(null)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [origineOptions, setOrigineOptions] = useState<string[]>([])
  const [langueOptions, setLangueOptions] = useState<string[]>([])
  const [form, setForm] = useState<any>({})

  useEffect(() => { fetchPersonnes(); fetchOptions() }, [])

  const fetchPersonnes = async () => {
    setLoading(true)
    const { data } = await supabase.from('personnes').select('*').eq('actif', true).order('nom')
    setPersonnes(data || [])
    setLoading(false)
  }

  const fetchOptions = async () => {
    const [{ data: o }, { data: l }] = await Promise.all([
      supabase.from('listes_parametrables').select('valeur').eq('categorie', 'origine').eq('actif', true).order('ordre'),
      supabase.from('listes_parametrables').select('valeur').eq('categorie', 'langue').eq('actif', true).order('ordre'),
    ])
    setOrigineOptions((o || []).map((x: any) => x.valeur))
    setLangueOptions((l || []).map((x: any) => x.valeur))
  }

  const openEdit = (p: any) => {
    setEditItem(p)
    setForm({
      nom: p.nom || '', prenom: p.prenom || '', sexe: p.sexe || '',
      date_naissance: p.date_naissance || '', lieu_naissance: p.lieu_naissance || '',
      telephone: p.telephone || '', telephone_whatsapp: p.telephone_whatsapp || '',
      email: p.email || '', profession: p.profession || '',
      situation_familiale: p.situation_familiale || '',
      nombre_enfants: p.nombre_enfants || 0, nationalite: p.nationalite || 'Malagasy',
      adresse: p.adresse || '', quartier: p.quartier || '',
      origine: p.origine || '', langue: p.langue || '',
      suivi_par: p.suivi_par || '', de_passage: p.de_passage ? 'oui' : 'non',
      date_premier_contact: p.date_premier_contact || '',
      source_contact: p.source_contact || '', notes: p.notes || '',
    })
    setModal(true)
  }

  const doSave = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) { toast.error('Nom et prénom requis'); return }
    setSaving(true)

    const champLabels: Record<string, string> = {
      nom: 'Nom', prenom: 'Prénom', sexe: 'Sexe', date_naissance: 'Date naissance',
      lieu_naissance: 'Lieu naissance', telephone: 'Téléphone', telephone_whatsapp: 'WhatsApp',
      email: 'Email', profession: 'Profession', situation_familiale: 'Situation familiale',
      nombre_enfants: 'Nb enfants', nationalite: 'Nationalité', adresse: 'Adresse',
      quartier: 'Quartier', origine: 'Origine', langue: 'Langue', suivi_par: 'Suivi par',
      de_passage: 'De passage', date_premier_contact: 'Date 1er contact',
      source_contact: 'Source contact', notes: 'Notes',
    }

    const anciennesValeurs: Record<string, unknown> = {}
    const nouvellesValeurs: Record<string, unknown> = {}
    const champsModifies: string[] = []

    Object.keys(champLabels).forEach(key => {
      const ancien = editItem[key] ?? ''
      const nouveau = key === 'de_passage' ? (form[key] === 'oui')
        : key === 'nombre_enfants' ? Number(form[key])
        : (form[key] ?? '')
      const ancienNorm = key === 'de_passage' ? Boolean(ancien) : ancien
      if (String(ancienNorm) !== String(nouveau)) {
        champsModifies.push(champLabels[key])
        anciennesValeurs[champLabels[key]] = ancienNorm
        nouvellesValeurs[champLabels[key]] = nouveau
      }
    })

    const { error } = await supabase.from('personnes').update({
      nom: form.nom.toUpperCase(), prenom: form.prenom,
      sexe: form.sexe || null, date_naissance: form.date_naissance || null,
      lieu_naissance: form.lieu_naissance || null, telephone: form.telephone || null,
      telephone_whatsapp: form.telephone_whatsapp || null, email: form.email || null,
      profession: form.profession || null, situation_familiale: form.situation_familiale || null,
      nombre_enfants: Number(form.nombre_enfants) || 0, nationalite: form.nationalite || 'Malagasy',
      adresse: form.adresse || null, quartier: form.quartier || null,
      origine: form.origine || null, langue: form.langue || null,
      suivi_par: form.suivi_par || null, de_passage: form.de_passage === 'oui',
      date_premier_contact: form.date_premier_contact || null,
      source_contact: form.source_contact || null, notes: form.notes || null,
    }).eq('id', editItem.id)

    setSaving(false)
    if (error) { toast.error('Erreur : ' + error.message); return }

    if (champsModifies.length > 0) {
      await logEvent(
        'administration', 'modifier',
        `Modification personne ${form.prenom} ${form.nom} — champs : ${champsModifies.join(', ')}`,
        editItem.id, anciennesValeurs, nouvellesValeurs
      )
    }

    toast.success('Personne mise à jour')
    setModal(false)
    fetchPersonnes()
  }

  const filtered = personnes.filter(p => {
    const s = search.toLowerCase()
    return !search || p.nom.toLowerCase().includes(s) || p.prenom.toLowerCase().includes(s)
      || (p.telephone || '').includes(s) || (p.email || '').toLowerCase().includes(s)
  })

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Rechercher par nom, prénom, téléphone, email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-slate-400 mt-2">{filtered.length} personne{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}</p>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader size={18} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nom complet', 'Sexe', 'Téléphone', 'Email', 'Origine', '1er contact', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.prenom} {p.nom}</td>
                    <td className="px-4 py-3 text-gray-600">{p.sexe === 'M' ? 'Homme' : p.sexe === 'F' ? 'Femme' : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.telephone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.origine || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.date_premier_contact ? format(new Date(p.date_premier_contact), 'dd MMM yyyy', { locale: fr }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-medium transition-colors">
                        <Edit size={13} /> Modifier
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucune personne trouvée</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal modification */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={`Modifier — ${editItem?.prenom} ${editItem?.nom}`} size="xl">
        {editItem && (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identité</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Nom *</label><input className="input uppercase" value={form.nom} onChange={e => setForm((f: any) => ({ ...f, nom: e.target.value }))} /></div>
                <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e => setForm((f: any) => ({ ...f, prenom: e.target.value }))} /></div>
                <div>
                  <label className="label">Sexe</label>
                  <select className="input" value={form.sexe} onChange={e => setForm((f: any) => ({ ...f, sexe: e.target.value }))}>
                    <option value="">— Sélectionner —</option>
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                  </select>
                </div>
                <div><label className="label">Nationalité</label><input className="input" value={form.nationalite} onChange={e => setForm((f: any) => ({ ...f, nationalite: e.target.value }))} /></div>
                <div><label className="label">Date de naissance</label><input type="date" className="input" value={form.date_naissance} onChange={e => setForm((f: any) => ({ ...f, date_naissance: e.target.value }))} /></div>
                <div><label className="label">Lieu de naissance</label><input className="input" value={form.lieu_naissance} onChange={e => setForm((f: any) => ({ ...f, lieu_naissance: e.target.value }))} /></div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={e => setForm((f: any) => ({ ...f, telephone: e.target.value }))} placeholder="+261 34 00 000 00" /></div>
                <div><label className="label">WhatsApp</label><input className="input" value={form.telephone_whatsapp} onChange={e => setForm((f: any) => ({ ...f, telephone_whatsapp: e.target.value }))} placeholder="+261 34 00 000 00" /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Profession</label><input className="input" value={form.profession} onChange={e => setForm((f: any) => ({ ...f, profession: e.target.value }))} /></div>
                <div>
                  <label className="label">Situation familiale</label>
                  <select className="input" value={form.situation_familiale} onChange={e => setForm((f: any) => ({ ...f, situation_familiale: e.target.value }))}>
                    <option value="">— Sélectionner —</option>
                    {SITUATIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div><label className="label">Nombre d'enfants</label><input type="number" min={0} className="input" value={form.nombre_enfants} onChange={e => setForm((f: any) => ({ ...f, nombre_enfants: Number(e.target.value) }))} /></div>
                <div><label className="label">Quartier</label><input className="input" value={form.quartier} onChange={e => setForm((f: any) => ({ ...f, quartier: e.target.value }))} /></div>
                <div>
                  <label className="label">Langue parlée</label>
                  <select className="input" value={form.langue} onChange={e => setForm((f: any) => ({ ...f, langue: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {langueOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Suivi pastoral</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Origine</label>
                  <select className="input" value={form.origine} onChange={e => setForm((f: any) => ({ ...f, origine: e.target.value }))}>
                    <option value="">— Sélectionner —</option>
                    {origineOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div><label className="label">Date premier contact</label><input type="date" className="input" value={form.date_premier_contact} onChange={e => setForm((f: any) => ({ ...f, date_premier_contact: e.target.value }))} /></div>
                <div>
                  <label className="label">Source contact</label>
                  <select className="input" value={form.source_contact} onChange={e => setForm((f: any) => ({ ...f, source_contact: e.target.value }))}>
                    <option value="">— Sélectionner —</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">De passage</label>
                  <select className="input" value={form.de_passage} onChange={e => setForm((f: any) => ({ ...f, de_passage: e.target.value }))}>
                    <option value="non">Non</option>
                    <option value="oui">Oui</option>
                  </select>
                </div>
                <div><label className="label">Suivi par</label><input className="input" value={form.suivi_par} onChange={e => setForm((f: any) => ({ ...f, suivi_par: e.target.value }))} placeholder="Nom du responsable" /></div>
              </div>
              <div className="mt-4"><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-2 text-xs text-violet-700 flex items-center gap-2">
              <Shield size={13} /> Toutes les modifications seront enregistrées dans l'Historique avec les anciennes et nouvelles valeurs.
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={doSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader size={14} className="animate-spin" /> Enregistrement...</> : <><Save size={14} /> Enregistrer</>}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Onglet Listes EJP ────────────────────────────────────────────────────────

type EJPSection = 'departements' | 'types_rencontre' | 'formations_pcnc'

const EJP_SECTIONS: { id: EJPSection; label: string; table: string }[] = [
  { id: 'departements', label: 'Départements EJP', table: 'ejp_departements' },
  { id: 'types_rencontre', label: 'Types de rencontre EJP', table: 'ejp_types_rencontre' },
  { id: 'formations_pcnc', label: 'Formations PCNC', table: 'ejp_formations_pcnc' },
]

function EJPListesTab() {
  const [section, setSection] = useState<EJPSection>('departements')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nom: '', code: '', libelle: '', nb_seance: '', nb_seance_obligatoire: '' })
  const [saving, setSaving] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<any>(null)

  const currentSection = EJP_SECTIONS.find(s => s.id === section)!

  useEffect(() => { fetchItems() }, [section])

  const fetchItems = async () => {
    setLoading(true)
    const { data } = await supabase.from(currentSection.table).select('*').order('created_at')
    setItems(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ nom: '', code: '', libelle: '', nb_seance: '', nb_seance_obligatoire: '' })
    setModal(true)
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setForm({
      nom: item.nom || '',
      code: item.code || '',
      libelle: item.libelle || '',
      nb_seance: item.nb_seance != null ? String(item.nb_seance) : '',
      nb_seance_obligatoire: item.nb_seance_obligatoire != null ? String(item.nb_seance_obligatoire) : '',
    })
    setModal(true)
  }

  const save = async () => {
    const isPCNC = section === 'formations_pcnc'
    if (isPCNC && !form.code.trim()) return toast.error('Code obligatoire')
    if (!isPCNC && !form.nom.trim()) return toast.error('Nom obligatoire')
    setSaving(true)
    try {
      const payload = isPCNC
        ? {
            code: form.code.trim(),
            libelle: form.libelle.trim() || null,
            nb_seance: form.nb_seance !== '' ? parseInt(form.nb_seance, 10) : null,
            nb_seance_obligatoire: form.nb_seance_obligatoire !== '' ? parseInt(form.nb_seance_obligatoire, 10) : null,
          }
        : { nom: form.nom.trim() }

      if (editItem) {
        const { error } = await supabase.from(currentSection.table).update(payload).eq('id', editItem.id)
        if (error) throw error
        toast.success('Entrée modifiée')
      } else {
        const { error } = await supabase.from(currentSection.table).insert({ ...payload, actif: true })
        if (error) throw error
        toast.success('Entrée ajoutée')
      }
      setModal(false)
      fetchItems()
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActif = async (item: any) => {
    const { error } = await supabase.from(currentSection.table).update({ actif: !item.actif }).eq('id', item.id)
    if (error) { toast.error('Erreur'); return }
    toast.success(item.actif ? 'Entrée désactivée' : 'Entrée réactivée')
    setConfirmToggle(null)
    fetchItems()
  }

  const isPCNC = section === 'formations_pcnc'

  return (
    <div>
      {/* Sélection section */}
      <div className="flex flex-wrap gap-2 mb-4">
        {EJP_SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              section === s.id ? 'bg-purple-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-700">{currentSection.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {items.filter(i => i.actif).length} active(s) · {items.filter(i => !i.actif).length} inactive(s)
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-1 text-xs py-1.5">
            <Plus size={14} /> Ajouter
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-700" /></div>
        ) : (
          <div className="divide-y">
            {items.map(item => (
              <div key={item.id} className={`flex items-center justify-between p-3 ${!item.actif ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center gap-3">
                  {isPCNC ? (
                    <>
                      <span className={`font-mono font-semibold ${item.actif ? 'text-purple-700' : 'text-slate-400'}`}>{item.code}</span>
                      {item.libelle && <span className={`text-sm ${item.actif ? 'text-slate-600' : 'text-slate-400'}`}>— {item.libelle}</span>}
                      {(item.nb_seance != null || item.nb_seance_obligatoire != null) && (
                        <span className="text-xs text-slate-400 ml-2">
                          ({item.nb_seance != null ? `${item.nb_seance} séance${item.nb_seance > 1 ? 's' : ''}` : ''}
                          {item.nb_seance != null && item.nb_seance_obligatoire != null ? ', ' : ''}
                          {item.nb_seance_obligatoire != null ? `${item.nb_seance_obligatoire} oblig.` : ''})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className={`font-medium ${item.actif ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{item.nom}</span>
                  )}
                  {!item.actif && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">Inactif</span>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    title="Modifier"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => item.actif ? setConfirmToggle(item) : toggleActif(item)}
                    className={`p-1.5 rounded text-xs ${
                      item.actif ? 'hover:bg-red-50 text-slate-400 hover:text-red-500' : 'hover:bg-green-50 text-slate-400 hover:text-green-600'
                    }`}
                    title={item.actif ? 'Désactiver' : 'Réactiver'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="p-6 text-sm text-slate-500 text-center">Aucune entrée — cliquez sur Ajouter pour commencer</p>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        key={`${section}-${editItem ? editItem.id : 'new'}`}
        open={modal}
        onClose={() => setModal(false)}
        title={editItem ? `Modifier — ${editItem.nom || editItem.code}` : `Nouvelle entrée — ${currentSection.label}`}
        size="md"
      >
        <div className="space-y-4">
          {isPCNC ? (
            <>
              <div>
                <label className="label">Code *</label>
                <input className="input font-mono" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="Ex: 001/BDR" autoFocus />
              </div>
              <div>
                <label className="label">Libellé (optionnel)</label>
                <input className="input" value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} placeholder="Description de la formation" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nb séances total</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={form.nb_seance}
                    onChange={e => setForm(f => ({ ...f, nb_seance: e.target.value }))}
                    placeholder="Ex: 12"
                  />
                </div>
                <div>
                  <label className="label">Nb séances obligatoires</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={form.nb_seance_obligatoire}
                    onChange={e => setForm(f => ({ ...f, nb_seance_obligatoire: e.target.value }))}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="label">Nom *</label>
              <input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Logistique" autoFocus />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setModal(false)} className="btn-secondary">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader size={14} className="animate-spin" /> Enregistrement...</> : <><Save size={14} /> Enregistrer</>}
          </button>
        </div>
      </Modal>

      {/* Confirm désactivation */}
      <ConfirmDialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => confirmToggle && toggleActif(confirmToggle)}
        title="Désactiver l'entrée ?"
        message={`Désactiver "${confirmToggle?.nom || confirmToggle?.code}" ?`}
        confirmLabel="Désactiver"
        danger={true}
      />
    </div>
  )
}
