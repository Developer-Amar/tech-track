import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

interface QuestionDef {
  order_index: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  prompt: string;
  sample_input: string;
  sample_output: string;
  test_cases: Array<{
    input: string;
    expected_output: string;
    is_visible: boolean;
  }>;
}

// Exactly 10 questions from the PDF for Round 1 (Checkpoints 1..10)
const ROUND_1_QUESTIONS: QuestionDef[] = [
  {
    order_index: 1,
    title: "Reverse a String",
    difficulty: "easy",
    points: 100,
    prompt: "Write a program that reads a string and prints it reversed.",
    sample_input: "hello",
    sample_output: "olleh",
    test_cases: [
      { input: "hello", expected_output: "olleh", is_visible: true },
      { input: "racecar", expected_output: "racecar", is_visible: false },
      { input: "TechTrack", expected_output: "kcarThceT", is_visible: false },
      { input: "12345", expected_output: "54321", is_visible: false },
    ],
  },
  {
    order_index: 2,
    title: "Count Digits",
    difficulty: "easy",
    points: 100,
    prompt: "Write a program that reads an integer N and prints the number of digits in N.",
    sample_input: "5832",
    sample_output: "4",
    test_cases: [
      { input: "5832", expected_output: "4", is_visible: true },
      { input: "7", expected_output: "1", is_visible: false },
      { input: "987654321", expected_output: "9", is_visible: false },
      { input: "1000", expected_output: "4", is_visible: false },
    ],
  },
  {
    order_index: 3,
    title: "Multiplication Table",
    difficulty: "easy",
    points: 100,
    prompt: "Write a program that reads an integer N and prints its multiplication table from 1 to 10 (each multiple on a new line).",
    sample_input: "5",
    sample_output: "5\n10\n15\n20\n25\n30\n35\n40\n45\n50",
    test_cases: [
      { input: "5", expected_output: "5\n10\n15\n20\n25\n30\n35\n40\n45\n50", is_visible: true },
      { input: "2", expected_output: "2\n4\n6\n8\n10\n12\n14\n16\n18\n20", is_visible: false },
      { input: "9", expected_output: "9\n18\n27\n36\n45\n54\n63\n72\n81\n90", is_visible: false },
    ],
  },
  {
    order_index: 4,
    title: "Check Prime Number",
    difficulty: "medium",
    points: 150,
    prompt: "Write a program that reads an integer N and prints \"Prime\" if N is a prime number, otherwise prints \"Not Prime\".",
    sample_input: "17",
    sample_output: "Prime",
    test_cases: [
      { input: "17", expected_output: "Prime", is_visible: true },
      { input: "20", expected_output: "Not Prime", is_visible: false },
      { input: "2", expected_output: "Prime", is_visible: false },
      { input: "1", expected_output: "Not Prime", is_visible: false },
      { input: "97", expected_output: "Prime", is_visible: false },
    ],
  },
  {
    order_index: 5,
    title: "Find Factorial",
    difficulty: "medium",
    points: 150,
    prompt: "Write a program that reads an integer N and prints its factorial.",
    sample_input: "5",
    sample_output: "120",
    test_cases: [
      { input: "5", expected_output: "120", is_visible: true },
      { input: "0", expected_output: "1", is_visible: false },
      { input: "1", expected_output: "1", is_visible: false },
      { input: "7", expected_output: "5040", is_visible: false },
    ],
  },
  {
    order_index: 6,
    title: "Reverse Fibonacci Series",
    difficulty: "medium",
    points: 150,
    prompt: "Write a program that reads an integer N and prints the first N terms of the Fibonacci series in reverse order, separated by a single space (The Fibonacci series begins: 0, 1, 1, 2, 3, 5, 8...).",
    sample_input: "7",
    sample_output: "8 5 3 1 1 0",
    test_cases: [
      { input: "7", expected_output: "8 5 3 1 1 0", is_visible: true },
      { input: "5", expected_output: "3 2 1 1 0", is_visible: false },
      { input: "4", expected_output: "2 1 1 0", is_visible: false },
      { input: "1", expected_output: "0", is_visible: false },
    ],
  },
  {
    order_index: 7,
    title: "Palindrome String",
    difficulty: "medium",
    points: 150,
    prompt: "Write a program that reads a string N and prints \"Palindrome\" if the string reads the same forward and backward, otherwise print \"Not Palindrome\".",
    sample_input: "bob",
    sample_output: "Palindrome",
    test_cases: [
      { input: "bob", expected_output: "Palindrome", is_visible: true },
      { input: "Coding", expected_output: "Not Palindrome", is_visible: false },
      { input: "madam", expected_output: "Palindrome", is_visible: false },
      { input: "racecar", expected_output: "Palindrome", is_visible: false },
      { input: "hello", expected_output: "Not Palindrome", is_visible: false },
    ],
  },
  {
    order_index: 8,
    title: "Find Missing Number",
    difficulty: "hard",
    points: 200,
    prompt: "Write a program that reads N-1 distinct integers from the range 1 to N and finds the missing number. The first line of input contains integer N. The second line contains N-1 space-separated integers.",
    sample_input: "5\n1 2 3 5",
    sample_output: "4",
    test_cases: [
      { input: "5\n1 2 3 5", expected_output: "4", is_visible: true },
      { input: "7\n1 2 3 4 6 7", expected_output: "5", is_visible: false },
      { input: "4\n1 2 3", expected_output: "4", is_visible: false },
      { input: "6\n2 3 4 5 6", expected_output: "1", is_visible: false },
    ],
  },
  {
    order_index: 9,
    title: "Find Maximum Occurring Element",
    difficulty: "hard",
    points: 200,
    prompt: "Write a program that reads N integers and prints the element that occurs the maximum number of times. If multiple elements have the same highest frequency, print the smallest one. The first line of input contains N. The second line contains N space-separated integers.",
    sample_input: "7\n4 2 4 3 2 4 2",
    sample_output: "2",
    test_cases: [
      { input: "7\n4 2 4 3 2 4 2", expected_output: "2", is_visible: true },
      { input: "6\n5 5 2 2 3 3", expected_output: "2", is_visible: false },
      { input: "5\n9 9 1 1 5", expected_output: "1", is_visible: false },
      { input: "3\n10 20 30", expected_output: "10", is_visible: false },
    ],
  },
  {
    order_index: 10,
    title: "Longest Word in a Sentence",
    difficulty: "hard",
    points: 200,
    prompt: "Write a program that reads a sentence and prints the longest word in it. If multiple words have the same maximum length, print the first one.",
    sample_input: "I love programming very much",
    sample_output: "programming",
    test_cases: [
      { input: "I love programming very much", expected_output: "programming", is_visible: true },
      { input: "coding makes life fun", expected_output: "coding", is_visible: false },
      { input: "apple banana orange", expected_output: "banana", is_visible: false },
      { input: "keep moving forward", expected_output: "forward", is_visible: false },
    ],
  },
];

