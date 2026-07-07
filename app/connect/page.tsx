import { connectAccount } from './actions';

export default function ConnectPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '48px', maxWidth: 480, margin: '0 auto' }}>
      <h1>Connect your NSSA account</h1>
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
