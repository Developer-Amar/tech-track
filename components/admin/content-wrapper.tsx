"use client";

import { useState } from "react";
import ContentEditor from "./content-editor";
import Round2ContentEditor from "./round-2-content-editor";

export default function ContentWrapper() {
  const [roundTab, setRoundTab] = useState<"round1" | "round2">("round1");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-void/50 border border-white/[0.08] rounded-lg w-fit">
        <button
          onClick={() => setRoundTab("round1")}
          className={`px-4 py-2 rounded-md font-mono text-xs uppercase tracking-wider transition-all duration-300 ${
            roundTab === "round1" 
              ? "bg-signal text-void font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)]" 
              : "text-dormant hover:text-white hover:bg-white/5"
          }`}
        >
          Round 1 Content
        </button>
        <button
          onClick={() => setRoundTab("round2")}
          className={`px-4 py-2 rounded-md font-mono text-xs uppercase tracking-wider transition-all duration-300 ${
            roundTab === "round2" 
              ? "bg-gold text-void font-bold shadow-[0_0_15px_rgba(255,215,0,0.3)]" 
              : "text-dormant hover:text-white hover:bg-white/5"
          }`}
        >
          Round 2 Content
        </button>
      </div>

      <div className="mt-4">
        {roundTab === "round1" ? <ContentEditor /> : <Round2ContentEditor />}
      </div>
    </div>
  );
}