// Exactly 3 LeetCode problems for Round 2 (Final Arena)
const ROUND_2_PROBLEMS = [
  {
    order_index: 1,
    title: "Two Sum",
    difficulty: "easy" as const,
    points: 100,
    prompt: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.",
    sample_input: "nums = [2,7,11,15], target = 9",
    sample_output: "[0,1]",
    test_cases: [
      { input: "nums = [2,7,11,15], target = 9", expected_output: "[0,1]", is_visible: true },
      { input: "nums = [3,2,4], target = 6", expected_output: "[1,2]", is_visible: true },
      { input: "nums = [3,3], target = 6", expected_output: "[0,1]", is_visible: false },
    ],
  },
  {
    order_index: 2,
    title: "Merge Intervals",
    difficulty: "medium" as const,
    points: 200,
    prompt: "Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
    sample_input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
    sample_output: "[[1,6],[8,10],[15,18]]",
    test_cases: [
      { input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", expected_output: "[[1,6],[8,10],[15,18]]", is_visible: true },
      { input: "intervals = [[1,4],[4,5]]", expected_output: "[[1,5]]", is_visible: true },
      { input: "intervals = [[1,4],[2,3]]", expected_output: "[[1,4]]", is_visible: false },
    ],
  },
  {
    order_index: 3,
    title: "Trapping Rain Water",
    difficulty: "hard" as const,
    points: 300,
    prompt: "Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
    sample_input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]",
    sample_output: "6",
    test_cases: [
      { input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", expected_output: "6", is_visible: true },
      { input: "height = [4,2,0,3,2,5]", expected_output: "9", is_visible: true },
      { input: "height = [4,2,3]", expected_output: "1", is_visible: false },
    ],
  },
];

async function main() {
  console.log("=== Setting up 10 Round 1 Questions & 3 Round 2 LeetCode Problems ===");

  // 1. Ensure checkpoints 1..10 exist
  const { data: existingCheckpoints, error: cpErr } = await supabase
    .from("checkpoints")
    .select("id, round_number, location_name")
    .order("round_number");

  if (cpErr) {
    console.error("Error fetching checkpoints:", cpErr);
    process.exit(1);
  }

  const cpMap = new Map((existingCheckpoints ?? []).map(cp => [cp.round_number, cp]));

  for (let r = 1; r <= 10; r++) {
    if (!cpMap.has(r)) {
      console.log(`Creating checkpoint for Round ${r}...`);
      const { data: newCp, error: insErr } = await supabase
        .from("checkpoints")
        .insert({
          round_number: r,
          location_name: `Checkpoint ${r}`,
        })
        .select()
        .single();
      if (insErr) {
        console.error(`Failed to create checkpoint ${r}:`, insErr);
        process.exit(1);
      }
      cpMap.set(r, newCp);
    }
  }

  // 2. Set up Round 1 coding_questions and test_cases (Questions 1..10)
  console.log("\n--- Populating Round 1 coding_questions & test_cases (10 Questions) ---");
  for (let i = 1; i <= 10; i++) {
    const qDef = ROUND_1_QUESTIONS.find(q => q.order_index === i)!;
    const cp = cpMap.get(i)!;

    const { data: existingQ } = await supabase
      .from("coding_questions")
      .select("id")
      .eq("checkpoint_id", cp.id)
      .maybeSingle();

    let questionId: string;
    if (existingQ) {
      console.log(`Updating Round 1 Question ${i}: "${qDef.title}"...`);
      await supabase
        .from("coding_questions")
        .update({
          prompt: qDef.prompt,
          sample_input: qDef.sample_input,
          sample_output: qDef.sample_output,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingQ.id);
      questionId = existingQ.id;
    } else {
      console.log(`Inserting Round 1 Question ${i}: "${qDef.title}"...`);
      const { data: insQ, error: qInsErr } = await supabase
        .from("coding_questions")
        .insert({
          checkpoint_id: cp.id,
          prompt: qDef.prompt,
          sample_input: qDef.sample_input,
          sample_output: qDef.sample_output,
        })
        .select("id")
        .single();
      if (qInsErr) {
        console.error(`Error inserting question for round ${i}:`, qInsErr);
        continue;
      }
      questionId = insQ.id;
    }

    // Replace test cases
    await supabase.from("test_cases").delete().eq("question_id", questionId);
    const tcRows = qDef.test_cases.map(tc => ({
      question_id: questionId,
      input: tc.input,
      expected_output: tc.expected_output,
      is_visible: tc.is_visible,
    }));
    const { error: tcErr } = await supabase.from("test_cases").insert(tcRows);
    if (tcErr) {
      console.error(`Error inserting test cases for round ${i}:`, tcErr);
    } else {
      console.log(`  ✓ Inserted ${tcRows.length} test cases for Question ${i}`);
    }
  }

  // 3. Set up Round 2 round_2_problems and round_2_test_cases (Exactly 3 LeetCode Problems)
  console.log("\n--- Populating Round 2 Arena with 3 LeetCode Problems ---");
  await supabase.from("round_2_test_cases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("round_2_problems").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  for (const pDef of ROUND_2_PROBLEMS) {
    console.log(`Inserting Round 2 Problem ${pDef.order_index}: "${pDef.title}" (${pDef.difficulty}, ${pDef.points} pts)...`);
    const { data: problem, error: pErr } = await supabase
      .from("round_2_problems")
      .insert({
        title: pDef.title,
        prompt: pDef.prompt,
        difficulty: pDef.difficulty,
        points: pDef.points,
        order_index: pDef.order_index,
        sample_input: pDef.sample_input,
        sample_output: pDef.sample_output,
      })
      .select("id")
      .single();

    if (pErr) {
      console.error(`Error inserting R2 problem ${pDef.order_index}:`, pErr);
      continue;
    }

    const r2TcRows = pDef.test_cases.map(tc => ({
      problem_id: problem.id,
      input: tc.input,
      expected_output: tc.expected_output,
      is_visible: tc.is_visible,
    }));

    const { error: tcErr } = await supabase.from("round_2_test_cases").insert(r2TcRows);
    if (tcErr) {
      console.error(`Error inserting R2 test cases for ${pDef.title}:`, tcErr);
    } else {
      console.log(`  ✓ Inserted ${r2TcRows.length} test cases for ${pDef.title}`);
    }
  }

  // 4. Update event_settings to ensure total_rounds = 10 and round_1_questions = 10
  await supabase
    .from("event_settings")
    .update({ total_rounds: 10, round_1_questions: 10 })
    .eq("id", 1);

  console.log("\n=== Setup Complete! Exactly 10 Round 1 questions and 3 Round 2 LeetCode problems are live on portal! ===");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
