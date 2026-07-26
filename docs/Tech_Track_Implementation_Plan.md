# Tech Track — Implementation Plan

| | |
|---|---|
| **Companion to** | PRD, TRD, App Flow, UI/UX Brief, Backend Schema (all v1.0) |
| **For** | An agentic coding tool (Cursor / Google Antigravity) working from `Tech_Track_Agent_Prompt.md` |
| **Version** | 1.0 |

This plan sequences the actual build. It doesn't repeat what's already specified elsewhere — each task points at the document that has the real detail. Work top to bottom; don't start a phase until the previous one's verification step passes.

---

## Phase 0 — Project Setup

- [ ] Initialize Next.js 14 (App Router) + TypeScript + Tailwind, matching the folder layout in `TRD.md` Section 11.
- [ ] Create the Supabase project; store keys per `TRD.md` Section 7 in `.env.local`.
- [ ] Create Google OAuth credentials; configure the `hd=chitkara.edu.in` hint per `TRD.md` Section 2.
- [ ] Connect the repo to Vercel; confirm a bare "hello world" page deploys successfully.
- [ ] Sign up for RapidAPI (no card required) and subscribe to Judge0 CE's free Basic plan; store the API key as `JUDGE0_API_KEY` (`TRD.md` Section 1 and 5).
- [ ] **Verify:** a local script can submit a trivial "hello world" snippet to Judge0 via RapidAPI using the API key and get a correct result back, and gets a clear auth error without the key.

## Phase 1 — Database

- [ ] Run the full table DDL from `Backend_Schema.md` Section 2.
- [ ] Run the functions and triggers from Section 3.
- [ ] Run the RLS policies from Section 4. Confirm RLS is enabled on every table listed.
- [ ] Run the views from Section 5 and the indexes from Section 6.
- [ ] Seed placeholder checkpoints, riddles, and questions for local development (real content comes later, from Admin).
- [ ] **Verify:** using two test accounts, confirm account A cannot read account B's unit data, and a non-`chitkara.edu.in` email cannot be inserted via `auth.users` at all.

## Phase 2 — Auth & Onboarding

- [ ] Build the landing page shell (functional first — full visual treatment comes in Phase 6).
- [ ] Wire up Supabase Auth's Google provider with the domain hint.
- [ ] Add the server-side domain re-check as a backstop, per `TRD.md` Section 2.
- [ ] Build the profile-completion form (mobile number, roll no., branch, semester); gate the dashboard behind `profile_completed = true`.
- [ ] **Verify:** a non-Chitkara Google account is rejected before reaching profile completion; a Chitkara account reaches it and, on submission, lands on the dashboard.

## Phase 3 — Registration Locking

- [ ] Build the dashboard shell — Lock Registration panel (active) and Tech Track Event panel (visibly locked).
- [ ] Build the solo lock flow and its confirmation step.
- [ ] Build the team creation form (name, Member 1 required, Member 2/3 optional) with domain validation on member emails.
- [ ] Build the invite banner and accept/decline flow on the invitee's dashboard.
- [ ] Wire Supabase Realtime so a leader's roster view updates live as members respond, with no manual refresh.
- [ ] Build the Admin "close registration" control, calling `close_registration()`.
- [ ] **Verify:** create a team with 3 invited test accounts; accept one, decline one, leave one pending; close registration; confirm the team locks with exactly leader + the accepted member, and the pending invite expired. Separately, confirm a team with zero acceptances converts its leader to a locked solo unit.

## Phase 4 — Event Engine

- [ ] Build the Track progress component (per `UIUX_Design_Brief.md`, functional version first).
- [ ] Build the riddle screen and secret-code entry, validated against `unit_checkpoint_codes`.
- [ ] Integrate an in-browser code editor (Monaco or CodeMirror) with a C/C++/Python/Java language picker.
- [ ] Build the submission flow: a server route calls Judge0 via RapidAPI, loops the question's hidden test cases, compares output, and updates `round_progress` and `submissions`. The client never sees hidden test cases or talks to Judge0 directly.
- [ ] Build the Skip flow.
- [ ] Build the pass/fail states (functional first; the exact microinteractions from the brief come in Phase 6).
- [ ] **Verify:** as a test unit, play through all configured rounds end to end. Confirm score updates correctly, unlimited retries work, a compile error is handled without crashing the UI, and skip always advances regardless of pass/fail state.

## Phase 5 — Admin Panel

- [ ] Build content management screens: riddles, checkpoints, questions, test cases (CRUD, per `TRD.md` Section 4).
- [ ] Build registration and event live/not-live toggles.
- [ ] Build participant management using `admin_unit_overview`; wire disqualify and manual point override.
- [ ] Build notifications (targeted) and announcements (global).
- [ ] Build the audit log view; confirm every admin action above actually writes an `audit_log` row.
- [ ] Build role management (promote/revoke Admin), restricted to `super_admin`.
- [ ] Build the Checkpoint Staff view (their assigned checkpoint's code, nothing else).
- [ ] **Verify:** super admin promotes a second test account to Admin; confirm that account can manage content but cannot revoke the super admin. Confirm Checkpoint Staff sees only their assigned checkpoint(s).

## Phase 6 — Visual Polish & Animation

- [ ] Apply the color and type tokens from `UIUX_Design_Brief.md` globally.
- [ ] Build the ambient node-field background (landing/sign-in/waiting screens only — not gameplay screens, per the brief).
- [ ] Implement entrance, hover, loading, and microinteraction animations exactly where the brief specifies, screen by screen.
- [ ] Confirm `prefers-reduced-motion` disables non-essential motion throughout.
- [ ] **Verify:** the gameplay screens (riddle, code entry, question) are visually quiet, per the brief's explicit direction — this is intentional, not a gap to fill in. Spot-check on a mid-range Android device or throttled emulation for jank.

## Phase 7 — Testing & Load Test

- [ ] Write unit tests for scoring logic and the code-validation path.
- [ ] Write one end-to-end integration test: registration → lock → full event → final score, against a seeded test unit.
- [ ] Load test: script 15–20 concurrent submissions against Judge0 via RapidAPI; confirm response times and the free tier's request quota hold up against the estimate in `PRD.md` Section 6.
- [ ] Run a full dry run with the actual organizing team, on real phones, at an actual campus location if possible.
- [ ] **Verify:** all of the above pass with no manual workarounds needed.

## Phase 8 — Deployment Hardening

- [ ] Set up the Supabase keep-alive scheduled job, per `TRD.md` Section 8.
- [ ] Set up a free uptime checker on the app.
- [ ] Audit all environment variables are present in Vercel's production environment, not just local `.env`.
- [ ] Generate and print the backup code sheet (`GET /api/admin/codes/export`) as an offline fallback for checkpoint staff.
- [ ] **Verify:** 24–48 hours before event day, confirm Supabase is awake and responding, and do one live test submission through Judge0 to confirm the RapidAPI key and quota are still good.
