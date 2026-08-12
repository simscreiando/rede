import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { APP_NAME } from "@/lib/rede";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/amigos", label: "Amigos" },
  { to: "/comunidades", label: "Comunidades" },
  { to: "/configuracoes/perfil", label: "Meu perfil" },
  { to: "/configuracoes/dados", label: "Meus dados" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-paper/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="font-display text-2xl text-primary">
            {APP_NAME}
          </Link>
          {user ? (
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground font-semibold" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="ms-auto flex items-center gap-2">
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  await navigate({ to: "/" });
                }}
              >
                Sair
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-border bg-paper/70">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-5 text-xs text-muted-foreground">
          <span>
            {APP_NAME} — sem algoritmo, sem ranking, sem publicidade comportamental.
          </span>
          <nav className="ms-auto flex gap-4">
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link to="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link to="/diretrizes" className="hover:text-foreground">
              Diretrizes
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
