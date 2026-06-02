import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logEvent } from '../lib/journal'
import toast from 'react-hot-toast'
import { Upload, Download, CheckCircle, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawRow {
  [key: string]: string | number | undefined
}

interface ParsedRow {
  index: number
  nom: string
  prenom: string
  sexe: string
  date_naissance: string
  telephone: string
  telephone_whatsapp: string
  email: string
  profession: string
  situation_familiale: string
  nationalite: string
  quartier: string
  origine: string
  langue: string
  date_premier_contact: string
  source_contact: string
  notes: string
  errors: string[]
  valid: boolean
}

interface ImportExcelModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  origineOptions: string[]
  langueOptions: string[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLONNES_MODELE = [
  'Nom', 'Prénom', 'Sexe', 'Date Naissance', 'Téléphone', 'WhatsApp',
  'Email', 'Profession', 'Situation Familiale', 'Nationalité',
  'Quartier', 'Origine', 'Langue', 'Date Premier Contact', 'Source Contact', 'Notes'
]

const SITUATIONS_VALIDES = ['celibataire', 'marie', 'divorce', 'veuf']
const SOURCES_VALIDES = ['culte', 'ami', 'internet', 'autre']

// ─── Helpers validation ───────────────────────────────────────────────────────

/** Vérifie format JJ/MM/AAAA et retourne YYYY-MM-DD ou null */
function parseDate(val: string): { iso: string | null; error: string | null } {
  if (!val || val.trim() === '') return { iso: null, error: null }
  const trimmed = val.trim()

  // Accepter JJ/MM/AAAA uniquement
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = trimmed.match(regex)
  if (!match) {
    return { iso: null, error: `"${trimmed}" n'est pas au format JJ/MM/AAAA` }
  }
  const [, dd, mm, yyyy] = match
  const day = parseInt(dd, 10)
  const month = parseInt(mm, 10)
  const year = parseInt(yyyy, 10)

  if (month < 1 || month > 12) return { iso: null, error: `Mois invalide (${mm}) — attendu 01–12` }
  if (day < 1 || day > 31) return { iso: null, error: `Jour invalide (${dd}) — attendu 01–31` }
  if (year < 1900 || year > 2100) return { iso: null, error: `Année invalide (${yyyy})` }

  // Vérification réelle de la date
  const d = new Date(`${yyyy}-${mm}-${dd}`)
  if (isNaN(d.getTime())) return { iso: null, error: `Date inexistante : ${trimmed}` }

  return { iso: `${yyyy}-${mm}-${dd}`, error: null }
}

/** Vérifie l'email */
function validateEmail(val: string): string | null {
  if (!val || val.trim() === '') return null
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(val.trim())) return `Email invalide : "${val.trim()}"`
  return null
}

/** Vérifie les caractères spéciaux interdits dans les champs texte */
function validateTexte(val: string, champ: string): string | null {
  if (!val || val.trim() === '') return null
  const regex = /[<>@#$%^*{}|\\]/
  if (regex.test(val)) return `${champ} contient des caractères spéciaux interdits`
  return null
}

/** Normalise le sexe : Homme/Femme/H/F/M → M ou F */
function normaliseSexe(val: string): { sexe: 'M' | 'F' | ''; error: string | null } {
  if (!val || val.trim() === '') return { sexe: '', error: null }
  const v = val.trim().toLowerCase()
  if (v === 'homme' || v === 'h' || v === 'm') return { sexe: 'M', error: null }
  if (v === 'femme' || v === 'f') return { sexe: 'F', error: null }
  return { sexe: '', error: `Sexe invalide : "${val.trim()}" — attendu "Homme" ou "Femme"` }
}

/** Normalise une valeur de cellule en string */
function cellStr(row: RawRow, key: string): string {
  const val = row[key]
  if (val === undefined || val === null) return ''
  // Gérer les dates Excel (numéros de série)
  if (typeof val === 'number') {
    // Tenter conversion date Excel
    try {
      const date = XLSX.SSF.parse_date_code(val)
      if (date) {
        const dd = String(date.d).padStart(2, '0')
        const mm = String(date.m).padStart(2, '0')
        const yyyy = String(date.y)
        return `${dd}/${mm}/${yyyy}`
      }
    } catch {
      // ignore
    }
    return String(val)
  }
  return String(val).trim()
}

// ─── Parse + validation d'une ligne ──────────────────────────────────────────

function parseRow(raw: RawRow, index: number): ParsedRow {
  const errors: string[] = []

  const nom = cellStr(raw, 'Nom').toUpperCase()
  const prenom = cellStr(raw, 'Prénom')
  const sexeRaw = cellStr(raw, 'Sexe')
  const dateNaissanceRaw = cellStr(raw, 'Date Naissance')
  const telephone = cellStr(raw, 'Téléphone')
  const telephone_whatsapp = cellStr(raw, 'WhatsApp')
  const email = cellStr(raw, 'Email')
  const profession = cellStr(raw, 'Profession')
  const situation_familiale = cellStr(raw, 'Situation Familiale').toLowerCase()
  const nationalite = cellStr(raw, 'Nationalité') || 'Malagasy'
  const quartier = cellStr(raw, 'Quartier')
  const origine = cellStr(raw, 'Origine')
  const langue = cellStr(raw, 'Langue')
  const datePremierContactRaw = cellStr(raw, 'Date Premier Contact')
  const source_contact = cellStr(raw, 'Source Contact').toLowerCase()
  const notes = cellStr(raw, 'Notes')

  // ── Validations obligatoires ──
  if (!nom) errors.push('Nom obligatoire')
  if (!prenom) errors.push('Prénom obligatoire')
  if (!origine) errors.push('Origine obligatoire')

  // ── Caractères spéciaux ──
  const champs_texte: [string, string][] = [
    [nom, 'Nom'], [prenom, 'Prénom'], [profession, 'Profession'],
    [quartier, 'Quartier'], [nationalite, 'Nationalité'], [notes, 'Notes']
  ]
  for (const [val, champ] of champs_texte) {
    const err = validateTexte(val, champ)
    if (err) errors.push(err)
  }

  // ── Sexe ──
  const { sexe, error: sexeErr } = normaliseSexe(sexeRaw)
  if (sexeErr) errors.push(sexeErr)

  // ── Dates ──
  const { iso: date_naissance, error: dnErr } = parseDate(dateNaissanceRaw)
  if (dnErr) errors.push(`Date naissance : ${dnErr}`)

  const { iso: date_premier_contact, error: dpcErr } = parseDate(datePremierContactRaw)
  if (dpcErr) errors.push(`Date premier contact : ${dpcErr}`)

  // ── Email ──
  const emailErr = validateEmail(email)
  if (emailErr) errors.push(emailErr)

  // ── Téléphone ──
  if (telephone && !/^[\d\s\+\-\(\)\.]+$/.test(telephone)) {
    errors.push(`Téléphone invalide : "${telephone}"`)
  }
  if (telephone_whatsapp && !/^[\d\s\+\-\(\)\.]+$/.test(telephone_whatsapp)) {
    errors.push(`WhatsApp invalide : "${telephone_whatsapp}"`)
  }

  // ── Situation familiale ──
  if (situation_familiale && !SITUATIONS_VALIDES.includes(situation_familiale)) {
    errors.push(`Situation familiale invalide : "${situation_familiale}" — attendu : ${SITUATIONS_VALIDES.join(', ')}`)
  }

  // ── Source contact ──
  if (source_contact && !SOURCES_VALIDES.includes(source_contact)) {
    errors.push(`Source contact invalide : "${source_contact}" — attendu : ${SOURCES_VALIDES.join(', ')}`)
  }

  return {
    index,
    nom,
    prenom,
    sexe,
    date_naissance: date_naissance || '',
    telephone,
    telephone_whatsapp,
    email,
    profession,
    situation_familiale,
    nationalite,
    quartier,
    origine,
    langue,
    date_premier_contact: date_premier_contact || '',
    source_contact,
    notes,
    errors,
    valid: errors.length === 0,
  }
}

// ─── Télécharger le modèle Excel ─────────────────────────────────────────────

function downloadModele() {
  const exemple = [{
    'Nom': 'RAKOTO',
    'Prénom': 'Jean',
    'Sexe': 'Homme',
    'Date Naissance': '15/03/1990',
    'Téléphone': '+261 34 00 000 00',
    'WhatsApp': '+261 34 00 000 00',
    'Email': 'jean.rakoto@email.com',
    'Profession': 'Enseignant',
    'Situation Familiale': 'marie',
    'Nationalité': 'Malagasy',
    'Quartier': 'Antanimena',
    'Origine': '',
    'Langue': '',
    'Date Premier Contact': '01/01/2024',
    'Source Contact': 'culte',
    'Notes': ''
  }]

  const ws = XLSX.utils.json_to_sheet(exemple, { header: COLONNES_MODELE })

  // Style en-têtes
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C })
    if (!ws[addr]) continue
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '6D28D9' } } }
  }

  // Largeurs colonnes
  ws['!cols'] = COLONNES_MODELE.map(() => ({ wch: 20 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Personnes')
  XLSX.writeFile(wb, 'modele_import_personnes.xlsx')
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ImportExcelModal({ isOpen, onClose, onImported, origineOptions, langueOptions }: ImportExcelModalProps) {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  // Étapes : 'upload' | 'preview' | 'confirm' | 'done'
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; skipped: number } | null>(null)

  const validRows = rows.filter(r => r.valid)
  const invalidRows = rows.filter(r => !r.valid)

  // ── Lecture du fichier ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (raw.length === 0) {
          toast.error('Le fichier est vide ou mal formaté')
          return
        }

        const parsed = raw.map((row, i) => parseRow(row, i + 2)) // i+2 = ligne Excel (1 = entête)
        setRows(parsed)
        setStep('preview')
      } catch (err) {
        toast.error('Impossible de lire le fichier Excel')
      }
    }
    reader.readAsArrayBuffer(file)
    // Reset input
    e.target.value = ''
  }

  // ── Import en base ──
  const doImport = async () => {
    setImporting(true)
    let ok = 0
    let skipped = 0

    for (const row of validRows) {
      const { error } = await supabase.from('personnes').insert({
        nom: row.nom,
        prenom: row.prenom,
        sexe: row.sexe || null,
        date_naissance: row.date_naissance || null,
        telephone: row.telephone || null,
        telephone_whatsapp: row.telephone_whatsapp || null,
        email: row.email || null,
        profession: row.profession || null,
        situation_familiale: row.situation_familiale || null,
        nationalite: row.nationalite || 'Malagasy',
        quartier: row.quartier || null,
        origine: row.origine || null,
        langue: row.langue || null,
        date_premier_contact: row.date_premier_contact || null,
        source_contact: row.source_contact || null,
        notes: row.notes || null,
        statut: 'nouveau',
        nombre_enfants: 0,
        de_passage: false,
        actif: true,
        auteur_creation: user?.id,
      })

      if (error) {
        skipped++
      } else {
        ok++
      }
    }

    await logEvent('personnes', 'creer', 'import', `Import Excel : ${ok} personnes importées, ${skipped} échecs`)
    setImportResult({ ok, skipped })
    setImporting(false)
    setStep('done')
    if (ok > 0) {
      toast.success(`${ok} personne${ok > 1 ? 's' : ''} importée${ok > 1 ? 's' : ''} avec succès`)
      onImported()
    }
  }

  // ── Reset ──
  const handleClose = () => {
    setStep('upload')
    setRows([])
    setFileName('')
    setImportResult(null)
    onClose()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Excel — Personnes" size="xl">

      {/* ── ÉTAPE 1 : Upload ── */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Zone de dépôt */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-violet-300 rounded-xl p-10 text-center cursor-pointer hover:border-violet-500 hover:bg-violet-50 transition-colors"
          >
            <FileSpreadsheet size={48} className="mx-auto text-violet-400 mb-3" />
            <p className="text-gray-700 font-medium">Cliquez pour sélectionner un fichier Excel</p>
            <p className="text-gray-400 text-sm mt-1">Formats acceptés : .xlsx, .xls</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>

          {/* Règles de validation */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="font-semibold text-amber-700 text-sm">Règles de validation appliquées</span>
            </div>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li><strong>Nom, Prénom, Origine</strong> : champs obligatoires</li>
              <li><strong>Sexe</strong> : doit être <code className="bg-amber-100 px-1 rounded">Homme</code> ou <code className="bg-amber-100 px-1 rounded">Femme</code></li>
              <li><strong>Dates</strong> : format <code className="bg-amber-100 px-1 rounded">JJ/MM/AAAA</code> obligatoire</li>
              <li><strong>Email</strong> : format valide requis si renseigné</li>
              <li><strong>Téléphone</strong> : chiffres, espaces, +, - uniquement</li>
              <li><strong>Texte</strong> : caractères <code className="bg-amber-100 px-1 rounded">{'< > @ # $ % ^ * { } | \\'}</code> interdits</li>
            </ul>
          </div>

          {/* Télécharger le modèle */}
          <div className="flex justify-between items-center pt-2 border-t">
            <button
              onClick={downloadModele}
              className="flex items-center gap-2 text-violet-700 hover:text-violet-900 text-sm font-medium"
            >
              <Download size={16} /> Télécharger le modèle Excel
            </button>
            <button onClick={handleClose} className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 2 : Prévisualisation ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Résumé */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-green-800 font-semibold">{validRows.length} ligne{validRows.length > 1 ? 's' : ''} valide{validRows.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <XCircle size={18} className="text-red-600" />
              <span className="text-red-800 font-semibold">{invalidRows.length} ligne{invalidRows.length > 1 ? 's' : ''} avec erreur{invalidRows.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
              <FileSpreadsheet size={18} className="text-gray-500" />
              <span className="text-gray-700 text-sm">{fileName}</span>
            </div>
          </div>

          {/* Tableau de prévisualisation */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Ligne</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Nom</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Prénom</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Sexe</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Date Naiss.</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Téléphone</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Email</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Origine</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <tr key={row.index} className={row.valid ? 'bg-white hover:bg-green-50' : 'bg-red-50'}>
                    <td className="px-3 py-2 text-gray-400">{row.index}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.nom || <span className="text-red-400 italic">vide</span>}</td>
                    <td className="px-3 py-2 text-gray-700">{row.prenom || <span className="text-red-400 italic">vide</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{row.sexe === 'M' ? 'Homme' : row.sexe === 'F' ? 'Femme' : <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{row.date_naissance || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{row.telephone || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{row.email || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{row.origine || <span className="text-red-400 italic">vide</span>}</td>
                    <td className="px-3 py-2">
                      {row.valid
                        ? <span className="inline-flex items-center gap-1 text-green-700 font-medium"><CheckCircle size={12} /> Valide</span>
                        : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium"><XCircle size={12} /> Erreur</span>
                            <ul className="mt-1 space-y-0.5">
                              {row.errors.map((e, i) => (
                                <li key={i} className="text-red-500 text-xs">• {e}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-3 border-t">
            <button onClick={() => { setStep('upload'); setRows([]) }} className="btn-secondary">
              ← Changer de fichier
            </button>
            <div className="flex gap-3">
              <button onClick={handleClose} className="btn-secondary">Annuler</button>
              {validRows.length > 0 && (
                <button
                  onClick={() => setStep('confirm')}
                  className="btn-primary flex items-center gap-2"
                >
                  <Upload size={16} />
                  Continuer ({validRows.length} ligne{validRows.length > 1 ? 's' : ''})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : Confirmation finale ── */}
      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
            <h3 className="font-bold text-violet-900 text-lg mb-3 flex items-center gap-2">
              <AlertTriangle size={20} className="text-violet-600" />
              Confirmation avant import
            </h3>
            <p className="text-violet-800 text-sm mb-4">
              Vous êtes sur le point d'importer définitivement les données suivantes dans la base :
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-violet-200 text-center">
                <p className="text-3xl font-bold text-green-600">{validRows.length}</p>
                <p className="text-sm text-gray-600 mt-1">ligne{validRows.length > 1 ? 's' : ''} à importer</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-violet-200 text-center">
                <p className="text-3xl font-bold text-red-500">{invalidRows.length}</p>
                <p className="text-sm text-gray-600 mt-1">ligne{invalidRows.length > 1 ? 's' : ''} ignorée{invalidRows.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Récap lignes valides */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-semibold text-green-700 mb-2">Lignes qui seront importées :</p>
            {validRows.map(r => (
              <div key={r.index} className="text-xs text-green-800 py-0.5 flex gap-2">
                <span className="text-green-500 font-mono">L{r.index}</span>
                <span>{r.prenom} {r.nom}</span>
                <span className="text-green-500">— {r.origine}</span>
              </div>
            ))}
          </div>

          {/* Récap lignes ignorées */}
          {invalidRows.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 mb-2">Lignes ignorées (erreurs) :</p>
              {invalidRows.map(r => (
                <div key={r.index} className="text-xs text-red-700 py-0.5">
                  <span className="font-mono">L{r.index}</span> — {r.nom || '?'} {r.prenom || '?'} : {r.errors.join(' | ')}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t">
            <button onClick={() => setStep('preview')} className="btn-secondary">
              ← Retour à l'aperçu
            </button>
            <div className="flex gap-3">
              <button onClick={handleClose} className="btn-secondary">Annuler</button>
              <button
                onClick={doImport}
                disabled={importing}
                className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {importing
                  ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Importation...</>
                  : <><CheckCircle size={16} /> Confirmer l'import</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 4 : Résultat ── */}
      {step === 'done' && importResult && (
        <div className="space-y-4 text-center py-4">
          <CheckCircle size={56} className="mx-auto text-green-500" />
          <h3 className="text-xl font-bold text-gray-900">Import terminé !</h3>
          <div className="flex justify-center gap-6 my-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600">{importResult.ok}</p>
              <p className="text-sm text-gray-500 mt-1">importée{importResult.ok > 1 ? 's' : ''}</p>
            </div>
            {importResult.skipped > 0 && (
              <div className="text-center">
                <p className="text-4xl font-bold text-red-500">{importResult.skipped}</p>
                <p className="text-sm text-gray-500 mt-1">échec{importResult.skipped > 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-primary mx-auto">
            Fermer
          </button>
        </div>
      )}

    </Modal>
  )
}
