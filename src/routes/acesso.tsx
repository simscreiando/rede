import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockSite } from "@/lib/gate.functions";
import { APP_NAME } from "@/lib/rede";

export const Route = createFileRoute("/acesso")({
  head: () => ({
    meta: [
      { title: "Acesso restrito — Rede" },
      {
        name: "description",
        content:
          "A Rede está em fase de planejamento e aberta apenas a pessoas convidadas. Informe a senha de acesso para continuar.",
      },
      { property: "og:title", content: "Acesso restrito — Rede" },
      {
        property: "og:description",
        content: "Rede fechada em fase de planejamento: entrada apenas com senha e convite.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccessGatePage,
});

function AccessGatePage() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockSite);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await unlock({ data: { password } });
      if (!result.ok) {
        setError("Senha incorreta. Confira o convite que você recebeu.");
        return;
      }
      await navigate({ to: "/", replace: true });
    } catch {
      setError("Não foi possível verificar a senha agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="paper-card w-full max-w-md p-7">
        <p className="font-display text-3xl text-primary">{APP_NAME}</p>
        <h1 className="mt-4 text-xl">Ainda estamos arrumando a casa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A Rede está em fase de planejamento e, por enquanto, só entra quem foi convidada(o).
          Informe a senha de acesso para continuar.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="senha-site">Senha de acesso</Label>
            <Input
              id="senha-site"
              type="password"
              autoComplete="off"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Verificando…" : "Entrar na Rede"}
          </Button>
        </form>

        <p className="mt-5 text-xs text-muted-foreground">
          Depois da senha, o login por e-mail ou Google só funciona para e-mails que estejam na
          lista de convidados.
        </p>
      </div>
    </main>
  );
}
