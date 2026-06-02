import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  total: number
  page: number
  pageSize?: number
  onPage: (p: number) => void
}

export default function Pagination({ total, page, pageSize = 25, onPage }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
      acc.push(p)
      return acc
    }, [])

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-purple-100 bg-purple-50/50 text-sm text-purple-700">
      <span className="text-xs text-purple-500">
        {from}–{to} sur <span className="font-semibold text-purple-700">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed text-purple-600 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-purple-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                p === page
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'hover:bg-purple-100 text-purple-600'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed text-purple-600 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
