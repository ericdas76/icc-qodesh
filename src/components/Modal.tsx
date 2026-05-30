import { X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  open?: boolean
  isOpen?: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Modal({ open, isOpen, onClose, title, children, size = 'md' }: Props) {
  const visible = open || isOpen || false

  useEffect(() => {
    if (visible) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [visible])

  if (!visible) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full ${sizeClass} bg-white rounded-xl shadow-xl max-h-[80vh] flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">{children}</div>
      </div>
    </div>
  )
}
