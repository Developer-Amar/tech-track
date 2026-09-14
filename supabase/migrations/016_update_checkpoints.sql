-- ============================================================
-- Update Checkpoints to 10 Questions
-- ============================================================
DO $$$
DECLARE
  i int;
  new_cp_id uuid;
  new_q_id uuid;
BEGIN
  -- 1. Rename existing checkpoints from "Round X" to "Question X"
  UPDATE public.checkpoints 
  SET location_name = REPLACE(location_name, 'Round', 'Question') 
  WHERE location_name LIKE '%Round%';

  -- 2. Update existing Riddles if they reference "Round"
  UPDATE public.riddles 
  SET content = REPLACE(content, 'Round', 'Question') 
  WHERE content LIKE '%Round%';

  -- 3. Ensure we have exactly 10 questions
  FOR i IN 1..10 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.checkpoints WHERE round_number = i) THEN
      
      INSERT INTO public.checkpoints (location_name, round_number)
      VALUES ('Question ' || i, i)
      RETURNING id INTO new_cp_id;

      INSERT INTO public.riddles (checkpoint_id, content)
      VALUES (new_cp_id, 'Solve this riddle to find the location for Question ' || i || '.');

      INSERT INTO public.coding_questions (checkpoint_id, prompt, sample_input, sample_output)
      VALUES (new_cp_id, 'Write a program that takes an integer N from stdin and prints N to stdout.', '5', '5')
      RETURNING id INTO new_q_id;

      INSERT INTO public.test_cases (question_id, input, expected_output, is_visible)
      VALUES 
        (new_q_id, '5', '5', true),
        (new_q_id, '12', '12', false);
        
    END IF;
  END LOOP;
  
  -- 4. Update event settings
  UPDATE public.event_settings 
  SET total_rounds = 10, round_1_questions = 10 
  WHERE id = 1;
END;
$$$;
