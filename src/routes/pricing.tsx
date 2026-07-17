import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Skein" },
      { name: "description", content: "Skein is free while it's still finding its feet. A Pro tier is coming later, priced honestly." },
      { property: "og:title", content: "Pricing — Skein" },
      { property: "og:description", content: "Free while Skein is early. Pro tier coming later, priced honestly." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <Link to="/" className="font-serif text-2xl">Skein</Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/faq" className="text-muted-foreground hover:text-bone">FAQ</Link>
          <Link to="/auth" className="text-muted-foreground hover:text-bone">Sign in</Link>
        </nav>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-thread mb-4">Pricing</p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight text-bone">
          Free while we're early.<br />
          <em className="text-thread not-italic italic">Honest when we're not.</em>
        </h1>
        <p className="mt-6 text-muted-foreground max-w-xl">
          Skein is built by one person for one-person shops. Right now everything works
          on the free tier. A Pro tier is coming when it earns its keep — no fake price,
          no invented feature list.
        </p>
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          <div className="stitch rounded-md p-6">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-serif text-2xl text-bone">Free</h2>
              <span className="text-sm text-muted-foreground">$0</span>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Everything Skein does today.</p>
            <ul className="space-y-2 text-sm">
              {[
                "Unlimited workflows on your canvas",
                "AI Response nodes (shared usage limits)",
                "Run Workflow nodes to compose pipelines",
                "Your workflows saved to your account",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-moss shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="mt-6 inline-flex rounded-sm bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
            >
              Start weaving
            </Link>
          </div>

          <div className="stitch rounded-md p-6 opacity-80">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-serif text-2xl text-bone">Pro</h2>
              <span className="text-xs uppercase tracking-wider rounded-sm border border-thread/40 text-thread px-2 py-0.5">
                Coming later
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              For when you're running Skein daily and want your own AI quota.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Everything in Free, plus higher AI usage limits.</li>
              <li>Priced when it's built. No waitlist tricks.</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
