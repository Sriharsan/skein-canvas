import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile, deleteMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const getProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);
  const deleteAccount = useServerFn(deleteMyAccount);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const [displayName, setDisplayName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (profileQ.data) setDisplayName(profileQ.data.displayName ?? "");
  }, [profileQ.data]);

  const saveM = useMutation({
    mutationFn: () => updateProfile({ data: { displayName: displayName.trim() || null } }),
    onSuccess: () => {
      toast.success("Saved to your loom.");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: async () => {
      await supabase.auth.signOut();
      toast("Account deleted.");
      nav({ to: "/" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete account."),
  });

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/build" className="text-muted-foreground hover:text-bone" aria-label="Back to canvas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="font-serif text-xl">Skein</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">Account</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <section className="stitch rounded-md p-6">
          <h1 className="font-serif text-2xl text-bone mb-1">Your account</h1>
          <p className="text-sm text-muted-foreground mb-6">Just the essentials. No team settings, no company fields.</p>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Signed in as</label>
              <div className="mt-1 rounded-sm bg-input border border-border px-3 py-2 text-sm">
                {profileQ.isLoading ? "Loading…" : profileQ.data?.email ?? "—"}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Display name (optional)</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should Skein call you?"
                maxLength={80}
                className="mt-1 w-full rounded-sm bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => saveM.mutate()}
                disabled={saveM.isPending}
                className="rounded-sm bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {saveM.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
              <button
                onClick={signOut}
                className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

        <section className="stitch rounded-md p-6 border-destructive/40">
          <h2 className="font-serif text-xl text-bone mb-1">Delete account</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently removes your profile, every saved workflow, and your sign-in.
            There is no 30-day grace period.
          </p>
          <button
            onClick={() => { setConfirmOpen(true); setConfirmText(""); }}
            className="rounded-sm border border-destructive/60 text-destructive px-4 py-2 text-sm hover:bg-destructive/10"
          >
            Delete account
          </button>
        </section>
      </main>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleteM.isPending && setConfirmOpen(false)}
        >
          <div
            className="stitch rounded-md p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl text-bone">Delete your account?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This wipes your workflows and sign-in. It cannot be undone. Type
              <span className="text-bone font-mono"> delete </span>
              below to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type: delete"
              className="mt-4 w-full rounded-sm bg-input border border-border px-3 py-2 text-sm outline-none focus:border-destructive"
              autoFocus
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleteM.isPending}
                className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteM.mutate()}
                disabled={deleteM.isPending || confirmText.trim().toLowerCase() !== "delete"}
                className="rounded-sm bg-destructive text-destructive-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
              >
                {deleteM.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
