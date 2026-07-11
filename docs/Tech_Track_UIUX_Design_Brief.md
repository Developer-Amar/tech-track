# Tech Track — UI/UX Design Brief

| | |
|---|---|
| **Companion to** | PRD, TRD, and App Flow docs (all v1.0) |
| **Version** | 1.0 |

## The Brief

**Subject:** Tech Track — a live campus treasure hunt where riddles send teams to physical locations, and each location unlocks a coding challenge solved on the spot.
**Audience:** Chitkara University students — competitive, tech-literate. Mostly on phones, outdoors, moving between locations during the event. On laptops during registration.
**The job changes by moment:** before the event, the product should build anticipation and make signing up feel effortless. During the event, it should almost disappear — get out of the way so people can read a riddle and write code fast, under time pressure. For organizers running the admin panel live, it needs to be instant and legible, with zero patience for anything decorative that slows a real-time decision down.

That three-way split — exciting, invisible, instant — is the organizing idea behind every choice below.

## Design Philosophy

You asked for "next level" animation across the board, and this brief delivers on every category you listed. But the honest expert answer isn't "maximum motion everywhere" — it's knowing exactly where motion earns its keep and where it costs you. Real premium products (the ones that feel expensive rather than busy) are disciplined about this: one or two orchestrated moments land harder than effects scattered across every element. Overdone motion is also, ironically, the single biggest tell of AI-generated design right now — so restraint in the right places is what will actually make this feel premium rather than templated.

Concretely: the landing page and the leaderboard are allowed to be loud. The riddle-and-code screens — used ten times per team, on a phone, in the sun, against the clock — need to be fast and quiet. The admin panel needs to be closer to a cockpit than a showcase. Section 5 below goes through every animation type you asked for and says exactly where it belongs and where it doesn't.

## Visual Identity

### Color

| Token | Hex | Use |
|---|---|---|
| `void` | `#0B0E14` | Base background — a deep blue-black, not flat black, for depth |
| `panel` | `#151A24` | Cards, modals, raised surfaces |
| `dormant` | `#3A4356` | Unlit path segments, locked states, secondary text — "unexplored" |
| `signal` | `#E8A33D` | Primary accent — warm amber-gold. Unlocked states, primary actions, the "treasure glow" |
| `danger` | `#E85D4A` | Errors, wrong codes, disqualification — a warm coral, not a jarring stop-sign red |
| `text` | `#E8EAED` | Primary text — near-white with a whisper of warmth |

Deliberately not going with the generic "dark background + acid-green or vermilion accent" combo that a lot of AI-generated tech UI defaults to. Gold is the treasure-hunt's actual subject matter — it means something here — and it pairs `dormant` (cool, unexplored) against `signal` (warm, discovered) as a functional system, not just a decoration: color literally tracks progress through the game.

### Typography

| Role | Typeface | Why |
|---|---|---|
| Display | **Space Grotesk** | Geometric, slightly technical, used sparingly for headlines and section titles |
| Body | **IBM Plex Sans** | Built with engineering DNA, highly readable at small sizes — there's a lot of reading (riddles, instructions, prompts) |
| Mono / data | **JetBrains Mono** | For the code editor, secret codes, timestamps, admin data tables — ties the whole type system back to the fact that this product is, at its core, about writing code |

All three are free and load easily via Google Fonts.

### Signature element: "The Track"

One motif, reused in different forms everywhere: a **glowing node-and-path system**. Abstract and ambient on the landing page (a slow-drifting constellation of connected points). Literal and functional on the dashboard and gameplay screens (an actual progress bar made of checkpoint nodes — lit for done, pulsing for current, dim for upcoming). Compressed into a small loop as the loading indicator (a single point of light traveling a short path instead of a generic spinner). This is the one thing people should remember about how Tech Track looks — everything else stays quiet around it.

## Layout Principles

**Landing hero** — full-bleed ambient node-field behind a centered headline and single CTA:

```
┌───────────────────────────────────────┐
│  TECH TRACK                 [Sign in] │
│                                        │
│     · ─ ─ ● ─ ─ · ─ ─ ●               │
│    ╱              ╲      ╲            │
│   ●                ● ─ ─ ─●─ ─ ●      │
│                                        │
│        SOLVE. TRAVEL. CODE.           │
│     A campus-wide treasure hunt       │
│     for people who'd rather earn      │
│     the answer than google it.        │
│            [ Enter the hunt ]         │
└───────────────────────────────────────┘
```

**Dashboard / gameplay** — the Track runs as a literal spine across the top of every screen in the loop, so a team always knows exactly where they are without asking:

```
┌─────────────────────────────────────┐
│  TECH TRACK          [Team Falcon]  │
│   ●━━━━●━━━━●━━━━◉┈┈┈○┈┈┈○┈┈┈○      │
│   1    2    3    4   5   6   7      │
│  done done done  YOU  ·   ·   ·     │
│                                      │
│   Round 4 — Riddle                  │
│   ┌─────────────────────────────┐   │
│   │ "Where shadows fall at noon, │   │
│   │  seek the tallest spire..."  │   │
│   └─────────────────────────────┘   │
│   [ Enter checkpoint code ___ ]     │
└─────────────────────────────────────┘
```

## The Animation System

Every category you asked for, with where it belongs and where it doesn't.

