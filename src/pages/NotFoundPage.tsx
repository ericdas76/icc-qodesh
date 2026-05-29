import { Link } from 'react-router-dom'
import { Home, AlertTriangle } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={36} className="text-slate-400" />
        </div>
        <h1 className="text-6xl font-bold text-slate-200 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 mb-1">Page introuvable</h2>
        <p className="text-slate-500 mb-6">La page que vous recherchez n'existe pas.</p>
        <Link to="/" className="btn-primary inline-flex">
          <Home size={16} /> Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
