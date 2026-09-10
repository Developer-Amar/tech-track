/**
 * AI Code Generation & Plagiarism Heuristic Engine
 * Computes an AI Suspicion Index (0 - 100%) based on structural, stylistic,
 * and pedagogical markers typical of ChatGPT, Claude, and Copilot.
 */

export interface AIAnalysisResult {
  score: number; // 0 to 100
  flagged: boolean; // true if score >= 50
  confidence: "low" | "medium" | "high";
  reasons: string[];
}

export function analyzeCodeForAI(code: string, language: string = "python"): AIAnalysisResult {
  if (!code || code.trim().length < 30) {
    return { score: 0, flagged: false, confidence: "low", reasons: [] };
  }

  const reasons: string[] = [];
  let score = 0;
  const cleanCode = code.trim();
  const lines = cleanCode.split("\n");
  const totalLines = lines.length;

  // 1. LLM-specific pedagogical comment signatures
  const llmCommentPatterns = [
    { pattern: /(?:time|space)\s*complexity\s*:\s*o\(/i, weight: 35, reason: "Explicit Time/Space Complexity comment annotation" },
    { pattern: /\/\/\s*function\s+to\s+|#\s*function\s+to\s+/i, weight: 25, reason: "Generic 'Function to...' introductory comment" },
    { pattern: /\/\/\s*driver\s+code|#\s*driver\s+code/i, weight: 20, reason: "Standard textbook 'Driver code' comment" },
    { pattern: /\/\/\s*helper\s+function|#\s*helper\s+function/i, weight: 20, reason: "'Helper function' annotation" },
    { pattern: /\/\/\s*step\s*\d+\s*:|#\s*step\s*\d+\s*:/i, weight: 25, reason: "Numbered tutorial-style 'Step N:' breakdown" },
    { pattern: /\/\/\s*base\s*case|#\s*base\s*case/i, weight: 15, reason: "Formal textbook 'Base case' comment" },
    { pattern: /\/\/\s*corner\s*cases?|#\s*edge\s*cases?/i, weight: 15, reason: "Explicit edge case annotation block" },
  ];

  for (const item of llmCommentPatterns) {
    if (item.pattern.test(cleanCode)) {
      score += item.weight;
      reasons.push(item.reason);
    }
  }

  // 2. High Comment-to-Code Ratio
  // Students in a timed contest write code fast without pedagogical commentary
  const commentLines = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith("//") || t.startsWith("#") || t.startsWith("/*") || t.startsWith("*");
  }).length;

  const commentRatio = totalLines > 5 ? commentLines / totalLines : 0;
  if (commentRatio > 0.35 && totalLines > 8) {
    score += 25;
    reasons.push(`Unusually high comment density (${Math.round(commentRatio * 100)}% of code is commentary)`);
  }

  // 3. Over-engineered Python Type Hinting & Imports
  if (language.toLowerCase() === "python") {
    if (cleanCode.includes("from typing import") && /(?:List|Dict|Tuple|Optional)\[/.test(cleanCode)) {
      score += 20;
      reasons.push("Formal typing imports with complex type annotations typical of LLM output");
    }
    if (/"""[\s\S]*?(?:Args|Returns|Parameters)[\s\S]*?"""/.test(cleanCode)) {
      score += 30;
      reasons.push("Full Google/Sphinx style Docstring specification with Args/Returns");
    }
  }

  // 4. Overly Verbose C++ / Java competitive boilerplate
  if (language.toLowerCase() === "cpp" || language.toLowerCase() === "c") {
    if (/ios_base::sync_with_stdio\(false\);\s*cin\.tie\(/i.test(cleanCode)) {
      score += 10;
      reasons.push("Standard competitive programming fast I/O boilerplate");
    }
  }

  // Normalize score between 0 and 100
  score = Math.min(100, Math.max(0, score));
  const flagged = score >= 50;
  const confidence = score >= 75 ? "high" : score >= 50 ? "medium" : "low";

  return {
    score,
    flagged,
    confidence,
    reasons,
  };
}

/**
 * Inspects a paste event to determine if it constitutes an external code dump
 */
export function inspectPastePayload(snippet: string, charCount: number): {
  isMajorPaste: boolean;
  aiSuspicionScore: number;
  tags: string[];
} {
  const tags: string[] = [];
  let aiScore = 0;

  if (charCount >= 100) {
    tags.push("large_paste_dump");
    aiScore += 20;
  }

  if (charCount >= 250) {
    tags.push("massive_paste_dump");
    aiScore += 30;
  }

  // Check if snippet contains function definitions
  if (/(?:def\s+\w+|function\s+\w+|int\s+\w+\(|public\s+static|class\s+\w+)/.test(snippet)) {
    tags.push("code_structure_pasted");
    aiScore += 30;
  }

  // Check for AI comment markers inside the paste
  if (/(?:time\s*complexity|helper\s*function|step\s*\d+:|#\s*function\s+to)/i.test(snippet)) {
    tags.push("ai_comment_signatures");
    aiScore += 40;
  }

  return {
    isMajorPaste: charCount >= 80,
    aiSuspicionScore: Math.min(100, aiScore),
    tags,
  };
}
