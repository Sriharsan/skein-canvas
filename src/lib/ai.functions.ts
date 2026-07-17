import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const RunInput = z.object({
  prompt: z.string().min(1).max(20000),
  workflowId: z.string().uuid().optional(),
  nodeId: z.string().optional(),
});

const RATE_LIMIT = 12;
const RATE_WINDOW_SECONDS = 60;

async function tryGetUserId(token: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data } = await client.auth.getClaims(token);
  return (data?.claims?.sub as string | undefined) ?? null;
}

/** Per-user key when authenticated, per-IP key otherwise (covers direct calls to this endpoint from the public /demo route). */
async function rateLimitKeyForRequest(): Promise<string> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const authHeader = request?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token.split(".").length === 3) {
      const userId = await tryGetUserId(token);
      if (userId) return `ai:user:${userId}`;
    }
  }
  const ip =
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip") ||
    "unknown";
  return `ai:ip:${ip}`;
}

/** Extracts the caller's IP from request headers, for endpoints that are never authenticated. */
export async function requestIp(): Promise<string> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  return (
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip") ||
    "unknown"
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkRateLimit(supabaseAdmin: SupabaseClient<any>, key: string, limit = RATE_LIMIT, windowSeconds = RATE_WINDOW_SECONDS) {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[ai.functions] rate limit check failed", { key, error: error.message });
    return; // fail open on infra errors rather than blocking every AI call
  }
  if ((data as number) > limit) {
    throw new Error("You're sending requests too quickly. Wait a moment and try again.");
  }
}

/**
 * Runs a single completion via the Gemini API. Fully server-side — the API
 * key never reaches the browser. Callers must supply their own `supabaseAdmin`
 * (imported dynamically inside their own createServerFn handler) since a
 * static or shared import of the service-role client here would pull
 * `client.server.ts` into the client bundle graph (this module ships to the
 * browser as the RPC stub for `runLLMNode`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callGemini(prompt: string, rateLimitKey: string, supabaseAdmin: SupabaseClient<any>): Promise<string> {
  await checkRateLimit(supabaseAdmin, rateLimitKey);

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI is not configured on this server.");

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are an assistant embedded inside a freelancer's workflow tool. Respond concisely and directly." }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );

  if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI error (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts as { text?: string }[] | undefined;
  return parts?.map((p) => p.text ?? "").join("") ?? "";
}

export const runLLMNode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rateLimitKey = await rateLimitKeyForRequest();
    try {
      const text = await callGemini(data.prompt, rateLimitKey, supabaseAdmin);
      return { text };
    } catch (err) {
      console.error("[ai.functions] AI call failed", {
        workflowId: data.workflowId ?? null,
        nodeId: data.nodeId ?? null,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
