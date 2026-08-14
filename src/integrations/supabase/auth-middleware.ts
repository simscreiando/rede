// Middleware de servidor: exige uma sessão Supabase válida (lida via cookie,
// com getClaims — nunca confiando num user_id enviado pelo cliente) antes
// de deixar uma server function seguir em frente.
//
// Reescrito depois da auditoria: a versão da Fase 0 exigia um Bearer token
// anexado manualmente pelo cliente (via auth-attacher.ts), o que só
// funciona depois que o JS do navegador já rodou — ou seja, não protegia a
// primeira renderização SSR de uma rota (acesso direto por URL). Agora usa
// o client de cookies (ssr-client.ts), que funciona igual em SSR e em
// chamadas do navegador, porque cookies são enviados automaticamente pelo
// browser em toda requisição, sem precisar de JS para anexar nada.
import { createMiddleware } from "@tanstack/react-start";
import { getSupabaseServerClient } from "./ssr-client";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      throw new Error("Não autenticado.");
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub as string,
        userEmail: (data.claims["email"] as string | undefined) ?? null,
      },
    });
  },
);
