import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Concluindo o acesso — Rede" },
      {
        name: "description",
        content: "Estamos concluindo seu acesso à Rede depois do login com o Google.",
      },
      { property: "og:title", content: "Concluindo o acesso — Rede" },
      {
        property: "og:description",
        content: "Retorno do login da Rede: aguardando a sessão ficar pronta.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading, inviteBlocked } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (inviteBlocked) {
      void navigate({ to: "/auth", replace: true });
      return;
    }
    if (user) {
      void navigate({ to: "/perfil/$id", params: { id: user.id }, replace: true });
      return;
    }
    const timer = window.setTimeout(() => {
      void navigate({ to: "/auth", replace: true });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [loading, user, inviteBlocked, navigate]);

  return (
    <AppShell>
      <div className="paper-card mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl">Concluindo seu acesso…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Só um instante enquanto conferimos sua sessão e o seu convite.
        </p>
      </div>
    </AppShell>
  );
}
