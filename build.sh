#!/bin/bash
set -e
cd /home/user/webapp
mkdir -p dist/assets
# Copier les assets statiques
cp -f public/favicon.svg dist/ 2>/dev/null || true
# Build avec esbuild — rapide et léger
node_modules/.bin/esbuild src/main.tsx \
  --bundle \
  --outfile=dist/assets/main.js \
  --format=esm \
  --jsx=automatic \
  --jsx-import-source=react \
  --target=es2020 \
  --loader:.tsx=tsx \
  --loader:.ts=ts \
  --loader:.css=css \
  --minify=false \
  --define:process.env.NODE_ENV=\"production\" \
  --log-level=info
# Copier index.html
cp -f dist/index.html dist/index.html 2>/dev/null || true
echo "Build terminé !"
