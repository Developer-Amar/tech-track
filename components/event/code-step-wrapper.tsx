"use client";

import { useCallback } from "react";
import ProctorGuard from "@/components/event/proctor-guard";
import CodeEditor from "@/components/event/code-editor";

/**
 * Client wrapper for the coding step — handles ProctorGuard + CodeEditor.
 * Needed because the event page is a Server Component and can't pass
 * function props (onLockout) to Client Components.
 */
export default function CodeStepWrapper({
  round,
  prompt,
  sampleInput,
  sampleOutput,
  ideSmartFeatures,
}: {
  round: number;
  prompt: string;
  sampleInput: string | null;
  sampleOutput: string | null;
  ideSmartFeatures: boolean;
}) {
  const handleLockout = useCallback(() => {
    // Lockout is handled visually by ProctorGuard itself
  }, []);

  return (
    <ProctorGuard round={round} onLockout={handleLockout}>
      <CodeEditor
        round={round}
        prompt={prompt}
        sampleInput={sampleInput}
        sampleOutput={sampleOutput}
        ideSmartFeatures={ideSmartFeatures}
      />
    </ProctorGuard>
  );
}
