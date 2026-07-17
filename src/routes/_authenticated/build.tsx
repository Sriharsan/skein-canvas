import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMyWorkflows, getWorkflow, createWorkflow, saveWorkflow, deleteWorkflow } from "@/lib/workflows.functions";
import { TEMPLATES } from "@/lib/templates";
import { toast } from "sonner";
import { Save, Trash2, LogOut, Loader2, User, LayoutTemplate, Share2 } from "lucide-react";
import type { WorkflowSnapshot } from "@/components/canvas/SkeinCanvas";

export const Route = createFileRoute("/_authenticated/build")({
  component: BuildPage,
});

const SUCCESS_PHRASES = ["Thread pulled through.", "Woven.", "The knot held."];

function BuildPage() {
  const [Canvas, setCanvas] = useState<null | typeof import("@/components/canvas/SkeinCanvas")["SkeinCanvas"]>(null);
  useEffect(() => {
    import("@/components/canvas/SkeinCanvas").then((m) => setCanvas(() => m.SkeinCanvas));
  }, []);

  const nav = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listMyWorkflows);
  const get = useServerFn(getWorkflow);
  const create = useServerFn(createWorkflow);
  const save = useServerFn(saveWorkflow);
  const del = useServerFn(deleteWorkflow);

  const listQ = useQuery({ queryKey: ["workflows"], queryFn: () => list() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled workflow");
  const snapRef = useRef<WorkflowSnapshot>({ nodes: [], edges: [] });
  const [initial, setInitial] = useState<WorkflowSnapshot | undefined>(undefined);
  const [canvasKey, setCanvasKey] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);

  const activeQ = useQuery({
    queryKey: ["workflow", activeId],
    queryFn: () => get({ data: { id: activeId! } }),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (activeQ.data) {
      setName(activeQ.data.name);
      setInitial({
        nodes: (activeQ.data.nodes as unknown as WorkflowSnapshot["nodes"]) ?? [],
        edges: (activeQ.data.edges as unknown as WorkflowSnapshot["edges"]) ?? [],
      });
      setCanvasKey((k) => k + 1);
      setShowTemplates(false);
    }
  }, [activeQ.data]);

  const createFromTemplateM = useMutation({
    mutationFn: (t: typeof TEMPLATES[number]) =>
      create({ data: { name: t.name, nodes: t.snapshot.nodes, edges: t.snapshot.edges } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      setActiveId(row.id);
      toast.success("Template loaded. Yours to edit.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't load template."),
  });

  const createBlankM = useMutation({
    mutationFn: () => create({ data: {
      name: "Untitled workflow",
      nodes: snapRef.current.nodes.length ? snapRef.current.nodes : [],
      edges: snapRef.current.edges,
    } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      setActiveId(row.id);
      toast.success("Saved to your loom.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create."),
  });

  const saveM = useMutation({
    mutationFn: () => {
      if (!activeId) throw new Error("Nothing to save yet.");
      return save({ data: { id: activeId, name, nodes: snapRef.current.nodes, edges: snapRef.current.edges } });
    },
    onSuccess: () => {
      toast.success("Saved to your loom.");
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      setActiveId(null); setInitial(undefined); setCanvasKey((k) => k + 1);
      toast("Workflow removed.");
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/" });
  }

  async function copyShareLink() {
    if (!activeId || typeof window === "undefined") return;
    const url = `${window.location.origin}/f/${activeId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied. Anyone with it can trigger this workflow.");
  }

  const availableWorkflows = useMemo(
    () => (listQ.data ?? []).map((w) => ({ id: w.id, name: w.name })),
    [listQ.data],
  );

  const onRunSuccess = useCallback(() => {
    const phrase = SUCCESS_PHRASES[Math.floor(Math.random() * SUCCESS_PHRASES.length)];
    toast.success(phrase);
  }, []);

  const showBlankState =
    !activeId && (listQ.data?.length ?? 0) === 0 && !listQ.isLoading;
  const showTemplatePanel = showBlankState || showTemplates;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl">Skein</span>
          <span className="text-muted-foreground">/</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow name"
            className="bg-transparent text-sm outline-none focus:bg-input px-2 py-1 rounded-sm min-w-0 max-w-[16rem]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveId(null); setInitial(undefined); setShowTemplates(true); setCanvasKey((k) => k + 1); }}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            <LayoutTemplate className="h-3 w-3" />
            Start from template
          </button>
          {activeId ? (
            <>
              <button
                onClick={() => saveM.mutate()}
                disabled={saveM.isPending}
                className="rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
              >
                {saveM.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
              <button
                onClick={copyShareLink}
                className="rounded-sm border border-border p-1.5 text-xs hover:bg-secondary"
                aria-label="Copy shareable link"
                title="Copy shareable link"
              >
                <Share2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => { if (confirm("Delete this workflow?")) delM.mutate(activeId); }}
                className="rounded-sm border border-border p-1.5 text-xs hover:bg-destructive/20 hover:border-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          ) : !showTemplatePanel ? (
            <button
              onClick={() => createBlankM.mutate()}
              disabled={createBlankM.isPending}
              className="rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
            >
              {createBlankM.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save as new
            </button>
          ) : null}
          <Link to="/account" className="rounded-sm border border-border p-1.5 hover:bg-secondary" aria-label="Account">
            <User className="h-3 w-3" />
          </Link>
          <button onClick={signOut} className="rounded-sm border border-border p-1.5 hover:bg-secondary" aria-label="Sign out">
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-56 border-r border-border bg-card p-3 overflow-y-auto shrink-0 hidden md:block">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Your workflows</span>
            <button
              onClick={() => { setActiveId(null); setInitial(undefined); setName("Untitled workflow"); setShowTemplates(true); setCanvasKey((k) => k + 1); }}
              className="text-xs text-thread hover:underline"
            >
              + new
            </button>
          </div>
          {listQ.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {listQ.isError && <p className="text-xs text-destructive">Failed to load.</p>}
          {listQ.data?.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nothing saved yet. Pick a template on the right.</p>
          )}
          <ul className="space-y-1">
            {listQ.data?.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => setActiveId(w.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-sm text-xs truncate ${activeId === w.id ? "bg-secondary text-bone" : "text-muted-foreground hover:bg-secondary/50 hover:text-bone"}`}
                >
                  {w.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex-1 relative">
          {showTemplatePanel ? (
            <TemplatePicker
              busy={createFromTemplateM.isPending}
              onPick={(t) => createFromTemplateM.mutate(t)}
              onBlank={() => { setShowTemplates(false); createBlankM.mutate(); }}
              onClose={showBlankState ? undefined : () => setShowTemplates(false)}
            />
          ) : Canvas ? (
            <Canvas
              key={canvasKey}
              initial={initial}
              palette
              currentWorkflowId={activeId ?? undefined}
              availableWorkflows={availableWorkflows}
              onRunSuccess={onRunSuccess}
              onDirtyChange={(s) => { snapRef.current = s; }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading canvas…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TemplatePicker({
  busy, onPick, onBlank, onClose,
}: {
  busy: boolean;
  onPick: (t: typeof TEMPLATES[number]) => void;
  onBlank: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-thread mb-3">Start from a template</p>
            <h1 className="font-serif text-3xl md:text-4xl text-bone leading-tight">
              Pick a starting thread.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg">
              Three workflows solo operators use most. Each one lands on your canvas fully connected — edit anything, run it, save it as yours.
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-bone">
              Close
            </button>
          )}
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              disabled={busy}
              onClick={() => onPick(t)}
              className="stitch rounded-md p-5 text-left hover:border-thread transition-colors disabled:opacity-60"
            >
              <h3 className="font-serif text-lg text-bone">{t.name}</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{t.blurb}</p>
              <div className="mt-4 flex items-center gap-1 text-[10px] uppercase tracking-wider text-thread">
                Use this template →
              </div>
            </button>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button
            onClick={onBlank}
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-bone underline underline-offset-4 disabled:opacity-50"
          >
            Or start from a blank canvas
          </button>
        </div>
      </div>
    </div>
  );
}
