import { createClient } from './supabase/client'

// Browser client singleton for backward compatibility
export const supabase = createClient()
