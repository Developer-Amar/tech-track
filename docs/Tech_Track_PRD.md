# Tech Track — Product Requirements Document

| | |
|---|---|
| **Organization** | IEI Club, Chitkara University |
| **Prepared by** | Amar Prakash (Technical Head) & Claude |
| **Event Date** | September 21, 2026 |
| **Build Deadline** | August 31, 2026 |
| **Kickoff** | July 4, 2026 |
| **Status** | Final — ready for Phase 1 |
| **Version** | 1.0 |

---

## 1. Overview

Tech Track is a live, campus-wide technical treasure hunt run by the IEI Club. Teams (or solo participants) solve riddles that send them to physical locations around campus, where a staff member gives them a code. That code unlocks a coding question, which must be written and run in an in-browser editor (C, C++, or Python) and verified against hidden test cases. There are roughly 10 rounds, each worth one point. The platform covers self-service registration, team formation, the live event engine, and a full admin panel to run the event in real time.

## 2. Goals

- Fully self-service registration and team formation — no manual admin work to get participants ready.
- A coding round that's genuinely tamper-resistant: no external IDE, no shared/reusable codes, verified execution rather than an honor system.
- Real-time control and visibility for organizers during the live event.
- Built entirely on free-tier infrastructure, sized appropriately for ~10-15 teams.

## 3. Out of Scope (v1)

- Native mobile app (web only, mobile-responsive — riddles will mostly be solved on phones while walking campus).
- Payment processing.
- Participation from outside Chitkara University.
- Camera/webcam proctoring or full browser lockdown — only tab-switch/window-blur logging, per the decision to log rather than police.
- Support for running more than one event instance at a time.

## 4. User Roles & Permissions

| Role | Description | Can do |
|---|---|---|
| **Solo Participant** | Competes individually | Register, lock as solo, play the event |
| **Team Leader** | Creates and owns a team | Register, create team, invite up to 3 members, plays the event as part of the team |
| **Team Member** | Joined via invite | Register, accept/decline invites, plays the event as part of the team |
| **Checkpoint Staff** | On-ground volunteer at a physical location | View the secret code(s) for their assigned checkpoint(s) only; nothing else |
| **Admin** | Promoted by Super Admin | Manage riddles/codes/questions/test cases, open/close registration, start/stop the event, disqualify, notify, announce, view all registrations, view audit log |
| **Super Admin** | Exactly one — hardcoded to `amar4594.ece25@chitkara.edu.in` | Everything Admin can do, plus promote/revoke Admin access. Cannot be revoked by anyone. |

## 5. Functional Requirements

### 5.1 Authentication & Onboarding

- **Sign-in method:** "Sign in with Google" only — no separate password to build or store.
- **Domain check:** only Google accounts on the `chitkara.edu.in` Workspace are accepted; any other domain is rejected with a clear message.
- Google's OAuth flow proves both identity and domain ownership in one step, so there's no separate email verification to build.
- **Profile completion (first login only):** Mobile Number (plain field, not OTP-verified — used purely for contact/logistics), University Roll No., Branch, Semester.
- Name and email come directly from the Google profile.
- **Uniqueness:** one account per Google identity — enforced naturally by OAuth, no extra dedup logic needed.
- The Super Admin flag is set automatically the first time `amar4594.ece25@chitkara.edu.in` signs in.

### 5.2 Dashboard

Two sections, visible after profile completion:
- **Lock Your Registration** — active immediately.
- **Tech Track Event** — greyed out until Admin activates it.

Pending team invitations (if any) surface at the top of the dashboard.

### 5.3 Registration Locking — Solo

- User selects "Go Solo."
- Confirmation prompt: *"This is permanent — you can't join a team later."*
- On confirm: participation type is set to solo and locked immediately.

### 5.4 Registration Locking — Team

