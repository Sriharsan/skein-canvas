import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { walkWorkflow, type LoadWorkflow, type OnOutputNode, type WorkflowRow } from "@/lib/workflow-engine";
import { runOutputSideEffects } from "@/lib/notify.functions";

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
    const rateLimitKey = `ai:user:${context.userId}`;
    const notifyRateLimitKey = `notify:user:${context.userId}`;

    const loadWorkflow: LoadWorkflow = async (workflowId) => {
      const { data: wf, error } = await context.supabase
        .from("workflows")
        .select("nodes,edges")
        .eq("id", workflowId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return wf as unknown as WorkflowRow | null;
    };

    const onOutputNode: OnOutputNode = async (node, outputText) => {
      await runOutputSideEffects(supabaseAdmin, notifyRateLimitKey, node, outputText, {
        workflowId: data.workflowId,
        nodeId: node.id,
      });
    };

    const visited = new Set<string>(data.currentWorkflowId ? [data.currentWorkflowId] : []);
    try {
      const output = await walkWorkflow({
        workflowId: data.workflowId,
        input: data.input,
        visited,
        loadWorkflow,
        rateLimitKey,
        supabaseAdmin,
        onOutputNode,
      });
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
