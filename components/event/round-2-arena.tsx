"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import {
  Code, CheckCircle, Circle, Trophy, Loader2, Play, AlertTriangle
} from "lucide-react";
import ProctorGuard from "@/components/event/proctor-guard";

interface R2Problem {
  id: string;
  title: string;
  prompt: string;
  difficulty: string;
  sample_input: string;
  sample_output: string;
  points: number;
  order_index: number;
}

interface R2Progress {
  problem_id: string;
  status: string;
  points: number;
}

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
];

export default function Round2Arena({ unitId }: { unitId: string }) {
  const [problems, setProblems] = useState<R2Problem[]>([]);
  const [progress, setProgress] = useState<R2Progress[]>([]);
  const [activeProblem, setActiveProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ passed: boolean; message: string } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchData = useCallback(async () => {
    try {
      const [problemsRes, progressRes] = await Promise.all([
        supabase.from('round_2_problems').select('*').order('order_index'),
        supabase.from('round_2_progress').select('problem_id, status, points').eq('unit_id', unitId),
      ]);
      setProblems(problemsRes.data ?? []);
      setProgress(progressRes.data ?? []);
    } catch (err) {
      console.error('Failed to fetch Round 2 data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, unitId]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('r2-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_2_progress', filter: `unit_id=eq.${unitId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, supabase, unitId]);

  const submitCode = async () => {
    if (!activeProblem || !code.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch('/api/event/round2/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: activeProblem, code, language }),
      });
      const data = await res.json();
      setSubmitResult({ passed: data.passed ?? false, message: data.message ?? (res.ok ? 'Submitted' : data.error ?? 'Failed') });
      if (data.passed) {
        await fetchData();
      }
    } catch {
      setSubmitResult({ passed: false, message: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const progressMap = new Map(progress.map(p => [p.problem_id, p]));
  const totalPoints = progress.reduce((sum, p) => sum + p.points, 0);
  const solved = progress.filter(p => p.status === 'passed').length;
  const selectedProblem = problems.find(p => p.id === activeProblem);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-signal animate-spin" /></div>;
  }

  return (
    <ProctorGuard round={2} onLockout={() => {}}>
      <div className="space-y-6">
      {/* Header */}
      <BentoCard delay={0.1} className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold font-semibold flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5" /> ROUND 2 — FINAL ARENA
            </span>
            <h2 className="font-display text-2xl font-bold text-white mt-1">
              <KineticText delay={0.1}>CODING CHALLENGES</KineticText>
            </h2>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-bold text-gold">{totalPoints}</p>
            <p className="font-mono text-[10px] text-dormant uppercase">{solved}/{problems.length} Solved</p>
          </div>
        </div>
      </BentoCard>

      {/* Problem Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {problems.map(problem => {
          const prog = progressMap.get(problem.id);
          const isPassed = prog?.status === 'passed';
          const isActive = activeProblem === problem.id;
          return (
            <button
              key={problem.id}
              onClick={() => {
                setActiveProblem(isActive ? null : problem.id);
                setCode("");
                setSubmitResult(null);
              }}
              disabled={isPassed}
              className={`rounded-xl border p-4 text-left transition-all duration-300 ${
                isPassed
                  ? 'border-signal/30 bg-signal/5 cursor-default'
                  : isActive
                  ? 'border-gold/30 bg-gold/5'
                  : 'border-white/[0.08] bg-void/50 hover:border-white/[0.15]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${
                  problem.difficulty === 'easy' ? 'border-signal/30 text-signal' :
                  problem.difficulty === 'hard' ? 'border-danger/30 text-danger' :
                  'border-gold/30 text-gold'
                }`}>{problem.difficulty}</span>
                {isPassed ? (
                  <CheckCircle className="w-5 h-5 text-signal" />
                ) : (
                  <Circle className="w-5 h-5 text-dormant/40" />
                )}
              </div>
              <h3 className="font-display text-sm font-semibold text-white">{problem.title}</h3>
              <p className="font-mono text-[10px] text-dormant mt-1">{problem.points} POINTS</p>
            </button>
          );
        })}
      </div>

      {/* Active Problem View */}
      {selectedProblem && !progressMap.get(selectedProblem.id)?.status?.includes('passed') && (
        <BentoCard delay={0.2} className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-xl font-bold text-white">{selectedProblem.title}</h3>
              <span className={`inline-block mt-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${
                selectedProblem.difficulty === 'easy' ? 'border-signal/30 text-signal' :
                selectedProblem.difficulty === 'hard' ? 'border-danger/30 text-danger' :
                'border-gold/30 text-gold'
              }`}>{selectedProblem.difficulty} · {selectedProblem.points} POINTS</span>
            </div>

            {/* Problem Statement */}
            <div className="rounded-lg border border-white/[0.06] bg-void/40 p-4">
              <pre className="font-body text-sm text-dormant whitespace-pre-wrap">{selectedProblem.prompt}</pre>
            </div>

            {/* Sample I/O */}
            {(selectedProblem.sample_input || selectedProblem.sample_output) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedProblem.sample_input && (
                  <div className="rounded-lg border border-white/[0.06] bg-void/40 p-3">
                    <p className="font-mono text-[10px] text-dormant uppercase mb-1">Sample Input</p>
                    <pre className="font-mono text-sm text-text">{selectedProblem.sample_input}</pre>
                  </div>
                )}
                {selectedProblem.sample_output && (
                  <div className="rounded-lg border border-white/[0.06] bg-void/40 p-3">
                    <p className="font-mono text-[10px] text-dormant uppercase mb-1">Expected Output</p>
                    <pre className="font-mono text-sm text-signal">{selectedProblem.sample_output}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Inline Code Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] text-dormant uppercase flex items-center gap-2">
                  <Code className="w-3 h-3" /> Your Solution
                </label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="rounded-lg border border-white/[0.08] bg-void/60 px-3 py-1.5 text-text font-mono text-xs focus:outline-none"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.value} value={l.value} className="bg-void">{l.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                rows={16}
                placeholder={`Write your ${language} solution here...`}
                className="w-full rounded-lg border border-white/[0.08] bg-void/60 px-4 py-3 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 resize-y transition-all duration-300"
                spellCheck={false}
              />

              {/* Submit */}
              <div className="flex items-center justify-between">
                <button
                  onClick={submitCode}
                  disabled={submitting || !code.trim()}
                  className="btn-cyber px-6 py-3 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Submit Solution
                </button>

                {submitResult && (
                  <div className={`rounded-lg border px-4 py-2 text-sm font-mono ${
                    submitResult.passed
                      ? 'border-signal/30 bg-signal/5 text-signal'
                      : 'border-danger/30 bg-danger/5 text-danger'
                  }`}>
                    {submitResult.passed ? <CheckCircle className="w-4 h-4 inline mr-2" /> : <AlertTriangle className="w-4 h-4 inline mr-2" />}
                    {submitResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </BentoCard>
      )}
      </div>
    </ProctorGuard>
  );
}
