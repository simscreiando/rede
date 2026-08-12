import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar na Rede — rede social nostálgica" },
      {
        name: "description",
        content:
          "Entre na Rede com sua conta Google ou e-mail. Rede social nostálgica sem algoritmo, sem ranking e sem publicidade comportamental.",
      },
      { property: "og:title", content: "Entrar na Rede" },
      {
        property: "og:description",
        content: "Acesse sua conta na Rede: perfis, comunidades e depoimentos entre amigos.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/perfil/$id", params: { id: user.id } });
    }
  }, [loading, user, navigate]);

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Não foi possível entrar com o Google agora.");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "criar") {
        if (!adult) {
          toast.error("É necessário declarar que você tem 18 anos ou mais.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Confira seu e-mail se pedirmos confirmação.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="paper-card mx-auto max-w-md p-6">
        <h1 className="text-2xl">{mode === "entrar" ? "Entrar na Rede" : "Criar uma conta"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A Rede é para maiores de 18 anos nesta primeira fase.
        </p>

        <Button
          type="button"
          variant="secondary"
          className="mt-5 w-full"
          disabled={busy}
          onClick={handleGoogle}
        >
          Continuar com o Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou com e-mail
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          {mode === "criar" ? (
            <div className="space-y-1.5">
              <Label htmlFor="nome">Como quer ser chamada(o)</Label>
              <Input
                id="nome"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome de exibição"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "criar" ? (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={adult}
                onCheckedChange={(checked) => setAdult(checked === true)}
                className="mt-0.5"
              />
              <span>
                Declaro que tenho 18 anos ou mais e li as{" "}
                <a href="/diretrizes" className="underline">
                  diretrizes de convivência
                </a>
                .
              </span>
            </label>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "entrar" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm text-primary underline"
          onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")}
        >
          {mode === "entrar" ? "Ainda não tenho conta" : "Já tenho conta"}
        </button>
      </div>
    </AppShell>
  );
}
