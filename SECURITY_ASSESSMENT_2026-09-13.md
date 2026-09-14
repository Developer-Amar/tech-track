# Tech Trek 2.0 — Security & Production Assessment

**Assessment date:** 13 September 2026  
**Scope:** `https://tech-trek-2-0.vercel.app/`, the supplied Supabase schema/migrations, and the deployed application's source snapshot.  
**Method:** Read-only code review plus minimal live checks. No accounts were created; no records, code submissions, event settings, teams, or files in the application were changed.

## Executive summary

The application is reachable and serving the expected Vercel deployment. However, it currently has several **critical authorization and data-exposure flaws**. The most urgent issue is a database policy that lets any authenticated student update every field in their own profile, including `role`; this permits a participant to become a `super_admin` through the Supabase API. Public Supabase reads also expose participant records and all riddle/checkpoint content.

The application should **not be used for a live competition or with real student data** until the critical items below are remediated and retested.

## Live verification performed

- The public home page responded successfully over HTTPS from Vercel.
- Using only the public Supabase client credential embedded in the app, unauthenticated read-only requests to `users` and `riddles` both returned **HTTP 200**. I selected only one opaque `id` and discarded response bodies; no PII, pass code, riddle, or submission content was retained.
- `/api/event/leaderboard` was reachable without authentication (HTTP 200). Admin and event-control endpoints tested without a session returned HTTP 401 as expected.
- I deliberately did **not** request `/api/health`, because its `GET` handler writes a heartbeat row and the engagement explicitly required no data changes.

## Findings

