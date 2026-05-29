import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PersonnesPage from './pages/PersonnesPage'
import PersonneFichePage from './pages/PersonneFichePage'
import PersonneFormPage from './pages/PersonneFormPage'
import PhoningPage from './pages/PhoningPage'
import MembresPage from './pages/MembresPage'
import MembreFichePage from './pages/MembreFichePage'
import FamillesImpactPage from './pages/FamillesImpactPage'
import FamilleImpactFichePage from './pages/FamilleImpactFichePage'
import FormationsPage from './pages/FormationsPage'
import FormationFichePage from './pages/FormationFichePage'
import ActivitesPage from './pages/ActivitesPage'
import AdministrationPage from './pages/AdministrationPage'
import HistoriquePage from './pages/HistoriquePage'
import NotFoundPage from './pages/NotFoundPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Chargement…</p>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/connexion" replace />
  return <>{children}</>
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">ICC-Qodesh</p>
      </div>
    </div>
  )

  return (
    <Routes>
      <Route path="/connexion" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="integration" element={<PersonnesPage />} />
        <Route path="integration/nouveau" element={<PersonneFormPage />} />
        <Route path="integration/:id" element={<PersonneFichePage />} />
        <Route path="integration/:id/modifier" element={<PersonneFormPage />} />
        <Route path="phoning" element={<PhoningPage />} />
        <Route path="membres" element={<MembresPage />} />
        <Route path="membres/:id" element={<MembreFichePage />} />
        <Route path="familles-impact" element={<FamillesImpactPage />} />
        <Route path="familles-impact/:id" element={<FamilleImpactFichePage />} />
        <Route path="formations" element={<FormationsPage />} />
        <Route path="formations/:id" element={<FormationFichePage />} />
        <Route path="activites/*" element={<ActivitesPage />} />
        <Route path="administration" element={<AdministrationPage />} />
        <Route path="historique" element={<HistoriquePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
