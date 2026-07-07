import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { connectAccount, signOut } from './actions';

export default async function ConnectPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/connect');

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '48px', maxWidth: 480, margin: '0 auto' }}>
      <h1>Connect your NSSA account</h1>
      <p>
        Logged in as {user.email}.{' '}
        <form action={signOut} style={{ display: 'inline' }}>
          <button type="submit" style={{ border: 'none', background: 'none', color: 'blue', cursor: 'pointer', padding: 0 }}>
            Log out
          </button>
        </form>
      </p>
      <p>
        Enter your NSSA member number and we&apos;ll pull in your public shoot history from
        mynssa.nssa-nsca.org — the same pages you can already see on your own record.
      </p>
      {searchParams.error && <p style={{ color: 'crimson' }}>{searchParams.error}</p>}
      <form action={connectAccount}>
        <input
          name="memberId"
          placeholder="e.g. 367202"
          required
          style={{ padding: 8, fontSize: 16, width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ padding: '8px 16px', fontSize: 16 }}>
          Connect
        </button>
      </form>
    </main>
  );
}
