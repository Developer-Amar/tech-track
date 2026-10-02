-- ============================================================
-- Migration 027: Seed 10 Coding Practice Questions for Round 1
-- Sets up the 10 competitive coding questions with test suites
-- for Round 1 (Checkpoints 1..10) and ensures Round 2 contains
-- the 3 LeetCode problems (Two Sum, Merge Intervals, Trapping Rain Water).
-- ============================================================

DO $$
DECLARE
  cp_id uuid;
  q_id uuid;
  p_id uuid;
BEGIN
  -- ── 1. Ensure 10 checkpoints exist ─────────────────────────
  FOR i IN 1..10 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.checkpoints WHERE round_number = i) THEN
      INSERT INTO public.checkpoints (round_number, location_name)
      VALUES (i, 'Checkpoint ' || i);
    END IF;
  END LOOP;

  -- ── 2. Populate Round 1 Coding Questions & Test Cases ──────

  -- Q1: Reverse a String (Checkpoint 1)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 1;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads a string and prints it reversed.', 'hello', 'olleh')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, 'hello', 'olleh', true),
    (q_id, 'racecar', 'racecar', false),
    (q_id, 'TechTrack', 'kcarThceT', false),
    (q_id, '12345', '54321', false);

  -- Q2: Count Digits (Checkpoint 2)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 2;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads an integer N and prints the number of digits in N.', '5832', '4')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, '5832', '4', true),
    (q_id, '7', '1', false),
    (q_id, '987654321', '9', false),
    (q_id, '1000', '4', false);

  -- Q3: Multiplication Table (Checkpoint 3)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 3;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads an integer N and prints its multiplication table from 1 to 10 (each multiple on a new line).', '5', E'5\n10\n15\n20\n25\n30\n35\n40\n45\n50')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, '5', E'5\n10\n15\n20\n25\n30\n35\n40\n45\n50', true),
    (q_id, '2', E'2\n4\n6\n8\n10\n12\n14\n16\n18\n20', false),
    (q_id, '9', E'9\n18\n27\n36\n45\n54\n63\n72\n81\n90', false);

  -- Q4: Check Prime Number (Checkpoint 4)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 4;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads an integer N and prints "Prime" if N is a prime number, otherwise prints "Not Prime".', '17', 'Prime')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, '17', 'Prime', true),
    (q_id, '20', 'Not Prime', false),
    (q_id, '2', 'Prime', false),
    (q_id, '1', 'Not Prime', false),
    (q_id, '97', 'Prime', false);

  -- Q5: Find Factorial (Checkpoint 5)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 5;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads an integer N and prints its factorial.', '5', '120')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, '5', '120', true),
    (q_id, '0', '1', false),
    (q_id, '1', '1', false),
    (q_id, '7', '5040', false);

  -- Q6: Reverse Fibonacci Series (Checkpoint 6)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 6;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads an integer N and prints the first N terms of the Fibonacci series in reverse order, separated by a single space (The Fibonacci series begins: 0, 1, 1, 2, 3, 5, 8...).', '7', '8 5 3 1 1 0')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, '7', '8 5 3 1 1 0', true),
    (q_id, '5', '3 2 1 1 0', false),
    (q_id, '4', '2 1 1 0', false),
    (q_id, '1', '0', false);

  -- Q7: Palindrome String (Checkpoint 7)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 7;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads a string N and prints "Palindrome" if the string reads the same forward and backward, otherwise print "Not Palindrome".', 'bob', 'Palindrome')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, 'bob', 'Palindrome', true),
    (q_id, 'Coding', 'Not Palindrome', false),
    (q_id, 'madam', 'Palindrome', false),
    (q_id, 'racecar', 'Palindrome', false),
    (q_id, 'hello', 'Not Palindrome', false);

  -- Q8: Find Missing Number (Checkpoint 8)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 8;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads N-1 distinct integers from the range 1 to N and finds the missing number. The first line of input contains integer N. The second line contains N-1 space-separated integers.', E'5\n1 2 3 5', '4')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, E'5\n1 2 3 5', '4', true),
    (q_id, E'7\n1 2 3 4 6 7', '5', false),
    (q_id, E'4\n1 2 3', '4', false),
    (q_id, E'6\n2 3 4 5 6', '1', false);

  -- Q9: Find Maximum Occurring Element (Checkpoint 9)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 9;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads N integers and prints the element that occurs the maximum number of times. If multiple elements have the same highest frequency, print the smallest one. The first line of input contains N. The second line contains N space-separated integers.', E'7\n4 2 4 3 2 4 2', '2')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, E'7\n4 2 4 3 2 4 2', '2', true),
    (q_id, E'6\n5 5 2 2 3 3', '2', false),
    (q_id, E'5\n9 9 1 1 5', '1', false),
    (q_id, E'3\n10 20 30', '10', false);

  -- Q10: Longest Word in a Sentence (Checkpoint 10)
  SELECT id INTO cp_id FROM public.checkpoints WHERE round_number = 10;
  INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
  VALUES (cp_id, 'Write a program that reads a sentence and prints the longest word in it. If multiple words have the same maximum length, print the first one.', 'I love programming very much', 'programming')
  ON CONFLICT (checkpoint_id) DO UPDATE SET
    prompt = EXCLUDED.prompt,
    sample_input = EXCLUDED.sample_input,
    sample_output = EXCLUDED.sample_output,
    updated_at = now()
  RETURNING id INTO q_id;

  DELETE FROM public.test_cases WHERE question_id = q_id;
  INSERT INTO public.test_cases (question_id, input, expected_output, is_visible) VALUES
    (q_id, 'I love programming very much', 'programming', true),
    (q_id, 'coding makes life fun', 'coding', false),
    (q_id, 'apple banana orange', 'banana', false),
    (q_id, 'keep moving forward', 'forward', false);

  -- ── 3. Restore / Ensure Round 2 LeetCode Problems (Exactly 3) ───────
  DELETE FROM public.round_2_submissions WHERE id IS NOT NULL;
  DELETE FROM public.round_2_test_cases WHERE id IS NOT NULL;
  DELETE FROM public.round_2_problems WHERE id IS NOT NULL;

  -- 1. Easy Problem (Two Sum)
  INSERT INTO public.round_2_problems (title, prompt, difficulty, sample_input, sample_output, points, order_index)
  VALUES (
    'Two Sum',
    'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
    'easy',
    'nums = [2,7,11,15], target = 9',
    '[0,1]',
    100,
    1
  ) RETURNING id INTO p_id;

  INSERT INTO public.round_2_test_cases (problem_id, input, expected_output, is_visible)
  VALUES 
    (p_id, 'nums = [2,7,11,15], target = 9', '[0,1]', true),
    (p_id, 'nums = [3,2,4], target = 6', '[1,2]', true),
    (p_id, 'nums = [3,3], target = 6', '[0,1]', false);

  -- 2. Medium Problem (Merge Intervals)
  INSERT INTO public.round_2_problems (title, prompt, difficulty, sample_input, sample_output, points, order_index)
  VALUES (
    'Merge Intervals',
    'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
    'medium',
    'intervals = [[1,3],[2,6],[8,10],[15,18]]',
    '[[1,6],[8,10],[15,18]]',
    200,
    2
  ) RETURNING id INTO p_id;

  INSERT INTO public.round_2_test_cases (problem_id, input, expected_output, is_visible)
  VALUES 
    (p_id, 'intervals = [[1,3],[2,6],[8,10],[15,18]]', '[[1,6],[8,10],[15,18]]', true),
    (p_id, 'intervals = [[1,4],[4,5]]', '[[1,5]]', true),
    (p_id, 'intervals = [[1,4],[2,3]]', '[[1,4]]', false);

  -- 3. Hard Problem (Trapping Rain Water)
  INSERT INTO public.round_2_problems (title, prompt, difficulty, sample_input, sample_output, points, order_index)
  VALUES (
    'Trapping Rain Water',
    'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
    'hard',
    'height = [0,1,0,2,1,0,1,3,2,1,2,1]',
    '6',
    300,
    3
  ) RETURNING id INTO p_id;

  INSERT INTO public.round_2_test_cases (problem_id, input, expected_output, is_visible)
  VALUES 
    (p_id, 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', '6', true),
    (p_id, 'height = [4,2,0,3,2,5]', '9', true),
    (p_id, 'height = [4,2,3]', '1', false);

  -- ── 4. Ensure Event Settings are configured ──────────────────
  UPDATE public.event_settings
  SET total_rounds = 10, round_1_questions = 10
  WHERE id = 1;

END;
$$;
