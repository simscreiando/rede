import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Abrindo a Rede…</p>;
  }

  if (!user) {
    return (
      <div className="paper-card mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl">Esta parte é só para quem entrou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Perfis, comunidades e depoimentos não são visíveis para quem não está autenticado.
        </p>
        <Button asChild className="mt-4">
          <Link to="/auth">Entrar na Rede</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
