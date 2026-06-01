import { Menu, Bell, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLocation } from 'react-router-dom'

const TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/integration': 'Intégration',
  '/phoning': 'Phoning',
  '/membres': 'Membres',
  '/familles-impact': 'Familles d\'Impact',
  '/formations': 'Formation',
  '/activites/adg': 'Activités — ADG',
  '/activites/prieres-star': 'Activités — Prières STAR',
  '/activites/celebration': 'Activités — Célébration',
  '/activites/conges': 'Activités — Congés',
  '/activites/rna': 'Activités — RNA',
  '/historique': 'Historique',
  '/administration': 'Administration',
}

interface Props { onMenuClick: () => void }

export default function TopBar({ onMenuClick }: Props) {
  const { profil, signOut } = useAuth()
  const location = useLocation()

  const title = Object.entries(TITLES).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1] || 'ICC-Qodesh'

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100"
      >
        <Menu size={20} />
      </button>
      <h1 className="font-semibold text-slate-800 flex-1 text-sm md:text-base">{title}</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 truncate max-w-[140px]">
          {profil?.prenom} {profil?.nom}
        </span>
        <button
          onClick={signOut}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          title="Déconnexion"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
