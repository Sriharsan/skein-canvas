import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      email: (context.claims as { email?: string } | null)?.email ?? null,
      displayName: data?.display_name ?? null,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ displayName: z.string().max(80).nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Delete workflows + profile first (also covered by FK cascade on auth.users)
    await supabaseAdmin.from("workflows").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
