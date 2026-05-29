interface Props { statut: string; size?: 'sm' | 'md' }

const CONFIG: Record<string, { label: string; color: string }> = {
  nouveau: { label: 'Nouveau', color: 'bg-slate-100 text-slate-700' },
  fi: { label: 'FI', color: 'bg-purple-100 text-purple-700' },
  formation: { label: 'Formation', color: 'bg-blue-100 text-blue-700' },
  star: { label: 'STAR', color: 'bg-amber-100 text-amber-700' },
  departement: { label: 'Département', color: 'bg-green-100 text-green-700' },
  libere: { label: 'Libéré', color: 'bg-red-100 text-red-700' },
  inactif: { label: 'Inactif', color: 'bg-slate-100 text-slate-500' },
  inscrit: { label: 'Inscrit', color: 'bg-blue-100 text-blue-700' },
  en_cours: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  termine: { label: 'Terminé', color: 'bg-green-100 text-green-700' },
  abandonne: { label: 'Abandonné', color: 'bg-red-100 text-red-700' },
  en_attente: { label: 'En attente', color: 'bg-slate-100 text-slate-700' },
  terminee: { label: 'Terminée', color: 'bg-green-100 text-green-700' },
  annulee: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
  joignable: { label: 'Joignable', color: 'bg-green-100 text-green-700' },
  non_joignable: { label: 'Non joignable', color: 'bg-red-100 text-red-700' },
  a_rappeler: { label: 'À rappeler', color: 'bg-amber-100 text-amber-700' },
  revient: { label: 'Revient', color: 'bg-green-100 text-green-700' },
  incertain: { label: 'Incertain', color: 'bg-amber-100 text-amber-700' },
  liberation: { label: 'Libération', color: 'bg-red-100 text-red-700' },
  aucune: { label: 'Aucune', color: 'bg-slate-100 text-slate-500' },
}

export default function StatusBadge({ statut, size = 'md' }: Props) {
  const cfg = CONFIG[statut] || { label: statut, color: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`badge ${cfg.color} ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}`}>
      {cfg.label}
    </span>
  )
}
