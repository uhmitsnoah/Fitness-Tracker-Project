# Fitness & Nutrition Tracker (No Paywall)

A simple free fitness tracker you can run locally in your browser.

## What it tracks

- Foods, drinks, and snacks
- Calories, protein, carbs, fat
- Daily steps
- Daily weight check-ins
- Bulk progress vs your starting weight
- 14-day trend charts (calories, protein, weight)
- Weekly report comparing last 7 days vs previous 7 days
- Editable food entries
- Auto target calculator using age, sex, height, weight, activity, and bulking surplus
- Live nutrition lookup from a public food database with local fallback suggestions

## Run it

1. Open `/Users/noahrc/Documents/Fitness App/index.html` in your browser.
2. Set your goals (calories, protein, steps, start weight).
3. Log your meals/snacks/drinks and daily check-ins.

When adding food, use **Lookup (Live)** to fetch nutrition data online. If no strong online match is found,
the app falls back to local built-in matches.

## Auto-calculate bulking targets

1. Fill out **Body Profile + Auto Targets**.
2. Click **Calculate Targets** to get recommended calories, protein, carbs, fat, and steps.
3. Click **Apply To Goals** to auto-fill and save your daily goals.

Data is saved to your browser with `localStorage`, so there are no accounts, subscriptions, or paywalls.

## Mobile home-screen install (PWA)

To get install + offline support, serve the folder over HTTP/HTTPS (not just `file://`):

```bash
cd "/Users/noahrc/Documents/Fitness App"
python3 -m http.server 4173
```

Then open `http://localhost:4173` in your mobile or desktop browser.

- Android Chrome: tap install prompt or browser menu -> Install app.
- iPhone Safari: Share -> Add to Home Screen.

## Netlify deploy hardening

This project includes:

- `_redirects` to route all paths to `index.html`
- `_headers` to reduce stale-cache issues for `sw.js`, `app.js`, `index.html`, and `manifest.webmanifest`

When you redeploy to Netlify, these files are automatically applied.

## Cross-device sync (Supabase)

1. Create a Supabase project.
2. In SQL Editor, run:

```sql
create table if not exists public.sync_profiles (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.sync_profiles enable row level security;

drop policy if exists "sync_select_all" on public.sync_profiles;
drop policy if exists "sync_insert_all" on public.sync_profiles;
drop policy if exists "sync_update_all" on public.sync_profiles;

create policy "sync_select_all" on public.sync_profiles
for select to anon using (true);

create policy "sync_insert_all" on public.sync_profiles
for insert to anon with check (true);

create policy "sync_update_all" on public.sync_profiles
for update to anon using (true) with check (true);
```

3. In the app, open **Cross-Device Sync** and enter:
   - Supabase project URL
   - Supabase anon key
   - Sync ID (same value on all your devices)
4. Click **Save Sync Setup**.
5. Click **Push Now** on your source device, then **Pull Now** on another device.

Use a hard-to-guess Sync ID because this simple policy set is broad for quick setup.
# Fitness-Tracker-Project
