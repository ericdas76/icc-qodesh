import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import toast from 'react-hot-toast'
import { format, parse } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Edit2, Save, X, Users, CheckSquare, Square, Loader } from 'lucide-react'
import { logEvent } from '../lib/journal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genNumSeance(dateStr: string, index: number) {
  // Format S-AAMMJJ-01
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const nn = String(index).padStart(2, '0')
  return `S-${yy}${mm}${dd}-${nn}`
}

function calcDuree(debut: string, fin: string): number | null {
  if (!debut || !fin) return null
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  const total = (fh * 60 + fm) - (dh * 60 + dm)
  return total > 0 ? total : null
}

function fmtDuree(minutes: number | null) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

// ─── EMPTY FORM ───────────────────────────────────────────────────────────────

const EMPTY_SEANCE = {
  date_seance: '',
  enseignant: '',
  assistant: '',
  theme: '',
  nb_present_seance: '' as string | number,
  heure_debut: '',
  heure_fin: '',
  points_remontes: '',
  observations: '',
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export default function SeancesModal({
  classe,
  isOpen,
  onClose,
}: {
  classe: any
  isOpen: boolean
  onClose: () => void
}) {
  const [seances, setSeances]           = useState<any[]>([])
  const [inscrits, setInscrits]         = useState<any[]>([])
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState(false)

  // Mode : 'list' | 'add' | 'edit' | 'presences'
  const [mode, setMode]                 = useState<'list' | 'add' | 'edit' | 'presences'>('list')
  const [editSeance, setEditSeance]     = useState<any>(null)
  const [form, setForm]                 = useState<any>({ ...EMPTY_SEANCE })
  const [presenceSeance, setPresenceSeance] = useState<any>(null)
  const [presences, setPresences]       = useState<Record<string, boolean>>({})

  const nbInscrit = (classe?.nb_femme || 0) + (classe?.nb_homme || 0)
  const maxSeances = (classe?.nb_seance || 0) + 2

  // ── Fetch séances ──────────────────────────────────────────────────────────
  const fetchSeances = async () => {
    if (!classe) return
    setLoading(true)
    const { data } = await supabase
      .from('seances')
      .select('*')
      .eq('formation_id', classe.id)
      .order('date_seance', { ascending: true })
    setSeances(data || [])
    setLoading(false)
  }

  // ── Fetch inscrits ─────────────────────────────────────────────────────────
  const fetchInscrits = async () => {
    if (!classe) return
    const { data } = await supabase
      .from('inscriptions_formation')
      .select('id, nom_apprenant, personnes(prenom, nom)')
      .eq('formation_id', classe.id)
      .neq('statut', 'abandonne')
    setInscrits(data || [])
  }

  useEffect(() => {
    if (isOpen && classe) {
      fetchSeances()
      fetchInscrits()
      setMode('list')
    }
  }, [isOpen, classe])

  // ── Ouvrir ajout ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditSeance(null)
    setForm({
      ...EMPTY_SEANCE,
      enseignant: classe?.enseignant_nom || '',
      assistant: classe?.assistant_nom || '',
    })
    setMode('add')
  }

  // ── Ouvrir édition ─────────────────────────────────────────────────────────
  const openEdit = (s: any) => {
    setEditSeance(s)
    setForm({
      date_seance: s.date_seance || '',
      enseignant: s.enseignant || '',
      assistant: s.assistant || '',
      theme: s.theme || '',
      nb_present_seance: s.nb_present_seance ?? '',
      heure_debut: s.heure_debut || '',
      heure_fin: s.heure_fin || '',
      points_remontes: s.points_remontes || '',
      observations: s.observations || '',
    })
    setMode('edit')
  }

  // ── Sauvegarder séance ─────────────────────────────────────────────────────
  const doSave = async () => {
    if (!form.date_seance) { toast.error('Date requise'); return }
    setSaving(true)
    try {
      const duree = calcDuree(form.heure_debut, form.heure_fin)
      const nbPresent = Number(form.nb_present_seance) || 0
      const index = mode === 'add' ? seances.length + 1 : editSeance?.num_seance?.split('-').pop() || 1
      const numSeance = mode === 'add'
        ? genNumSeance(form.date_seance, seances.length + 1)
        : editSeance.num_seance

      const payload = {
        formation_id: classe.id,
        num_seance: numSeance,
        date_seance: form.date_seance,
        enseignant: form.enseignant || null,
        assistant: form.assistant || null,
        theme: form.theme || null,
        nb_inscrit: nbInscrit,
        nb_present_seance: nbPresent,
        heure_debut: form.heure_debut || null,
        heure_fin: form.heure_fin || null,
        duree_seance: duree,
        points_remontes: form.points_remontes || null,
        observations: form.observations || null,
      }

      if (mode === 'edit' && editSeance) {
        const { error } = await supabase.from('seances').update(payload).eq('id', editSeance.id)
        if (error) throw error
        await logEvent('formations', 'modifier', classe.id, `Séance modifiée : ${numSeance}`)
        toast.success('Séance mise à jour')
      } else {
        const { error } = await supabase.from('seances').insert(payload)
        if (error) throw error
        await logEvent('formations', 'creer', classe.id, `Séance créée : ${numSeance}`)
        toast.success('Séance ajoutée')
      }

      await fetchSeances()
      setMode('list')
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Gérer présences ────────────────────────────────────────────────────────
  const openPresences = async (s: any) => {
    setPresenceSeance(s)
    // Charger les présences existantes
    const { data } = await supabase
      .from('presences_seance')
      .select('inscription_id, present')
      .eq('seance_id', s.id)
    const map: Record<string, boolean> = {}
    inscrits.forEach(i => { map[i.id] = false })
    ;(data || []).forEach((p: any) => { map[p.inscription_id] = p.present })
    setPresences(map)
    setMode('presences')
  }

  const savePresences = async () => {
    if (!presenceSeance) return
    setSaving(true)
    try {
      // Supprimer les présences existantes
      await supabase.from('presences_seance').delete().eq('seance_id', presenceSeance.id)
      // Insérer les nouvelles
      const rows = inscrits.map(i => ({
        seance_id: presenceSeance.id,
        inscription_id: i.id,
        present: presences[i.id] || false,
      }))
      if (rows.length > 0) {
        const { error } = await supabase.from('presences_seance').insert(rows)
        if (error) throw error
      }
      // Mettre à jour nb_present_seance
      const nbPresent = Object.values(presences).filter(Boolean).length
      await supabase.from('seances').update({ nb_present_seance: nbPresent }).eq('id', presenceSeance.id)
      await logEvent('formations', 'modifier', classe.id, `Présences séance ${presenceSeance.num_seance}`)
      toast.success('Présences enregistrées')
      await fetchSeances()
      setMode('list')
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Statistiques ───────────────────────────────────────────────────────────
  const getStats = () => {
    if (seances.length === 0 || inscrits.length === 0) return null
    // Pour chaque inscrit, compter absences
    const absencesMap: Record<string, number> = {}
    inscrits.forEach(i => { absencesMap[i.id] = 0 })

    // On ne peut calculer les stats que si on a les données de présences chargées
    return null // Sera calculé à la demande
  }

  // ─── FORMULAIRE ─────────────────────────────────────────────────────────────
  const formJsx = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date séance *</label>
          <input type="date" className="input" value={form.date_seance}
            onChange={e => setForm((f: any) => ({ ...f, date_seance: e.target.value }))} />
        </div>
        <div>
          <label className="label">N° séance (auto)</label>
          <input className="input bg-gray-50 text-gray-500" readOnly
            value={mode === 'edit' ? editSeance?.num_seance : genNumSeance(form.date_seance, seances.length + 1)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Enseignant</label>
          <input className="input" value={form.enseignant}
            onChange={e => setForm((f: any) => ({ ...f, enseignant: e.target.value }))} />
        </div>
        <div>
          <label className="label">Assistant</label>
          <input className="input" value={form.assistant}
            onChange={e => setForm((f: any) => ({ ...f, assistant: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="label">Thème</label>
        <input className="input" value={form.theme}
          onChange={e => setForm((f: any) => ({ ...f, theme: e.target.value }))} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Heure début</label>
          <input type="time" className="input" value={form.heure_debut}
            onChange={e => setForm((f: any) => ({ ...f, heure_debut: e.target.value }))} />
        </div>
        <div>
          <label className="label">Heure fin</label>
          <input type="time" className="input" value={form.heure_fin}
            onChange={e => setForm((f: any) => ({ ...f, heure_fin: e.target.value }))} />
        </div>
        <div>
          <label className="label">Durée (auto)</label>
          <input className="input bg-gray-50 text-gray-500" readOnly
            value={fmtDuree(calcDuree(form.heure_debut, form.heure_fin))} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Nb inscrits (auto)</label>
          <input className="input bg-gray-50 text-gray-500" readOnly value={nbInscrit} />
        </div>
        <div>
          <label className="label">Nb présents</label>
          <input type="number" min={0} max={nbInscrit} className="input" value={form.nb_present_seance}
            onChange={e => setForm((f: any) => ({ ...f, nb_present_seance: e.target.value }))} />
        </div>
        <div>
          <label className="label">Nb absents (auto)</label>
          <input className="input bg-gray-50 text-gray-500" readOnly
            value={nbInscrit - (Number(form.nb_present_seance) || 0)} />
        </div>
      </div>

      <div>
        <label className="label">Points remontés</label>
        <textarea className="input resize-none" rows={2} value={form.points_remontes}
          onChange={e => setForm((f: any) => ({ ...f, points_remontes: e.target.value }))} />
      </div>

      <div>
        <label className="label">Observations</label>
        <textarea className="input resize-none" rows={2} value={form.observations}
          onChange={e => setForm((f: any) => ({ ...f, observations: e.target.value }))} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={() => setMode('list')} className="btn btn-secondary" disabled={saving}>
          Annuler
        </button>
        <button onClick={doSave} className="btn btn-primary flex items-center gap-2" disabled={saving}>
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          {mode === 'edit' ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </div>
  )

  // ─── LISTE PRÉSENCES ─────────────────────────────────────────────────────────
  const presencesJsx = (
    <div className="space-y-3">
      <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700">
        Séance <strong>{presenceSeance?.num_seance}</strong> — {presenceSeance?.date_seance
          ? format(new Date(presenceSeance.date_seance), 'dd MMM yyyy', { locale: fr }) : ''}
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500 px-1">
        <span>{inscrits.length} inscrits</span>
        <span>{Object.values(presences).filter(Boolean).length} présents</span>
      </div>
      <div className="divide-y border rounded-lg max-h-72 overflow-y-auto">
        {inscrits.map(i => {
          const nom = i.nom_apprenant || `${i.personnes?.prenom || ''} ${i.personnes?.nom || ''}`.trim() || '—'
          return (
            <div key={i.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
              onClick={() => setPresences(p => ({ ...p, [i.id]: !p[i.id] }))}>
              {presences[i.id]
                ? <CheckSquare size={18} className="text-green-600 shrink-0" />
                : <Square size={18} className="text-gray-300 shrink-0" />}
              <span className={`text-sm ${presences[i.id] ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {nom}
              </span>
            </div>
          )
        })}
        {inscrits.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Aucun inscrit à cette classe</div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={() => setMode('list')} className="btn btn-secondary" disabled={saving}>Annuler</button>
        <button onClick={savePresences} className="btn btn-primary flex items-center gap-2" disabled={saving}>
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
      </div>
    </div>
  )

  // ─── LISTE SÉANCES ────────────────────────────────────────────────────────────
  const listJsx = (
    <div className="space-y-3">
      {/* En-tête info classe */}
      <div className="bg-purple-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
        <div>
          <span className="font-semibold text-purple-800">{classe?.code}</span>
          <span className="text-purple-600 text-sm ml-2">
            {seances.length} / {classe?.nb_seance || '?'} séances
            {classe?.nb_seance_obligatoire
              ? <span className="text-purple-400 ml-1">(oblig. : {classe.nb_seance_obligatoire})</span>
              : null}
          </span>
        </div>
        {seances.length < maxSeances && (
          <button onClick={openAdd} className="btn btn-primary flex items-center gap-1.5 text-xs">
            <Plus size={13} /> Ajouter séance
          </button>
        )}
        {seances.length >= maxSeances && (
          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
            Maximum atteint ({maxSeances})
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader size={24} className="animate-spin text-purple-600" />
        </div>
      ) : seances.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-sm">Aucune séance enregistrée</p>
          <p className="text-xs mt-1">Cliquez sur "Ajouter séance" pour commencer</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['N° Séance', 'Date', 'Enseignant', 'Thème', 'Inscrits', 'Présents', 'Absents', 'Durée', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {seances.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-purple-700">{s.num_seance}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {s.date_seance ? format(new Date(s.date_seance), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{s.enseignant || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate" title={s.theme}>{s.theme || '—'}</td>
                  <td className="px-3 py-2 text-center">{s.nb_inscrit}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5">{s.nb_present_seance}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                      {s.nb_inscrit - s.nb_present_seance}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{fmtDuree(s.duree_seance)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)}
                        className="p-1 rounded hover:bg-amber-50 text-amber-600" title="Modifier">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => openPresences(s)}
                        className="p-1 rounded hover:bg-blue-50 text-blue-600" title="Gérer présences">
                        <Users size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Statistiques */}
      {seances.length > 0 && (
        <StatsSeances seances={seances} inscrits={inscrits} classeId={classe?.id} />
      )}
    </div>
  )

  const titles: Record<string, string> = {
    list: `Séances — ${classe?.code || ''}`,
    add: 'Ajouter une séance',
    edit: 'Modifier la séance',
    presences: 'Gérer les présences',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titles[mode]} size="xl">
      {mode === 'list' && listJsx}
      {(mode === 'add' || mode === 'edit') && formJsx}
      {mode === 'presences' && presencesJsx}
    </Modal>
  )
}

// ─── STATS SÉANCES ────────────────────────────────────────────────────────────

function StatsSeances({ seances, inscrits, classeId }: { seances: any[], inscrits: any[], classeId: string }) {
  const [stats, setStats]   = useState<{ assidus: any[], aRisque: any[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen]     = useState(false)

  const loadStats = async () => {
    setLoading(true)
    // Charger toutes les présences de la classe
    const { data } = await supabase
      .from('presences_seance')
      .select('inscription_id, present, seance_id')
      .in('seance_id', seances.map(s => s.id))

    const absencesMap: Record<string, number> = {}
    const presencesMap: Record<string, number> = {}
    inscrits.forEach(i => { absencesMap[i.id] = 0; presencesMap[i.id] = 0 })

    ;(data || []).forEach((p: any) => {
      if (p.present) presencesMap[p.inscription_id] = (presencesMap[p.inscription_id] || 0) + 1
      else absencesMap[p.inscription_id] = (absencesMap[p.inscription_id] || 0) + 1
    })

    const assidus = inscrits.filter(i => presencesMap[i.id] === seances.length)
    const aRisque = inscrits.filter(i => absencesMap[i.id] > 2)

    setStats({ assidus, aRisque })
    setLoading(false)
    setOpen(true)
  }

  const nomInscrit = (i: any) =>
    i.nom_apprenant || `${i.personnes?.prenom || ''} ${i.personnes?.nom || ''}`.trim() || '—'

  return (
    <div className="border-t pt-3">
      <button onClick={loadStats} className="text-xs text-purple-600 hover:underline flex items-center gap-1" disabled={loading}>
        {loading ? <Loader size={12} className="animate-spin" /> : null}
        📊 Voir les statistiques de participation
      </button>
      {open && stats && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-green-700 mb-2">
              ✅ Participants assidus ({stats.assidus.length})
            </p>
            {stats.assidus.length === 0
              ? <p className="text-xs text-gray-400">Aucun</p>
              : <ul className="space-y-0.5">
                  {stats.assidus.map(i => (
                    <li key={i.id} className="text-xs text-green-800">{nomInscrit(i)}</li>
                  ))}
                </ul>
            }
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-orange-700 mb-2">
              ⚠️ Apprenants à risque — {'>'}2 absences ({stats.aRisque.length})
            </p>
            {stats.aRisque.length === 0
              ? <p className="text-xs text-gray-400">Aucun</p>
              : <ul className="space-y-0.5">
                  {stats.aRisque.map(i => (
                    <li key={i.id} className="text-xs text-orange-800">{nomInscrit(i)}</li>
                  ))}
                </ul>
            }
          </div>
        </div>
      )}
    </div>
  )
}
