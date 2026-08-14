// Client Supabase de SERVIDOR baseado em cookies (via @supabase/ssr).
// Diferente de client.server.ts (que usa a service-role key e ignora RLS
// por completo), este client usa a mesma anon key do navegador e respeita
// RLS normalmente — ele só existe para poder LER a sessão do usuário a
// partir do cookie durante SSR (primeiro carregamento de uma rota,
// incluindo acesso direto por URL), quando ainda não há nenhum JS do
// cliente rodando para anexar um Bearer token.
//
// Import só em código que roda no servidor (server functions, beforeLoad
// chamado a partir de uma server function) — nunca em um componente que
// também é enviado ao bundle do navegador.
import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import type { Database } from "./types";

export function getSupabaseServerClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Configuração do Supabase ausente no servidor.");
  }

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          setCookie(cookie.name, cookie.value, cookie.options);
        });
      },
    },
  });
}
