# Tech Trek

A live, campus-wide technical treasure hunt platform for the **IEI Club** at **Chitkara University**.

Teams solve riddles → travel to physical locations → enter a unique secret code → unlock and solve a coding challenge in the browser → earn points. ~10 rounds, real-time leaderboard, full admin panel.

**Event date:** September 21, 2026  
**Build deadline:** August 31, 2026

---

## Tech Stack (locked)

| Layer | Tech |
|---|---|
| Frontend + backend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | Google OAuth via Supabase Auth (`chitkara.edu.in` domain restriction) |
| Database + realtime | Supabase (Postgres) |
| Code judge | Judge0 CE via RapidAPI (C, C++, Python, Java) |
| Hosting — app | Vercel (auto-deploy from GitHub) |
| Judge hosting | None needed — Judge0 runs on RapidAPI's infrastructure |

---

## Project Structure

```
├── app/
│   ├── (auth)/login/         # Google OAuth sign-in
│   ├── (dashboard)/          # Participant screens
│   │   ├── dashboard/        # Registration locking, team status
│   │   └── event/            # Live gameplay (riddles, code editor)
│   ├── (admin)/admin/        # Admin panel (content, controls, audit log)
│   └── api/                  # Route handlers (all backend logic)
│       └── health/           # Keep-alive health endpoint
├── lib/
│   ├── supabase/             # Client, server, and middleware helpers
│   ├── judge0/               # Judge0 API client wrapper (server-only)
│   └── validation/           # Shared validators (domain check, etc.)
├── components/               # Shared UI components (built per phase)
├── types/                    # TypeScript types mirroring the DB schema
├── scripts/                  # Utility scripts (Judge0 verification, etc.)
├── Assets/                   # Logos (IEI, Chitkara University)
└── docs/                     # Product, technical, and design documentation
```

---

## Manual Setup Guide

These steps must be done by a human with access to the relevant accounts. Do them in order.

### 1. Create the Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**. Choose any name (e.g., `tech-trek`) and region.
3. Once created, go to **Settings → API** and copy:
   - **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
   - **anon / public** key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → paste as `SUPABASE_SERVICE_ROLE_KEY`

   > ⚠️ The `service_role` key bypasses Row-Level Security. It must **never** appear in client-side code or be committed to Git.

4. Go to **Authentication → Providers → Google** and enable it (you'll need the Google OAuth credentials from step 2 below).

### 2. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or reuse one) — e.g., `Tech Trek`.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized redirect URIs**: add your Supabase callback URL:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
6. Copy the **Client ID** and **Client Secret**.
7. Back in Supabase (**Authentication → Providers → Google**):
   - Paste the Client ID and Client Secret.
   - No other configuration needed here — the domain hint (`hd=chitkara.edu.in`) is applied in the app code, not in the provider settings.

8. In your `.env.local`, set:
   ```
   GOOGLE_HD_DOMAIN=chitkara.edu.in
   ```

### 3. Sign Up for Judge0 CE on RapidAPI

1. Go to [rapidapi.com](https://rapidapi.com) and create an account (no credit card required).
2. Search for **Judge0 CE** and subscribe to the **Basic** (free) plan.
3. On the API's page, copy your **X-RapidAPI-Key** from the code snippets panel.
4. In your `.env.local`, set:
   ```
   JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
   JUDGE0_API_KEY=your-rapidapi-key-here
   ```

### 4. Connect the Repo to Vercel

1. Push this repo to GitHub (private recommended).
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **Import Project** and select the repo.
4. Framework preset: **Next.js** (should auto-detect).
5. Add the environment variables from `.env.local` to Vercel's project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_HD_DOMAIN`
   - `JUDGE0_API_URL`
   - `JUDGE0_API_KEY`
6. Deploy. The hello-world page at `/` should render with the "TECH TREK" heading.

### 5. Run the Verification Script

Once steps 1–4 are done, run the Phase 0 verification:

```bash
npm run test:judge0
```

This checks:
- ✓ RapidAPI key is accepted
- ✓ A Python "hello world" submission returns `Accepted` (status 3)
- ✓ stdout matches the expected output

All three must pass before Phase 0 is complete.

---

## Development

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Run the Judge0 verification
npm run test:judge0
```

---

## Documentation

All design and technical decisions are documented in `/docs`:

| Document | Purpose |
|---|---|
| `Tech_Trek_PRD.md` | What we're building and why |
| `Tech_Trek_TRD.md` | Tech stack and architecture |
| `Tech_Trek_Backend_Schema.md` | Authoritative database schema (supersedes TRD Section 3) |
| `Tech_Trek_App_Flow.md` | Every screen and transition, by role |
| `Tech_Trek_UIUX_Design_Brief.md` | Visual identity and animation system |
| `Tech_Trek_Implementation_Plan.md` | Phase-by-phase build order |

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon key (respects RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase admin key (bypasses RLS) |
| `GOOGLE_HD_DOMAIN` | Server only | `chitkara.edu.in` — OAuth domain hint |
| `JUDGE0_API_URL` | Server only | Judge0 CE RapidAPI endpoint |
| `JUDGE0_API_KEY` | Server only | RapidAPI key (sent as `X-RapidAPI-Key`) |
