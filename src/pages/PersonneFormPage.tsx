import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, Personne } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Save, ArrowLeft, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { logEvent } from '../lib/journal'

const SEXES = [{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Féminin' }]
const SITUATIONS = ['celibataire', 'marie', 'divorce', 'veuf']
const SITUATIONS_LABELS: Record<string, string> = { celibataire: 'Célibataire', marie: 'Marié(e)', divorce: 'Divorcé(e)', veuf: 'Veuf/Veuve' }
const SOURCES = [{ value: 'culte', label: 'Culte' }, { value: 'ami', label: 'Par un ami' }, { value: 'internet', label: 'Internet' }, { value: 'autre', label: 'Autre' }]

interface FormData {
  nom: string; prenom: string; date_naissance: string; lieu_naissance: string
  telephone: string; email: string; profession: string; sexe: string
  situation_familiale: string; nombre_enfants: number; nationalite: string
  adresse: string; quartier: string; statut: string; origine: string
  date_premier_contact: string; source_contact: string; notes: string
}

const empty: FormData = {
  nom: '', prenom: '', date_naissance: '', lieu_naissance: '',
  telephone: '', email: '', profession: '', sexe: '',
  situation_familiale: '', nombre_enfants: 0, nationalite: 'Malagasy',
  adresse: '', quartier: '', statut: 'nouveau', origine: '',
  date_premier_contact: new Date().toISOString().split('T')[0],
  source_contact: '', notes: ''
}

export default function PersonneFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = !!id
  const [form, setForm] = useState<FormData>(empty)
  const [origineOptions, setOrigineOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(isEdit)

  useEffect(() => {
    fetchOrigines()
    if (isEdit) {
      supabase.from('personnes').select('*').eq('id', id).single().then(({ data }) => {
        if (data) setForm({
          nom: data.nom || '', prenom: data.prenom || '',
          date_naissance: data.date_naissance || '', lieu_naissance: data.lieu_naissance || '',
          telephone: data.telephone || '', email: data.email || '',
          profession: data.profession || '', sexe: data.sexe || '',
          situation_familiale: data.situation_familiale || '', nombre_enfants: data.nombre_enfants || 0,
          nationalite: data.nationalite || 'Malagasy', adresse: data.adresse || '',
          quartier: data.quartier || '', statut: data.statut || 'nouveau',
          origine: data.origine || '',
          date_premier_contact: data.date_premier_contact || '',
          source_contact: data.source_contact || '', notes: data.notes || ''
        })
        setLoadingData(false)
      })
    }
  }, [id])

  const fetchOrigines = async () => {
    const { data } = await supabase
      .from('listes_parametrables')
      .select('valeur')
      .eq('categorie', 'origine')
      .eq('actif', true)
      .order('ordre')
    setOrigineOptions((data || []).map(d => d.valeur))
  }

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: field === 'nombre_enfants' ? parseInt(e.target.value) || 0 : e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom.trim() || !form.prenom.trim()) return toast.error('Nom et prénom requis')
    if (!form.nationalite.trim()) return toast.error('Nationalité requise')
    if (!form.origine) return toast.error('Origine obligatoire')
    setLoading(true)

    const payload = {
      ...form,
      origine: form.origine || null,
      date_naissance: form.date_naissance || null,
      lieu_naissance: form.lieu_naissance || null,
      date_premier_contact: form.date_premier_contact || null,
      sexe: (form.sexe as 'M' | 'F') || null,
      situation_familiale: form.situation_familiale || null,
      source_contact: form.source_contact || null,
      notes: form.notes || null,
      auteur_creation: user?.id
    }

    if (isEdit) {
      const { error } = await supabase.from('personnes').update(payload).eq('id', id)
      if (error) { toast.error('Erreur lors de la mise à jour'); setLoading(false); return }
      await logEvent('integration', 'modification', `Modification : ${form.prenom} ${form.nom}`, id)
      toast.success('Fiche mise à jour')
      navigate(`/integration/${id}`)
    } else {
      const { data, error } = await supabase.from('personnes').insert(payload).select().single()
      if (error) { toast.error('Erreur lors de la création'); setLoading(false); return }
      await logEvent('integration', 'creation', `Nouvelle fiche : ${form.prenom} ${form.nom}`, data.id)
      toast.success('Fiche créée — tâche J+3 générée automatiquement')
      navigate(`/integration/${data.id}`)
    }
    setLoading(false)
  }

  if (loadingData) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" /></div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="page-title">{isEdit ? 'Modifier la fiche' : 'Nouvelle fiche personne'}</h2>
          <p className="text-sm text-slate-500">Les champs marqués * sont obligatoires</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identité */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wide">Identité</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom *</label>
              <input className="input uppercase" value={form.nom} onChange={set('nom')} placeholder="RAKOTO" required />
            </div>
            <div>
              <label className="label">Prénom *</label>
              <input className="input" value={form.prenom} onChange={set('prenom')} placeholder="Jean" required />
            </div>
            <div>
              <label className="label">Sexe</label>
              <select className="input" value={form.sexe} onChange={set('sexe')}>
                <option value="">— Choisir —</option>
                {SEXES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nationalité *</label>
              <input className="input" value={form.nationalite} onChange={set('nationalite')} placeholder="Malagasy" required />
            </div>
            <div>
              <label className="label">Date de naissance</label>
              <input type="date" className="input" value={form.date_naissance} onChange={set('date_naissance')} />
            </div>
            <div>
              <label className="label">Lieu de naissance</label>
              <input className="input" value={form.lieu_naissance} onChange={set('lieu_naissance')} placeholder="Antananarivo" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wide">Contact & Situation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.telephone} onChange={set('telephone')} placeholder="+261 34 00 000 00" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="jean@email.com" />
            </div>
            <div>
              <label className="label">Profession</label>
              <input className="input" value={form.profession} onChange={set('profession')} placeholder="Enseignant" />
            </div>
            <div>
              <label className="label">Situation familiale</label>
              <select className="input" value={form.situation_familiale} onChange={set('situation_familiale')}>
                <option value="">— Choisir —</option>
                {SITUATIONS.map(s => <option key={s} value={s}>{SITUATIONS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nombre d'enfants</label>
              <input type="number" min={0} className="input" value={form.nombre_enfants} onChange={set('nombre_enfants')} />
            </div>
            <div>
              <label className="label">Adresse / Quartier</label>
              <input className="input" value={form.quartier} onChange={set('quartier')} placeholder="Ambohimanarina" />
            </div>
          </div>
        </div>

        {/* Suivi */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wide">Suivi pastoral</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Origine *</label>
              <select className="input" value={form.origine} onChange={set('origine')} required>
                <option value="">— Choisir —</option>
                {origineOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date premier contact</label>
              <input type="date" className="input" value={form.date_premier_contact} onChange={set('date_premier_contact')} />
            </div>
            <div>
              <label className="label">Source de contact</label>
              <select className="input" value={form.source_contact} onChange={set('source_contact')}>
                <option value="">— Choisir —</option>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Notes</label>
            <textarea className="input min-h-24 resize-none" value={form.notes} onChange={set('notes')} placeholder="Notes additionnelles…" />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Enregistrer' : 'Créer la fiche'}
          </button>
        </div>
      </form>
    </div>
  )
}
