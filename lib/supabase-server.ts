import { createClient } from '@supabase/supabase-js';

// Server-side client for public, read-only data (no auth session / cookies
// involved yet). Once login exists, server components that need the current
// user's session should use @supabase/ssr's createServerClient instead.
//
// Next.js patches the global `fetch` in Server Components and caches
// requests by default — supabase-js's reads were getting served from that
// cache even on routes marked `force-dynamic`, so profile pages kept
// showing results from before a re-import. Passing `cache: 'no-store'`
// explicitly on every request bypasses that regardless of route config.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  );
}
