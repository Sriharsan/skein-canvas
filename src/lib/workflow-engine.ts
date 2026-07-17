import type { SupabaseClient } from "@supabase/supabase-js";
import { callGemini } from "@/lib/ai.functions";

export type SnapshotNode = { id: string; type?: string; data?: Record<string, unknown> };
export type SnapshotEdge = { source: string; target: string };
export type WorkflowRow = { nodes: SnapshotNode[]; edges: SnapshotEdge[] };

export type LoadWorkflow = (workflowId: string) => Promise<WorkflowRow | null>;
export type OnOutputNode = (node: SnapshotNode, outputText: string) => Promise<void> | void;

/**
 * Walks a saved workflow's graph from its Trigger node to completion,
 * resolving Run Workflow (subflow) nodes recursively. Shared by the
 * authenticated Run Workflow path and the public intake-form path — the
 * only thing that differs between them is how `loadWorkflow` fetches a
 * workflow row (RLS-scoped client vs. admin client pinned to one owner).
 *
 * Cycle detection is authoritative here: `visited` is rebuilt fresh in
 * server memory on every top-level call and threaded through recursive
 * calls, never trusted from the client.
 */
export async function walkWorkflow(opts: {
  workflowId: string;
  input: string;
  visited: Set<string>;
  loadWorkflow: LoadWorkflow;
  rateLimitKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any>;
  onOutputNode?: OnOutputNode;
}): Promise<string> {
  const { workflowId, input, visited, loadWorkflow, rateLimitKey, supabaseAdmin, onOutputNode } = opts;

  if (visited.has(workflowId)) {
    throw new Error("Cycle detected: this workflow already runs upstream.");
  }
  const nextVisited = new Set(visited);
  nextVisited.add(workflowId);

  const wf = await loadWorkflow(workflowId);
  if (!wf) throw new Error("That workflow could not be loaded.");

  const nodes = wf.nodes ?? [];
  const edges = wf.edges ?? [];
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) throw new Error("Workflow has no Trigger node.");

  const outMap = new Map<string, string>();
  outMap.set(trigger.id, input || String(trigger.data?.starter ?? ""));

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
        out = await walkWorkflow({ ...opts, workflowId: nestedId, input: inText, visited: nextVisited });
      } else {
        out = inText;
      }
      if (tgt.type === "output" && onOutputNode) {
        await onOutputNode(tgt, out);
      }
      outMap.set(e.target, out);
      last = out;
      queue.push(e.target);
    }
  }
  return last;
}
