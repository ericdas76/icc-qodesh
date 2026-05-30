import * as XLSX from 'xlsx'

export interface ExportColumn {
  header: string
  key: string
  width?: number
}

function getVal(obj: Record<string, unknown>, key: string): string {
  const val = key.split('.').reduce((acc: unknown, k) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[k]
    return undefined
  }, obj as unknown)
  if (val === null || val === undefined) return ''
  if (typeof val === 'boolean') return val ? 'Oui' : 'Non'
  return String(val)
}

export function exportPDF(
  titre: string,
  colonnes: ExportColumn[],
  donnees: Record<string, unknown>[],
  sousTitre?: string
) {
  const now = new Date().toLocaleString('fr-FR')
  const rows = donnees.map(row =>
    `<tr>${colonnes.map(c => `<td>${getVal(row, c.key)}</td>`).join('')}</tr>`
  ).join('')

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${titre}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px}
.hd{background:#1e3a8a;color:#fff;padding:10px 16px;margin-bottom:10px}
.hd h1{font-size:15px}.hd p{font-size:9px;opacity:.8;margin-top:2px}
.meta{padding:0 16px 6px;font-size:9px;color:#64748b;display:flex;justify-content:space-between}
table{width:calc(100% - 32px);margin:0 16px;border-collapse:collapse}
thead tr{background:#1e3a8a;color:#fff}thead th{padding:5px 7px;text-align:left;font-size:10px}
tbody tr:nth-child(even){background:#f1f5f9}tbody td{padding:4px 7px;border-bottom:1px solid #e2e8f0}
.ft{text-align:center;margin-top:10px;font-size:8px;color:#94a3b8}
@media print{@page{margin:8mm;size:A4 landscape}}</style></head>
<body>
<div class="hd"><h1>ICC-QODESH — ${titre}</h1>${sousTitre ? `<p>${sousTitre}</p>` : ''}</div>
<div class="meta"><span>${donnees.length} ligne(s)</span><span>Exporté le ${now}</span></div>
<table><thead><tr>${colonnes.map(c => `<th>${c.header}</th>`).join('')}</tr></thead>
<tbody>${rows}</tbody></table>
<div class="ft">ICC-Qodesh — ${now}</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (w) w.onafterprint = () => { w.close(); URL.revokeObjectURL(url) }
}

export function exportExcel(
  titre: string,
  colonnes: ExportColumn[],
  donnees: Record<string, unknown>[],
  nomFeuille?: string
) {
  const data = donnees.map(row =>
    colonnes.reduce((acc, c) => {
      acc[c.header] = getVal(row, c.key)
      return acc
    }, {} as Record<string, string>)
  )
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = colonnes.map(c => ({ wch: c.width || 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nomFeuille || titre.slice(0, 31))
  XLSX.writeFile(wb, `${titre.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
