import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Cross, Eye, EyeOff, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Veuillez remplir tous les champs')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      toast.error('Email ou mot de passe incorrect')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Cross size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ICC-Qodesh</h1>
          <p className="text-blue-300 text-sm mt-1">ICC Antananarivo</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Connexion</h2>
          <p className="text-sm text-slate-500 mb-5">Bienvenue. Entrez vos identifiants.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Adresse email</label>
              <input
                type="email"
                className="input"
                placeholder="prenom.nom@icc-antananarivo.mg"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPwd(!showPwd)}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader size={16} className="animate-spin" />}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          ICC-Qodesh v1.0 — Gestion des membres
        </p>
      </div>
    </div>
  )
}
