# Tech Track

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
| Code judge | Self-hosted [Piston](https://github.com/engineer-man/piston) on Oracle Cloud VM |
| Hosting — app | Vercel (auto-deploy from GitHub) |
| Hosting — judge | Oracle Cloud "Always Free" VM (Ampere A1, 2 OCPU / 12GB RAM) |

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
│   ├── piston/               # Code judge client (server-only)
│   └── validation/           # Shared validators (domain check, etc.)
├── components/               # Shared UI components (built per phase)
├── types/                    # TypeScript types mirroring the DB schema
├── infrastructure/           # Docker Compose + Caddy for the Piston VM
├── scripts/                  # Utility scripts (Piston health check, etc.)
├── Assets/                   # Logos (IEI, Chitkara University)
└── docs/                     # Product, technical, and design documentation
```

---

## Manual Setup Guide

These steps must be done by a human with access to the relevant accounts. Do them in order.

### 1. Create the Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**. Choose any name (e.g., `tech-track`) and region.
3. Once created, go to **Settings → API** and copy:
   - **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
   - **anon / public** key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → paste as `SUPABASE_SERVICE_ROLE_KEY`

   > ⚠️ The `service_role` key bypasses Row-Level Security. It must **never** appear in client-side code or be committed to Git.

4. Go to **Authentication → Providers → Google** and enable it (you'll need the Google OAuth credentials from step 2 below).

### 2. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or reuse one) — e.g., `Tech Track`.
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

### 3. Connect the Repo to Vercel

1. Push this repo to GitHub (private recommended).
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **Import Project** and select the `TECH-TRACK-Antigravity` repo.
4. Framework preset: **Next.js** (should auto-detect).
5. Add the environment variables from `.env.local` to Vercel's project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_HD_DOMAIN`
   - `PISTON_API_URL` (once the VM is provisioned in step 4)
   - `PISTON_SHARED_SECRET` (same value as on the VM)
6. Deploy. The hello-world page at `/` should render with the "TECH TRACK" heading and a "Phase 0 — deployment verified" footer.

### 4. Provision the Oracle Cloud VM + Piston

1. Log in to [Oracle Cloud](https://cloud.oracle.com/).
2. Create a **Compute Instance**:
   - Shape: **VM.Standard.A1.Flex** (Ampere — Always Free eligible)
   - OCPUs: **2**, Memory: **12 GB**
   - OS: **Ubuntu 22.04** (or latest LTS)
   - Make sure SSH access is configured.

3. SSH into the VM and install Docker:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
   sudo usermod -aG docker $USER
   # Log out and back in for the group change to take effect
   ```

4. Copy the `infrastructure/` directory to the VM:
   ```bash
   scp -r infrastructure/ user@<vm-ip>:~/tech-track-infra/
   ```

5. On the VM, set up the shared secret:
   ```bash
   cd ~/tech-track-infra
   cp .env.example .env
   # Edit .env and set a strong random secret:
   # PISTON_SHARED_SECRET=<generate with: openssl rand -hex 32>
   ```

6. Start the services:
   ```bash
   docker compose up -d
   ```

7. Install the required language runtimes:
   ```bash
   docker compose exec piston /bin/sh -c "piston ppman install python"
   docker compose exec piston /bin/sh -c "piston ppman install gcc"
   docker compose exec piston /bin/sh -c "piston ppman install g++"
   ```

8. Quick smoke test from the VM itself:
   ```bash
   # Should return 403 (no secret)
   curl -s -o /dev/null -w "%{http_code}" http://localhost:2001/api/v2/runtimes

   # Should return 200 with a JSON array (with secret)
   curl -H "X-Piston-Secret: YOUR_SECRET" http://localhost:2001/api/v2/runtimes
   ```

9. **Open firewall port 2001** in Oracle Cloud's security list (VCN → Security Lists → add an ingress rule for TCP port 2001). Restrict the source to Vercel's IP ranges if possible, or open to `0.0.0.0/0` for now.

10. Back in your local `.env.local`, set:
    ```
    PISTON_API_URL=http://<vm-public-ip>:2001
    PISTON_SHARED_SECRET=<same secret you set in step 5>
    ```

### 5. Run the Verification Script

Once steps 1–4 are done, run the Phase 0 verification:

```bash
npm run test:piston
```

This checks:
- ✓ The proxy rejects requests without the secret (403)
- ✓ Piston is reachable with the secret (200)
- ✓ Python, C, and C++ runtimes are installed

All three must pass before Phase 0 is complete.

---

## Development

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Run the Piston health check
npm run test:piston
```

---

## Documentation

All design and technical decisions are documented in `/docs`:

| Document | Purpose |
|---|---|
| `Tech_Track_PRD.md` | What we're building and why |
| `Tech_Track_TRD.md` | Tech stack and architecture |
| `Tech_Track_Backend_Schema.md` | Authoritative database schema (supersedes TRD Section 3) |
| `Tech_Track_App_Flow.md` | Every screen and transition, by role |
| `Tech_Track_UIUX_Design_Brief.md` | Visual identity and animation system |
| `Tech_Track_Implementation_Plan.md` | Phase-by-phase build order |

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon key (respects RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase admin key (bypasses RLS) |
| `GOOGLE_HD_DOMAIN` | Server only | `chitkara.edu.in` — OAuth domain hint |
| `PISTON_API_URL` | Server only | URL of the self-hosted Piston instance |
| `PISTON_SHARED_SECRET` | Server only | Auth header between Vercel and the judge VM |
