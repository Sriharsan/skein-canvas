import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/ai.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NOTIFY_RATE_LIMIT = 10;
const NOTIFY_WINDOW_SECONDS = 60;

const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/";

export type NotifyResult = { ok: boolean; error?: string };

type NotifyContext = { workflowId?: string; nodeId?: string };

async function sendEmailNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  rateLimitKey: string,
  to: string,
  outputText: string,
  ctx: NotifyContext,
): Promise<NotifyResult> {
  try {
    await checkRateLimit(supabaseAdmin, `notify:${rateLimitKey}`, NOTIFY_RATE_LIMIT, NOTIFY_WINDOW_SECONDS);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Rate limited." };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[notify] email not configured (missing RESEND_API_KEY)", ctx);
    return { ok: false, error: "Email isn't configured on this server." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Skein <onboarding@resend.dev>",
        to: [to],
        subject: "Your Skein workflow result",
        text: outputText,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[notify] email send failed", { ...ctx, status: res.status, body: body.slice(0, 300) });
      if (res.status === 429) return { ok: false, error: "Email provider rate limit reached. Try again shortly." };
      return { ok: false, error: "Couldn't send the email." };
    }
    return { ok: true };
  } catch (err) {
    console.error("[notify] email send threw", {
      ...ctx,
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Couldn't send the email." };
  }
}

async function sendSlackNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  rateLimitKey: string,
  webhookUrl: string,
  outputText: string,
  ctx: NotifyContext,
): Promise<NotifyResult> {
  if (!webhookUrl.startsWith(SLACK_WEBHOOK_PREFIX)) {
    return { ok: false, error: "That doesn't look like a Slack Incoming Webhook URL." };
  }
  try {
    await checkRateLimit(supabaseAdmin, `notify:${rateLimitKey}`, NOTIFY_RATE_LIMIT, NOTIFY_WINDOW_SECONDS);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Rate limited." };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*Skein workflow result*\n${outputText}` }),
    });
    const body = await res.text();
    if (!res.ok || body.trim() !== "ok") {
      console.error("[notify] slack post failed", { ...ctx, status: res.status, body: body.slice(0, 300) });
      return { ok: false, error: "Couldn't post to Slack." };
    }
    return { ok: true };
  } catch (err) {
    console.error("[notify] slack post threw", {
      ...ctx,
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Couldn't post to Slack." };
  }
}

/**
 * Fires the Output node's configured side effects (email/Slack), if any are
 * set on it. Used internally by the workflow-execution engine for both the
 * authenticated Run Workflow path and the public intake-form path — always
 * reads the values from the already-loaded node data, never from
 * unauthenticated client input.
 */
export async function runOutputSideEffects(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  rateLimitKey: string,
  node: { id: string; data?: Record<string, unknown> },
  outputText: string,
  ctx: NotifyContext,
): Promise<{ email?: NotifyResult; slack?: NotifyResult }> {
  const results: { email?: NotifyResult; slack?: NotifyResult } = {};
  const emailTo = node.data?.sendEmailTo as string | undefined;
  const slackWebhookUrl = node.data?.slackWebhookUrl as string | undefined;
  if (emailTo) {
    results.email = await sendEmailNotification(supabaseAdmin, rateLimitKey, emailTo, outputText, ctx);
  }
  if (slackWebhookUrl) {
    results.slack = await sendSlackNotification(supabaseAdmin, rateLimitKey, slackWebhookUrl, outputText, ctx);
  }
  return results;
}

/**
 * Authenticated entry point used by the canvas: sends to whatever
 * email/Slack values are currently in the node's (possibly-unsaved) editor
 * state. Only the signed-in owner can call this, and it's rate-limited per
 * user — separate from the public form's per-IP limit.
 */
export const notifyOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workflowId: z.string().uuid().optional(),
        nodeId: z.string().optional(),
        output: z.string().min(1).max(20000),
        sendEmailTo: z.string().email().optional(),
        slackWebhookUrl: z.string().url().startsWith(SLACK_WEBHOOK_PREFIX).optional(),
      })
      .refine((v) => v.sendEmailTo || v.slackWebhookUrl, "Nothing to send to.")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rateLimitKey = `user:${context.userId}`;
    const ctx = { workflowId: data.workflowId, nodeId: data.nodeId };
    const results: { email?: NotifyResult; slack?: NotifyResult } = {};
    if (data.sendEmailTo) {
      results.email = await sendEmailNotification(supabaseAdmin, rateLimitKey, data.sendEmailTo, data.output, ctx);
    }
    if (data.slackWebhookUrl) {
      results.slack = await sendSlackNotification(supabaseAdmin, rateLimitKey, data.slackWebhookUrl, data.output, ctx);
    }
    return results;
  });
