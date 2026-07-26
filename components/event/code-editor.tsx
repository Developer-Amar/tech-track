"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Editor, { OnMount } from "@monaco-editor/react";
import { STARTER_TEMPLATES } from "@/lib/ide-templates";
import BentoCard from "@/components/bento-card";
import { TerminalSquare, Lock, Unlock, Code2 } from "lucide-react";

type TestResult = {
  passed: boolean;
  is_visible: boolean;
  input: string | null;
  expected_output: string | null;
  actual_output: string | null;
  error: string | null;
  status: string;
};

export default function CodeEditor({
  round,
  prompt,
  sampleInput,
  sampleOutput,
  tabSwitches = 0,
  ideSmartFeatures = true,
}: {
  round: number;
  prompt: string;
  sampleInput: string | null;
  sampleOutput: string | null;
  tabSwitches?: number;
  ideSmartFeatures?: boolean;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState<string>(() => STARTER_TEMPLATES["python"] ?? "");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    all_passed: boolean;
    verdict: string;
    compile_error: string | null;
    attempt_number: number;
    results: TestResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Telemetry refs
  const startTimeRef = useRef<number>(Date.now());
  const pasteCountRef = useRef<number>(0);
  const keystrokeCountRef = useRef<number>(0);

  const editorRef = useRef<any>(null);

  // Reset timer on mount
  useEffect(() => {
    startTimeRef.current = Date.now();
    pasteCountRef.current = 0;
    keystrokeCountRef.current = 0;
  }, [round]);

  // Initialize code with template if empty on mount or language switch
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const currentIsTemplate = Object.values(STARTER_TEMPLATES).some(
      (t) => t.trim() === code.trim()
    );
    if (!code.trim() || currentIsTemplate) {
      setCode(STARTER_TEMPLATES[newLang] ?? "");
    }
  };

  const handleResetTemplate = () => {
    if (confirm(`Reset editor to standard ${language.toUpperCase()} starter template? Your current edits will be replaced.`)) {
      const template = STARTER_TEMPLATES[language] ?? "";
      setCode(template);
      if (editorRef.current) {
        editorRef.current.setValue(template);
      }
    }
  };

  const handleFormatCode = () => {
    if (editorRef.current && ideSmartFeatures) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track keystrokes
    editor.onKeyDown(() => {
      keystrokeCountRef.current += 1;
    });

    // Track paste events in Monaco
    editor.onDidPaste(() => {
      pasteCountRef.current += 1;
      // Report paste to proctor API
      fetch("/api/event/proctor/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round,
          action: "report_strike",
          event_type: "paste_detected",
        }),
      });
    });

    // Define custom Tech Track Cyber Dark theme
    monaco.editor.defineTheme("tech-track-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "64748B", fontStyle: "italic" },
        { token: "keyword", foreground: "FF1E56", fontStyle: "bold" },
        { token: "string", foreground: "34D399" },
        { token: "number", foreground: "F59E0B" },
        { token: "delimiter", foreground: "94A3B8" },
        { token: "type", foreground: "A78BFA" },
        { token: "function", foreground: "38BDF8" },
        { token: "variable", foreground: "F8FAFC" },
      ],
      colors: {
        "editor.background": "#070912",
        "editor.foreground": "#F8FAFC",
        "editor.lineHighlightBackground": "#131726",
        "editorCursor.foreground": "#FF1E56",
        "editorWhitespace.foreground": "#334155",
        "editorIndentGuide.background": "#1E293B",
        "editorIndentGuide.activeBackground": "#FF1E56",
        "editorBracketMatch.background": "#FF1E5633",
        "editorBracketMatch.border": "#FF1E56",
        "editorError.foreground": "#EF4444",
        "editorWarning.foreground": "#F59E0B",
        "editorBracketHighlight.unexpectedBracket.foreground": "#EF4444",
        "editorGutter.background": "#070912",
        "editorLineNumber.foreground": "#475569",
        "editorLineNumber.activeForeground": "#FF1E56",
      },
    });

    monaco.editor.setTheme("tech-track-dark");
  };

  async function handleSubmit() {
    const codeToSubmit = editorRef.current ? editorRef.current.getValue() : code;
    if (!codeToSubmit.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    const timeTakenSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

    const res = await fetch("/api/event/code/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: codeToSubmit,
        language,
        round,
        tab_switches: tabSwitches,
        time_taken_seconds: timeTakenSeconds,
        paste_count: pasteCountRef.current,
        keystroke_count: keystrokeCountRef.current,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Submission failed");
      setLoading(false);
      return;
    }

    setResults(data);
    setLoading(false);

    if (data.all_passed) {
      setTimeout(() => router.refresh(), 2000);
    }
  }

  const languages = [
    { value: "python", label: "PYTHON", monacoLang: "python" },
    { value: "c", label: "C", monacoLang: "c" },
    { value: "cpp", label: "C++", monacoLang: "cpp" },
    { value: "java", label: "JAVA", monacoLang: "java" },
  ];

  const currentMonacoLang = ideSmartFeatures
    ? languages.find((l) => l.value === language)?.monacoLang ?? "python"
    : "plaintext";

  const monacoOptions: any = ideSmartFeatures
    ? {
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        lineNumbers: "on",
        renderLineHighlight: "all",
        bracketPairColorization: {
          enabled: true,
        },
        matchBrackets: "always",
        autoClosingBrackets: "always",
        autoClosingQuotes: "always",
        autoClosingOvertype: "always",
        autoIndent: "full",
        formatOnType: true,
        formatOnPaste: true,
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false,
        },
        acceptSuggestionOnEnter: "on",
        snippetSuggestions: "inline",
        padding: { top: 12, bottom: 12 },
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
      }
    : {
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        lineNumbers: "on",
        renderLineHighlight: "none",
        bracketPairColorization: { enabled: false },
        matchBrackets: "never",
        autoClosingBrackets: "never",
        autoClosingQuotes: "never",
        autoClosingOvertype: "never",
        autoIndent: "none",
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        acceptSuggestionOnEnter: "off",
        padding: { top: 12, bottom: 12 },
      };

  return (
    <BentoCard glowColor="default" className="rounded-2xl p-6 md:p-8 text-left relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none transition-all duration-500 group-hover:bg-white/10 group-hover:scale-110" />

      {/* Header Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
        <div>
          <p className="font-mono text-[9px] uppercase text-signal tracking-widest font-semibold">
            STAGE CHIEF: CODE ENGINE
          </p>
          <h3 className="font-display text-3xl font-extrabold text-white uppercase">
            CODING CHALLENGE
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {ideSmartFeatures ? (
            <span className="rounded bg-signal/15 border border-signal/30 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-signal font-semibold shadow-[0_0_10px_rgba(255,30,86,0.15)] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
              ⚡ SMART IDE ACTIVE
            </span>
          ) : (
            <span className="rounded bg-void/60 border border-dormant/30 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-dormant font-semibold">
              🔒 STRICT MODE (UNASSISTED)
            </span>
          )}
        </div>
      </div>

      <p className="text-dormant text-xs font-body mb-5 leading-relaxed">
        Write a program to solve the challenge. Read input from stdin and print output to stdout. If you get stuck, you can skip (0 points for code).
      </p>

      {/* Problem statement - Locked Copy & Selection */}
      <div
        className="rounded-xl border border-dormant/15 bg-void/40 p-5 mb-5 relative select-none"
        onCopy={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="font-mono text-[8px] text-dormant uppercase tracking-widest font-semibold">
            [PROBLEM_PROMPT_LOCKED]
          </span>
          <span className="font-mono text-[9px] text-signal/70 uppercase tracking-widest font-semibold flex items-center gap-1">
            🔒 COPYING PROMPT DISABLED
          </span>
        </div>
        <p className="text-text font-mono text-sm leading-relaxed whitespace-pre-wrap mt-1 select-none">
          {prompt}
        </p>
      </div>

      {/* Sample I/O */}
      {sampleInput && sampleOutput && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 select-text">
          <div className="rounded-xl border border-dormant/15 bg-void/20 p-4">
            <p className="text-dormant text-[10px] font-mono uppercase tracking-widest mb-1.5 font-semibold">
              [SAMPLE_INPUT]
            </p>
            <pre className="text-signal font-mono text-xs whitespace-pre-wrap">{sampleInput}</pre>
          </div>
          <div className="rounded-xl border border-dormant/15 bg-void/20 p-4">
            <p className="text-dormant text-[10px] font-mono uppercase tracking-widest mb-1.5 font-semibold">
              [SAMPLE_OUTPUT]
            </p>
            <pre className="text-signal font-mono text-xs whitespace-pre-wrap">{sampleOutput}</pre>
          </div>
        </div>
      )}

      {/* IDE Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 bg-void/60 border border-dormant/15 rounded-xl p-3">
        {/* Language picker */}
        <div className="flex gap-1.5 flex-wrap">
          {languages.map((lang) => (
            <button
              key={lang.value}
              onClick={() => handleLanguageChange(lang.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-mono tracking-wider transition-all border ${
                language === lang.value
                  ? "bg-signal/20 border-signal text-signal font-bold shadow-[0_0_10px_rgba(255,30,86,0.2)]"
                  : "bg-void/40 border-dormant/15 text-dormant hover:bg-void/80 hover:text-text"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* IDE Helper Actions */}
        <div className="flex gap-2 items-center w-full sm:w-auto justify-end font-mono">
          {ideSmartFeatures && (
            <button
              onClick={handleFormatCode}
              className="px-3 py-1.5 rounded-lg border border-dormant/20 hover:border-signal/40 bg-void/30 hover:bg-void text-dormant hover:text-text text-[11px] uppercase tracking-wider transition-all"
              title="Auto-format Code (Shift+Alt+F)"
            >
              ✨ Format Code
            </button>
          )}

          <button
            onClick={handleResetTemplate}
            className="px-3 py-1.5 rounded-lg border border-dormant/20 hover:border-signal/40 bg-void/30 hover:bg-void text-dormant hover:text-text text-[11px] uppercase tracking-wider transition-all"
            title={`Insert ${language.toUpperCase()} starter template`}
          >
            📋 Starter Template
          </button>
        </div>
      </div>

      {/* VS Code Monaco Editor Window - Deep Glass Terminal Pane */}
      <div className="relative rounded-xl border border-white/10 bg-black/50 overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] mt-4">
        <div className="flex justify-between items-center bg-black/60 px-4 py-2 border-b border-white/5 font-mono text-[9px] text-muted uppercase tracking-widest select-none backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80 shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
            <span className="ml-2 text-white/90 font-semibold flex items-center gap-2">
              <TerminalSquare className="w-3 h-3 text-[#7DF9FF]"/>
              solution.{language === "cpp" ? "cpp" : language === "python" ? "py" : language}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {ideSmartFeatures ? <Unlock className="w-3 h-3 text-[#7DF9FF]" /> : <Lock className="w-3 h-3 text-red-500" />}
            [CYBER_DECK_ENGINE]
          </div>
        </div>

        <Editor
          height="380px"
          language={currentMonacoLang}
          value={code}
          onChange={(val) => setCode(val ?? "")}
          onMount={handleEditorDidMount}
          options={monacoOptions}
          loading={
            <div className="flex flex-col items-center justify-center h-full text-dormant font-mono text-xs animate-pulse py-20">
              <span className="text-signal text-lg font-bold mb-2">⚡ LOADING VS CODE EDITOR ENGINE...</span>
              <span>Initializing language features & syntax highlighter</span>
            </div>
          }
        />
      </div>

      {/* Submit Action */}
      <button
        onClick={handleSubmit}
        disabled={loading || !code.trim()}
        className="w-full mt-5 btn-cyber px-4 py-4 rounded-xl text-xs uppercase font-bold tracking-widest"
      >
        {loading ? "COMPILING & EXECUTING TEST SUITES..." : "RUN & SUBMIT CODE"}
      </button>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 mt-4">
          <p className="text-danger text-xs font-mono">Error: {error}</p>
        </div>
      )}

      {/* Test Results */}
      {results && (
        <div className="mt-6 border-t border-dormant/10 pt-6">
          <div
            className={`rounded-xl p-4 mb-4 text-center font-mono text-xs uppercase tracking-widest border font-bold ${
              results.all_passed
                ? "bg-signal/10 border-signal text-signal shadow-[0_0_15px_rgba(255,30,86,0.2)] animate-pulse"
                : "bg-danger/10 border-danger/40 text-danger"
            }`}
          >
            {results.all_passed
              ? `✓ ALL TEST CASES PASSED! (Attempt #${results.attempt_number})`
              : `✗ SUBMISSION FAILED: ${results.verdict} (Attempt #${results.attempt_number})`}
          </div>

          {results.compile_error && (
            <div className="rounded-xl border border-danger/30 bg-void/80 p-4 mb-4 select-text">
              <p className="text-danger text-xs font-mono uppercase tracking-widest mb-2 font-bold">[COMPILER DIAGNOSTICS LOG]</p>
              <pre className="text-danger/90 font-mono text-xs overflow-x-auto whitespace-pre-wrap bg-void/60 p-3.5 rounded-lg border border-danger/20">
                {results.compile_error}
              </pre>
            </div>
          )}

          {!results.compile_error && (
            <div className="space-y-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-dormant font-semibold">
                TEST SUITE VERIFICATION REPORT
              </p>
              {results.results.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 transition-all duration-300 ${
                    r.passed
                      ? "border-signal/30 bg-signal/5"
                      : "border-danger/30 bg-danger/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-text font-mono text-xs font-semibold">
                      TEST CASE 0{i + 1} {!r.is_visible && "(secure hidden evaluation metric)"}
                    </span>
                    <span
                      className={`font-mono text-xs uppercase tracking-wider font-bold ${
                        r.passed ? "text-signal animate-pulse" : "text-danger"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  {r.is_visible && !r.passed && r.expected_output && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono select-text bg-void/40 p-3 rounded-lg border border-dormant/10">
                      <div>
                        <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">
                          [EXPECTED OUTPUT]
                        </p>
                        <pre className="text-text whitespace-pre-wrap">{r.expected_output}</pre>
                      </div>
                      <div>
                        <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">
                          [ACTUAL OUTPUT]
                        </p>
                        <pre className="text-danger whitespace-pre-wrap">{r.actual_output ?? "(empty)"}</pre>
                      </div>
                    </div>
                  )}
                  {r.error && r.is_visible && (
                    <p className="text-danger/80 text-xs font-mono mt-2 bg-void/30 p-2 rounded">
                      Error: {r.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skip challenge */}
      <div className="mt-6 pt-4 border-t border-dormant/10">
        {!showSkipConfirm ? (
          <button
            onClick={() => setShowSkipConfirm(true)}
            className="text-dormant text-xs font-mono uppercase tracking-wider hover:text-danger transition-colors duration-300 font-semibold"
          >
            ⚠️ Skip this challenge and move to the next round? →
          </button>
        ) : (
          <div className="rounded-xl border border-danger/35 bg-danger/5 p-4 mt-2">
            <p className="text-danger text-sm font-body mb-3">
              Are you sure? Skipping awards <strong>0 coding points</strong> for this round. You will still keep points earned from riddle and checkpoint (20 points).
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setSkipping(true);
                  const res = await fetch("/api/event/code/skip", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ round }),
                  });
                  if (res.ok) {
                    setTimeout(() => router.refresh(), 1000);
                  }
                  setSkipping(false);
                }}
                disabled={skipping}
                className="rounded-lg px-4 py-2 text-xs font-mono bg-danger text-white hover:bg-danger/80 disabled:opacity-50 uppercase tracking-widest font-semibold"
              >
                {skipping ? "SKIPPING..." : "YES, SKIP"}
              </button>
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="rounded-lg px-4 py-2 text-xs font-mono bg-dormant/10 text-dormant hover:text-text uppercase tracking-widest font-semibold"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  );
}
