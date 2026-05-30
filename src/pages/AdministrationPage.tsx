import { useEffect, useState } from 'react'
import { supabase, Profil, Role, ListeParametrable } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit, Trash2, Users, List, Shield, Loader, Save } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { logEvent } from '../lib/journal'

type AdminTab = 'utilisateurs' | 'listes' | 'roles'

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
    </div>
  )
}

function UtilisateursTab() {
  const [profils, setProfils] = useState<any[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('profils').select('*, roles(nom)').order('nom'),
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

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-slate-700">Utilisateurs ({profils.length})</h3>
        <p className="text-xs text-slate-400 mt-0.5">Les comptes sont créés via Supabase Auth. Assignez ici les rôles.</p>
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
                  <button onClick={() => toggleActif(p.id, p.actif)} className={`text-xs px-2 py-1 rounded ${p.actif ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {p.actif ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const CATEGORIES = ['statut_membre', 'issue_phoning', 'type_appel', 'departement', 'nationalite', 'type_activite_rna', 'situation_familiale']
const CATEGORIES_LABELS: Record<string, string> = { statut_membre: 'Statuts membres', issue_phoning: 'Issues phoning', type_appel: 'Types appel', departement: 'Départements', nationalite: 'Nationalités', type_activite_rna: 'Types RNA', situation_familiale: 'Situations familiales' }

function ListesTab() {
  const [listes, setListes] = useState<ListeParametrable[]>([])
  const [selectedCat, setSelectedCat] = useState('departement')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<ListeParametrable | null>(null)
  const [form, setForm] = useState({ valeur: '', ordre: 0 })

  useEffect(() => { fetchListes() }, [selectedCat])

  const fetchListes = async () => {
    setLoading(true)
    const { data } = await supabase.from('listes_parametrables').select('*').eq('categorie', selectedCat).order('ordre')
    setListes(data || [])
    setLoading(false)
  }

  const save = async () => {
    if (!form.valeur.trim()) return toast.error('Valeur requise')
    if (editItem) {
      await supabase.from('listes_parametrables').update({ valeur: form.valeur, ordre: form.ordre }).eq('id', editItem.id)
    } else {
      await supabase.from('listes_parametrables').insert({ categorie: selectedCat, valeur: form.valeur, ordre: form.ordre })
    }
    toast.success('Enregistré')
    setModal(false)
    fetchListes()
  }

  const supprimer = async (id: string) => {
    await supabase.from('listes_parametrables').update({ actif: false }).eq('id', id)
    toast.success('Entrée désactivée')
    fetchListes()
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setSelectedCat(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedCat === c ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {CATEGORIES_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">{CATEGORIES_LABELS[selectedCat]}</h3>
          <button onClick={() => { setEditItem(null); setForm({ valeur: '', ordre: listes.length + 1 }); setModal(true) }} className="btn-primary text-xs py-1"><Plus size={14} /> Ajouter</button>
        </div>
        {loading ? <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700" /></div> : (
          <div className="divide-y">
            {listes.map(l => (
              <div key={l.id} className={`flex items-center justify-between p-3 ${!l.actif ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-6">{l.ordre}</span>
                  <span className="font-medium text-slate-800">{l.valeur}</span>
                  {!l.actif && <span className="badge bg-red-100 text-red-600">Inactif</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditItem(l); setForm({ valeur: l.valeur, ordre: l.ordre }); setModal(true) }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><Edit size={14} /></button>
                  <button onClick={() => supprimer(l.id)} className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {listes.length === 0 && <p className="p-4 text-sm text-slate-500 text-center">Aucune entrée</p>}
          </div>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Modifier' : 'Nouvelle entrée'} size="sm">
        <div className="space-y-3">
          <div><label className="label">Valeur</label><input className="input" value={form.valeur} onChange={e => setForm(p => ({ ...p, valeur: e.target.value }))} /></div>
          <div><label className="label">Ordre</label><input type="number" className="input" value={form.ordre} onChange={e => setForm(p => ({ ...p, ordre: parseInt(e.target.value) || 0 }))} /></div>
          <div className="flex justify-end gap-2"><button onClick={() => setModal(false)} className="btn-secondary">Annuler</button><button onClick={save} className="btn-primary"><Save size={14} /> Enregistrer</button></div>
        </div>
      </Modal>
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
