"use client";

import { useState, useEffect } from "react";

type ContentData = {
  checkpoints: Array<{ id: string; location_name: string; round_number: number }>;
  riddles: Array<{
    id: string;
    checkpoint_id: string;
    content: string;
    alternate_answers?: string[];
    hints?: string[];
  }>;
  questions: Array<{ id: string; checkpoint_id: string; prompt: string; sample_input: string; sample_output: string }>;
  test_cases: Array<{ id: string; question_id: string; input: string; expected_output: string; is_visible: boolean }>;
  is_locked?: boolean;
};

export default function ContentEditor() {
  const [data, setData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    const res = await fetch("/api/admin/content");
    const d = await res.json();
    setData(d);
    setIsLocked(d.is_locked ?? false);
    setLoading(false);
  }

  async function saveField(entity: string, id: string, field: string, value: any) {
    if (isLocked) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, action: "update", data: { id, [field]: value } }),
    });
    const result = await res.json();
    if (res.ok) {
      setMsg("Saved!");
      loadContent();
    } else {
      setMsg(result.error || "Failed");
    }
    setSaving(false);
    setEditingField(null);
    setTimeout(() => setMsg(null), 2500);
  }

  async function addRound() {
    if (isLocked) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_round" }),
    });
    const result = await res.json();
    if (res.ok) {
      setMsg(result.message || "Round successfully added.");
      loadContent();
    } else {
      setMsg(result.error || "Failed to add round");
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 2500);
  }

  async function removeLastRound() {
    if (isLocked) return;
    const currentRounds = data?.checkpoints.length ?? 0;
    if (currentRounds <= 1) {
      alert("Cannot remove the final remaining round.");
      return;
    }

    if (!confirm(`WIPE WARNING:\nAre you sure you want to delete Round ${currentRounds}?\nAll associated riddles, questions, and test cases will be permanently deleted. This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_last_round" }),
    });
    const result = await res.json();
    if (res.ok) {
      setMsg(result.message || "Round successfully removed.");
      loadContent();
    } else {
      setMsg(result.error || "Failed to remove round");
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 2500);
  }

  if (loading) return <p className="text-dormant text-sm font-mono animate-pulse uppercase tracking-widest">[Loading hunt contents...]</p>;
  if (!data) return <p className="text-danger text-sm font-mono">[Error loading hunt content configurations]</p>;

  return (
    <div className="space-y-6 text-left">
      {/* Alert Dispatch */}
      {msg && (
        <div className="rounded-xl border border-signal/30 bg-signal/5 p-3.5 mb-4 animate-pulse">
          <p className="text-signal text-xs font-mono font-semibold">[SYSTEM ALERT] {msg}</p>
        </div>
      )}

      {/* Lock banner if event started / registration closed */}
      {isLocked && (
        <div className="rounded-xl border border-danger/45 bg-danger/10 px-4 py-3 mb-6 animate-pulse">
          <p className="text-danger text-xs font-mono font-semibold uppercase tracking-wider">
            🔒 ROUNDS CONSOLE LOCKED: Registration is closed or the event has started. Rounds cannot be added, removed, or edited.
          </p>
        </div>
      )}

      {/* Admin control panel to add/remove rounds */}
      {!isLocked && (
        <div className="flex gap-3 bg-void/30 border border-dormant/15 p-4 rounded-2xl items-center justify-between">
          <div>
            <h4 className="font-display text-lg font-bold text-white uppercase">Round Controls</h4>
            <p className="text-dormant text-xs font-body">Add or remove event stages prior to starting the hunt.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addRound}
              disabled={saving}
              className="px-4 py-2 bg-signal/10 hover:bg-signal/20 text-signal border border-signal/30 rounded font-mono text-xs uppercase tracking-widest font-semibold transition-all disabled:opacity-50"
            >
              + ADD ROUND
            </button>
            <button
              onClick={removeLastRound}
              disabled={saving || data.checkpoints.length <= 1}
              className="px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded font-mono text-xs uppercase tracking-widest font-semibold transition-all disabled:opacity-50"
            >
              - REMOVE ROUND
            </button>
          </div>
        </div>
      )}

      {data.checkpoints.map((cp) => {
        const riddle = data.riddles.find((r) => r.checkpoint_id === cp.id);
        const question = data.questions.find((q) => q.checkpoint_id === cp.id);
        const tests = data.test_cases.filter((t) => t.question_id === question?.id);

        return (
          <div key={cp.id} className="rounded-2xl border border-dormant/15 bg-void/40 p-5 relative overflow-hidden transition-all duration-300 hover:border-signal/25">
            <div className="absolute top-0 right-0 w-12 h-12 bg-signal/5 rounded-bl-full pointer-events-none" />
            <h4 className="font-display text-2xl font-bold text-signal mb-4 uppercase tracking-wide">
              ROUND {cp.round_number < 10 ? `0${cp.round_number}` : cp.round_number} SETTINGS
            </h4>

            {/* Location name */}
            <EditableField
              label="Checkpoint Location Name"
              value={cp.location_name}
              fieldKey={`cp-${cp.id}-location_name`}
              editingField={editingField}
              editValue={editValue}
              setEditingField={setEditingField}
              setEditValue={setEditValue}
              onSave={(val) => saveField("checkpoints", cp.id, "location_name", val)}
              saving={saving}
              isLocked={isLocked}
            />

            {/* Riddle & Alternative Answers & Hints */}
            {riddle && (
              <div className="space-y-4">
                <EditableField
                  label="Riddle Content"
                  value={riddle.content}
                  fieldKey={`riddle-${riddle.id}-content`}
                  editingField={editingField}
                  editValue={editValue}
                  setEditingField={setEditingField}
                  setEditValue={setEditValue}
                  onSave={(val) => saveField("riddles", riddle.id, "content", val)}
                  saving={saving}
                  isLocked={isLocked}
                  multiline
                />

                {/* Accepted Alternative Answers (Array) */}
                <AlternateAnswersEditor
                  answers={riddle.alternate_answers || []}
                  locationName={cp.location_name}
                  onSave={(newAnswers) => saveField("riddles", riddle.id, "alternate_answers", newAnswers)}
                  saving={saving}
                  isLocked={isLocked}
                />

                {/* 3 Sub-Hints Section */}
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[#00E5FF] text-[11px] font-mono uppercase tracking-widest font-semibold flex items-center gap-1.5">
                      <span>💡</span> 3 CAMPUS SUB-HINTS (PROGRESSIVE PARTICIPANT CLUES)
                    </p>
                    <span className="text-[10px] font-mono text-dormant uppercase">
                      Hints Broadcast
                    </span>
                  </div>
                  <p className="text-dormant text-xs font-body mb-3">
                    Configure up to 3 progressive clues that participants can decrypt when stuck to help them navigate campus to this checkpoint.
                  </p>
                  <div className="space-y-2">
                    {[0, 1, 2].map((idx) => {
                      const hintLabels = [
                        "Sub-Hint 1 (General Area / Zone Clue)",
                        "Sub-Hint 2 (Landmark / Visual Detail Clue)",
                        "Sub-Hint 3 (Direct Location Orientation Clue)",
                      ];
                      const currentHints = riddle.hints || [];
                      const currentVal = currentHints[idx] || "";
                      return (
                        <EditableField
                          key={idx}
                          label={`[CLUE 0${idx + 1}] ${hintLabels[idx]}`}
                          value={currentVal}
                          fieldKey={`riddle-${riddle.id}-hint-${idx}`}
                          editingField={editingField}
                          editValue={editValue}
                          setEditingField={setEditingField}
                          setEditValue={setEditValue}
                          onSave={(val) => {
                            const updated = [...currentHints];
                            while (updated.length < 3) updated.push("");
                            updated[idx] = val.trim();
                            saveField("riddles", riddle.id, "hints", updated);
                          }}
                          saving={saving}
                          isLocked={isLocked}
                          multiline
                          compact
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Question */}
            {question && (
              <div className="mt-4 pt-4 border-t border-dormant/10 space-y-4">
                <EditableField
                  label="Coding Prompt"
                  value={question.prompt}
                  fieldKey={`q-${question.id}-prompt`}
                  editingField={editingField}
                  editValue={editValue}
                  setEditingField={setEditingField}
                  setEditValue={setEditValue}
                  onSave={(val) => saveField("coding_questions", question.id, "prompt", val)}
                  saving={saving}
                  isLocked={isLocked}
                  multiline
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EditableField
                    label="Sample Input"
                    value={question.sample_input ?? ""}
                    fieldKey={`q-${question.id}-sample_input`}
                    editingField={editingField}
                    editValue={editValue}
                    setEditingField={setEditingField}
                    setEditValue={setEditValue}
                    onSave={(val) => saveField("coding_questions", question.id, "sample_input", val)}
                    saving={saving}
                    isLocked={isLocked}
                  />
                  <EditableField
                    label="Sample Output"
                    value={question.sample_output ?? ""}
                    fieldKey={`q-${question.id}-sample_output`}
                    editingField={editingField}
                    editValue={editValue}
                    setEditingField={setEditingField}
                    setEditValue={setEditValue}
                    onSave={(val) => saveField("coding_questions", question.id, "sample_output", val)}
                    saving={saving}
                    isLocked={isLocked}
                  />
                </div>
              </div>
            )}

            {/* Test Cases */}
            {tests.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dormant/10">
                <p className="text-dormant text-[10px] font-mono uppercase tracking-widest mb-3 font-semibold">TEST SUITE ({tests.length} CASES)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tests.map((tc, i) => (
                    <div key={tc.id} className="rounded-xl border border-dormant/10 bg-void/50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-text font-mono text-xs">TEST 0{i + 1}</span>
                        <span className={`rounded px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider font-semibold ${tc.is_visible ? "bg-signal/15 text-signal" : "bg-dormant/15 text-dormant"}`}>
                          {tc.is_visible ? "VISIBLE" : "HIDDEN"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <EditableField
                          label="Input Parameter"
                          value={tc.input}
                          fieldKey={`tc-${tc.id}-input`}
                          editingField={editingField}
                          editValue={editValue}
                          setEditingField={setEditingField}
                          setEditValue={setEditValue}
                          onSave={(val) => saveField("test_cases", tc.id, "input", val)}
                          saving={saving}
                          isLocked={isLocked}
                          compact
                        />
                        <EditableField
                          label="Expected Output"
                          value={tc.expected_output}
                          fieldKey={`tc-${tc.id}-expected_output`}
                          editingField={editingField}
                          editValue={editValue}
                          setEditingField={setEditingField}
                          setEditValue={setEditValue}
                          onSave={(val) => saveField("test_cases", tc.id, "expected_output", val)}
                          saving={saving}
                          isLocked={isLocked}
                          compact
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditableField({
  label,
  value,
  fieldKey,
  editingField,
  editValue,
  setEditingField,
  setEditValue,
  onSave,
  saving,
  isLocked,
  multiline,
  compact,
}: {
  label: string;
  value: string;
  fieldKey: string;
  editingField: string | null;
  editValue: string;
  setEditingField: (k: string | null) => void;
  setEditValue: (v: string) => void;
  onSave: (val: string) => void;
  saving: boolean;
  isLocked?: boolean;
  multiline?: boolean;
  compact?: boolean;
}) {
  const isEditing = editingField === fieldKey;

  if (isEditing) {
    return (
      <div className={`${compact ? "mb-2" : "mb-4"}`}>
        <p className="text-dormant text-[10px] font-mono uppercase tracking-widest mb-1.5 font-semibold">{label}</p>
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-signal/30 bg-void px-3 py-2 text-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-signal/30"
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full rounded-lg border border-signal/30 bg-void px-3 py-2 text-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-signal/30"
          />
        )}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onSave(editValue)}
            disabled={saving}
            className="rounded px-3 py-1 text-xs font-mono bg-signal text-void hover:brightness-110 disabled:opacity-50 uppercase tracking-widest font-semibold"
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
          <button
            onClick={() => setEditingField(null)}
            className="rounded px-3 py-1 text-xs font-mono bg-dormant/10 text-dormant hover:text-text uppercase tracking-widest font-semibold"
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? "mb-2" : "mb-4"}`}>
      <p className="text-dormant text-[10px] font-mono uppercase tracking-widest mb-1 font-semibold">{label}</p>
      <button
        onClick={() => {
          if (isLocked) return;
          setEditingField(fieldKey);
          setEditValue(value);
        }}
        disabled={isLocked}
        className={`w-full text-left text-text font-mono text-xs bg-void/50 border border-dormant/15 rounded px-3 py-2 transition-all duration-300 truncate ${
          isLocked ? "cursor-not-allowed opacity-80" : "hover:border-signal/30 hover:bg-void/70"
        }`}
      >
        {value || "[None]"}
      </button>
    </div>
  );
}

