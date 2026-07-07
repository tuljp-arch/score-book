import { createClient } from '@supabase/supabase-js';

// Server-side client for public, read-only data (no auth session / cookies
// involved yet). Once login exists, server components that need the current
// user's session should use @supabase/ssr's createServerClient instead.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
