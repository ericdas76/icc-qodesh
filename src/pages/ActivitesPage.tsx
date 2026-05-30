import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import ActivitesADG from './activites/ActivitesADG'
import ActivitesPriereStar from './activites/ActivitesPriereStar'
import ActivitesCelebration from './activites/ActivitesCelebration'
import ActivitesConges from './activites/ActivitesConges'
import ActivitesRNA from './activites/ActivitesRNA'
import ActivitesEvangelisation from './activites/ActivitesEvangelisation'

const TABS = [
  { to: '/activites/adg', label: 'ADG' },
  { to: '/activites/prieres-star', label: 'Prières STAR' },
  { to: '/activites/celebration', label: 'Célébration' },
  { to: '/activites/conges', label: 'Congés' },
  { to: '/activites/rna', label: 'RNA' },
  { to: '/activites/evangelisation', label: 'Évangélisation' },
]

export default function ActivitesPage() {
  const location = useLocation()

  return (
    <div>
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              location.pathname.startsWith(tab.to)
                ? 'bg-blue-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="adg" replace />} />
        <Route path="adg" element={<ActivitesADG />} />
        <Route path="prieres-star" element={<ActivitesPriereStar />} />
        <Route path="celebration" element={<ActivitesCelebration />} />
        <Route path="conges" element={<ActivitesConges />} />
        <Route path="rna" element={<ActivitesRNA />} />
        <Route path="evangelisation" element={<ActivitesEvangelisation />} />
      </Routes>
    </div>
  )
}
