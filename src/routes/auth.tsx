import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Skein" },
      { name: "description", content: "Sign in to your Skein workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/build" });
    });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + "/build" },
        });
        if (error) throw error;
        toast.success("Check your email for the sign-in link.");
      } else if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/build" },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. You're in.");
          nav({ to: "/build" });
        } else {
          toast.success("Check your email to confirm your account, then sign in.");
          setIsSignup(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/build" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
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
          <h1 className="text-xl mb-1">{isSignup ? "Start weaving" : "Welcome back"}</h1>
          <p className="text-sm text-muted-foreground mb-5">
            {mode === "magic" ? "We'll email you a one-tap sign-in link." : isSignup ? "Create your workspace." : "Sign in to your workflows."}
          </p>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="w-full rounded-sm bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {mode === "password" && (
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" minLength={6}
                className="w-full rounded-sm bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            <button
              type="submit" disabled={busy}
              className="w-full rounded-sm bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working…" : mode === "magic" ? "Send magic link" : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>
          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
            <button
              onClick={() => setMode(mode === "magic" ? "password" : "magic")}
              className="underline underline-offset-2 hover:text-bone"
            >
              {mode === "magic" ? "Use password" : "Email me a link"}
            </button>
            {mode === "password" && (
              <button
                onClick={() => setIsSignup(!isSignup)}
                className="underline underline-offset-2 hover:text-bone"
              >
                {isSignup ? "I have an account" : "Create account"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
