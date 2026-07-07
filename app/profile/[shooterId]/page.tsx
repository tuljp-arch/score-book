import { createClient } from '@/lib/supabase';

// This is the target for the first Claude Code milestone: fetch one real
// shooter's row (and their results) from Supabase and render it here.
// See score_book_profile_mockup.html for the intended visual design —
// this file is functional scaffolding, not the final page.

export default async function ProfilePage({ params }: { params: { shooterId: string } }) {
  const supabase = createClient();

  const { data: shooter, error } = await supabase
    .from('shooters')
    .select('*')
    .eq('shooter_id', params.shooterId)
    .single();

  if (error || !shooter) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: '48px' }}>
        <p>No shooter found for id {params.shooterId}. Seed the database first — see /supabase/schema.sql and seed_data_v2/.</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '48px' }}>
      <h1>{shooter.full_name}</h1>
      <p>NSSA #{shooter.nssa_nsca_number}</p>
      {/* Replace this whole page with the design in score_book_profile_mockup.html
          once real data is flowing — medals row, gun cabinet, trend chart, etc. */}
    </main>
  );
}
