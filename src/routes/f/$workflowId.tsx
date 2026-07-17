import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitPublicIntake } from "@/lib/public-intake.functions";
import { Loader2, Send, Check } from "lucide-react";

export const Route = createFileRoute("/f/$workflowId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Send a request — Skein" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicIntakePage,
});

function PublicIntakePage() {
  const { workflowId } = Route.useParams();
  const submit = useServerFn(submitPublicIntake);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submit({ data: { workflowId, input: value.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8">
          <span className="font-serif text-3xl text-bone">Skein</span>
        </Link>
        <div className="stitch rounded-md p-6">
          {sent ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-moss/20 text-moss">
                <Check className="h-5 w-5" />
              </div>
              <h1 className="text-xl text-bone mb-1">Thanks — this has been sent.</h1>
              <p className="text-sm text-muted-foreground">Someone will follow up if it's needed.</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl mb-1">Send a request</h1>
              <p className="text-sm text-muted-foreground mb-5">
                Fill this in and it'll go straight through.
              </p>
              <form onSubmit={onSubmit} className="space-y-3">
                <textarea
                  required
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="What do you need?"
                  rows={5}
                  maxLength={4000}
                  className="w-full rounded-sm bg-input border border-border p-3 text-sm resize-none outline-none focus:border-primary"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || !value.trim()}
                  className="w-full rounded-sm bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {busy ? "Sending…" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
