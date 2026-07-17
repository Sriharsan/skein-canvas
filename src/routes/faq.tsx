import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Skein" },
      { name: "description", content: "Answers to the questions freelancers actually ask about Skein: data privacy, AI limits, exporting, and more." },
      { property: "og:title", content: "FAQ — Skein" },
      { property: "og:description", content: "Straight answers about how Skein handles your workflows, your client data, and your AI usage." },
    ],
  }),
  component: FaqPage,
});

const QA: { q: string; a: string }[] = [
  {
    q: "Is my client data private?",
    a: "Your workflows and any text you type into a node are stored in your own row-level-secured account. Nobody else on Skein can read them. When an AI Response node runs, the prompt you assembled is sent to the AI provider that powers the response — treat that the way you'd treat pasting text into any other AI tool: don't paste anything you wouldn't send to a third party.",
  },
  {
    q: "What happens if I hit my AI usage limit?",
    a: "The AI Response node will show a red error saying credits are exhausted, and the run will stop at that node. Your other nodes and saved workflows are untouched. A Pro tier with a higher personal quota is coming; until then, limits are shared and reset on Skein's schedule.",
  },
  {
    q: "Can I export my workflows?",
    a: "Not with a one-click button yet. The canvas state is a straightforward JSON structure (nodes + edges) stored in your account — if you need a copy today, ask and we'll pull it. A proper export lives on the near-term list.",
  },
  {
    q: "Can I run a workflow from another workflow?",
    a: "Yes. Add a Run Workflow node, pick one of your saved workflows, and it becomes a step in the bigger pipeline. Skein blocks a workflow from calling itself and refuses cycles, so you can't accidentally build an infinite loop.",
  },
  {
    q: "Do you have a team plan?",
    a: "No, and there isn't one planned. Skein is built for one person running their own practice. If you need seats, roles, and shared workspaces, another tool will serve you better.",
  },
  {
    q: "How do I delete my account?",
    a: "Head to Account in the app. There's a Delete account button with a confirmation step. It removes your profile, your workflows, and your sign-in — permanently, no 30-day grace period.",
  },
];

function FaqPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <Link to="/" className="font-serif text-2xl">Skein</Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/pricing" className="text-muted-foreground hover:text-bone">Pricing</Link>
          <Link to="/auth" className="text-muted-foreground hover:text-bone">Sign in</Link>
        </nav>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-thread mb-4">Questions</p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight text-bone">
          Straight answers.
        </h1>
        <p className="mt-4 text-muted-foreground">Written by the person who wrote the code.</p>
        <div className="mt-10 space-y-5">
          {QA.map((item) => (
            <div key={item.q} className="stitch rounded-md p-5">
              <h2 className="font-serif text-lg text-bone">{item.q}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
