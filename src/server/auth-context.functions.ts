// Função central de decisão de acesso — chamada pelo beforeLoad de
// src/routes/_protected.tsx. Concentra numa só função a ordem exigida pela
// spec: sessão válida → autorização de beta → confirmação de 18+.
//
// IMPORTANTE (documentado também na guia oficial do Supabase para TanStack
// Start): beforeLoad protege a EXPERIÊNCIA de navegação, não é, sozinho, o
// limite de segurança dos dados — cada server function que devolve dado
// sensível precisa continuar validando a própria sessão (é o que
// requireSupabaseAuth + as policies de RLS já fazem). O beforeLoad evita
// que a pessoa veja uma tela que não devia, mas os dados em si já estão
// protegidos numa camada mais funda independente disso.
import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/integrations/supabase/ssr-client";

export type AuthContext =
  | { status: "anonymous" }
  | { status: "beta_unauthorized" }
  | { status: "needs_adult_confirmation"; userId: string }
  | { status: "ok"; userId: string; email: string | null };

export const fetchAuthContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthContext> => {
    const supabase = getSupabaseServerClient();

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) {
      return { status: "anonymous" };
    }

    const userId = claimsData.claims.sub as string;
    const email = (claimsData.claims["email"] as string | undefined) ?? null;

    const { data: betaOk, error: betaError } = await supabase.rpc("check_my_beta_access");
    if (betaError || !betaOk) {
      return { status: "beta_unauthorized" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_adult_confirmed")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_adult_confirmed) {
      return { status: "needs_adult_confirmation", userId };
    }

    return { status: "ok", userId, email };
  },
);
