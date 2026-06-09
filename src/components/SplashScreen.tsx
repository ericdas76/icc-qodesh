import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'visible' | 'out'>('in')

  useEffect(() => {
    // Fade in : 600ms
    const t1 = setTimeout(() => setPhase('visible'), 600)
    // Pause visible : 1800ms
    const t2 = setTimeout(() => setPhase('out'), 2400)
    // Fade out : 600ms puis onFinish
    const t3 = setTimeout(() => onFinish(), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onFinish])

  const opacity =
    phase === 'in' ? 'opacity-0' :
    phase === 'visible' ? 'opacity-100' :
    'opacity-0'

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-600 ${opacity}`}
      style={{ transition: 'opacity 0.6s ease-in-out' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-6">
        <img
          src="/logo-icc.png"
          alt="Logo ICC"
          className="w-40 h-40 object-contain drop-shadow-md"
        />

        {/* Textes */}
        <div className="text-center space-y-1">
          <p className="text-2xl font-bold text-gray-700 tracking-wide">
            ICC Antananarivo
          </p>
          <p className="text-lg font-medium text-purple-600 tracking-widest uppercase">
            App Qodesh
          </p>
        </div>

        {/* Points de chargement animés */}
        <div className="flex items-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
