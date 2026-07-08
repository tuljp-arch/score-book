'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  if (status === 'sent') {
    return <p>Check {email} for a magic link — click it to finish logging in.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>Enter your email and we&apos;ll send you a magic link — no password needed.</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        style={{ padding: 8, fontSize: 16, width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
      />
      <button type="submit" disabled={status === 'sending'} style={{ padding: '8px 16px', fontSize: 16 }}>
        {status === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </form>
  );
}
