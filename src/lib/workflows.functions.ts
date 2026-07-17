import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
