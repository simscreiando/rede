// Entrega de avatar depois da correção de privacidade do Storage (migration
// 0008_storage_privacy.sql): o bucket "avatars" é privado, então não existe
// mais uma URL pública fixa para embutir num <img src>. Esta função:
//   1. confirma, com o client do PRÓPRIO usuário (respeitando RLS), que ele
//      pode ver o perfil dono do avatar (mesma regra de can_view_profile
//      usada para a linha de `profiles`);
//   2. só então usa o client de service-role para gerar uma signed URL de
//      curta duração.
// A ordem importa: a permissão é decidida ANTES de tocar em service-role,
// nunca depois — service-role nunca é usado para "decidir" quem pode ver
// o quê, só para executar a ação já autorizada.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 minutos

export const getAvatarSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string }) => ({
    profileId: String(data?.profileId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    if (!data.profileId) return { url: null };

    const { data: canView, error: canViewError } = await context.supabase.rpc(
      "check_can_view_profile",
      { _profile_id: data.profileId },
    );
    if (canViewError || !canView) {
      // Silencioso de propósito: não revela se o perfil existe ou se só o
      // avatar está indisponível — resultado igual a "sem avatar".
      return { url: null };
    }

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", data.profileId)
      .maybeSingle();

    if (profileError || !profile?.avatar_path) return { url: null };

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) return { url: null };

    return { url: signed.signedUrl };
  });
