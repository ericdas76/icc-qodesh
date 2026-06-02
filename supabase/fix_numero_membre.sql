-- Script one-shot : attribution des numéros membres manquants
-- Format : ICC-YYYY-NNN basé sur l'année de created_at

DO $$
DECLARE
  rec RECORD;
  annee INT;
  seq INT;
  nouveau_numero TEXT;
BEGIN
  FOR rec IN
    SELECT id, created_at
    FROM membres
    WHERE actif = true
      AND (numero_membre IS NULL OR numero_membre = '')
    ORDER BY created_at ASC
  LOOP
    annee := EXTRACT(YEAR FROM rec.created_at);

    -- Compter les numéros déjà attribués pour cette année
    SELECT COUNT(*) INTO seq
    FROM membres
    WHERE numero_membre LIKE 'ICC-' || annee || '-%';

    nouveau_numero := 'ICC-' || annee || '-' || LPAD((seq + 1)::TEXT, 3, '0');

    UPDATE membres SET numero_membre = nouveau_numero WHERE id = rec.id;

    RAISE NOTICE 'Membre % → %', rec.id, nouveau_numero;
  END LOOP;
END;
$$;
