const express = require('express')
const compression = require('compression')
const path = require('path')
const fs = require('fs')

const app = express()
const PORT = process.env.PORT || 3000
const DIST = path.join(__dirname, 'dist')

// Gzip sur tous les fichiers
app.use(compression({ level: 6 }))

// Cache long sur les assets versionnés
app.use('/assets', express.static(path.join(DIST, 'assets'), {
  maxAge: '1y',
  immutable: true
}))

// Autres fichiers statiques (favicon, etc.)
app.use(express.static(DIST, { maxAge: '1h' }))

// SPA fallback : toutes les routes inconnues → index.html
app.use((req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ICC-Qodesh running on http://0.0.0.0:${PORT}`)
})
