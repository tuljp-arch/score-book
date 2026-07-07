# The Score Book — Starter Scaffold

This is a real, minimal Next.js + Supabase project — not a mockup. It's intentionally bare: a home page, one dynamic profile route, a Supabase client, and the full schema as runnable SQL. Claude Code's first session should be able to open this folder and get straight to work instead of scaffolding from zero.

## What you need to do yourself, before Claude Code's first session

I can't create third-party accounts on your behalf, so these four things need to happen first:

1. **Create a free Supabase project** at supabase.com. Once it's created, go to the SQL Editor and run `supabase/schema.sql`, then `supabase/seed.sql` (in that order) to get real 2026 season data into the database from the start.
2. **Grab your API credentials** from Project Settings → API in the Supabase dashboard (the Project URL and the `anon` public key). Copy `.env.example` to `.env.local` and paste them in.
3. **Create a GitHub repo** for this project (empty is fine) and push this folder to it — makes it much easier for Claude Code to track changes and for you to deploy later.
4. **Install Claude Code** (desktop app or CLI — desktop is simpler to start with) and open this folder as the project.

## What to tell Claude Code in the first session

Point it at `CLAUDE_CODE_PROJECT_BRIEF.md` first — that has the full build order, the design system rules, and the reasoning behind the schema. Then the concrete first task:

> "Get the profile page at /profile/[shooterId] rendering real data for Jeffrey Tulman (shooter_id `10000000-0000-0000-0000-000000000001` in the seed data), matching the layout in score_book_profile_mockup.html — medals row, gun cabinet, trophy shelf, trend chart."

That's the whole first milestone. Resist letting it wander into Challenges or Casual Rounds before that page works end-to-end with real data.

## What's in this folder

```
app/
  layout.tsx           — root layout
  page.tsx              — placeholder home page
  profile/[shooterId]/page.tsx   — the real first milestone; currently bare-bones, needs the mockup's design applied
lib/
  supabase.ts           — Supabase client setup
supabase/
  schema.sql             — full Phase 1 + Phase 2 schema, runnable as-is
  seed.sql               — real, verified 2026 season data (Jeff, Brett, 5 events)
.env.example             — copy to .env.local and fill in
package.json
```

## Deploying, once it's working locally

Push to GitHub, then connect the repo at vercel.com — Vercel auto-detects Next.js and deploys on every push. Add the same two environment variables from `.env.local` in Vercel's project settings before the first deploy.
