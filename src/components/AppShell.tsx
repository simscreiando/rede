import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/env";
import { useAuth } from "@/hooks/useAuth";

// Shell provisório da Fase 0/2 — identidade visual definitiva é Fase 1.
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold text-lg">
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/diretrizes">Diretrizes</Link>
          {!loading && user && (
            <>
              <Link to="/perfil">Perfil</Link>
              <button type="button" onClick={() => void signOut()} className="underline">
                Sair
              </button>
            </>
          )}
          {!loading && !user && <Link to="/auth">Entrar</Link>}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
