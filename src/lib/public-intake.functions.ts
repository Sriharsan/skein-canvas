import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit, requestIp } from "@/lib/ai.functions";
import { walkWorkflow, type LoadWorkflow, type WorkflowRow } from "@/lib/workflow-engine";
import { runOutputSideEffects } from "@/lib/notify.functions";

const INTAKE_RATE_LIMIT = 5;
const INTAKE_WINDOW_SECONDS = 60;

/**
 * Executes a saved workflow end-to-end for an anonymous visitor submitting
 * its public intake form. No auth, no output returned to the caller (the
 * visitor only ever sees a generic thank-you — the actual result goes to
 * the workflow owner via email/Slack, not back over this response).
 *
 * Rate limited per-IP under its own `intake:` key namespace, entirely
 * separate from the authenticated per-user AI rate limit, so a public form
 * can't be hammered to drain the account's usage. The AI calls it triggers
 * still count against the workflow owner's own `ai:user:` budget (same
 * bucket their authenticated canvas runs use), so total spend stays capped
 * even across many different visitor IPs.
 */
export const submitPublicIntake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        workflowId: z.string().uuid(),
        input: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const intakeKey = `intake:ip:${await requestIp()}`;
    await checkRateLimit(supabaseAdmin, intakeKey, INTAKE_RATE_LIMIT, INTAKE_WINDOW_SECONDS);

    const { data: topWf, error } = await supabaseAdmin
      .from("workflows")
      .select("user_id")
      .eq("id", data.workflowId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!topWf) throw new Error("This form is no longer available.");
    const ownerId = topWf.user_id as string;

    const loadWorkflow: LoadWorkflow = async (workflowId) => {
      const { data: wf, error: loadErr } = await supabaseAdmin
        .from("workflows")
        .select("nodes,edges")
        .eq("id", workflowId)
        .eq("user_id", ownerId)
        .maybeSingle();
      if (loadErr) throw new Error(loadErr.message);
      return wf as unknown as WorkflowRow | null;
    };

    try {
      await walkWorkflow({
        workflowId: data.workflowId,
        input: data.input,
        visited: new Set(),
        loadWorkflow,
        rateLimitKey: `ai:user:${ownerId}`,
        supabaseAdmin,
        onOutputNode: async (node, outputText) => {
          await runOutputSideEffects(supabaseAdmin, `notify:owner:${ownerId}`, node, outputText, {
            workflowId: data.workflowId,
            nodeId: node.id,
          });
        },
      });
      return { ok: true };
    } catch (err) {
      console.error("[public-intake] pipeline failed", {
        workflowId: data.workflowId,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("Something went wrong running this. Please try again in a moment.");
    }
  });
