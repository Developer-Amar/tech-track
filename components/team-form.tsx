"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [email1, setEmail1] = useState("");
  const [email2, setEmail2] = useState("");
  const [email3, setEmail3] = useState("");

  function validateEmail(email: string): boolean {
    return email.trim().toLowerCase().endsWith("@chitkara.edu.in");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const memberEmails = [email1, email2, email3]
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    if (memberEmails.length < 1) {
      setError("At least one member email is required.");
      setLoading(false);
      return;
    }

    for (const email of memberEmails) {
      if (!validateEmail(email)) {
        setError(`${email} is not a valid @chitkara.edu.in email.`);
        setLoading(false);
        return;
      }
    }

    const res = await fetch("/api/units/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: teamName,
        member_emails: memberEmails,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="glass-panel border-signal/30 rounded-2xl p-6 text-left relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-signal/5 rounded-full blur-xl pointer-events-none" />

      <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1 font-semibold">UNIT ASSEMBLY</p>
      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-1">
        FORM A TEAM
      </h3>
      <p className="text-dormant text-xs font-body mb-6 leading-relaxed">
        Specify your team name and invite members. Invited members will receive accept prompts on their dashboard.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="teamName" className="block text-xs font-mono uppercase tracking-wider text-text mb-1">
            Team Name
          </label>
          <input
            id="teamName"
            type="text"
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Code_Breakers"
            className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
        </div>

        <div>
          <label htmlFor="member1" className="block text-xs font-mono uppercase tracking-wider text-text mb-1">
            Member 1 Email <span className="text-danger font-mono text-[10px] uppercase ml-1">(Required)</span>
          </label>
          <input
            id="member1"
            type="email"
            required
            value={email1}
            onChange={(e) => setEmail1(e.target.value)}
            placeholder="peer@chitkara.edu.in"
            className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
        </div>

        <div>
          <label htmlFor="member2" className="block text-xs font-mono uppercase tracking-wider text-text mb-1">
            Member 2 Email <span className="text-dormant font-mono text-[10px] uppercase ml-1">(Optional)</span>
          </label>
          <input
            id="member2"
            type="email"
            value={email2}
            onChange={(e) => setEmail2(e.target.value)}
            placeholder="peer@chitkara.edu.in"
            className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
        </div>

        <div>
          <label htmlFor="member3" className="block text-xs font-mono uppercase tracking-wider text-text mb-1">
            Member 3 Email <span className="text-dormant font-mono text-[10px] uppercase ml-1">(Optional)</span>
          </label>
          <input
            id="member3"
            type="email"
            value={email3}
            onChange={(e) => setEmail3(e.target.value)}
            placeholder="peer@chitkara.edu.in"
            className="w-full rounded-lg border border-signal/20 bg-void/40 px-4 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
        </div>

        {error && (
          <div className="rounded border border-danger/30 bg-danger/5 p-3">
            <p className="text-danger text-xs font-mono">Error: {error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 btn-cyber-outline px-4 py-2.5 rounded-lg text-xs uppercase font-display"
          >
            ABORT
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 btn-cyber px-4 py-2.5 rounded-lg text-xs uppercase"
          >
            {loading ? "CREATING..." : "CREATE TEAM"}
          </button>
        </div>
      </form>
    </div>
  );
}
