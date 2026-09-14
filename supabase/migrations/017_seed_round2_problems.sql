-- ============================================================
-- Seed 3 Sample LeetCode Questions for Round 2
-- ============================================================

DO $$$
DECLARE
  q1_id uuid;
  q2_id uuid;
  q3_id uuid;
BEGIN
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
  ) RETURNING id INTO q1_id;

  INSERT INTO public.round_2_test_cases (problem_id, input, expected_output, is_visible)
  VALUES 
    (q1_id, 'nums = [2,7,11,15], target = 9', '[0,1]', true),
    (q1_id, 'nums = [3,2,4], target = 6', '[1,2]', true),
    (q1_id, 'nums = [3,3], target = 6', '[0,1]', false);

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
  ) RETURNING id INTO q2_id;

  INSERT INTO public.round_2_test_cases (problem_id, input, expected_output, is_visible)
  VALUES 
    (q2_id, 'intervals = [[1,3],[2,6],[8,10],[15,18]]', '[[1,6],[8,10],[15,18]]', true),
    (q2_id, 'intervals = [[1,4],[4,5]]', '[[1,5]]', true),
    (q2_id, 'intervals = [[1,4],[2,3]]', '[[1,4]]', false);

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
  ) RETURNING id INTO q3_id;

  INSERT INTO public.round_2_test_cases (problem_id, input, expected_output, is_visible)
  VALUES 
    (q3_id, 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', '6', true),
    (q3_id, 'height = [4,2,0,3,2,5]', '9', true),
    (q3_id, 'height = [4,2,3]', '1', false);

END;
$$$;
