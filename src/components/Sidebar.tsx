import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, UserPlus, Phone, Users, Home, BookOpen,
  Activity, Settings, History, ChevronRight, X, Cross,
  Star, Droplets, Baby, Package
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
  { to: '/familles-impact', label: "Familles d'Impact", icon: <Home size={18} /> },
  { to: '/formations', label: 'Formation', icon: <BookOpen size={18} /> },
  {
    to: '/activites', label: 'Activités', icon: <Activity size={18} />,
    children: [
      { to: '/activites/adg', label: 'ADG' },
      { to: '/activites/prieres-star', label: 'Prières STAR' },
      { to: '/activites/celebration', label: 'Célébration' },
      { to: '/activites/conges', label: 'Congés' },
      { to: '/activites/rna', label: 'RNA' },
      { to: '/activites/evangelisation', label: 'Évangélisation' },
    ]
  },
  { to: '/membres-star', label: 'STAR', icon: <Star size={18} /> },
  { to: '/baptemes', label: 'Baptêmes', icon: <Droplets size={18} /> },
  { to: '/impact-junior', label: 'Impact Junior', icon: <Baby size={18} /> },
  { to: '/logistique', label: 'Logistique', icon: <Package size={18} /> },
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
    <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #3b0764 0%, #4c1d95 40%, #5b21b6 100%)' }}>

      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-purple-700/50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}>
            <Cross size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-white leading-none">ICC-Qodesh</p>
            <p className="text-xs text-purple-300 mt-0.5">Antananarivo</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-purple-700 text-purple-300">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.adminOnly && role?.nom !== 'admin' && role !== null) return null
          const active = isActive(item.to)

          if (item.children) {
            const anyChildActive = item.children.some(c => location.pathname.startsWith(c.to))
            return (
              <div key={item.to}>
                <div className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-default
                  ${anyChildActive
                    ? 'bg-purple-600/60 text-white'
                    : 'text-purple-200 hover:bg-purple-700/40 hover:text-white'}
                `}>
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight size={14} className={`transition-transform ${anyChildActive ? 'rotate-90' : ''}`} />
                </div>
                <div className="ml-4 border-l border-purple-600/50 pl-3 mt-0.5 mb-1 space-y-0.5">
                  {item.children.map(child => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `block px-3 py-1.5 rounded text-xs transition-colors ${
                          isActive
                            ? 'bg-amber-500 text-white font-semibold'
                            : 'text-purple-300 hover:text-white hover:bg-purple-700/50'
                        }`
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
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
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-purple-200 hover:bg-purple-700/40 hover:text-white'}
              `}
            >
              {item.icon}
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-purple-700/50">
        <div
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-purple-700/40 cursor-pointer transition-colors"
          onClick={signOut}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase text-white"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
            {profil?.prenom?.[0]}{profil?.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{profil?.prenom} {profil?.nom}</p>
            <p className="text-xs text-purple-300 capitalize">{role?.nom || 'Utilisateur'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