function AlternateAnswersEditor({
  answers = [],
  locationName,
  onSave,
  saving,
  isLocked,
}: {
  answers: string[];
  locationName: string;
  onSave: (newAnswers: string[]) => void;
  saving: boolean;
  isLocked?: boolean;
}) {
  const [newAnswer, setNewAnswer] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAnswer.trim();
    if (!trimmed) return;
    const exists = answers.some((a) => a.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert(`"${trimmed}" is already added to the alternative answers list.`);
      return;
    }
    if (trimmed.toLowerCase() === locationName.trim().toLowerCase()) {
      alert(`"${trimmed}" is already the primary Checkpoint Location Name.`);
      return;
    }
    onSave([...answers, trimmed]);
    setNewAnswer("");
  };

  const handleRemove = (targetIndex: number) => {
    if (isLocked) return;
    const updated = answers.filter((_, idx) => idx !== targetIndex);
    onSave(updated);
  };

  return (
    <div className="rounded-xl border border-signal/25 bg-void/30 p-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 mb-2">
        <p className="text-signal text-[11px] font-mono uppercase tracking-widest font-semibold flex items-center gap-1.5">
          <span>🎯</span> ACCEPTED ALTERNATIVE ANSWERS (ARRAY)
        </p>
        <span className="text-[10px] font-mono text-dormant uppercase">
          Dynamic Matching List
        </span>
      </div>

      <p className="text-dormant text-xs font-body mb-3">
        Participants entering either the Checkpoint Location Name (<strong>&ldquo;{locationName}&rdquo;</strong>) OR any of the alternative answers below will pass the riddle and unlock the secret pass code screen.
      </p>

      {/* Answer badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dormant/20 border border-dormant/30 text-text font-mono text-xs">
          <span className="text-signal font-bold">[PRIMARY]:</span> {locationName}
        </span>
        {answers.map((ans, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-signal/10 border border-signal/30 text-signal font-mono text-xs shadow-[0_0_10px_rgba(255,30,86,0.1)]"
          >
            <span>{ans}</span>
            {!isLocked && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                disabled={saving}
                className="text-dormant hover:text-white transition-colors ml-1 font-bold disabled:opacity-50"
                title="Remove this alternative answer"
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {answers.length === 0 && (
          <span className="text-dormant text-xs font-mono italic flex items-center py-1">
            No alternate answers yet. Add variations like &ldquo;Library&rdquo;, &ldquo;Library Gate&rdquo;, etc. below.
          </span>
        )}
      </div>

      {/* Add new alternate answer input */}
      {!isLocked && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            placeholder="Type alternate answer (e.g. Library, Library Gate, Entrance)..."
            disabled={saving}
            className="flex-1 rounded-lg border border-dormant/20 bg-void/50 px-3 py-2 text-text font-mono text-xs focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30"
          />
          <button
            type="submit"
            disabled={saving || !newAnswer.trim()}
            className="rounded-lg px-4 py-2 text-xs font-mono bg-signal text-void hover:brightness-110 disabled:opacity-50 font-bold uppercase tracking-wider transition-all"
          >
            {saving ? "SAVING..." : "+ ADD ANSWER"}
          </button>
        </form>
      )}
    </div>
  );
}
