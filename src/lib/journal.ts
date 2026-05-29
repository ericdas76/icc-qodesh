import { supabase } from './supabase'

export async function logEvent(
  module: string,
  action: string,
  description: string,
  entiteId?: string,
  anciennesValeurs?: Record<string, unknown>,
  nouvellesValeurs?: Record<string, unknown>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('journal_evenements').insert({
      auteur_id: user?.id || null,
      module,
      action,
      entite_id: entiteId || null,
      description,
      anciennes_valeurs: anciennesValeurs || null,
      nouvelles_valeurs: nouvellesValeurs || null
    })
  } catch {
    // Silently fail — journaling must never block the main action
    console.warn('Journaling failed silently')
  }
}
