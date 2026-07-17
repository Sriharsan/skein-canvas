import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RunInput = z.object({
  prompt: z.string().min(1).max(20000),
  model: z.string().optional(),
});

/**
 * Runs a single LLM completion via the Lovable AI Gateway.
 * Public (no auth) — freelancers can experiment on the landing demo too.
 */
export const runLLMNode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this server.");
    const model = data.model || "google/gemini-3-flash-preview";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an assistant embedded inside a freelancer's workflow tool. Respond concisely and directly." },
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI error (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { text };
  });
