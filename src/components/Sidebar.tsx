import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, UserPlus, Phone, Users, Home, BookOpen,
  Activity, Settings, History, ChevronRight, X, Cross
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  children?: { to: string; label: string }[]
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={18} /> },
  { to: '/integration', label: 'Intégration', icon: <UserPlus size={18} /> },
  { to: '/phoning', label: 'Phoning', icon: <Phone size={18} /> },
  { to: '/membres', label: 'Membres', icon: <Users size={18} /> },
  { to: '/familles-impact', label: 'Familles d\'Impact', icon: <Home size={18} /> },
  { to: '/formations', label: 'Formation', icon: <BookOpen size={18} /> },
  {
    to: '/activites', label: 'Activités', icon: <Activity size={18} />,
    children: [
      { to: '/activites/adg', label: 'ADG' },
      { to: '/activites/prieres-star', label: 'Prières STAR' },
      { to: '/activites/celebration', label: 'Célébration' },
      { to: '/activites/conges', label: 'Congés' },
      { to: '/activites/rna', label: 'RNA' },
    ]
  },
  { to: '/historique', label: 'Historique', icon: <History size={18} /> },
  { to: '/administration', label: 'Administration', icon: <Settings size={18} />, adminOnly: true },
]

interface Props {
  onClose: () => void
}

export default function Sidebar({ onClose }: Props) {
  const { profil, role, signOut } = useAuth()
  const location = useLocation()

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <div className="h-full bg-slate-900 text-slate-100 flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Cross size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none">ICC-Qodesh</p>
            <p className="text-xs text-slate-400 mt-0.5">Antananarivo</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-slate-700">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map((item) => {
          // Visible si : pas adminOnly, OU rôle admin, OU aucun rôle configuré
          if (item.adminOnly && role?.nom !== 'admin' && role !== null) return null
          const active = isActive(item.to)

          if (item.children) {
            const anyChildActive = item.children.some(c => location.pathname.startsWith(c.to))
            return (
              <div key={item.to}>
                <div className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5
                  ${anyChildActive ? 'bg-slate-700 text-white' : 'text-slate-300'}
                `}>
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight size={14} className={anyChildActive ? 'rotate-90' : ''} />
                </div>
                {(anyChildActive || true) && (
                  <div className="ml-4 border-l border-slate-700 pl-3 mb-1">
                    {item.children.map(child => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={onClose}
                        className={({ isActive }) => `
                          block px-3 py-1.5 rounded text-xs mb-0.5
                          ${isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                        `}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors
                ${active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}
              `}
            >
              {item.icon}
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 cursor-pointer" onClick={signOut}>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold uppercase">
            {profil?.prenom?.[0]}{profil?.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profil?.prenom} {profil?.nom}</p>
            <p className="text-xs text-slate-400 capitalize">{role?.nom || 'Utilisateur'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
