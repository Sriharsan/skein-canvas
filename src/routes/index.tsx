import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="font-serif text-2xl tracking-tight">Skein</span>
        <nav className="flex items-center gap-3 sm:gap-6 text-sm">
          <Link to="/demo" className="hidden sm:inline text-muted-foreground hover:text-bone">Try the demo</Link>
          <Link to="/auth" className="text-muted-foreground hover:text-bone">Sign in</Link>
          <Link to="/auth" className="rounded-sm bg-primary text-primary-foreground px-3.5 py-1.5 hover:opacity-90">
            Open canvas
          </Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-thread mb-6">
            For freelancers, not for teams.
          </p>
          <h1 className="font-serif text-5xl md:text-7xl leading-[1.02] tracking-tight text-bone">
            Weave the tedious parts<br />
            of client work<br />
            <em className="text-thread not-italic italic">into a thread you pull once.</em>
          </h1>
          <p className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Skein is a canvas for solo operators. Drag a trigger, connect an AI reply,
            drop the result where you need it. No teams tab. No enterprise settings.
            Just you, at 11pm, finally stopping the copy-paste.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-sm bg-primary text-primary-foreground px-5 py-3 text-sm font-medium hover:opacity-90"
            >
              Start weaving
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-3 text-sm text-bone hover:bg-secondary"
            >
              Try the demo
            </Link>
            <span className="text-xs text-muted-foreground">Free to try. No card.</span>
          </div>
        </div>

        {/* Live canvas preview */}
        <div className="mt-20">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Live preview — drag, connect, run</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="stitch rounded-md overflow-hidden h-[520px] relative">
            {mounted ? <LandingCanvas /> : <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Loading canvas…</div>}
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8 text-sm">
          {[
            { h: "One-person shop.", p: "Built for the freelancer running intake, replies, and follow-up alone. No seats. No workspace admin." },
            { h: "AI where it fits.", p: "Drop an AI Response node anywhere in the flow. Use {{input}} to weave in whatever came before." },
            { h: "Yours to keep.", p: "Your workflows save to your account. Copy the output, pipe it into your inbox, tool, or the void." },
          ].map((f) => (
            <div key={f.h}>
              <h3 className="font-serif text-xl mb-2 text-bone">{f.h}</h3>
              <p className="text-muted-foreground leading-relaxed">{f.p}</p>
            </div>
          ))}
        </div>
      </main>

      <SkeinFooter />
    </div>
  );
}

function SkeinFooter() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>© Skein. Made for one person at a time.</span>
        <nav className="flex items-center gap-5">
          <Link to="/pricing" className="hover:text-bone">Pricing</Link>
          <Link to="/faq" className="hover:text-bone">FAQ</Link>
          <Link to="/demo" className="hover:text-bone">Demo</Link>
          <Link to="/auth" className="hover:text-bone">Sign in →</Link>
        </nav>
      </div>
    </footer>
  );
}

function LandingCanvas() {
  // Client-only import to avoid SSR touching window
  const [Comp, setComp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@/components/canvas/SkeinCanvas").then((m) => {
      if (!cancelled) setComp(() => () => <m.SkeinCanvas />);
    });
    return () => { cancelled = true; };
  }, []);
  if (!Comp) return <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Loading canvas…</div>;
  return <Comp />;
}