**Entrance animations**
Landing headline and subhead stagger in — 60ms between lines, rise + fade, 400ms ease-out. The background node-field is already mid-motion when the page paints, never starting from a dead frame. The signature entrance moment is the **riddle reveal**: text resolves from a scrambled, glitching state into the real riddle over ~600ms — on-theme, and it only plays once per riddle, not on every re-render. Dashboard cards stagger in fast on first load (40ms apart, ~500ms total) — quick enough that a returning user isn't sitting through a show. The admin panel gets none of this: data appears immediately, full stop.

**Hover effects**
Primary buttons scale to 1.02 with a soft gold glow fading in over 150ms — fast enough to feel responsive. Cards lift 2-4px with a border transition from `dormant` to `signal`, 180ms. Hovering a *completed* track node reveals the timestamp it was solved at (this is where the tiebreak timestamp data we built into the schema actually earns its keep in the UI). Hovering a locked, future node does nothing — no teasing content that isn't unlocked yet.

**Loading effects**
Every wait tied to code execution uses the same "light traveling along a short path" loader — never a generic spinner — so "the system is thinking" always looks like the same visual language as the progress track. Loads under ~400ms show nothing at all; a loader that flashes for a tenth of a second reads as jank, not polish.

**3D animations**
Reserved for exactly two moments: the landing hero's ambient node-field, and the final leaderboard reveal. Everywhere else — especially the riddle/code/question screens, used repeatedly, outdoors, on mid-range phones — 3D is off the table. A dropped frame while a team is timing a submission costs more than the flourish is worth. Build the node-field in SVG + CSS rather than WebGL/Three.js: it gets most of the visual richness for a fraction of the battery and bandwidth cost, which matters when people are on campus WiFi walking between buildings. Save true WebGL for a v2 if there's appetite once the core product is proven.

**Microinteractions**
Passing a question fills that track node from `dormant` to `signal` with a quick bloom (scale 1→1.15→1, 300ms) — not a full-screen celebration, because it needs to feel good ten times in a row without wearing thin. A wrong code triggers a small 2-3px shake on the input, enough to register as "no" without feeling punitive. Accepting a team invite gets a small, contained particle burst near the roster row — the big celebration is saved for the leaderboard, which only happens once. Admin toggles (open/close registration, start/stop the event) get a deliberate, slightly weighted slide with a soft snap at the end — these are consequential actions and should feel like they have weight.

**Background animations**
Slow ambient drift in the node-field on landing, sign-in, and the "waiting for the event to start" screen — low opacity, never competing with foreground content. Every gameplay screen (riddle, code entry, question) gets a static or near-static background. Motion in your peripheral vision while you're mid-code is a liability, not atmosphere.

**Mouse / cursor animations**
A soft glow trailing the cursor is a nice touch — on the landing and marketing pages only. It's switched off completely inside the actual app, and especially inside the code editor, where a modified cursor over a text-editing surface actively hurts the precision that screen exists for.

**Scroll animations**
The landing page's "how it works" section reveals in a straightforward stagger as it scrolls into view, fade + rise, 300ms, triggered once. Inside the app — lists, admin tables, the roster — scrolling is just scrolling. No reveal-on-scroll on a working list someone will scroll up and down repeatedly; it would get old within the first minute of real use.

## Screen-by-Screen Direction

| Screen | Treatment |
|---|---|
| Landing / sign-in | Maximum visual richness — full node-field, boldest type, the only place the cursor glow lives |
| Profile completion | Quiet, focused, single-column form on a `panel` surface — a form to finish quickly, not a moment to dwell in |
| Dashboard (pre-event) | Two clear panels for Lock Registration / Tech Track Event; the locked one visibly dimmed until Admin flips it live |
| Team formation | The roster list is a lightweight version of the Track motif — pending invites dim, accepted members lit |
| Gameplay loop | The Track spine runs across the top of every screen; everything below it is quiet and fast |
| Leaderboard | The one screen allowed to be loud — full-width, ranks animate into place, first place gets the full-strength gold treatment |
| Admin panel | Dense and data-forward; motion exists only to confirm an action landed, never to decorate |
| Checkpoint Staff view | The simplest screen in the product on purpose — one card, one code, a fade when it updates, nothing else |

## Voice & Microcopy

- Buttons say exactly what they do: *"Enter the hunt," "Lock in as solo," "Submit code"* — never a bare "Continue" or "Submit."
- Errors explain rather than apologize: *"That code doesn't match this checkpoint yet"*, not *"Oops, something went wrong."*
- Waiting states point forward instead of just stating a fact: the pre-event dashboard doesn't say "Event not started" — it says something closer to *"The hunt begins when the organizers start the clock. Your team is locked in and ready."*

## Technical Implementation Notes

- **Motion:** Framer Motion for entrance, hover, and microinteractions in the Next.js app.
- **Ambient background / Track motif:** SVG + CSS keyframes, not WebGL, for the reasons above.
- **Scroll reveals:** a small Intersection Observer hook — the app doesn't have enough long-scroll surface to justify a heavier scroll library.
- **`prefers-reduced-motion`:** every non-essential animation (ambient drift, decode effects, hover lifts) is disabled or swapped for a plain opacity fade when this is set. Functional state changes — a node lighting up on a pass — still happen, just instantly.

## Performance & Accessibility Floor

- Gameplay screens are built and tested mobile-first, on mid-range Android hardware, not just a developer's laptop.
- Contrast between `text`/`signal` and `void` is kept high enough to hold up in direct sunlight — worth an actual outdoor screen-brightness check before event day, not just a contrast-checker score.
- Visible keyboard focus everywhere, including the UI surrounding the code editor.
- Reduced motion respected everywhere, per the note above.
