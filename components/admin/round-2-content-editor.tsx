"use client";

import { useEffect, useState, useCallback } from "react";
import BentoCard from "@/components/bento-card";
import {
  Plus, Trash2, Save, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Code, FileText
} from "lucide-react";

interface TestCase {
  id?: string;
  input: string;
  expected_output: string;
  is_visible: boolean;
}

interface Problem {
  id?: string;
  title: string;
  prompt: string;
  difficulty: string;
  sample_input: string;
  sample_output: string;
  points: number;
  order_index: number;
  test_cases?: TestCase[];
}

export default function Round2ContentEditor() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProblems = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rounds/problems');
      if (res.ok) {
        const data = await res.json();
        setProblems(data.problems ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch problems:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProblems(); }, [fetchProblems]);

  const saveProblem = async (problem: Problem) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/rounds/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: problem.id ? 'update' : 'create', problem }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message ?? 'Saved' });
        await fetchProblems();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteProblem = async (id: string) => {
    if (!confirm('Delete this problem and all its test cases?')) return;
    try {
      const res = await fetch('/api/admin/rounds/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', problem_id: id }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Problem deleted' });
        await fetchProblems();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const addNewProblem = () => {
    const newProblem: Problem = {
      title: '',
      prompt: '',
      difficulty: 'medium',
      sample_input: '',
      sample_output: '',
      points: 100,
      order_index: problems.length + 1,
      test_cases: [],
    };
    setProblems(prev => [...prev, newProblem]);
    setExpanded(`new-${problems.length}`);
  };

  const updateProblem = (index: number, updates: Partial<Problem>) => {
    setProblems(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const addTestCase = (problemIndex: number) => {
    setProblems(prev => prev.map((p, i) => i === problemIndex ? {
      ...p,
      test_cases: [...(p.test_cases ?? []), { input: '', expected_output: '', is_visible: false }],
    } : p));
  };

  const updateTestCase = (problemIndex: number, tcIndex: number, updates: Partial<TestCase>) => {
    setProblems(prev => prev.map((p, i) => i === problemIndex ? {
      ...p,
      test_cases: (p.test_cases ?? []).map((tc, j) => j === tcIndex ? { ...tc, ...updates } : tc),
    } : p));
  };

  const removeTestCase = (problemIndex: number, tcIndex: number) => {
    setProblems(prev => prev.map((p, i) => i === problemIndex ? {
      ...p,
      test_cases: (p.test_cases ?? []).filter((_, j) => j !== tcIndex),
    } : p));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-signal animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold font-semibold flex items-center gap-2">
            <Code className="w-3.5 h-3.5" /> ROUND 2 PROBLEMS
          </span>
          <h2 className="font-display text-xl font-bold text-white mt-1">LeetCode Problems Editor</h2>
        </div>
        <button onClick={addNewProblem} className="btn-cyber px-4 py-2 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Problem
        </button>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-mono ${
          message.type === 'success' ? 'border-signal/30 bg-signal/5 text-signal' : 'border-danger/30 bg-danger/5 text-danger'
        }`}>{message.text}</div>
      )}

      {problems.length === 0 ? (
        <div className="text-center py-12 text-dormant font-mono text-sm">No problems yet. Click &quot;Add Problem&quot; to create one.</div>
      ) : (
        <div className="space-y-3">
          {problems.map((problem, pi) => {
            const key = problem.id ?? `new-${pi}`;
            const isExpanded = expanded === key;
            return (
              <div key={key} className="rounded-xl border border-white/[0.08] bg-void/50 overflow-hidden">
                {/* Header */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-dormant" /> : <ChevronDown className="w-4 h-4 text-dormant" />}
                  <span className="font-mono text-xs text-dormant">#{problem.order_index}</span>
                  <span className="font-body text-sm text-white flex-1">{problem.title || 'Untitled Problem'}</span>
                  <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${
                    problem.difficulty === 'easy' ? 'border-signal/30 text-signal' :
                    problem.difficulty === 'hard' ? 'border-danger/30 text-danger' :
                    'border-gold/30 text-gold'
                  }`}>{problem.difficulty}</span>
                  <span className="font-mono text-xs text-gold">{problem.points}pts</span>
                </div>

                {/* Expanded Editor */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] px-4 py-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-[10px] text-dormant uppercase block mb-1">Title</label>
                        <input
                          value={problem.title}
                          onChange={e => updateProblem(pi, { title: e.target.value })}
                          className="w-full rounded-lg border border-white/[0.08] bg-void/60 px-3 py-2 text-text font-body text-sm focus:border-signal focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="font-mono text-[10px] text-dormant uppercase block mb-1">Difficulty</label>
                          <select
                            value={problem.difficulty}
                            onChange={e => updateProblem(pi, { difficulty: e.target.value })}
                            className="w-full rounded-lg border border-white/[0.08] bg-void/60 px-3 py-2 text-text font-mono text-sm focus:outline-none"
                          >
                            <option value="easy" className="bg-void">Easy</option>
                            <option value="medium" className="bg-void">Medium</option>
                            <option value="hard" className="bg-void">Hard</option>
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="font-mono text-[10px] text-dormant uppercase block mb-1">Points</label>
                          <input
                            type="number"
                            value={problem.points}
                            onChange={e => updateProblem(pi, { points: parseInt(e.target.value) || 100 })}
                            className="w-full rounded-lg border border-white/[0.08] bg-void/60 px-3 py-2 text-text font-mono text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="font-mono text-[10px] text-dormant uppercase block mb-1">Problem Statement</label>
                      <textarea
                        value={problem.prompt}
                        onChange={e => updateProblem(pi, { prompt: e.target.value })}
                        rows={6}
                        className="w-full rounded-lg border border-white/[0.08] bg-void/60 px-3 py-2 text-text font-mono text-sm focus:border-signal focus:outline-none resize-y"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-[10px] text-dormant uppercase block mb-1">Sample Input</label>
                        <textarea
                          value={problem.sample_input}
                          onChange={e => updateProblem(pi, { sample_input: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-white/[0.08] bg-void/60 px-3 py-2 text-text font-mono text-sm focus:outline-none resize-y"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[10px] text-dormant uppercase block mb-1">Sample Output</label>
                        <textarea
                          value={problem.sample_output}
                          onChange={e => updateProblem(pi, { sample_output: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-white/[0.08] bg-void/60 px-3 py-2 text-text font-mono text-sm focus:outline-none resize-y"
                        />
                      </div>
                    </div>

                    {/* Test Cases */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-mono text-[10px] text-dormant uppercase flex items-center gap-2">
                          <FileText className="w-3 h-3" /> Test Cases ({(problem.test_cases ?? []).length})
                        </label>
                        <button onClick={() => addTestCase(pi)} className="text-signal text-xs font-mono hover:underline flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(problem.test_cases ?? []).map((tc, tci) => (
                          <div key={tci} className="rounded-lg border border-white/[0.06] bg-void/40 p-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-start">
                            <div>
                              <label className="font-mono text-[9px] text-dormant uppercase">Input</label>
                              <textarea
                                value={tc.input}
                                onChange={e => updateTestCase(pi, tci, { input: e.target.value })}
                                rows={2}
                                className="w-full rounded border border-white/[0.06] bg-void/60 px-2 py-1 text-text font-mono text-xs focus:outline-none resize-y"
                              />
                            </div>
                            <div>
                              <label className="font-mono text-[9px] text-dormant uppercase">Expected Output</label>
                              <textarea
                                value={tc.expected_output}
                                onChange={e => updateTestCase(pi, tci, { expected_output: e.target.value })}
                                rows={2}
                                className="w-full rounded border border-white/[0.06] bg-void/60 px-2 py-1 text-text font-mono text-xs focus:outline-none resize-y"
                              />
                            </div>
                            <button
                              onClick={() => updateTestCase(pi, tci, { is_visible: !tc.is_visible })}
                              className={`p-2 rounded transition-colors mt-4 ${tc.is_visible ? 'text-signal' : 'text-dormant hover:text-white'}`}
                              title={tc.is_visible ? 'Visible to participants' : 'Hidden test case'}
                            >
                              {tc.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => removeTestCase(pi, tci)}
                              className="p-2 rounded text-dormant hover:text-danger transition-colors mt-4"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                      <button
                        onClick={() => saveProblem(problem)}
                        disabled={saving}
                        className="btn-cyber px-4 py-2 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save Problem
                      </button>
                      {problem.id && (
                        <button
                          onClick={() => deleteProblem(problem.id!)}
                          className="text-dormant hover:text-danger text-xs font-mono transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
