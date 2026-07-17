import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import type { WorkflowSnapshot } from "@/components/canvas/SkeinCanvas";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Skein — Live demo" },
      { name: "description", content: "Try Skein's visual workflow canvas. No sign-up. Simulated AI reply for a demo lead." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoPage,
});

const DEMO_SNAPSHOT: WorkflowSnapshot = {
  nodes: [
    { id: "t1", type: "trigger", position: { x: 40, y: 140 }, data: { starter: "Lead: Alex wants wedding photos for June 14. Budget flexible." } },
    { id: "l1", type: "llm", position: { x: 340, y: 90 }, data: { prompt: "Draft a warm, professional reply to this inquiry:\n\n{{input}}" } },
    { id: "o1", type: "output", position: { x: 680, y: 160 }, data: {} },
  ],
  edges: [
    { id: "e1", source: "t1", target: "l1", type: "thread" },
    { id: "e2", source: "l1", target: "o1", type: "thread" },
  ],
};

function DemoPage() {
  const [Canvas, setCanvas] = useState<null | typeof import("@/components/canvas/SkeinCanvas")["SkeinCanvas"]>(null);
  useEffect(() => {
    import("@/components/canvas/SkeinCanvas").then((m) => setCanvas(() => m.SkeinCanvas));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-bone" aria-label="Back to home">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="font-serif text-xl">Skein</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">Demo</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider rounded-sm border border-thread/40 text-thread px-2 py-0.5">
            Simulated AI reply
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.message("Sign up to save your own workflows.", {
              action: { label: "Sign up", onClick: () => { window.location.href = "/auth"; } },
            })}
            className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Save
          </button>
          <Link
            to="/auth"
            className="rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-xs hover:opacity-90"
          >
            Sign up to build your own
          </Link>
        </div>
      </header>

      <div className="border-b border-border bg-bark-2/50 px-4 py-2 text-[11px] text-muted-foreground text-center">
        You're in the demo — the AI Response node returns a fixed sample reply. Sign up to run live models and save workflows.
      </div>

      <main className="flex-1 relative">
        {Canvas ? (
          <Canvas initial={DEMO_SNAPSHOT} demo palette />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Loading canvas…
          </div>
        )}
      </main>
    </div>
  );
}