| ID | Severity | Finding | Evidence / impact |
|---|---|---|---|
| TT-01 | **Critical** | Participant-to-super-admin privilege escalation | `users_update_own` uses only `USING (auth.uid() = id)` and has no column-level protection or restrictive `WITH CHECK`. An authenticated user can update their own `role` directly through Supabase from `participant` to `super_admin`; app routes then trust that value for admin access. See `supabase/000_master_schema.sql` and `app/api/admin/*`. |
| TT-02 | **Critical** | Public exposure of student PII and pass codes | `users_read_all ... FOR SELECT USING (true)` exposes every column, including email, mobile number, roll number, branch, semester, role, avatar URL, and `pass_code`. Live unauthenticated REST verification returned HTTP 200. This enables bulk student-data harvesting and exposes badge/QR pass secrets. |
| TT-03 | **Critical, configuration-dependent** | `close_registration()` can be publicly callable as a privileged RPC | The supplied SQL creates `public.close_registration()` as `SECURITY DEFINER`, but does not revoke its default `PUBLIC` execute privilege. In PostgreSQL, functions are executable by `PUBLIC` unless revoked. If the public schema is API-exposed (normal Supabase configuration), an unauthenticated caller may invoke it through RPC to close registration, lock/disqualify teams, and generate codes. Do **not** test this live; inspect function privileges immediately. |
| TT-04 | **High** | Competition riddles, locations, and coding questions are public before the event | `checkpoints_read_all`, `riddles_read_all`, and `coding_questions_read_all` all use `USING (true)`. The riddle answer is exactly `checkpoints.location_name` in `app/api/event/riddle/check/route.ts`, so a caller can retrieve answers/locations for every round and complete the riddle gate legitimately. Live read access to `riddles` returned HTTP 200. |
| TT-05 | **High** | Anyone can cause database writes through the public health endpoint | `GET /api/health` uses the service role and inserts a `heartbeat_log` row on every request. There is no authentication, rate limit, cache protection, or secret. An attacker can generate unbounded writes, table growth, DB load, and Vercel invocations simply by requesting a GET URL. See `app/api/health/route.ts`. |
| TT-06 | **High** | An invitee can move their own membership into a different unlocked team | `unit_members_update_own` permits a user to update their entire row, not merely the response status. A pending invitee can change `unit_id` to a public target team ID and set status to `accepted`; the trigger checks only the old/new status and checks the *target* lock state. There is no database constraint on capacity or one accepted team per person. |
| TT-07 | **High** | Checkpoint staff are not limited to an assigned checkpoint and can advance arbitrary teams | `/api/scan` accepts any staff account, but never checks `checkpoint_staff_assignments`. Its GET returns the scanned attendee's PII, team roster, all round locations, and all unit checkpoint secrets. Its POST accepts arbitrary `unit_id` plus `checkpoint_id`/`round` and directly writes `checkpoint_done`, with no sequence or assignment check. One compromised/malicious staff account can reveal secrets or advance any team. |
| TT-08 | **High** | Real-time streams amplify the data leak | The realtime publication includes `users`, `unit_members`, `checkpoints`, `submissions`, and `round_progress`. With the current permissive read policies, a public client can potentially subscribe to live changes, not just take one-time snapshots. This can expose new registrations, rosters, code, and progress continuously. |
| TT-09 | **High** | Team creation has race conditions and no database-enforced invariants | `/api/units/team` performs "is already in a team" checks, then inserts a unit and membership in separate, non-transactional requests. Parallel requests can pass the checks and create multiple teams/memberships for the same leader. The database has no partial unique index for one accepted team per user, no enforced 2–4 member limit, and no constraint requiring the leader to be a member. |
| TT-10 | **High** | Code-execution endpoints have no abuse controls | Both Round 1 and Round 2 submission endpoints invoke Judge0 synchronously with no request-rate limit, attempt limit, code-size limit, queue, idempotency key, or per-team lock. An authenticated student can rapidly submit expensive workloads to exhaust Judge0 quota, Vercel duration/concurrency, and database storage. See `app/api/event/code/submit/route.ts` and `app/api/event/round2/submit/route.ts`. |
| TT-11 | **High** | Proctoring can be bypassed from the client | Tab/full-screen/device telemetry is voluntarily reported by browser JavaScript. A participant can block or modify `/api/event/proctor/report` requests and submit directly to the code endpoint; absence of a `proctoring_state` record is treated as allowed. The API cannot reliably infer tab switching or DevTools use. The current system can flag cooperative clients but cannot enforce anti-cheating. |
| TT-12 | **Medium** | “Single active device” protection is not actually bound to a device or user | `session_token` is client supplied, accepted as `token_default` when absent, and the same token can be reused by multiple team members. `unit_device_sessions` exposes the token to accepted team members through `SELECT *`. Reusing it defeats the “another device” check; no signed device-bound credential exists. |
| TT-13 | **Medium** | Submissions and progress are readable across teams | `submissions_read_all` and `round_progress_read_all` use `USING (true)`. This leaks all teams’ source code, language, attempt counts, AI flags/reasons, scores, completion times, and progress. It enables solution copying and competitive intelligence; live submissions may be empty now, but the policy is active. |
| TT-14 | **Medium** | No transaction/error rollback for multi-step mutations | Team creation, registration closure, staff advancement, and admin override flows perform sequences of service-role writes while ignoring several errors. A partial failure can leave orphaned units, missing leader memberships, mismatched progress/codes, or partially reset events. The app reports success in some branches without verifying every mutation. |
| TT-15 | **Medium** | Security headers are incomplete | The deployment correctly sends HSTS, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`, but does not set a Content-Security-Policy, Referrer-Policy, or Permissions-Policy. A CSP is particularly valuable because the app handles student data, QR passes, and code-editor content. |
| TT-16 | **Low** | Pass-code uniqueness is probabilistic, not enforced by the database | Pass codes are generated after checking for an existing code, but `users.pass_code` has an index rather than a `UNIQUE` constraint. Concurrent signups or manual edits can create duplicate codes, causing ambiguous badge scans. |

## Priority remediation plan

1. **Immediately disable public data access and rotate exposed operational secrets if any were copied.** Replace broad `USING (true)` policies with authenticated, column-minimized access. Do not expose `pass_code`, phone, roll number, or submissions in a general profile table.
2. **Fix TT-01 before any other feature work.** Revoke direct client `UPDATE` on `users`, or use a narrow RPC/server endpoint that permits only approved profile fields. Enforce `WITH CHECK (auth.uid() = id)` plus field restrictions; RLS alone cannot restrict individual columns.
3. **Revoke public execution of privileged functions.** Explicitly revoke `EXECUTE` on `close_registration()` from `PUBLIC`, `anon`, and `authenticated`; invoke it only from a server-side service-role path or a tightly authorized wrapper.
4. **Protect event content.** Keep unreleased riddles, locations, hidden tests, and future questions in private tables/API routes. Release only the current round after server-side eligibility checks.
5. **Move core invariants into the database.** Add transactional RPCs and constraints/partial indexes for one accepted team per user, 2–4 accepted members, immutable leader membership, unique pass codes, and valid progress transitions.
6. **Restrict staff actions.** Bind staff to `checkpoint_staff_assignments`, return the minimum information needed at that checkpoint, and validate that a team is at the correct next checkpoint before writing progress.
7. **Replace the public writing health check.** Make it authenticated by a cron secret and read-only, or write at a fixed controlled cadence with retention/cleanup. Add rate limits/WAF rules.
8. **Add quotas and queues around Judge0.** Impose code/body limits, per-user/team rate limits, concurrency locks, submission idempotency, timeouts, and monitoring for quota exhaustion.
9. **Reframe proctoring.** Treat client telemetry as advisory. For stronger enforcement, use supervised checkpoints and server-side attempt/audit controls; do not claim that client-side tab tracking prevents cheating.
10. **Run a post-fix RLS audit.** Test each table/RPC as `anon`, ordinary participant, team leader, checkpoint staff, admin, and super admin, verifying both row and column access.

## Retest checklist

- An ordinary authenticated account cannot alter `role`, `pass_code`, another profile field, membership `unit_id`, or an already-resolved invite through the REST API.
- `anon` receives 401/403 for `users`, `unit_members`, `submissions`, `round_progress`, unreleased `riddles`, and unreleased `checkpoints`.
- A participant sees only their own allowed team data and current released round.
- A staff account can read/advance only its assigned checkpoint and only a team’s valid next step.
- `anon` and `authenticated` cannot execute `close_registration()`; only the intended admin workflow can.
- Repeated health requests do not create database rows or costly work.
- Concurrent team creation/submission tests preserve all database invariants.

## Notes on confidence

TT-01, TT-02, TT-04, TT-05, TT-06, TT-07, TT-09, TT-10, TT-11, TT-13, TT-14, TT-15, and TT-16 are supported by the supplied source/schema. TT-02 and TT-04 were additionally confirmed against the live Supabase REST surface without retaining any returned data. TT-03 is critical if the live function grants were not tightened outside the supplied migrations; verify it in Supabase immediately rather than invoking the function.