- The person filling the form becomes **Leader**. They enter: Team Name, Member 1 (name + email, **mandatory**), Member 2 (optional), Member 3 (optional). Team size range: **2–4 people** including the leader.
- All member emails must be on the `chitkara.edu.in` domain.
- No duplicate members within a team; a person cannot be invited into more than one team at a time, and anyone already locked as solo cannot be invited.
- Each invited member sees, on their own dashboard once they've completed their own registration: *"[Leader] invited you to join [Team Name]"* with Accept / Decline. If an invited email hasn't registered yet, the invite simply waits until they do.
- **On Accept:** that member is immediately and permanently attached to the team — they cannot leave, cannot join a different team, and the leader cannot remove them.
- **The roster stays open** — more pending invites can still resolve — right up until Admin closes registration.
- **At registration close:**
  - If the team has one or more accepted members, it locks exactly as it stands; any still-pending invites simply expire.
  - If zero members ever accepted, the leader automatically converts to a locked solo participant.
- Once locked (by either path), participation type and roster are permanently immutable.

### 5.5 Event Engine — Gameplay Loop

Triggered once Admin activates the "Tech Track Event" section. Default 10 rounds, count and order configurable by Admin.

Each round, for each team/solo:

1. A riddle is shown alongside a secret-code entry field.
2. The riddle points to a physical campus location.
3. At that location, Checkpoint Staff (or Admin) gives the participant a code that is **unique to that specific team at that specific checkpoint** — not shared across teams, so a leaked code can't be reused by anyone else.
4. The participant enters the code; the system checks it against that team's expected code for that round.
5. A valid code unlocks that round's coding question.
6. The question is solved in an in-browser code editor — participant's choice of C, C++, or Python — with no external IDE and no requirement to leave the tab.
7. Two options:
   - **Skip:** 0 points for this round, immediately advances to the next riddle.
   - **Attempt:** code runs in a sandboxed judge and is checked against several hidden test cases plus one visible sample test case. **Unlimited retries** are allowed. A full pass awards **+1 point**, records the timestamp, and advances to the next riddle. A partial or full fail simply lets them try again or skip.
8. Any tab-switch or window-blur event while a question is open is logged (team/solo ID, question, timestamp) for Admin to review after the fact. No automatic penalty is applied.
9. After the final round, the event is marked complete for that participant/team and the final score is saved.

### 5.6 Scoring & Leaderboard

