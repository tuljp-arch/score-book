'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import ui from '@/components/ui.module.css';

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
    return <p className={ui.helpText}>Check {email} for a magic link — click it to finish logging in.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className={ui.helpText}>Enter your email and we&apos;ll send you a magic link — no password needed.</p>
      <label className={ui.label} htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className={ui.input}
      />
      <button type="submit" disabled={status === 'sending'} className={ui.button}>
        {status === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {error && <p className={ui.error}>{error}</p>}
    </form>
  );
}
