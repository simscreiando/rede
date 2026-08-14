import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Fluxo: Google → Supabase → aqui. O @supabase/ssr usa PKCE por padrão, então
// a troca do "code" da URL por uma sessão precisa ser feita explicitamente
// aqui (exchangeCodeForSession) — diferente do fluxo implícito antigo, que
// resolvia sozinho. Depois de estabelecida a sessão, a decisão de para onde
// ir (perfil, confirmar 18+, ou acesso-restrito) é sempre feita pelo
// beforeLoad de _protected — este arquivo não duplica essa lógica, só
// garante que a sessão existe antes de navegar para lá.
export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );

      if (exchangeError) {
        setError("Não foi possível concluir a entrada com Google. Tente novamente.");
        return;
      }

      // O beforeLoad de /_protected decide o destino final (perfil,
      // confirmar-idade, ou acesso-restrito se o e-mail não estiver
      // autorizado para o closed beta).
      void navigate({ to: "/perfil" });
    })();
  }, [navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-sm px-6 py-16 text-center">
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <a href="/auth" className="text-sm underline">
          Voltar para a entrada
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16 text-center text-sm text-muted-foreground">
      Entrando…
    </div>
  );
}