- Score = number of rounds passed; every round is worth 1 point in v1.
- Ties are displayed as ties — no automatic tiebreak is applied yet.
- The timestamp of every point earned is still recorded, so a time-based tiebreak can be applied later (manually, or in a future version) without re-engineering anything.
- A live leaderboard is visible to participants by default (assumption — flagged in Section 8 if you'd rather keep it admin-only until the event ends).

### 5.7 Admin Panel

- **Content management:** create/edit/reorder riddles; set the secret code per team per checkpoint; create/edit coding questions with multiple hidden test cases plus one sample; set number of rounds and their order.
- **Registration control:** open/close registration (closing triggers the auto-solo conversion described in 5.4).
- **Event control:** activate/deactivate the live event section.
- **Participant management:** view full details of every solo/team registration; disqualify a team or solo participant (removes them from active leaderboard ranking and blocks further code entry/submissions, but keeps their record for reference); manually award or adjust a round's points for a specific team — the dispute-resolution safety valve.
- **Communication:** send a targeted notification to one team/solo, or post a global announcement visible to everyone registered. Both are in-app/dashboard notifications in v1 — no email or SMS push.
- **Audit log:** every admin-level action (content edits, disqualifications, point overrides, registration/event toggles) is recorded with actor, timestamp, and detail — visible to both Admin and Super Admin.
- **Role management (Super Admin only):** promote a user to Admin, or revoke Admin access. Super Admin status itself cannot be revoked by anyone.

## 6. Non-Functional Requirements

- **Security:** sandboxed code execution with no outgoing network access, per-submission CPU/memory/time limits, and an isolated unprivileged user per run (via Piston + Isolate); OAuth-based auth means no password storage; per-team-per-checkpoint codes prevent sharing between teams.
- **Capacity:** registration and database load are a non-issue at this scale — Supabase's free tier (50,000 monthly users, 500MB storage) has enormous headroom over 10-15 teams. The one real constraint is the self-hosted code judge during live bursts of submissions; estimated comfortable headroom into the 40-60 team range, to be confirmed with a load test in Week 8.
- **Availability:** both Supabase (auto-pauses after 7 days of inactivity) and the Oracle VM (can reclaim an instance idle below ~20% CPU for 7 days) need a small scheduled keep-alive ping. This must be double-checked as "awake" in the 24-48 hours before event day.
- **Browser support:** modern evergreen browsers; mobile-responsive throughout, since riddles are solved on the move.
- **Data collected:** name, email, mobile number, roll number, branch, semester — nothing beyond what's needed to run the event.

## 7. System Architecture

- **Frontend + backend logic:** Next.js, hosted on Vercel.
- **Auth:** Google OAuth via Chitkara's Google Workspace, domain-restricted to `chitkara.edu.in`.
- **Database + realtime:** Supabase (Postgres) — powers data storage plus realtime updates for invites and the live leaderboard.
- **Code judge:** self-hosted Piston (Docker), supporting C, C++, and Python, running on an Oracle Cloud "Always Free" VM (Ampere A1, 2 OCPU / 12GB RAM).

## 8. Data Model (high-level)

| Entity | Purpose |
|---|---|
| `Users` | Google identity, mobile, roll no., branch, semester, role, participant type |
| `Teams` | Team name, leader reference, locked status |
| `TeamMembers` | Links users to teams with invite status (pending/accepted/declined) |
| `Riddles` | Riddle content and round order |
| `Checkpoints` | Physical location tied to a riddle |
| `TeamCheckpointCodes` | The unique secret code per team, per checkpoint |
| `CodingQuestions` | Prompt and sample test case per round |
| `TestCases` | Hidden + visible test cases per question |
| `Submissions` | Each code attempt, language, result, timestamp |
| `RoundProgress` | Pass/skip status and points per team per round, with timestamp (tiebreak data) |
| `ProctoringEvents` | Tab-switch/blur log entries |
| `Announcements` | Global messages from Admin |
| `Notifications` | Targeted messages to a specific team/solo |
| `AuditLog` | Every admin-level action, who did it, and when |
| `Disqualifications` | Record of disqualified teams/solos and reason |

## 9. Assumptions & Open Items

These are reasonable defaults chosen to keep things moving — flag any you'd rather change before or during Phase 1:

1. No hard global time cutoff for the event by default; it runs until Admin ends it or all teams finish. A fixed end-time would need a defined rule for teams still mid-round when time's up.
2. Leaderboard is visible to all participants, not admin-only.
3. Disqualified teams are tagged and excluded from ranking, not deleted from records.
4. Notifications/announcements are in-app only in v1.
5. Checkpoint Staff can view their assigned code(s); marking physical attendance in the panel is a nice-to-have, not a v1 requirement.
6. Audit log is visible to Admin and Super Admin alike.

## 10. Timeline

| Weeks | Dates | Focus |
|---|---|---|
| 1–2 | Jul 4 – Jul 18 | Google OAuth + domain check, registration, profile completion, base schema |
| 3–4 | Jul 19 – Aug 1 | Team formation, dashboard, invites, locking logic |
| 5–6 | Aug 2 – Aug 15 | Event engine — riddles, per-team codes, Piston integration, scoring |
| 7 | Aug 16 – Aug 22 | Admin panel — CMS, roles, leaderboard, notifications, audit log |
| 8 | Aug 23 – Aug 31 | Integration testing, Piston load test, full dry run, buffer |
| Sep 1–20 | — | Polish, dress rehearsal, checkpoint staff briefing |
| Sep 21 | — | Event day |

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Supabase / Oracle VM go idle and pause or get reclaimed | Scheduled keep-alive ping; manual check 24-48 hrs before the event |
| Piston judge under-provisioned for real concurrent load | Load test with simulated submissions in Week 8 |
| Oracle "out of capacity" for the free VM shape in some regions | Known quantity from prior use; retry or switch availability domain if needed |
| Ambiguity in Section 9 turning out wrong | Reviewed with you before Phase 1 build starts |
