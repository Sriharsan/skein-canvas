import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGemini } from "@/lib/ai.functions";

const NodesEdges = z.object({
  name: z.string().min(1).max(120),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

export const listMyWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workflows")
      .select("id,name,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workflows")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const createWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NodesEdges.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workflows")
      .insert({ user_id: context.userId, name: data.name, nodes: data.nodes, edges: data.edges })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).merge(NodesEdges).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workflows")
      .update({ name: data.name, nodes: data.nodes, edges: data.edges })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workflows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type SnapshotNode = { id: string; type?: string; data?: Record<string, unknown> };
type SnapshotEdge = { source: string; target: string };

/**
 * Executes a saved workflow (used by Run Workflow / subflow nodes) entirely
 * server-side, including any nested Run Workflow nodes it contains.
 *
 * Cycle detection is authoritative here: `visited` is rebuilt fresh in
 * server memory on every call from `currentWorkflowId` (never trusted from
 * elsewhere), and each recursive step adds the workflow it's about to run
 * before descending. A direct API call cannot bypass this the way a
 * client-side-only check could, since the check lives in this closure, not
 * in browser state. Sub-workflow reads go through the caller's RLS-scoped
 * `context.supabase`, so a workflow that isn't the caller's own is simply
 * invisible (not loadable), not just UI-hidden.
 */
export const runWorkflowChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workflowId: z.string().uuid(),
        input: z.string(),
        currentWorkflowId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rateLimitKey = `user:${context.userId}`;

    async function walk(workflowId: string, inputText: string, visited: Set<string>): Promise<string> {
      if (visited.has(workflowId)) {
        throw new Error("Cycle detected: this workflow already runs upstream.");
      }
      const nextVisited = new Set(visited);
      nextVisited.add(workflowId);

      const { data: wf, error } = await context.supabase
        .from("workflows")
        .select("nodes,edges")
        .eq("id", workflowId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!wf) throw new Error("That workflow could not be loaded.");

      const nodes = (wf.nodes as unknown as SnapshotNode[]) ?? [];
      const edges = (wf.edges as unknown as SnapshotEdge[]) ?? [];
      const trigger = nodes.find((n) => n.type === "trigger");
      if (!trigger) throw new Error("Sub-workflow has no Trigger node.");

      const outMap = new Map<string, string>();
      outMap.set(trigger.id, inputText || String(trigger.data?.starter ?? ""));

      const queue: string[] = [trigger.id];
      const seen = new Set<string>([trigger.id]);
      let last = outMap.get(trigger.id) ?? "";
      while (queue.length) {
        const cur = queue.shift()!;
        for (const e of edges.filter((edge) => edge.source === cur)) {
          if (seen.has(e.target)) continue;
          seen.add(e.target);
          const tgt = nodes.find((n) => n.id === e.target);
          if (!tgt) continue;
          const inText = outMap.get(cur) ?? "";
          let out: string;
          if (tgt.type === "llm") {
            const promptTpl = String(tgt.data?.prompt ?? "");
            const finalPrompt = promptTpl.replaceAll("{{input}}", inText) || inText;
            out = await callGemini(finalPrompt, rateLimitKey, supabaseAdmin);
          } else if (tgt.type === "subflow") {
            const nestedId = tgt.data?.runWorkflowId as string | undefined;
            if (!nestedId) throw new Error("Nested Run Workflow node has no target selected.");
            out = await walk(nestedId, inText, nextVisited);
          } else {
            out = inText;
          }
          outMap.set(e.target, out);
          last = out;
          queue.push(e.target);
        }
      }
      return last;
    }

    const visited = new Set<string>(data.currentWorkflowId ? [data.currentWorkflowId] : []);
    try {
      const output = await walk(data.workflowId, data.input, visited);
      return { output };
    } catch (err) {
      console.error("[workflows.functions] subflow execution failed", {
        workflowId: data.workflowId,
        currentWorkflowId: data.currentWorkflowId ?? null,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
