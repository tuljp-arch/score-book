import { createAuthServerClient } from '@/lib/supabase-auth-server';

// Persistent, sticky nav rendered on every page via the root layout.
// Without it, pages like /profile/[id] and /event/[id] are dead ends —
// fine in a normal browser tab (back button), but the app also runs as a
// standalone PWA (see app/manifest.ts) where there's no browser chrome
// and no back button at all.
export default async function NavBar() {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myShooterId: string | null = null;
  let debugInfo = '';
  if (user) {
    const { data: shooter, error } = await supabase
      .from('shooters')
      .select('shooter_id')
      .eq('user_id', user.id)
      .maybeSingle();
    myShooterId = shooter?.shooter_id ?? null;
    debugInfo = `uid:${user.id} err:${error?.message ?? 'none'}`;
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#262E1E',
        color: '#EDE7D6',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        fontFamily: 'sans-serif',
        fontSize: 14,
        borderBottom: '1px solid rgba(237,231,214,0.15)',
      }}
    >
      <a href="/" style={{ color: '#EDE7D6', fontWeight: 600, textDecoration: 'none' }}>
        The Score Book
      </a>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {myShooterId && (
          <a href={`/profile/${myShooterId}`} style={{ color: '#EDE7D6' }}>
            My Profile
          </a>
        )}
        <a href="/events" style={{ color: '#EDE7D6' }}>
          Events
        </a>
        <a href="/head-to-head" style={{ color: '#EDE7D6' }}>
          Head-to-Head
        </a>
        {myShooterId && (
          <a href="/rivals" style={{ color: '#EDE7D6' }}>
            Rivals
          </a>
        )}
        <a href="/connect" style={{ color: '#EDE7D6' }}>
          Connect
        </a>
        {user ? (
          <span style={{ color: 'rgba(237,231,214,0.6)' }}>{user.email}</span>
        ) : (
          <a href="/login" style={{ color: '#EDE7D6' }}>
            Log in
          </a>
        )}
      </div>
      {user && (
        <div style={{ width: '100%', fontSize: 10, color: 'rgba(237,231,214,0.4)', wordBreak: 'break-all' }}>
          DEBUG (temporary): {debugInfo}
        </div>
      )}
    </nav>
  );
}
