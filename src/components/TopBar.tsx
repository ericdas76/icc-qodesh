import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLocation } from 'react-router-dom'

const TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/integration': 'Intégration',
  '/phoning': 'Phoning',
  '/membres': 'Membres',
  '/familles-impact': "Familles d'Impact",
  '/formations': 'Formation',
  '/activites/adg': 'Activités — ADG',
  '/activites/prieres-star': 'Activités — Prières STAR',
  '/activites/celebration': 'Activités — Célébration',
  '/activites/conges': 'Activités — Congés',
  '/activites/rna': 'Activités — RNA',
  '/activites/evangelisation': 'Activités — Évangélisation',
  '/membres-star': 'STAR',
  '/baptemes': 'Baptêmes',
  '/impact-junior': 'Impact Junior',
  '/logistique': 'Logistique',
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
    <header className="h-14 bg-white border-b border-purple-100 flex items-center px-4 gap-3 shrink-0 shadow-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg hover:bg-purple-50 text-purple-700"
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 flex items-center gap-3">
        <span className="w-1 h-6 rounded-full bg-purple-600 hidden md:block" />
        <h1 className="font-semibold text-purple-900 text-sm md:text-base">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-purple-900 truncate max-w-[140px]">
            {profil?.prenom} {profil?.nom}
          </span>
        </div>
        <button
          onClick={signOut}
          className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 hover:text-purple-700 transition-colors"
          title="Déconnexion"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
