-- ============================================================================
-- Tech Trek — Development Seed Data
-- ============================================================================
-- Placeholder content for local development.
-- Real event content is entered by Admin through the CMS in Phase 5.
--
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Run AFTER 001_schema.sql.
-- ============================================================================


-- ── Event Settings (singleton row) ──────────────────────────────────────────

insert into public.event_settings (id, registration_open, event_live, total_rounds)
values (1, true, false, 3)
on conflict (id) do nothing;


-- ── Checkpoints (3 rounds for dev) ──────────────────────────────────────────

insert into public.checkpoints (id, location_name, round_number) values
  ('a1000000-0000-0000-0000-000000000001', 'Library Main Entrance',    1),
  ('a1000000-0000-0000-0000-000000000002', 'Turing Block Courtyard',   2),
  ('a1000000-0000-0000-0000-000000000003', 'Cafeteria Rooftop Garden', 3);


-- ── Riddles (one per checkpoint) ────────────────────────────────────────────

insert into public.riddles (checkpoint_id, content) values
  ('a1000000-0000-0000-0000-000000000001',
   'Where knowledge sleeps in paper stacks and silence is the rule — find the gate that greets the world of books and fools.'),
  ('a1000000-0000-0000-0000-000000000002',
   'Named for the father of the thinking machine, seek the open sky where concrete walls convene.'),
  ('a1000000-0000-0000-0000-000000000003',
   'Above the place where appetites are fed, a garden hides beneath the open spread of sky.');


-- ── Coding Questions (one per checkpoint) ───────────────────────────────────

insert into public.coding_questions (id, checkpoint_id, prompt, sample_input, sample_output) values
  ('b1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'Write a program that reads an integer N and prints the sum of all integers from 1 to N.',
   '5',
   '15'),
  ('b1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000002',
   'Write a program that reads a string and prints it reversed.',
   'hello',
   'olleh'),
  ('b1000000-0000-0000-0000-000000000003',
   'a1000000-0000-0000-0000-000000000003',
   'Write a program that reads an integer N and prints "Even" if N is even, or "Odd" if N is odd.',
   '7',
   'Odd');


-- ── Test Cases (2 per question: 1 visible sample, 1 hidden) ────────────────

-- Question 1: Sum 1..N
insert into public.test_cases (question_id, input, expected_output, is_visible) values
  ('b1000000-0000-0000-0000-000000000001', '5',   '15',    true),
  ('b1000000-0000-0000-0000-000000000001', '100', '5050',  false);

-- Question 2: Reverse string
insert into public.test_cases (question_id, input, expected_output, is_visible) values
  ('b1000000-0000-0000-0000-000000000002', 'hello',     'olleh',     true),
  ('b1000000-0000-0000-0000-000000000002', 'racecar',   'racecar',   false);

-- Question 3: Even/Odd
insert into public.test_cases (question_id, input, expected_output, is_visible) values
  ('b1000000-0000-0000-0000-000000000003', '7',  'Odd',  true),
  ('b1000000-0000-0000-0000-000000000003', '42', 'Even', false);
