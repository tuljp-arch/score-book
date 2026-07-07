'use server';

import { redirect } from 'next/navigation';

export async function goToHeadToHead(formData: FormData) {
  const a = String(formData.get('shooterA') ?? '');
  const b = String(formData.get('shooterB') ?? '');

  if (!a || !b) {
    redirect(`/head-to-head?error=${encodeURIComponent('Pick two shooters.')}`);
  }
  if (a === b) {
    redirect(`/head-to-head?error=${encodeURIComponent('Pick two different shooters.')}`);
  }

  redirect(`/head-to-head/${a}/${b}`);
}
