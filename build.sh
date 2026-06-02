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

# Générer index.html dans dist/
cat > dist/index.html << 'HTML'
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ICC-Qodesh — ICC Antananarivo</title>
    <meta name="description" content="Gestion des membres - ICC Antananarivo" />
    <link rel="stylesheet" href="/assets/main.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/main.js"></script>
  </body>
</html>
HTML

# Étape 1 : Compiler Tailwind CSS complet → dist/assets/main.css
echo "Compilation Tailwind CSS..."
node_modules/.bin/tailwindcss \
  -i src/index.css \
  -o dist/assets/main.css \
  --minify
echo "Tailwind OK — $(wc -c < dist/assets/main.css) bytes"

# Étape 2 : Bundle JS avec esbuild — injection des variables d'environnement
# Note: on exclut le CSS de l'import (déjà compilé par tailwind)
node_modules/.bin/esbuild src/main.tsx \
  --bundle \
  --outfile=dist/assets/main.js \
  --format=esm \
  --jsx=automatic \
  --jsx-import-source=react \
  --target=es2020 \
  --loader:.tsx=tsx \
  --loader:.ts=ts \
  --loader:.css=empty \
  --minify \
  --define:process.env.NODE_ENV=\"production\" \
  --define:import.meta.env.VITE_SUPABASE_URL=\"${SUPABASE_URL}\" \
  --define:import.meta.env.VITE_SUPABASE_ANON_KEY=\"${SUPABASE_KEY}\" \
  --define:import.meta.env.MODE=\"production\" \
  --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true \
  --log-level=info

echo "Build terminé !"
