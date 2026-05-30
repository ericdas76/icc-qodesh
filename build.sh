#!/bin/bash
set -e
cd /home/user/webapp

# Charger les variables .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SUPABASE_KEY="${VITE_SUPABASE_ANON_KEY:-}"

echo "SUPABASE_URL: $SUPABASE_URL"

mkdir -p dist/assets
# Copier les assets statiques
cp -f public/favicon.svg dist/ 2>/dev/null || true

# Build avec esbuild — injection des variables d'environnement via --define
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
  --define:import.meta.env.VITE_SUPABASE_URL=\"${SUPABASE_URL}\" \
  --define:import.meta.env.VITE_SUPABASE_ANON_KEY=\"${SUPABASE_KEY}\" \
  --define:import.meta.env.MODE=\"production\" \
  --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true \
  --log-level=info

echo "Build terminé !"
